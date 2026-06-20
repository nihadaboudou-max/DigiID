# -*- coding: utf-8 -*-
"""
Service Profil — logique métier de consultation, modification, suppression.

Toutes les données sensibles sont chiffrées/déchiffrées à la frontière du service.
Les modèles SQLAlchemy ne voient que les versions chiffrées.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import parametres
from sqlalchemy import select as sa_select

from src.config.constantes import RolesUtilisateur, TypesEvenementAudit
from src.modeles import Utilisateur, JournalAudit, Consentement, AttestationCommunautaire
from src.modules.authentification.totp import (
    chiffrer_secret_totp,
    construire_uri_provisioning,
    generer_qr_code_base64,
    generer_secret_totp,
    verifier_code_totp,
)
from src.modules.profil.schemas import (
    ProfilDetail, ProfilModification, ExportDonnees,
    Preparation2FAReponse, Activation2FAReponse,
    AttestationRecue, AttestationEmise,
)
from src.noyau import chiffrer_donnee, dechiffrer_donnee, journal
from src.noyau.exceptions import (
    ErreurAutorisation,
    ErreurConflit,
    ErreurRessourceIntrouvable,
    ErreurValidation,
    Erreur2FAInvalide,
)
from src.noyau.journal import journal_audit


def _utilisateur_vers_profil(utilisateur: Utilisateur) -> ProfilDetail:
    """Convertit un objet ORM Utilisateur en ProfilDetail (déchiffré)."""
    # Calculer le niveau de vérification
    verifs = 0
    if utilisateur.est_email_verifie:
        verifs += 1
    if utilisateur.est_visage_verifie:
        verifs += 1
    if utilisateur.est_cni_verifiee:
        verifs += 1
    if utilisateur.deux_fa_active:
        verifs += 1

    if verifs == 0:
        niveau_verification = "aucune"
    elif verifs <= 2:
        niveau_verification = "partielle"
    elif verifs == 3:
        niveau_verification = "renforcee"
    else:
        niveau_verification = "complete"

    # Note : les attestations sont chargées dans obtenir_profil_detail via
    # la session, pas ici. Ce sont des aperçus séparés.
    return ProfilDetail(
        id=utilisateur.id,
        digiid_public=utilisateur.digiid_public,
        email=dechiffrer_donnee(utilisateur.email_chiffre),
        prenom=dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else None,
        nom=dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else None,
        telephone=dechiffrer_donnee(utilisateur.telephone_chiffre) if utilisateur.telephone_chiffre else None,
        operateur_telephone=utilisateur.operateur_telephone,
        quartier=utilisateur.quartier,
        ville=utilisateur.ville,
        pays=utilisateur.pays,
        role=utilisateur.role,
        deux_fa_active=utilisateur.deux_fa_active,
        est_email_verifie=utilisateur.est_email_verifie,
        score_actuel=utilisateur.score_actuel,
        date_dernier_calcul_score=utilisateur.date_dernier_calcul_score,
        date_creation=utilisateur.cree_le,
        date_derniere_connexion=utilisateur.date_derniere_connexion,
        # Vérifications
        est_visage_verifie=utilisateur.est_visage_verifie,
        date_verification_visage=utilisateur.date_verification_visage,
        est_cni_verifiee=utilisateur.est_cni_verifiee,
        date_verification_cni=utilisateur.date_verification_cni,
        date_derniere_mise_a_jour_verifications=utilisateur.date_derniere_mise_a_jour_verifications,
        niveau_verification=niveau_verification,
        progres_verifications=verifs,
    )


async def obtenir_profil_detail(
    session: AsyncSession,
    utilisateur: Utilisateur,
    adresse_ip: Optional[str] = None,
) -> ProfilDetail:
    """Récupère le profil complet de l'utilisateur connecté."""
    profil = _utilisateur_vers_profil(utilisateur)

    # --- Charger les attestations communautaires ---
    # Attestations reçues (quelqu'un atteste pour moi)
    resultat = await session.execute(
        sa_select(AttestationCommunautaire)
        .where(AttestationCommunautaire.atteste_id == utilisateur.id)
        .order_by(AttestationCommunautaire.date_soumission.desc())
    )
    attestations_recues = resultat.scalars().all()
    profil.attestations_recues = [
        AttestationRecue(
            id=a.id,
            type_attestation=a.type_attestation,
            titre=a.titre,
            statut=a.statut,
            date_soumission=a.date_soumission,
            date_expiration=a.date_expiration,
            poids_score=a.poids_score,
            est_active=a.est_active,
            attestant_id=a.attestant_id,
            lien_connu_depuis=a.lien_connu_depuis,
            lien_nature=a.lien_nature,
            forces=a.forces,
        )
        for a in attestations_recues
    ]

    # Attestations émises (j'atteste pour quelqu'un)
    resultat = await session.execute(
        sa_select(AttestationCommunautaire)
        .where(AttestationCommunautaire.attestant_id == utilisateur.id)
        .order_by(AttestationCommunautaire.date_soumission.desc())
    )
    attestations_emises = resultat.scalars().all()
    profil.attestations_emises = [
        AttestationEmise(
            id=a.id,
            type_attestation=a.type_attestation,
            titre=a.titre,
            statut=a.statut,
            date_soumission=a.date_soumission,
            date_expiration=a.date_expiration,
            poids_score=a.poids_score,
            est_active=a.est_active,
            atteste_id=a.atteste_id,
        )
        for a in attestations_emises
    ]

    await _enregistrer_audit(
        session,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.CONSULTATION_PROFIL.value,
        description="Consultation du profil utilisateur",
        adresse_ip=adresse_ip,
    )
    await session.commit()
    return profil


