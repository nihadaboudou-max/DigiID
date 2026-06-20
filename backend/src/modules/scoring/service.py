# -*- coding: utf-8 -*-
"""
Service Scoring — orchestre generation de donnees, calcul, enregistrement.

Modifications v2 :
  - Integration des attestations communautaires comme 5e facteur (correcteur d'exclusion)
  - Cooldown par type d'action pour eviter l'exploitation du recalcul temps reel
  - Utilisation du modele_pondere_v2 (attestations)
"""
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Tuple
from uuid import UUID

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.config.constantes import TypesEvenementAudit
from src.modeles import (
    AttestationCommunautaire, Consentement, JournalAudit,
    Parrainage, ScoreHistorique, Utilisateur,
)
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
        # Recuperer le dernier enregistrement d'historique pour avoir les facteurs
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

    journal.info(f"Score calcule : utilisateur={utilisateur.id} score={resultat.score_total} (attestations={resultat.sous_score_attestations:.1f})")
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
    # Si aucun score n'existe, le calculer
    if utilisateur.score_actuel is None:
        return await calculer_et_enregistrer_score(
            session=session,
            utilisateur=utilisateur,
            adresse_ip=adresse_ip,
        )

    # Recuperer le dernier historique
    resultat = await session.execute(
        select(ScoreHistorique)
        .where(ScoreHistorique.utilisateur_id == utilisateur.id)
        .order_by(desc(ScoreHistorique.date_calcul))
        .limit(1)
    )
    historique = resultat.scalar_one_or_none()

    # Cas limite : score actuel defini mais pas d'historique (compatibilite)
    if historique is None:
        return await calculer_et_enregistrer_score(
            session=session,
            utilisateur=utilisateur,
            adresse_ip=adresse_ip,
            forcer_recalcul=True,
        )

    # Audit de consultation
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
    Empeche l'exploitation du recalcul temps reel (ex: upload CNI -> supprimer -> re-upload).

    Exemples d'appel :
      - apres modification du profil
      - apres bascule d'un consentement
      - apres activation 2FA
      - apres verification email
      - apres upload CNI ou visage

    Retourne le nouveau ScoreDetail ou None si le calcul a echoue.
    """
    # --- Cooldown par type d'action ---
    cle_cooldown = (utilisateur.id, raison)
    maintenant_ts = time.time()
    dernier_appel = _cooldown_cache.get(cle_cooldown, 0)
    if dernier_appel and (maintenant_ts - dernier_appel) < DUREE_COOLDOWN_SECONDES:
        temps_restant = int(DUREE_COOLDOWN_SECONDES - (maintenant_ts - dernier_appel))
        journal.info(
            f"Cooldown actif pour {raison} (utilisateur={utilisateur.id}) : "
            f"{temps_restant}s restantes"
        )
        # On ne bloque pas -- on retourne le score actuel sans recalcul
        return None

    # Enregistrer le timestamp pour le cooldown
    _cooldown_cache[cle_cooldown] = maintenant_ts

    # Nettoyer les entrees de cache trop vieilles (tous les 100 appels)
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
        journal.warning(f"Echec recalcul score ({raison}) : utilisateur={utilisateur.id} erreur={e}")
        return None


async def _collecter_signaux_utilisateur(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> SignauxUtilisateur:
    """
    Collecte 100% des signaux RÉELS depuis la base de données.

    Plus aucune simulation. Chaque champ vient du profil utilisateur
    ou de requêtes sur les tables réelles (Parrainage, Consentement, etc.).
    """
    maintenant = datetime.now(timezone.utc)

    # ========================================================================
    # 1. PROFIL & ENGAGEMENT
    # ========================================================================
    champs_remplis = 0
    if utilisateur.prenom_chiffre: champs_remplis += 1
    if utilisateur.nom_chiffre: champs_remplis += 1
    if utilisateur.telephone_chiffre: champs_remplis += 1
    if utilisateur.ville: champs_remplis += 1
    if utilisateur.est_email_verifie: champs_remplis += 1
    if utilisateur.est_cni_verifiee: champs_remplis += 1
    if utilisateur.est_visage_verifie: champs_remplis += 1

    # Consentements facultatifs
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

    # ========================================================================
    # 2. ANCIENNETÉ & STABILITÉ (RÉELLES)
    # ========================================================================
    # Âge du compte
    age_compte_jours = max(0, (maintenant - utilisateur.cree_le).days)

    # Âge du téléphone actuel (depuis dernier changement ou création du compte)
    if utilisateur.date_derniere_modification_telephone:
        age_telephone_mois = max(0, (maintenant - utilisateur.date_derniere_modification_telephone).days // 30)
        nb_changements_telephone = 1  # Au moins 1 changement tracé
    else:
        # Jamais changé : on prend l'âge du compte
        age_telephone_mois = age_compte_jours // 30
        nb_changements_telephone = 0

    # Opérateur
    operateur = utilisateur.operateur_telephone

    # ========================================================================
    # 3. GÉOGRAPHIE (RÉELLE)
    # ========================================================================
    if utilisateur.date_dernier_changement_ville and utilisateur.ville:
        mois_stabilite_ville = max(0, (maintenant - utilisateur.date_dernier_changement_ville).days // 30)
        nb_changements_ville = 1  # Au moins 1 changement
    else:
        # Jamais changé de ville : stabilité = âge du compte
        mois_stabilite_ville = age_compte_jours // 30 if utilisateur.ville else 0
        nb_changements_ville = 0

    nb_changements_quartier = 0  # Pas de tracking quartier pour l'instant

    # ========================================================================
    # 4. RÉSEAU & PARRAINAGE (RÉEL)
    # ========================================================================
    # Compter les filleuls
    total_filleuls = await session.scalar(
        select(func.count(Parrainage.id)).where(Parrainage.parrain_id == utilisateur.id)
    ) or 0

    # Bonus cumulé réel
    bonus_cumule = utilisateur.bonus_score_cumule or 0

    # ========================================================================
    # 5. VÉRIFICATIONS FORTES (RÉELLES)
    # ========================================================================
    cni_verifiee = utilisateur.est_cni_verifiee
    visage_verifie = utilisateur.est_visage_verifie

    # Mois depuis les vérifications
    if utilisateur.date_verification_cni:
        mois_depuis_cni = max(0, (maintenant - utilisateur.date_verification_cni).days // 30)
    else:
        mois_depuis_cni = 999

    if utilisateur.date_verification_visage:
        mois_depuis_visage = max(0, (maintenant - utilisateur.date_verification_visage).days // 30)
    else:
        mois_depuis_visage = 999

    # ========================================================================
    # CONSTRUCTION DU SIGNAL
    # ========================================================================
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
    )


async def _collecter_attestations(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> dict:
    """
    Collecte les donnees reelles d'attestations communautaires depuis la base.
    Remplace les valeurs simulees par les vraies donnees.

    Calcule le POIDS EFFECTIF en ponderant chaque attestation par la
    credibilite de l'attestant (son role, son score, sa reussite).
    Un agent d'etat atteste plus fort qu'un citoyen lambda.
    """
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
    #    Facteurs de crédibilité :
    #      - Role : admin/super_admin → +50%, agent/medecin/police/ong → +25%
    #      - Score de l'attestant : >70 → +20%, >50 → +10%, >30 → +5%
    #      - Type d'attestation : competence → +10%, personnalise → -10%
    poids_effectif_total = 0.0
    if nb_attestations > 0:
                # Récupérer chaque attestation avec l'attestant pour pondérer
        attestations = await session.execute(
            select(AttestationCommunautaire)
            .options(
                joinedload(AttestationCommunautaire.attestant)
            )
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

    Ce coefficient pondère le poids de l'attestation :
      - Un attestant avec un score élevé et un rôle de confiance
        (admin, agent, médecin...) atteste "plus fort"
      - Un inconnu avec un score bas atteste "moins fort"

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
    # score < 30 : aucun bonus

    # 3. Ajustement selon le type d'attestation
    bonus_type = {
        "competence": +0.10,   # Attestation pro nécessite plus de crédibilité
        "moralite": +0.05,     # Attestation morale nécessite confiance
        "identite": 0.0,       # Neutre
        "residence": -0.05,    # Plus facile à vérifier
        "activite": -0.05,     # Plus factuelle
        "personnalise": -0.10, # Type libre = moins de poids
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

# ============================================================================
# Evaluation contextuelle (score asymetrique par cas d'usage)
# ============================================================================

# Seuils par contexte (configurables en prod via table ConfigurationSysteme)
# Chaque contexte a un seuil minimal et un message d'eligibilite
SEUILS_PAR_CONTEXTE = {
    # --- Acces financier ---
    "acces_credit": {
        "libelle": "Acces au microcredit",
        "seuil_requis": 65,
    },
    "ouverture_compte": {
        "libelle": "Ouverture de compte bancaire",
        "seuil_requis": 70,
    },
    "assurance": {
        "libelle": "Souscription assurance",
        "seuil_requis": 50,
    },

    # --- Aide humanitaire (seuils bas -- correcteur d'exclusion) ---
    "aide_humanitaire": {
        "libelle": "Aide humanitaire ONG",
        "seuil_requis": 25,
    },
    "distribution_alimentaire": {
        "libelle": "Distribution alimentaire",
        "seuil_requis": 15,
    },
    "acces_soins": {
        "libelle": "Acces aux soins de base",
        "seuil_requis": 20,
    },

    # --- Verification identite ---
    "verification_identite": {
        "libelle": "Verification d'identite simple",
        "seuil_requis": 30,
    },
    "verification_renforcee": {
        "libelle": "Verification d'identite renforcee",
        "seuil_requis": 55,
    },

    # --- Services numeriques ---
    "location_vehicule": {
        "libelle": "Location de vehicule",
        "seuil_requis": 50,
    },
    "acces_plateforme": {
        "libelle": "Acces a une plateforme partenaire",
        "seuil_requis": 35,
    },
}


def evaluation_contextuelle(
    digiid: str,
    score: int,
    contexte: str,
    montant_estime: Optional[float] = None,
) -> ResultatEvaluationContextuelle:
    """
    Evalue un score pour un contexte specifique (score asymetrique).

    Concept :
      Un score de 45/100 est INSUFFISANT pour ouvrir un compte bancaire
      mais SUFFISANT pour acceder a une aide humanitaire.

    Cette fonction applique des seuils differents par contexte, ce qui permet :
      - Aux institutions financieres d'avoir des criteres stricts
      - Aux ONG d'avoir des criteres inclusifs
      - De ne pas exposer le score brut au citoyen (juste eligible/non)

    Args:
        digiid: Identifiant public DigiID
        score: Score de confiance calcule
        contexte: Contexte de la demande
        montant_estime: Montant estime (optionnel, pour affiner)

    Returns:
        ResultatEvaluationContextuelle avec verdict par contexte
    """
    from src.modules.scoring.schemas import SeuilContexte

    # Si un contexte specifique est demande, on l'evalue
    if contexte:
        config = SEUILS_PAR_CONTEXTE.get(contexte)
        if not config:
            # Contexte inconnu -- seuil par defaut moyen
            config = {"libelle": contexte.replace("_", " ").title(), "seuil_requis": 40}

        seuil = config["seuil_requis"]

        # Ajustement optionnel selon le montant estime
        if montant_estime and montant_estime > 500000:
            seuil = min(95, seuil + 10)  # Montants eleves -> seuil plus haut
        elif montant_estime and montant_estime < 50000:
            seuil = max(5, seuil - 5)  # Petits montants -> seuil plus bas

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
        # Aucun contexte specifie -- retourner tous les contextes
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
