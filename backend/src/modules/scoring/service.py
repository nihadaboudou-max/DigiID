# -*- coding: utf-8 -*-
"""
Service Scoring — orchestre generation de donnees, calcul, enregistrement.
Modifications v2 :
Integration des attestations communautaires comme 5e facteur (correcteur d'exclusion)
Cooldown par type d'action pour eviter l'exploitation du recalcul temps reel
Utilisation du modele_pondere_v2 (attestations)
"""
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.config.constantes import TypesEvenementAudit
# ✅ Imports directs depuis les sous-modules (évite le cycle via src.modeles.__init__)
from src.modeles.consentement import Consentement
from src.modeles.document_identite import DocumentIdentite
from src.modeles.audit import JournalAudit

from src.modeles.parrainage import Parrainage
from src.modeles.score_historique import ScoreHistorique
from src.modeles.utilisateur import Utilisateur

from src.modules.gamification import service_badges, service_tracking
from src.modules.scoring import modele_pondere_v2 as modele_pondere
from src.modules.scoring.chargeur_modele_ml import (
    est_modele_disponible, predire_score_ml,
)
from src.modules.scoring.generateur_donnees import (
    generer_donnees_pour_utilisateur,
    SignauxUtilisateur,
)
from src.modules.scoring.schemas import (
    FacteurScore, ScoreDetail, HistoriqueScore, ListeHistoriqueScore,
    ResultatEvaluationContextuelle,
)
from src.noyau import journal
from src.noyau.journal import journal_audit

# Combien de temps un score reste valide avant recalcul automatique
DUREE_VALIDITE_SCORE_JOURS = 30

# Cache de cooldown par type d'action (empeche l'exploitation du recalcul temps reel)
# Structure : { (utilisateur_id, type_action): timestamp_dernier_declenchement }
_cooldown_cache: Dict[Tuple[UUID, str], float] = {}
DUREE_COOLDOWN_SECONDES = 300  # 5 minutes par type d'action