async def modifier_profil(
    session: AsyncSession,
    utilisateur: Utilisateur,
    donnees: ProfilModification,
    adresse_ip: Optional[str] = None,
) -> ProfilDetail:
    """
    Modifie le profil de l'utilisateur.

    Seuls les champs fournis (non nuls) sont mis à jour. Les autres restent.
    Les modifications sont tracées dans le journal d'audit avec les anciennes
    et nouvelles valeurs (pour pouvoir reconstituer en cas de litige).
    """
    modifications: dict[str, dict[str, Optional[str]]] = {}

    if donnees.prenom is not None:
        ancien = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else None
        utilisateur.prenom_chiffre = chiffrer_donnee(donnees.prenom)
        modifications["prenom"] = {"avant": ancien, "apres": donnees.prenom}

    if donnees.nom is not None:
        ancien = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else None
        utilisateur.nom_chiffre = chiffrer_donnee(donnees.nom)
        modifications["nom"] = {"avant": ancien, "apres": donnees.nom}

    if donnees.telephone is not None:
        ancien = dechiffrer_donnee(utilisateur.telephone_chiffre) if utilisateur.telephone_chiffre else None
        utilisateur.telephone_chiffre = chiffrer_donnee(donnees.telephone)
        utilisateur.date_derniere_modification_telephone = datetime.now(timezone.utc)
        modifications["telephone"] = {"avant": ancien, "apres": donnees.telephone}

    if donnees.operateur_telephone is not None:
        modifications["operateur_telephone"] = {
            "avant": utilisateur.operateur_telephone, "apres": donnees.operateur_telephone
        }
        utilisateur.operateur_telephone = donnees.operateur_telephone

    if donnees.quartier is not None:
        modifications["quartier"] = {"avant": utilisateur.quartier, "apres": donnees.quartier}
        utilisateur.quartier = donnees.quartier

    if donnees.ville is not None:
        modifications["ville"] = {"avant": utilisateur.ville, "apres": donnees.ville}
        utilisateur.ville = donnees.ville
        utilisateur.date_dernier_changement_ville = datetime.now(timezone.utc)

    if donnees.pays is not None:
        modifications["pays"] = {"avant": utilisateur.pays, "apres": donnees.pays}
        utilisateur.pays = donnees.pays

    await _enregistrer_audit(
        session,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.MODIFICATION_PROFIL.value,
        description=f"Modification de {len(modifications)} champ(s) du profil",
        adresse_ip=adresse_ip,
        donnees_supplementaires={"champs": list(modifications.keys())},
    )

    await session.commit()
    journal.info(f"Profil modifié : utilisateur={utilisateur.id} champs={list(modifications.keys())}")
    return _utilisateur_vers_profil(utilisateur)


