# -*- coding: utf-8 -*-
"""
Service Scoring — orchestre génération de données, calcul, enregistrement.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.constantes import TypesEvenementAudit
from src.modeles import Consentement, JournalAudit, ScoreHistorique, Utilisateur
from src.modules.gamification import service_badges, service_tracking
from src.modules.scoring import modele_pondere
from src.modules.scoring.chargeur_modele_ml import (
    est_modele_disponible, predire_score_ml,
)
from src.modules.scoring.generateur_donnees import (
    generer_donnees_pour_utilisateur,
    SignauxUtilisateur,
)
from src.modules.scoring.schemas import (
    FacteurScore, ScoreDetail, HistoriqueScore, ListeHistoriqueScore,
)
from src.noyau import journal
from src.noyau.journal import journal_audit


# Combien de temps un score reste valide avant recalcul automatique
DUREE_VALIDITE_SCORE_JOURS = 30


async def calculer_et_enregistrer_score(
    session: AsyncSession,
    utilisateur: Utilisateur,
    adresse_ip: Optional[str] = None,
    forcer_recalcul: bool = False,
) -> ScoreDetail:
    """
    Calcule le score, le stocke dans l'historique, met à jour l'utilisateur.

    Si un score récent (< 30 jours) existe et que forcer_recalcul=False,
    on retourne directement le score existant sans recalcul.
    """
    maintenant = datetime.now(timezone.utc)

    # Vérifier si un score récent existe déjà
    if (
        not forcer_recalcul
        and utilisateur.score_actuel is not None
        and utilisateur.date_dernier_calcul_score is not None
        and maintenant - utilisateur.date_dernier_calcul_score < timedelta(days=DUREE_VALIDITE_SCORE_JOURS)
    ):
        # Récupérer le dernier enregistrement d'historique pour avoir les facteurs
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
    #    Ces signaux font évoluer le score au fil du temps (plus l'utilisateur
    #    remplit son profil et accorde des consentements, plus son score monte).
    signaux = await _collecter_signaux_utilisateur(session, utilisateur)

    # 2. Générer les données comportementales (déterministes + signaux dynamiques)
    donnees = generer_donnees_pour_utilisateur(
        utilisateur_id=utilisateur.id,
        date_creation_compte=utilisateur.cree_le,
        signaux=signaux,
    )

    # 3. Calculer le score
    # On utilise une approche hybride :
    #   - Le modèle pondéré (règles métier) donne la DÉCOMPOSITION par facteur
    #     (transparence et explicabilité pour l'utilisateur)
    #   - Le modèle ML entraîné (XGBoost) affine le SCORE TOTAL si disponible
    #     (précision, captures des interactions non linéaires)
    # Si le modèle ML n'est pas disponible, on utilise uniquement le pondéré.
    resultat = modele_pondere.calculer(donnees)
    methode_utilisee = modele_pondere.METHODE_VERSION

    score_ml = predire_score_ml(donnees)
    if score_ml is not None:
        # Le modèle ML est disponible — on remplace le score total par sa prédiction,
        # mais on garde les sous-scores pondérés pour la décomposition par facteur.
        # Le score total devient une moyenne pondérée 60% ML / 40% règles
        # (pour éviter les écarts trop importants entre les deux approches).
        score_combine = round(score_ml * 0.6 + resultat.score_total * 0.4)
        score_combine = max(0, min(100, score_combine))
        journal.debug(
            f"Score combiné : ML={score_ml:.1f} pondéré={resultat.score_total} "
            f"-> final={score_combine}"
        )
        # On reconstruit le résultat avec le score combiné
        from dataclasses import replace
        resultat = replace(resultat, score_total=score_combine)
        methode_utilisee = "hybride_ml_ponderee_v1"

    # 4. Enregistrer dans l'historique (append-only)
    historique = ScoreHistorique(
        utilisateur_id=utilisateur.id,
        score_total=resultat.score_total,
        facteur_anciennete_sim=resultat.sous_score_sim,
        facteur_mobile_money=resultat.sous_score_mobile_money,
        facteur_geographie=resultat.sous_score_geographie,
        facteur_reseau_contacts=resultat.sous_score_reseau,
        date_calcul=maintenant,
        methode=methode_utilisee,
        donnees_brutes=resultat.donnees_brutes,
    )
    session.add(historique)

    # 5. Mettre à jour le champ score courant de l'utilisateur
    utilisateur.score_actuel = resultat.score_total
    utilisateur.date_dernier_calcul_score = maintenant

    # 5. Audit
    entree = JournalAudit(
        date_evenement=maintenant,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.CALCUL_SCORE.value,
        description=f"Score calculé : {resultat.score_total}/100 (méthode {methode_utilisee})",
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "score": resultat.score_total,
            "facteurs": {
                "sim": resultat.sous_score_sim,
                "mobile_money": resultat.sous_score_mobile_money,
                "geographie": resultat.sous_score_geographie,
                "reseau": resultat.sous_score_reseau,
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

    journal.info(f"Score calculé : utilisateur={utilisateur.id} score={resultat.score_total}")
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

    # Récupérer le dernier historique
    resultat = await session.execute(
        select(ScoreHistorique)
        .where(ScoreHistorique.utilisateur_id == utilisateur.id)
        .order_by(desc(ScoreHistorique.date_calcul))
        .limit(1)
    )
    historique = resultat.scalar_one_or_none()

    # Cas limite : score actuel défini mais pas d'historique (compatibilité)
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
    un recalcul immédiat du score après une action utilisateur.

    Exemples d'appel :
      - après modification du profil
      - après bascule d'un consentement
      - après activation 2FA
      - après vérification email
      - après upload CNI ou visage

    Retourne le nouveau ScoreDetail ou None si le calcul a échoué.
    """
    try:
        return await calculer_et_enregistrer_score(
            session=session,
            utilisateur=utilisateur,
            adresse_ip=adresse_ip,
            forcer_recalcul=True,
        )
    except Exception as e:
        journal.warning(f"Échec recalcul score ({raison}) : utilisateur={utilisateur.id} erreur={e}")
        return None