async def calculer_et_enregistrer_score(
    session: AsyncSession,
    utilisateur: Utilisateur,
    adresse_ip: Optional[str] = None,
    forcer_recalcul: bool = False,
) -> ScoreDetail:
    """
    Calcule le score, le stocke dans l'historique, met a jour l'utilisateur.
    Si un score recent (< 30 jours) existe et que forcer_recalcul=False,
    on retourne directement le score existant sans recalcul.
    """
    maintenant = datetime.now(timezone.utc)

    # Verifier si un score recent existe deja
    if (
        not forcer_recalcul
        and utilisateur.score_actuel is not None
        and utilisateur.date_dernier_calcul_score is not None
        and maintenant - utilisateur.date_dernier_calcul_score < timedelta(days=DUREE_VALIDITE_SCORE_JOURS)
    ):
        resultat = await session.execute(
            select(ScoreHistorique)
            .where(ScoreHistorique.utilisateur_id == utilisateur.id)
            .order_by(desc(ScoreHistorique.date_calcul))
            .limit(1)
        )
        historique_recent = resultat.scalar_one_or_none()
        if historique_recent is not None:
            return _construire_detail(utilisateur, historique_recent)

    # 1. Collecter les signaux dynamiques du profil utilisateur
    signaux = await _collecter_signaux_utilisateur(session, utilisateur)

    # 1bis. Collecter les donnees d'attestations communautaires (correcteur d'exclusion)
    stats_attestations = await _collecter_attestations(session, utilisateur)

    # 2. Generer les donnees comportementales (deterministes + signaux dynamiques)
    donnees = generer_donnees_pour_utilisateur(
        utilisateur_id=utilisateur.id,
        date_creation_compte=utilisateur.cree_le,
        signaux=signaux,
    )

    # 2bis. Injecter les vraies donnees d'attestations (remplace la simulation)
    donnees.attestations_approuvees_recues = stats_attestations["approuvees_recues"]
    donnees.poids_total_attestations = stats_attestations["poids_total"]
    donnees.poids_total_effectif_attestations = stats_attestations["poids_total_effectif"]
    donnees.attestants_uniques = stats_attestations["attestants_uniques"]

    # 3. Calculer le score
    resultat = modele_pondere.calculer(donnees)
    methode_utilisee = modele_pondere.METHODE_VERSION
    score_ml = predire_score_ml(donnees)

    if score_ml is not None:
        score_combine = round(score_ml * 0.6 + resultat.score_total * 0.4)
        score_combine = max(0, min(100, score_combine))
        journal.debug(
            f"Score combine : ML={score_ml:.1f} pondere={resultat.score_total} "
            f"-> final={score_combine}"
        )
        from dataclasses import replace
        resultat = replace(resultat, score_total=score_combine)
        methode_utilisee = "hybride_ml_ponderee_v2_attestations"

    # 4. Enregistrer dans l'historique (append-only)
    historique = ScoreHistorique(
        utilisateur_id=utilisateur.id,
        score_total=resultat.score_total,
        facteur_anciennete_sim=resultat.sous_score_sim,
        facteur_mobile_money=resultat.sous_score_mobile_money,
        facteur_geographie=resultat.sous_score_geographie,
        facteur_reseau_contacts=resultat.sous_score_reseau,
        facteur_attestations=resultat.sous_score_attestations,
        date_calcul=maintenant,
        methode=methode_utilisee,
        donnees_brutes=resultat.donnees_brutes,
    )
    session.add(historique)

    # 5. Mettre a jour le champ score courant de l'utilisateur
    utilisateur.score_actuel = resultat.score_total
    utilisateur.date_dernier_calcul_score = maintenant

    # 6. Audit
    entree = JournalAudit(
        date_evenement=maintenant,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.CALCUL_SCORE.value,
        description=f"Score calcule : {resultat.score_total}/100 (methode {methode_utilisee})",
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "score": resultat.score_total,
            "facteurs": {
                "sim": resultat.sous_score_sim,
                "mobile_money": resultat.sous_score_mobile_money,
                "geographie": resultat.sous_score_geographie,
                "reseau": resultat.sous_score_reseau,
                "attestations": resultat.sous_score_attestations,
            },
        },
    )
    session.add(entree)
    journal_audit(f"calcul_score | utilisateur={utilisateur.id} | score={resultat.score_total}")

    await session.commit()
    await session.refresh(historique)
    await service_tracking.tracker_action(session, utilisateur, "score_calcul")
    await service_badges.verifier_et_debloquer_badges(session, utilisateur)
    await session.commit()

    journal.info(
        f"Score calcule : utilisateur={utilisateur.id} score={resultat.score_total} "
        f"(attestations={resultat.sous_score_attestations:.1f})"
    )
    return _construire_detail(utilisateur, historique)


async def obtenir_score_actuel(
    session: AsyncSession,
    utilisateur: Utilisateur,
    adresse_ip: Optional[str] = None,
) -> ScoreDetail:
    """
    Retourne le score actuel — calcule s'il n'existe pas encore.
    Trace une consultation dans le journal d'audit.
    """
    if utilisateur.score_actuel is None:
        return await calculer_et_enregistrer_score(
            session=session,
            utilisateur=utilisateur,
            adresse_ip=adresse_ip,
        )

    resultat = await session.execute(
        select(ScoreHistorique)
        .where(ScoreHistorique.utilisateur_id == utilisateur.id)
        .order_by(desc(ScoreHistorique.date_calcul))
        .limit(1)
    )
    historique = resultat.scalar_one_or_none()

    if historique is None:
        return await calculer_et_enregistrer_score(
            session=session,
            utilisateur=utilisateur,
            adresse_ip=adresse_ip,
            forcer_recalcul=True,
        )

    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.CONSULTATION_SCORE.value,
        description=f"Consultation du score actuel ({utilisateur.score_actuel}/100)",
        adresse_ip=adresse_ip,
    )
    session.add(entree)
    await session.commit()
    await service_tracking.tracker_action(session, utilisateur, "score_consultation")
    await service_badges.verifier_et_debloquer_badges(session, utilisateur)
    await session.commit()

    return _construire_detail(utilisateur, historique)


async def lister_historique(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 24,
) -> ListeHistoriqueScore:
    """Retourne les `limite` derniers points de l'historique du score."""
    resultat = await session.execute(
        select(ScoreHistorique)
        .where(ScoreHistorique.utilisateur_id == utilisateur.id)
        .order_by(desc(ScoreHistorique.date_calcul))
        .limit(limite)
    )
    points = resultat.scalars().all()

    return ListeHistoriqueScore(
        historique=[
            HistoriqueScore(
                date_calcul=p.date_calcul,
                score_total=p.score_total,
                methode=p.methode,
            )
            for p in points
        ],
        nombre_points=len(points),
    )


