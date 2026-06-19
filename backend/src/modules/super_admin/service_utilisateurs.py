# -*- coding: utf-8 -*-
"""
Service Super Admin — Gestion de tous les utilisateurs (pas seulement les admins).

Permet au super admin de :
  - Lister tous les utilisateurs avec pagination/filtres
  - Compter les utilisateurs par statut
  - Voir les détails d'un utilisateur
  - Modifier un utilisateur (prénom, nom, ville)
  - Suspendre / Réactiver un utilisateur
  - Supprimer (soft-delete) un utilisateur
  - Supprimer définitivement (hard-delete) un utilisateur
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.constantes import RolesUtilisateur
from src.modeles import (
    JournalAudit,
    SessionAuthentification,
    Utilisateur,
)
from src.modules.super_admin.schemas_utilisateurs import (
    CreerProfilRequete,
    ListeUtilisateurs,
    NombreUtilisateurs,
    UtilisateurApercu,
)
from src.noyau import chiffrer_donnee, dechiffrer_donnee, generer_token_aleatoire, hacher_mot_de_passe, journal


# =============================================================================
# Utilitaire de hash email (SHA-256) — copié localement pour éviter les imports
# circulaires entre modules super_admin et authentification
# =============================================================================

from src.noyau.exceptions import ErreurRessourceIntrouvable, ErreurValidation
from src.noyau.journal import journal_audit


# =============================================================================
# Utilitaire de hash email (SHA-256)
# =============================================================================

def _hasher_email(email: str) -> str:
    """Hash SHA-256 de l'email — permet la recherche en base sans déchiffrer."""
    import hashlib
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


def _utilisateur_vers_apercu(u: Utilisateur) -> UtilisateurApercu:
    """Convertit une instance Utilisateur ORM en schéma de réponse."""
    return UtilisateurApercu(
        id=u.id,
        email=dechiffrer_donnee(u.email_chiffre),
        prenom=dechiffrer_donnee(u.prenom_chiffre) if u.prenom_chiffre else None,
        nom=dechiffrer_donnee(u.nom_chiffre) if u.nom_chiffre else None,
        role=u.role,
        est_actif=u.est_actif,
        est_verrouille=u.est_verrouille,
        est_supprime=u.est_supprime,
        deux_fa_active=u.deux_fa_active,
        est_email_verifie=u.est_email_verifie,
        ville=u.ville,
        score_actuel=u.score_actuel,
        date_creation=u.cree_le,
        date_derniere_connexion=u.date_derniere_connexion,
        date_verrouillage=u.date_verrouillage,
        date_suppression=u.date_suppression,
        motif_suspension=None,
        sessions_actives=0,
        roles_autorises=[],
    )


