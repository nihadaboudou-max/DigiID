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

from src.config.constantes import TypesEvenementAudit
from src.modeles import (
    AttestationCommunautaire, Consentement, JournalAudit,
    ScoreHistorique, Utilisateur,
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
    Tire du profil utilisateur les signaux dynamiques qui font evoluer le score.

    Plus l'utilisateur s'engage (profil rempli, consentements donnes, 2FA active),
    plus son score grimpe. C'est l'incitation visible a la completion du profil.
    """
    # 1. Completion du profil — on compte les champs renseignes
    champs_remplis = 0
    if utilisateur.prenom_chiffre: champs_remplis += 1
    if utilisateur.nom_chiffre: champs_remplis += 1
    if utilisateur.telephone_chiffre: champs_remplis += 1
    if utilisateur.ville: champs_remplis += 1
    if utilisateur.est_email_verifie: champs_remplis += 1

    # Verifications fortes d'identite
    if utilisateur.est_cni_verifiee: champs_remplis += 1
    if utilisateur.est_visage_verifie: champs_remplis += 1

    # 2. Nombre de consentements facultatifs actuellement accordes
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

    return SignauxUtilisateur(
        nombre_champs_profil_remplis=champs_remplis,
        nombre_consentements_facultatifs_accordes=nb_consentements_facultatifs,
        deux_fa_active=utilisateur.deux_fa_active,
        email_verifie=utilisateur.est_email_verifie,
    )


async def _collecter_attestations(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> dict:
    """
    Collecte les donnees reelles d'attestations communautaires depuis la base.
    Remplace les valeurs simulees par les vraies donnees.
    """
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

    stats = {
        "approuvees_recues": ligne.total or 0,
        "poids_total": float(ligne.poids_total or 0),
        "attestants_uniques": ligne.attestants or 0,
    }

    journal.debug(
        "_collecter_attestations | utilisateur=%s | recues=%s | poids=%s | uniques=%s",
        utilisateur.id,
        stats["approuvees_recues"],
        stats["poids_total"],
        stats["attestants_uniques"],
    )

    return stats


def _construire_detail(
    utilisateur: Utilisateur,
    historique: ScoreHistorique,
) -> ScoreDetail:
    """Construit la reponse ScoreDetail a partir d'un enregistrement historique."""
    niveau, interpretation = modele_pondere.interpreter_score(historique.score_total)

    facteurs = [
        FacteurScore(
            nom="anciennete_sim",
            libelle="Anciennete et stabilite SIM",
            valeur=historique.facteur_anciennete_sim,
            poids_maximum=modele_pondere.POIDS_ANCIENNETE_SIM,
            pourcentage_utilisation=round(
                historique.facteur_anciennete_sim / modele_pondere.POIDS_ANCIENNETE_SIM * 100, 1
            ),
        ),
        FacteurScore(
            nom="mobile_money",
            libelle="Regularite mobile money",
            valeur=historique.facteur_mobile_money,
            poids_maximum=modele_pondere.POIDS_MOBILE_MONEY,
            pourcentage_utilisation=round(
                historique.facteur_mobile_money / modele_pondere.POIDS_MOBILE_MONEY * 100, 1
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
            nom="reseau_contacts",
            libelle="Reseau de contacts",
            valeur=historique.facteur_reseau_contacts,
            poids_maximum=modele_pondere.POIDS_RESEAU,
            pourcentage_utilisation=round(
                historique.facteur_reseau_contacts / modele_pondere.POIDS_RESEAU * 100, 1
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