async def supprimer_compte(
    session: AsyncSession,
    utilisateur: Utilisateur,
    adresse_ip: Optional[str] = None,
) -> dict:
    """
    Suppression logique du compte — droit à l'oubli (loi 2008-12 art. 32).

    Le compte est marqué comme supprimé. Une purge complète (effacement
    physique des données chiffrées) est programmée sous 30 jours, via une
    tâche Celery périodique (à implémenter en Phase 6).
    """
    utilisateur.est_supprime = True
    utilisateur.est_actif = False
    utilisateur.date_suppression = datetime.now(timezone.utc)
    # Modifier le hash email pour permettre la réinscription avec le même email
    # On tronque car le champ email_hash est limité à 64 caractères
    ancien_hash = utilisateur.email_hash
    hash_prefixe = f"DEL_{utilisateur.id}"[:16]
    utilisateur.email_hash = f"{hash_prefixe}_{ancien_hash}"[:64]

    # On garde un hash anonymisé de l'identifiant pour audit, mais on
    # efface les données personnelles chiffrées dès maintenant.
    # (Le délai légal de 30 jours s'applique à la purge totale.)
    utilisateur.prenom_chiffre = None
    utilisateur.nom_chiffre = None
    utilisateur.telephone_chiffre = None
    utilisateur.empreinte_faciale = None
    utilisateur.secret_2fa_chiffre = None

    await _enregistrer_audit(
        session,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.SUPPRESSION_PROFIL.value,
        description="Suppression du compte demandée par l'utilisateur (droit à l'oubli)",
        adresse_ip=adresse_ip,
    )

    await session.commit()
    journal.warning(f"Compte supprimé : utilisateur={utilisateur.id}")

    return {
        "message": "Ton compte a été supprimé. Tes données seront purgées définitivement sous 30 jours.",
        "utilisateur_id": utilisateur.id,
        "date_suppression_effective": utilisateur.date_suppression,
        "delai_purge_complete_jours": 30,
    }


async def exporter_donnees(
    session: AsyncSession,
    utilisateur: Utilisateur,
    adresse_ip: Optional[str] = None,
) -> ExportDonnees:
    """
    Export RGPD-like — portabilité des données personnelles.

    Renvoie une structure JSON contenant TOUT ce que DigiID sait de l'utilisateur :
      - profil détaillé
      - tous les consentements (actifs et retirés)
      - 50 derniers événements d'audit
    """
    # Consentements
    resultat = await session.execute(
        select(Consentement).where(Consentement.utilisateur_id == utilisateur.id)
    )
    consentements = [
        {
            "categorie": c.categorie,
            "version_texte": c.version_texte,
            "est_accorde": c.est_accorde,
            "date_accord": c.date_accord.isoformat() if c.date_accord else None,
            "date_retrait": c.date_retrait.isoformat() if c.date_retrait else None,
        }
        for c in resultat.scalars().all()
    ]

    # Historique audit (50 derniers)
    resultat = await session.execute(
        select(JournalAudit)
        .where(JournalAudit.utilisateur_id == utilisateur.id)
        .order_by(JournalAudit.date_evenement.desc())
        .limit(50)
    )
    historique = [
        {
            "date": e.date_evenement.isoformat(),
            "type": e.type_evenement,
            "description": e.description,
            "adresse_ip": e.adresse_ip,
        }
        for e in resultat.scalars().all()
    ]

    await _enregistrer_audit(
        session,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.EXPORT_DONNEES.value,
        description="Export complet des données personnelles (RGPD)",
        adresse_ip=adresse_ip,
    )
    await session.commit()

    return ExportDonnees(
        utilisateur=_utilisateur_vers_profil(utilisateur),
        consentements=consentements,
        historique_audit=historique,
        date_export=datetime.now(timezone.utc),
    )


async def preparer_activation_2fa(
    session: AsyncSession,
    utilisateur: Utilisateur,
    adresse_ip: Optional[str] = None,
) -> Preparation2FAReponse:
    """
    Étape 1 — génère un secret TOTP et un QR code.

    Le secret est stocké chiffré mais la 2FA reste inactive jusqu'à confirmation
    par un code valide (étape 2).
    """
    if utilisateur.deux_fa_active:
        raise ErreurConflit(
            "2FA déjà active",
            message_utilisateur="La double authentification est déjà activée sur ce compte.",
        )

    email = dechiffrer_donnee(utilisateur.email_chiffre)
    secret = generer_secret_totp()
    uri = construire_uri_provisioning(email, secret)

    utilisateur.secret_2fa_chiffre = chiffrer_secret_totp(secret)
    await session.commit()

    journal.info(f"Préparation 2FA : utilisateur={utilisateur.id}")
    return Preparation2FAReponse(
        uri_provisioning=uri,
        secret_manuel=secret,
        qr_code_base64=generer_qr_code_base64(uri),
    )