async def lister_utilisateurs(
    session: AsyncSession,
    page: int = 1,
    limite: int = 20,
    recherche: Optional[str] = None,
    role: Optional[str] = None,
    est_actif: Optional[bool] = None,
    est_verrouille: Optional[bool] = None,
    est_supprime: Optional[bool] = None,
    deux_fa_active: Optional[bool] = None,
    ville: Optional[str] = None,
    tri: str = "cree_le",
    ordre: str = "desc",
) -> ListeUtilisateurs:
    """
    Liste tous les utilisateurs avec pagination et filtres.
    
    Filtres disponibles :
      - recherche : email, nom, prénom (via hash)
      - role : filtre par rôle exact
      - est_actif / est_verrouille / est_supprime : statuts booléens
      - deux_fa_active : filtrage 2FA
      - ville : filtre textuel
    """
    # Construction de la requête
    requete = select(Utilisateur)

    # Filtres
    if recherche:
        conditions = [
            Utilisateur.ville.ilike(f"%{recherche}%"),
        ]
        # Si la recherche ressemble à un email complet, hacher et chercher exactement
        if "@" in recherche and "." in recherche:
            # Hacher l'email pour chercher exactement dans email_hash
            hash_email = _hasher_email(recherche.strip().lower())
            conditions.append(Utilisateur.email_hash == hash_email)
        else:
            conditions.append(Utilisateur.email_hash.ilike(f"%{recherche}%"))
        requete = requete.where(or_(*conditions))
    if role:
        requete = requete.where(Utilisateur.role == role)
    if est_actif is not None:
        requete = requete.where(Utilisateur.est_actif == est_actif)
    if est_verrouille is not None:
        requete = requete.where(Utilisateur.est_verrouille == est_verrouille)
    if est_supprime is not None:
        requete = requete.where(Utilisateur.est_supprime == est_supprime)
    if deux_fa_active is not None:
        requete = requete.where(Utilisateur.deux_fa_active == deux_fa_active)
    if ville:
        requete = requete.where(Utilisateur.ville.ilike(f"%{ville}%"))

    # Tri
    colonne_tri = getattr(Utilisateur, tri, Utilisateur.cree_le)
    if ordre == "asc":
        requete = requete.order_by(colonne_tri.asc())
    else:
        requete = requete.order_by(colonne_tri.desc())

    # Comptage total — construire une requête de comptage séparée
    requete_comptage = select(func.count(Utilisateur.id))
    if recherche:
        conditions_comptage = [
            Utilisateur.ville.ilike(f"%{recherche}%"),
        ]
        if "@" in recherche and "." in recherche:
            hash_email = _hasher_email(recherche.strip().lower())
            conditions_comptage.append(Utilisateur.email_hash == hash_email)
        else:
            conditions_comptage.append(Utilisateur.email_hash.ilike(f"%{recherche}%"))
        requete_comptage = requete_comptage.where(or_(*conditions_comptage))
    if role:
        requete_comptage = requete_comptage.where(Utilisateur.role == role)
    if est_actif is not None:
        requete_comptage = requete_comptage.where(Utilisateur.est_actif == est_actif)
    if est_verrouille is not None:
        requete_comptage = requete_comptage.where(Utilisateur.est_verrouille == est_verrouille)
    if est_supprime is not None:
        requete_comptage = requete_comptage.where(Utilisateur.est_supprime == est_supprime)
    if deux_fa_active is not None:
        requete_comptage = requete_comptage.where(Utilisateur.deux_fa_active == deux_fa_active)
    if ville:
        requete_comptage = requete_comptage.where(Utilisateur.ville.ilike(f"%{ville}%"))

    total = await session.scalar(requete_comptage) or 0

    # Pagination
    pages = max(1, (total + limite - 1) // limite)
    decalage = (page - 1) * limite
    requete = requete.offset(decalage).limit(limite)

    resultat = await session.execute(requete)
    utilisateurs = resultat.scalars().all()

    # Calcul des sessions actives pour chaque utilisateur
    maintenant = datetime.now(timezone.utc)
    apercus = []
    for u in utilisateurs:
        apercu = _utilisateur_vers_apercu(u)
        # Compter les sessions actives
        sessions_count = await session.scalar(
            select(func.count(SessionAuthentification.id)).where(
                SessionAuthentification.utilisateur_id == u.id,
                SessionAuthentification.est_revoquee == False,
                SessionAuthentification.date_expiration > maintenant,
            )
        ) or 0
        apercu.sessions_actives = sessions_count
        apercus.append(apercu)

    return ListeUtilisateurs(
        utilisateurs=apercus,
        total=total,
        page=page,
        pages=pages,
        limite=limite,
    )


async def compter_utilisateurs(session: AsyncSession) -> NombreUtilisateurs:
    """Retourne les compteurs globaux des utilisateurs."""
    total = await session.scalar(select(func.count(Utilisateur.id))) or 0
    actifs = await session.scalar(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.est_actif == True,
            Utilisateur.est_supprime == False,
        )
    ) or 0
    verrouilles = await session.scalar(
        select(func.count(Utilisateur.id)).where(Utilisateur.est_verrouille == True)
    ) or 0
    supprimes = await session.scalar(
        select(func.count(Utilisateur.id)).where(Utilisateur.est_supprime == True)
    ) or 0
    avec_2fa = await session.scalar(
        select(func.count(Utilisateur.id)).where(Utilisateur.deux_fa_active == True)
    ) or 0
    sans_2fa = total - avec_2fa

    return NombreUtilisateurs(
        total=total,
        actifs=actifs,
        verrouilles=verrouilles,
        supprimes=supprimes,
        avec_2fa=avec_2fa,
        sans_2fa=sans_2fa,
    )