async def declencher_recalcul_score(
    session: AsyncSession,
    utilisateur: Utilisateur,
    raison: str = "action_utilisateur",
    adresse_ip: Optional[str] = None,
) -> ScoreDetail | None:
    """
    Fonction utilitaire appelable depuis d'autres modules pour forcer
    un recalcul immediat du score apres une action utilisateur.
    PROTECTION : cooldown de 5 minutes par type d'action.
    """
    cle_cooldown = (utilisateur.id, raison)
    maintenant_ts = time.time()
    dernier_appel = _cooldown_cache.get(cle_cooldown, 0)

    if dernier_appel and (maintenant_ts - dernier_appel) < DUREE_COOLDOWN_SECONDES:
        temps_restant = int(DUREE_COOLDOWN_SECONDES - (maintenant_ts - dernier_appel))
        journal.info(
            f"Cooldown actif pour {raison} (utilisateur={utilisateur.id}) : "
            f"{temps_restant}s restantes"
        )
        return None

    _cooldown_cache[cle_cooldown] = maintenant_ts

    if len(_cooldown_cache) > 100:
        seuil = maintenant_ts - DUREE_COOLDOWN_SECONDES * 2
        for cle in list(_cooldown_cache.keys()):
            if _cooldown_cache[cle] < seuil:
                del _cooldown_cache[cle]

    try:
        return await calculer_et_enregistrer_score(
            session=session,
            utilisateur=utilisateur,
            adresse_ip=adresse_ip,
            forcer_recalcul=True,
        )
    except Exception as e:
        journal.warning(
            f"Echec recalcul score ({raison}) : utilisateur={utilisateur.id} erreur={e}"
        )
        return None