async def _collecter_signaux_utilisateur(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> SignauxUtilisateur:
    """
    Tire du profil utilisateur les signaux dynamiques qui font évoluer le score.

    Plus l'utilisateur s'engage (profil rempli, consentements donnés, 2FA active),
    plus son score grimpe. C'est l'incitation visible à la complétion du profil.
    """
    # 1. Complétion du profil — on compte les champs renseignés
    champs_remplis = 0
    if utilisateur.prenom_chiffre: champs_remplis += 1
    if utilisateur.nom_chiffre: champs_remplis += 1
    if utilisateur.telephone_chiffre: champs_remplis += 1
    if utilisateur.ville: champs_remplis += 1
    if utilisateur.est_email_verifie: champs_remplis += 1

    # Vérifications fortes d'identité
    if utilisateur.est_cni_verifiee: champs_remplis += 1
    if utilisateur.est_visage_verifie: champs_remplis += 1

    # 2. Nombre de consentements facultatifs actuellement accordés
    # (le CGU obligatoire ne compte pas — on ne valorise que les choix volontaires)
    resultat = await session.execute(
        select(Consentement)
        .where(
            Consentement.utilisateur_id == utilisateur.id,
            Consentement.est_accorde == True,
            Consentement.date_retrait.is_(None),
            Consentement.categorie != "cgu",  # On exclut le consentement obligatoire
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


def _construire_detail(
    utilisateur: Utilisateur,
    historique: ScoreHistorique,
) -> ScoreDetail:
    """Construit la réponse ScoreDetail à partir d'un enregistrement historique."""
    niveau, interpretation = modele_pondere.interpreter_score(historique.score_total)

    facteurs = [
        FacteurScore(
            nom="anciennete_sim",
            libelle="Ancienneté & stabilité SIM",
            valeur=historique.facteur_anciennete_sim,
            poids_maximum=modele_pondere.POIDS_ANCIENNETE_SIM,
            pourcentage_utilisation=round(
                historique.facteur_anciennete_sim / modele_pondere.POIDS_ANCIENNETE_SIM * 100, 1
            ),
        ),
        FacteurScore(
            nom="mobile_money",
            libelle="Régularité mobile money",
            valeur=historique.facteur_mobile_money,
            poids_maximum=modele_pondere.POIDS_MOBILE_MONEY,
            pourcentage_utilisation=round(
                historique.facteur_mobile_money / modele_pondere.POIDS_MOBILE_MONEY * 100, 1
            ),
        ),
        FacteurScore(
            nom="geographie",
            libelle="Stabilité géographique",
            valeur=historique.facteur_geographie,
            poids_maximum=modele_pondere.POIDS_GEOGRAPHIE,
            pourcentage_utilisation=round(
                historique.facteur_geographie / modele_pondere.POIDS_GEOGRAPHIE * 100, 1
            ),
        ),
        FacteurScore(
            nom="reseau_contacts",
            libelle="Réseau de contacts",
            valeur=historique.facteur_reseau_contacts,
            poids_maximum=modele_pondere.POIDS_RESEAU,
            pourcentage_utilisation=round(
                historique.facteur_reseau_contacts / modele_pondere.POIDS_RESEAU * 100, 1
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