async def obtenir_utilisateur_detail(
    session: AsyncSession,
    utilisateur_id: UUID,
) -> UtilisateurApercu:
    """Retourne les détails complets d'un utilisateur."""
    resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.id == utilisateur_id)
    )
    utilisateur = resultat.scalar_one_or_none()
    if utilisateur is None:
        raise ErreurRessourceIntrouvable(
            f"Utilisateur {utilisateur_id} introuvable",
            message_utilisateur="Utilisateur introuvable.",
        )

    maintenant = datetime.now(timezone.utc)
    apercu = _utilisateur_vers_apercu(utilisateur)
    sessions_count = await session.scalar(
        select(func.count(SessionAuthentification.id)).where(
            SessionAuthentification.utilisateur_id == utilisateur_id,
            SessionAuthentification.est_revoquee == False,
            SessionAuthentification.date_expiration > maintenant,
        )
    ) or 0
    apercu.sessions_actives = sessions_count
    return apercu


async def modifier_utilisateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    utilisateur_id: UUID,
    prenom: Optional[str] = None,
    nom: Optional[str] = None,
    ville: Optional[str] = None,
    adresse_ip: Optional[str] = None,
) -> UtilisateurApercu:
    """Modifie les informations personnelles d'un utilisateur."""
    resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.id == utilisateur_id)
    )
    utilisateur = resultat.scalar_one_or_none()
    if utilisateur is None:
        raise ErreurRessourceIntrouvable(
            f"Utilisateur {utilisateur_id} introuvable",
            message_utilisateur="Utilisateur introuvable.",
        )

    modifications = []
    if prenom is not None:
        utilisateur.prenom_chiffre = chiffrer_donnee(prenom)
        modifications.append("prénom")
    if nom is not None:
        utilisateur.nom_chiffre = chiffrer_donnee(nom)
        modifications.append("nom")
    if ville is not None:
        utilisateur.ville = ville
        modifications.append("ville")

    if not modifications:
        raise ErreurValidation(
            "Aucune donnée à modifier",
            message_utilisateur="Aucune modification fournie.",
        )

    # Audit
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="modification_utilisateur",
        description=f"Super admin a modifié l'utilisateur {utilisateur_id} : {', '.join(modifications)}",
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "utilisateur_cible_id": str(utilisateur_id),
            "champs_modifies": modifications,
        },
    )
    session.add(entree)
    journal_audit(f"modification_utilisateur | par={super_admin.id} | cible={utilisateur_id}")

    await session.commit()
    await session.refresh(utilisateur)
    return await obtenir_utilisateur_detail(session, utilisateur_id)


async def suspendre_utilisateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    utilisateur_id: UUID,
    motif: Optional[str] = None,
    adresse_ip: Optional[str] = None,
) -> UtilisateurApercu:
    """Suspend un utilisateur (ne peut plus se connecter)."""
    resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.id == utilisateur_id)
    )
    utilisateur = resultat.scalar_one_or_none()
    if utilisateur is None:
        raise ErreurRessourceIntrouvable(
            f"Utilisateur {utilisateur_id} introuvable",
            message_utilisateur="Utilisateur introuvable.",
        )

    utilisateur.est_actif = False
    utilisateur.est_verrouille = True
    utilisateur.date_verrouillage = datetime.now(timezone.utc)
    # Stocker le motif (utiliser un champ ou le journal)
    # Le motif est stocké dans le journal d'audit

    # Révoquer les sessions
    await session.execute(
        update(SessionAuthentification)
        .where(
            SessionAuthentification.utilisateur_id == utilisateur_id,
            SessionAuthentification.est_revoquee == False,
        )
        .values(
            est_revoquee=True,
            raison_revocation="suspension_par_super_admin",
        )
    )

    # Audit
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="suspension_utilisateur",
        description=f"Super admin a suspendu l'utilisateur {utilisateur_id}. Motif: {motif or 'Non spécifié'}",
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "utilisateur_cible_id": str(utilisateur_id),
            "motif": motif or "",
        },
    )
    session.add(entree)
    journal_audit(f"suspension_utilisateur | par={super_admin.id} | cible={utilisateur_id}")

    await session.commit()
    return await obtenir_utilisateur_detail(session, utilisateur_id)