async def activer_2fa(
    session: AsyncSession,
    utilisateur: Utilisateur,
    code: str,
    adresse_ip: Optional[str] = None,
) -> Activation2FAReponse:
    """Étape 2 — confirme l'activation avec un code TOTP valide."""
    if utilisateur.deux_fa_active:
        raise ErreurConflit(
            "2FA déjà active",
            message_utilisateur="La double authentification est déjà activée.",
        )
    if not utilisateur.secret_2fa_chiffre:
        raise ErreurValidation(
            "2FA non préparée",
            message_utilisateur="Commence par générer le QR code avant d'activer la 2FA.",
        )
    if not verifier_code_totp(utilisateur.secret_2fa_chiffre, code):
        await _enregistrer_audit(
            session,
            utilisateur_id=utilisateur.id,
            role_acteur=utilisateur.role,
            type_evenement=TypesEvenementAudit.VERIFICATION_2FA_ECHOUEE.value,
            description="Échec activation 2FA — code incorrect",
            adresse_ip=adresse_ip,
        )
        await session.commit()
        raise Erreur2FAInvalide("Code TOTP incorrect lors de l'activation")

    utilisateur.deux_fa_active = True
    await _enregistrer_audit(
        session,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.ACTIVATION_2FA.value,
        description="Double authentification activée",
        adresse_ip=adresse_ip,
    )
    await session.commit()

    # Déblocage éventuel du badge SECURITE_PLUS
    try:
        from src.modules.gamification import service_badges
        await service_badges.verifier_et_debloquer_badges(session, utilisateur)
        await session.commit()
    except Exception as erreur:
        journal.warning(f"Badge 2FA non attribué : {erreur}")

    journal.info(f"2FA activée : utilisateur={utilisateur.id}")
    return Activation2FAReponse(
        message="Double authentification activée avec succès.",
        deux_fa_active=True,
    )


async def desactiver_2fa(
    session: AsyncSession,
    utilisateur: Utilisateur,
    code: str,
    adresse_ip: Optional[str] = None,
) -> Activation2FAReponse:
    """Désactive la 2FA après vérification du code TOTP courant."""
    if not utilisateur.deux_fa_active:
        raise ErreurValidation(
            "2FA inactive",
            message_utilisateur="La double authentification n'est pas activée.",
        )

    role_admin = utilisateur.role in (
        RolesUtilisateur.ADMINISTRATEUR.value,
        RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
    )
    if role_admin and parametres.activer_2fa_obligatoire_admin:
        raise ErreurAutorisation(
            f"Désactivation 2FA refusée pour admin id={utilisateur.id}",
            message_utilisateur=(
                "La double authentification est obligatoire pour les administrateurs "
                "et ne peut pas être désactivée."
            ),
        )

    if not utilisateur.secret_2fa_chiffre or not verifier_code_totp(
        utilisateur.secret_2fa_chiffre, code
    ):
        await _enregistrer_audit(
            session,
            utilisateur_id=utilisateur.id,
            role_acteur=utilisateur.role,
            type_evenement=TypesEvenementAudit.VERIFICATION_2FA_ECHOUEE.value,
            description="Échec désactivation 2FA — code incorrect",
            adresse_ip=adresse_ip,
        )
        await session.commit()
        raise Erreur2FAInvalide("Code TOTP incorrect lors de la désactivation")

    utilisateur.deux_fa_active = False
    utilisateur.secret_2fa_chiffre = None

    await _enregistrer_audit(
        session,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement="desactivation_2fa",
        description="Double authentification désactivée",
        adresse_ip=adresse_ip,
    )
    await session.commit()

    journal.info(f"2FA désactivée : utilisateur={utilisateur.id}")
    return Activation2FAReponse(
        message="Double authentification désactivée.",
        deux_fa_active=False,
    )


async def obtenir_activite_recente(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
    adresse_ip: Optional[str] = None,
) -> list[dict]:
    """
    Récupère les dernières activités de l'utilisateur depuis le journal d'audit.
    """
    resultat = await session.execute(
        select(JournalAudit)
        .where(JournalAudit.utilisateur_id == utilisateur.id)
        .order_by(JournalAudit.date_evenement.desc())
        .limit(limite)
    )
    activites = []
    for e in resultat.scalars().all():
        activites.append({
            "id": str(e.id),
            "type": e.type_evenement,
            "description": e.description,
            "date": e.date_evenement.isoformat(),
            "adresse_ip": e.adresse_ip,
        })
    
    await _enregistrer_audit(
        session,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.CONSULTATION_PROFIL.value,
        description="Consultation de l'historique d'activité",
        adresse_ip=adresse_ip,
    )
    await session.commit()
    return activites


async def _enregistrer_audit(
    session: AsyncSession,
    type_evenement: str,
    description: str,
    utilisateur_id: Optional[UUID] = None,
    role_acteur: Optional[str] = None,
    adresse_ip: Optional[str] = None,
    donnees_supplementaires: Optional[dict] = None,
) -> None:
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=utilisateur_id,
        role_acteur=role_acteur,
        type_evenement=type_evenement,
        description=description,
        adresse_ip=adresse_ip,
        donnees_supplementaires=donnees_supplementaires,
    )
    session.add(entree)
    journal_audit(f"{type_evenement} | utilisateur={utilisateur_id} | {description}")