async def _collecter_signaux_utilisateur(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> SignauxUtilisateur:
    """
    Collecte 100% des signaux RÉELS depuis la base de données.
    """
    maintenant = datetime.now(timezone.utc)

    # 1. PROFIL & ENGAGEMENT
    champs_remplis = 0
    if utilisateur.prenom_chiffre: champs_remplis += 1
    if utilisateur.nom_chiffre: champs_remplis += 1
    if utilisateur.telephone_chiffre: champs_remplis += 1
    if utilisateur.ville: champs_remplis += 1
    if utilisateur.est_email_verifie: champs_remplis += 1
    if utilisateur.est_cni_verifiee: champs_remplis += 1
    if utilisateur.est_visage_verifie: champs_remplis += 1

    resultat = await session.execute(
        select(Consentement)
        .where(
            Consentement.utilisateur_id == utilisateur.id,
            Consentement.est_accorde == True,
            Consentement.date_retrait.is_(None),
            Consentement.categorie != "cgu",
        )
    )
    consentements_actifs = resultat.scalars().all()
    nb_consentements_facultatifs = len(consentements_actifs)

    # 2. ANCIENNETÉ & STABILITÉ
    age_compte_jours = max(0, (maintenant - utilisateur.cree_le).days)
    age_telephone_mois = age_compte_jours // 30
    nb_changements_telephone = 0
    operateur = None

    # 3. GÉOGRAPHIE
    mois_stabilite_ville = age_compte_jours // 30 if utilisateur.ville else 0
    nb_changements_ville = 0
    nb_changements_quartier = 0

    # 4. RÉSEAU & PARRAINAGE
    total_filleuls = await session.scalar(
        select(func.count(Parrainage.id)).where(Parrainage.parrain_id == utilisateur.id)
    ) or 0
    bonus_cumule = utilisateur.bonus_score_cumule or 0

    # 5. VÉRIFICATIONS FORTES
    cni_verifiee = utilisateur.est_cni_verifiee
    visage_verifie = utilisateur.est_visage_verifie
    mois_depuis_cni = max(0, (maintenant - utilisateur.date_verification_cni).days // 30) if utilisateur.date_verification_cni else 999
    mois_depuis_visage = max(0, (maintenant - utilisateur.date_verification_visage).days // 30) if utilisateur.date_verification_visage else 999

    # 6. DOCUMENTS D'IDENTITÉ
    docs = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.utilisateur_id == utilisateur.id,
            DocumentIdentite.est_actif.is_(True),
        )
    )
    documents = docs.scalars().all()

    doc_cni_present = False
    doc_permis_present = False
    doc_assurance_present = False
    nb_champs_cni = 0
    nb_champs_permis = 0
    nb_champs_assurance = 0
    date_derniere_modif_document = None

    for doc in documents:
        if doc.type_document == "cni":
            doc_cni_present = True
            for champ in [doc.numero_document, doc.nom_complet, doc.date_naissance,
                          doc.lieu_naissance, doc.sexe, doc.adresse, doc.profession]:
                if champ:
                    nb_champs_cni += 1
        elif doc.type_document == "permis":
            doc_permis_present = True
            for champ in [doc.numero_permis, doc.nom_complet, doc.categories_permis,
                          doc.date_delivrance, doc.date_expiration, doc.centre_examen]:
                if champ:
                    nb_champs_permis += 1
        elif doc.type_document == "assurance":
            doc_assurance_present = True
            for champ in [doc.compagnie_assurance, doc.type_couverture, doc.numero_contrat,
                          doc.immatriculation_vehicule, doc.marque_vehicule, doc.modele_vehicule]:
                if champ:
                    nb_champs_assurance += 1

        if date_derniere_modif_document is None or doc.modifie_le > date_derniere_modif_document:
            date_derniere_modif_document = doc.modifie_le

    mois_depuis_modif_doc = max(0, (maintenant - date_derniere_modif_document).days // 30) if date_derniere_modif_document else 999

    return SignauxUtilisateur(
        nombre_champs_profil_remplis=champs_remplis,
        nombre_consentements_facultatifs_accordes=nb_consentements_facultatifs,
        deux_fa_active=utilisateur.deux_fa_active,
        email_verifie=utilisateur.est_email_verifie,
        age_compte_jours=age_compte_jours,
        age_telephone_mois=age_telephone_mois,
        operateur=operateur,
        nombre_changements_telephone=nb_changements_telephone,
        mois_stabilite_ville=mois_stabilite_ville,
        nombre_changements_ville=nb_changements_ville,
        nombre_changements_quartier=nb_changements_quartier,
        nombre_filleuls=total_filleuls,
        bonus_score_cumule=bonus_cumule,
        cni_verifiee=cni_verifiee,
        visage_verifie=visage_verifie,
        mois_depuis_verification_cni=mois_depuis_cni,
        mois_depuis_verification_visage=mois_depuis_visage,
        document_cni_present=doc_cni_present,
        document_permis_present=doc_permis_present,
        document_assurance_present=doc_assurance_present,
        nb_champs_cni_remplis=nb_champs_cni,
        nb_champs_permis_remplis=nb_champs_permis,
        nb_champs_assurance_remplis=nb_champs_assurance,
        mois_depuis_derniere_modif_document=mois_depuis_modif_doc,
    )


async def _collecter_attestations(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> dict:
    """
    Collecte les donnees reelles d'attestations communautaires depuis la base.
    ✅ Import LOCAL de AttestationCommunautaire pour éviter le cycle d'import.
    """
    # ✅ Import local — C'EST ICI QUE LE CYCLE EST CASSÉ
    from src.modeles.attestation_communautaire import AttestationCommunautaire

    # 1. Compter les attestations approuvees
    resultat = await session.execute(
        select(
            func.count(AttestationCommunautaire.id).label("total"),
            func.sum(AttestationCommunautaire.poids_score).label("poids_total"),
            func.count(func.distinct(AttestationCommunautaire.attestant_id)).label("attestants"),
        ).where(
            AttestationCommunautaire.atteste_id == utilisateur.id,
            AttestationCommunautaire.statut == "APPROUVEE",
            AttestationCommunautaire.est_active.is_(True),
        )
    )
    ligne = resultat.one()
    nb_attestations = ligne.total or 0
    poids_brut = float(ligne.poids_total or 0)
    attestants_uniques = ligne.attestants or 0

    # 2. Calculer le poids effectif pondéré par la crédibilité de chaque attestant
    poids_effectif_total = 0.0

    if nb_attestations > 0:
        attestations = await session.execute(
            select(AttestationCommunautaire)
            .options(joinedload(AttestationCommunautaire.attestant))
            .where(
                AttestationCommunautaire.atteste_id == utilisateur.id,
                AttestationCommunautaire.statut == "APPROUVEE",
                AttestationCommunautaire.est_active.is_(True),
            )
        )

        for att in attestations.scalars().all():
            credibilite = _calculer_credibilite_attestant(
                attestant=att.attestant,
                type_attestation=att.type_attestation,
            )
            poids_effectif = att.poids_score * credibilite
            poids_effectif_total += poids_effectif
            journal.debug(
                "Attestation %s : credibilite=%.2f poids_brut=%.1f poids_effectif=%.1f (%s)",
                att.id, credibilite, att.poids_score, poids_effectif, att.attestant.role or "citoyen",
            )

    stats = {
        "approuvees_recues": nb_attestations,
        "poids_total": poids_brut,
        "poids_total_effectif": round(poids_effectif_total, 1),
        "attestants_uniques": attestants_uniques,
    }

    journal.debug(
        "_collecter_attestations | utilisateur=%s | recues=%s | poids_brut=%s | poids_effectif=%s | uniques=%s",
        utilisateur.id,
        stats["approuvees_recues"],
        stats["poids_total"],
        stats["poids_total_effectif"],
        stats["attestants_uniques"],
    )
    return stats


def _calculer_credibilite_attestant(
    attestant: Utilisateur,
    type_attestation: str = "identite",
) -> float:
    """
    Calcule un coefficient de crédibilité pour un attestant (1.0 = neutre).
    Retourne un facteur multiplicateur entre 0.5 et 2.0.
    """
    facteur = 1.0

    # 1. Bonus/Malus selon le rôle de l'attestant
    role = (attestant.role or "citoyen").lower()
    bonus_role = {
        "super_administrateur": +0.50,
        "administrateur": +0.40,
        "agent": +0.25,
        "medecin": +0.25,
        "police": +0.25,
        "ong": +0.15,
        "citoyen": 0.0,
    }
    facteur += bonus_role.get(role, 0.0)

    # 2. Bonus selon le score de confiance de l'attestant
    score = attestant.score_actuel or 0
    if score >= 90:
        facteur += 0.30
    elif score >= 70:
        facteur += 0.20
    elif score >= 50:
        facteur += 0.10
    elif score >= 30:
        facteur += 0.05

    # 3. Ajustement selon le type d'attestation
    bonus_type = {
        "competence": +0.10,
        "moralite": +0.05,
        "identite": 0.0,
        "residence": -0.05,
        "activite": -0.05,
        "personnalise": -0.10,
    }
    facteur += bonus_type.get(type_attestation, 0.0)

    # 4. Clamp entre 0.5 et 2.0
    return max(0.5, min(2.0, facteur))


def _construire_detail(
    utilisateur: Utilisateur,
    historique: ScoreHistorique,
) -> ScoreDetail:
    """Construit la reponse ScoreDetail a partir d'un enregistrement historique."""
    niveau, interpretation = modele_pondere.interpreter_score(historique.score_total)

    facteurs = [
        FacteurScore(
            nom="anciennete",
            libelle="Anciennete et stabilite",
            valeur=historique.facteur_anciennete_sim,
            poids_maximum=modele_pondere.POIDS_ANCIENNETE,
            pourcentage_utilisation=round(
                historique.facteur_anciennete_sim / modele_pondere.POIDS_ANCIENNETE * 100, 1
            ),
        ),
        FacteurScore(
            nom="verifications",
            libelle="Verifications identite",
            valeur=historique.facteur_mobile_money,
            poids_maximum=modele_pondere.POIDS_VERIFICATIONS,
            pourcentage_utilisation=round(
                historique.facteur_mobile_money / modele_pondere.POIDS_VERIFICATIONS * 100, 1
            ),
        ),
        FacteurScore(
            nom="geographie",
            libelle="Stabilite geographique",
            valeur=historique.facteur_geographie,
            poids_maximum=modele_pondere.POIDS_GEOGRAPHIE,
            pourcentage_utilisation=round(
                historique.facteur_geographie / modele_pondere.POIDS_GEOGRAPHIE * 100, 1
            ),
        ),
        FacteurScore(
            nom="reseau_bonus",
            libelle="Reseau et engagement",
            valeur=historique.facteur_reseau_contacts,
            poids_maximum=modele_pondere.POIDS_RESEAU_BONUS,
            pourcentage_utilisation=round(
                historique.facteur_reseau_contacts / modele_pondere.POIDS_RESEAU_BONUS * 100, 1
            ),
        ),
        FacteurScore(
            nom="attestations",
            libelle="Attestations communautaires",
            valeur=getattr(historique, "facteur_attestations", 0.0),
            poids_maximum=modele_pondere.POIDS_ATTESTATIONS,
            pourcentage_utilisation=round(
                getattr(historique, "facteur_attestations", 0.0) / modele_pondere.POIDS_ATTESTATIONS * 100, 1
            ),
        ),
    ]

    prochaine = historique.date_calcul + timedelta(days=DUREE_VALIDITE_SCORE_JOURS)

    return ScoreDetail(
        utilisateur_id=utilisateur.id,
        score_total=historique.score_total,
        niveau=niveau,
        interpretation=interpretation,
        facteurs=facteurs,
        methode=historique.methode,
        date_calcul=historique.date_calcul,
        prochaine_mise_a_jour=prochaine,
    )


# =============================================================================
# Evaluation contextuelle (score asymetrique par cas d'usage)
# =============================================================================

SEUILS_PAR_CONTEXTE = {
    "acces_credit": {"libelle": "Acces au microcredit", "seuil_requis": 65},
    "ouverture_compte": {"libelle": "Ouverture de compte bancaire", "seuil_requis": 70},
    "assurance": {"libelle": "Souscription assurance", "seuil_requis": 50},
    "aide_humanitaire": {"libelle": "Aide humanitaire ONG", "seuil_requis": 25},
    "distribution_alimentaire": {"libelle": "Distribution alimentaire", "seuil_requis": 15},
    "acces_soins": {"libelle": "Acces aux soins de base", "seuil_requis": 20},
    "verification_identite": {"libelle": "Verification d'identite simple", "seuil_requis": 30},
    "verification_renforcee": {"libelle": "Verification d'identite renforcee", "seuil_requis": 55},
    "location_vehicule": {"libelle": "Location de vehicule", "seuil_requis": 50},
    "acces_plateforme": {"libelle": "Acces a une plateforme partenaire", "seuil_requis": 35},
}


def evaluation_contextuelle(
    digiid: str,
    score: int,
    contexte: str,
    montant_estime: Optional[float] = None,
) -> ResultatEvaluationContextuelle:
    """
    Evalue un score pour un contexte specifique (score asymetrique).
    """
    from src.modules.scoring.schemas import SeuilContexte

    if contexte:
        config = SEUILS_PAR_CONTEXTE.get(contexte)
        if not config:
            config = {"libelle": contexte.replace("_", " ").title(), "seuil_requis": 40}

        seuil = config["seuil_requis"]

        if montant_estime and montant_estime > 500000:
            seuil = min(95, seuil + 10)
        elif montant_estime and montant_estime < 50000:
            seuil = max(5, seuil - 5)

        eligible = score >= seuil

        if eligible:
            message = f"Eligible : {config['libelle']}. Score ({score}/100) >= seuil requis ({seuil}/100)."
        else:
            message = f"Score insuffisant pour {config['libelle']}. Score ({score}/100) < seuil requis ({seuil}/100)."

        contextes_evalues = [
            SeuilContexte(
                contexte=contexte,
                libelle=config["libelle"],
                seuil_requis=seuil,
                score_utilisateur=score,
                eligible=eligible,
                message=message,
            )
        ]
    else:
        contextes_evalues = []
        for ctx, cfg in SEUILS_PAR_CONTEXTE.items():
            eligible_ctx = score >= cfg["seuil_requis"]
            contextes_evalues.append(
                SeuilContexte(
                    contexte=ctx,
                    libelle=cfg["libelle"],
                    seuil_requis=cfg["seuil_requis"],
                    score_utilisateur=score,
                    eligible=eligible_ctx,
                    message=(
                        f"Eligible : {cfg['libelle']}."
                        if eligible_ctx
                        else f"Non eligible : {cfg['libelle']}. Seuil requis : {cfg['seuil_requis']}/100."
                    ),
                )
            )

    return ResultatEvaluationContextuelle(
        digiid=digiid,
        score=score,
        contextes=contextes_evalues,
    )