async def reactiver_utilisateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    utilisateur_id: UUID,
    adresse_ip: Optional[str] = None,
) -> UtilisateurApercu:
    """Réactive un utilisateur suspendu."""
    resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.id == utilisateur_id)
    )
    utilisateur = resultat.scalar_one_or_none()
    if utilisateur is None:
        raise ErreurRessourceIntrouvable(
            f"Utilisateur {utilisateur_id} introuvable",
            message_utilisateur="Utilisateur introuvable.",
        )

    utilisateur.est_actif = True
    utilisateur.est_verrouille = False
    utilisateur.tentatives_connexion_echouees = 0
    utilisateur.date_verrouillage = None

    # Audit
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="reactivation_utilisateur",
        description=f"Super admin a réactivé l'utilisateur {utilisateur_id}",
        adresse_ip=adresse_ip,
        donnees_supplementaires={"utilisateur_cible_id": str(utilisateur_id)},
    )
    session.add(entree)
    journal_audit(f"reactivation_utilisateur | par={super_admin.id} | cible={utilisateur_id}")

    await session.commit()
    return await obtenir_utilisateur_detail(session, utilisateur_id)


async def supprimer_utilisateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    utilisateur_id: UUID,
    raison: Optional[str] = None,
    adresse_ip: Optional[str] = None,
) -> None:
    """Supprime logiquement un utilisateur (soft-delete)."""
    resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.id == utilisateur_id)
    )
    utilisateur = resultat.scalar_one_or_none()
    if utilisateur is None:
        raise ErreurRessourceIntrouvable(
            f"Utilisateur {utilisateur_id} introuvable",
            message_utilisateur="Utilisateur introuvable.",
        )

    maintenant = datetime.now(timezone.utc)
    utilisateur.est_supprime = True
    utilisateur.est_actif = False
    utilisateur.date_suppression = maintenant

    # Modifier le hash email pour permettre la réinscription (contrainte UNIQUE)
    # Modifier le hash email pour permettre la réinscription (contrainte UNIQUE DB)
    # On tronque car le champ email_hash est limité à 64 caractères
    ancien_hash = utilisateur.email_hash
    hash_prefixe = f"DEL_{utilisateur.id}"[:16]
    utilisateur.email_hash = f"{hash_prefixe}_{ancien_hash}"[:64]

    # Révoquer les sessions
    await session.execute(
        update(SessionAuthentification)
        .where(
            SessionAuthentification.utilisateur_id == utilisateur_id,
            SessionAuthentification.est_revoquee == False,
        )
        .values(
            est_revoquee=True,
            raison_revocation="suppression_compte_par_super_admin",
        )
    )

    # Audit
    entree = JournalAudit(
        date_evenement=maintenant,
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="suppression_utilisateur",
        description=f"Super admin a supprimé l'utilisateur {utilisateur_id}. Raison: {raison or 'Non spécifiée'}",
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "utilisateur_cible_id": str(utilisateur_id),
            "raison": raison or "",
        },
    )
    session.add(entree)
    journal_audit(f"suppression_utilisateur | par={super_admin.id} | cible={utilisateur_id}")

    await session.commit()


async def supprimer_definitivement_utilisateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    utilisateur_id: UUID,
    adresse_ip: Optional[str] = None,
) -> None:
    """Supprime définitivement un utilisateur (hard-delete)."""
    resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.id == utilisateur_id)
    )
    utilisateur = resultat.scalar_one_or_none()
    if utilisateur is None:
        raise ErreurRessourceIntrouvable(
            f"Utilisateur {utilisateur_id} introuvable",
            message_utilisateur="Utilisateur introuvable.",
        )

    email = dechiffrer_donnee(utilisateur.email_chiffre)

    # Supprimer les sessions associées
    await session.execute(
        update(SessionAuthentification)
        .where(SessionAuthentification.utilisateur_id == utilisateur_id)
        .values(est_revoquee=True, raison_revocation="hard_delete_par_super_admin")
    )

    # Supprimer l'utilisateur
    await session.delete(utilisateur)

    # Audit
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="suppression_definitive_utilisateur",
        description=f"Super admin a supprimé définitivement l'utilisateur {utilisateur_id} ({email})",
        adresse_ip=adresse_ip,
        donnees_supplementaires={"utilisateur_cible_id": str(utilisateur_id), "email": email},
    )
    session.add(entree)
    journal_audit(f"hard_delete_utilisateur | par={super_admin.id} | cible={utilisateur_id}")

    await session.commit()


async def creer_utilisateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    donnees: CreerProfilRequete,
    adresse_ip: Optional[str] = None,
) -> UtilisateurApercu:
    """
    Crée un utilisateur avec un rôle spécifique (hors citoyen).

    Le super admin peut créer des profils pour :
      - ong, medecin, agent, police (institutionnels)
      - administrateur, super_administrateur (administratifs)

    Les données personnelles (email, prénom, nom) sont chiffrées avant stockage.
    """
    # 1. Vérifier que l'email n'est pas déjà utilisé
    import hashlib
    email_hash = hashlib.sha256(donnees.email.strip().lower().encode()).hexdigest()
    existe = await session.execute(
        select(Utilisateur).where(
            Utilisateur.email_hash == email_hash,
            Utilisateur.est_supprime == False,
        )
    )
    if existe.scalar_one_or_none() is not None:
        raise ErreurValidation(
            f"L'email {donnees.email} est déjà utilisé",
            message_utilisateur="Un compte avec cet email existe déjà.",
        )

    # 2. Créer l'utilisateur
    mot_de_passe_hash = hacher_mot_de_passe(donnees.mot_de_passe)
    digiid = f"DIGIID-{generer_token_aleatoire(12)}"

    utilisateur = Utilisateur(
        email_hash=email_hash,
        email_chiffre=chiffrer_donnee(donnees.email),
        prenom_chiffre=chiffrer_donnee(donnees.prenom),
        nom_chiffre=chiffrer_donnee(donnees.nom),
        mot_de_passe_hash=mot_de_passe_hash,
        role=donnees.role,
        digiid=digiid,
        ville=donnees.ville or "",
        est_actif=True,
        est_email_verifie=False,
        deux_fa_active=False,
        cree_le=datetime.now(timezone.utc),
    )
    session.add(utilisateur)
    await session.flush()

    # 3. Audit
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="creation_profil",
        description=(
            f"Super admin a créé un profil {donnees.role} : "
            f"{donnees.prenom} {donnees.nom} ({donnees.email})"
        ),
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "utilisateur_cree_id": str(utilisateur.id),
            "role": donnees.role,
            "email": donnees.email,
        },
    )
    session.add(entree)
    journal_audit(f"creation_profil | par={super_admin.id} | role={donnees.role} | email={donnees.email}")

    await session.commit()
    await session.refresh(utilisateur)

    journal.info(
        f"Profil {donnees.role} créé par super_admin={super_admin.id} : "
        f"{donnees.prenom} {donnees.nom} ({donnees.email})"
    )

    return _utilisateur_vers_apercu(utilisateur)
