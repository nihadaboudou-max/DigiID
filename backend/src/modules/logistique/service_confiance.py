# -*- coding: utf-8 -*-
"""Calcul quotidien et consultation du score de confiance chauffeur."""
import math
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, delete, distinct, func, or_, select
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.analytique import (
    DimensionChauffeurAnalytique,
    EvenementAnalytique,
    ScoreConfianceChauffeurAnalytique,
    anonymiser_identifiant_analytique,
)
from src.modeles.logistique.acteur_logistique import ActeurLogistique

FENETRE_SCORE_JOURS = 30
RETENTION_HISTORIQUE_JOURS = 90
RETENTION_DETAIL_JOURS = 30
RETENTION_DETAIL_SIMULE_JOURS = 180
TOLERANCE_DEPART_SECONDES = 15 * 60
SEUIL_VERT_SCORE = 70
SEUIL_ORANGE_SCORE = 50


def _condition_purge_details(maintenant: datetime):
    """Conserve les faits synthétiques six mois, les faits réels trente jours."""
    return or_(
        and_(
            EvenementAnalytique.est_simule.is_(False),
            EvenementAnalytique.horodatage
            < maintenant - timedelta(days=RETENTION_DETAIL_JOURS),
        ),
        and_(
            EvenementAnalytique.est_simule.is_(True),
            EvenementAnalytique.horodatage
            < maintenant - timedelta(days=RETENTION_DETAIL_SIMULE_JOURS),
        ),
    )


def _niveau_score(score: int) -> str:
    if score >= SEUIL_VERT_SCORE:
        return "vert"
    if score >= SEUIL_ORANGE_SCORE:
        return "orange"
    return "rouge"


def _percentile_95(valeurs: list[int]) -> int | None:
    """Percentile empirique nearest-rank, stable et sans dépendance scientifique."""
    if not valeurs:
        return None
    triees = sorted(valeurs)
    rang = max(0, math.ceil(0.95 * len(triees)) - 1)
    return triees[rang]


def calculer_score_confiance(
    score_regularite: int | None,
    score_volume: int | None,
) -> dict[str, int | str]:
    """Applique les poids demandés; les sources absentes restent neutres à 50."""
    regularite = 50 if score_regularite is None else score_regularite
    volume = 50 if score_volume is None else score_volume
    litiges = 50
    avis = 50
    total = int(
        math.floor(
            litiges * 0.40 + regularite * 0.30 + volume * 0.20 + avis * 0.10 + 0.5
        )
    )
    return {
        "score_total": total,
        "niveau": _niveau_score(total),
        "score_litiges": litiges,
        "score_regularite": regularite,
        "score_volume": volume,
        "score_avis": avis,
    }


def _est_dans_la_tolerance(
    depart_reel: datetime, depart_prevu: datetime
) -> bool:
    if depart_reel.tzinfo is None:
        depart_reel = depart_reel.replace(tzinfo=timezone.utc)
    if depart_prevu.tzinfo is None:
        depart_prevu = depart_prevu.replace(tzinfo=timezone.utc)
    return (
        abs((depart_reel - depart_prevu).total_seconds())
        <= TOLERANCE_DEPART_SECONDES
    )


async def calculer_et_enregistrer_scores(
    session: AsyncSession,
    maintenant: datetime | None = None,
) -> dict[str, int]:
    """Calcule les scores actifs, archive les agrégats et purge les détails expirés."""
    maintenant = maintenant or datetime.now(timezone.utc)
    debut_fenetre = maintenant - timedelta(days=FENETRE_SCORE_JOURS)
    date_calcul = maintenant.date()

    utilisateurs_chauffeurs = await session.scalars(
        select(ActeurLogistique.utilisateur_id)
        .where(
            ActeurLogistique.role == "chauffeur",
            ActeurLogistique.actif.is_(True),
        )
        .distinct()
    )
    chauffeurs_anonymes = sorted(
        {
            pseudonyme
            for utilisateur_id in utilisateurs_chauffeurs.all()
            if (
                pseudonyme := anonymiser_identifiant_analytique(
                    "chauffeur", utilisateur_id
                )
            )
        }
    )

    if chauffeurs_anonymes:
        await session.execute(
            insert_postgresql(DimensionChauffeurAnalytique)
            .values(
                [
                    {"chauffeur_id_anonyme": chauffeur_id}
                    for chauffeur_id in chauffeurs_anonymes
                ]
            )
            .on_conflict_do_nothing(index_elements=["chauffeur_id_anonyme"])
        )

    volumes_resultat = await session.execute(
        select(
            EvenementAnalytique.chauffeur_id_anonyme,
            func.count(distinct(EvenementAnalytique.colis_id_anonyme)),
        )
        .where(
            EvenementAnalytique.chauffeur_id_anonyme.in_(chauffeurs_anonymes),
            EvenementAnalytique.type_evenement == "livraison",
            EvenementAnalytique.colis_id_anonyme.is_not(None),
            EvenementAnalytique.horodatage >= debut_fenetre,
            EvenementAnalytique.horodatage <= maintenant,
            EvenementAnalytique.est_simule.is_(False),
        )
        .group_by(EvenementAnalytique.chauffeur_id_anonyme)
    )
    volumes = {chauffeur_id: int(total) for chauffeur_id, total in volumes_resultat}
    percentile_volume = _percentile_95(
        [volumes.get(chauffeur_id, 0) for chauffeur_id in chauffeurs_anonymes]
    )

    departs_resultat = await session.execute(
        select(
            EvenementAnalytique.voyage_id_anonyme,
            EvenementAnalytique.chauffeur_id_anonyme,
            EvenementAnalytique.horodatage,
            EvenementAnalytique.depart_prevu_le,
        ).where(
            EvenementAnalytique.chauffeur_id_anonyme.in_(chauffeurs_anonymes),
            EvenementAnalytique.type_evenement == "voyage_en_cours",
            EvenementAnalytique.horodatage >= debut_fenetre,
            EvenementAnalytique.horodatage <= maintenant,
            EvenementAnalytique.depart_prevu_le.is_not(None),
            EvenementAnalytique.voyage_id_anonyme.is_not(None),
            EvenementAnalytique.est_simule.is_(False),
        )
        .order_by(EvenementAnalytique.horodatage, EvenementAnalytique.id)
    )
    departs_par_chauffeur: dict[str, list[tuple[datetime, datetime]]] = {}
    voyages_deja_comptes: set[str] = set()
    for voyage_id, chauffeur_id, depart_reel, depart_prevu in departs_resultat:
        if voyage_id not in voyages_deja_comptes and depart_prevu is not None:
            voyages_deja_comptes.add(voyage_id)
            departs_par_chauffeur.setdefault(chauffeur_id, []).append(
                (depart_reel, depart_prevu)
            )

    instantanes = []
    for chauffeur_id in chauffeurs_anonymes:
        departs = departs_par_chauffeur.get(chauffeur_id, [])
        nombre_depart = len(departs)
        nombre_a_lheure = sum(
            _est_dans_la_tolerance(reel, prevu) for reel, prevu in departs
        )
        score_regularite = (
            int(math.floor(nombre_a_lheure * 100 / nombre_depart + 0.5))
            if nombre_depart
            else None
        )
        nombre_colis = volumes.get(chauffeur_id, 0)
        score_volume = (
            min(100, int(math.floor(nombre_colis * 100 / percentile_volume + 0.5)))
            if percentile_volume
            else None
        )
        scores = calculer_score_confiance(score_regularite, score_volume)
        instantanes.append(
            {
                "id": uuid.uuid4(),
                "chauffeur_id_anonyme": chauffeur_id,
                "date_calcul": date_calcul,
                **scores,
                "litiges_mesures": False,
                "regularite_mesuree": nombre_depart > 0,
                "volume_mesure": percentile_volume is not None and percentile_volume > 0,
                "avis_mesures": False,
                "est_provisoire": True,
                "nombre_depart_analyse": nombre_depart,
                "nombre_depart_a_lheure": nombre_a_lheure,
                "nombre_colis_livres": nombre_colis,
                "calcule_le": maintenant,
            }
        )

    if instantanes:
        insertion_scores = insert_postgresql(
            ScoreConfianceChauffeurAnalytique
        ).values(instantanes)
        await session.execute(
            insertion_scores.on_conflict_do_update(
                index_elements=["chauffeur_id_anonyme", "date_calcul"],
                set_={
                    "score_total": insertion_scores.excluded.score_total,
                    "niveau": insertion_scores.excluded.niveau,
                    "score_litiges": insertion_scores.excluded.score_litiges,
                    "score_regularite": insertion_scores.excluded.score_regularite,
                    "score_volume": insertion_scores.excluded.score_volume,
                    "score_avis": insertion_scores.excluded.score_avis,
                    "litiges_mesures": insertion_scores.excluded.litiges_mesures,
                    "regularite_mesuree": insertion_scores.excluded.regularite_mesuree,
                    "volume_mesure": insertion_scores.excluded.volume_mesure,
                    "avis_mesures": insertion_scores.excluded.avis_mesures,
                    "est_provisoire": insertion_scores.excluded.est_provisoire,
                    "nombre_depart_analyse": insertion_scores.excluded.nombre_depart_analyse,
                    "nombre_depart_a_lheure": insertion_scores.excluded.nombre_depart_a_lheure,
                    "nombre_colis_livres": insertion_scores.excluded.nombre_colis_livres,
                    "calcule_le": insertion_scores.excluded.calcule_le,
                },
            )
        )

    await session.execute(
        select(
            func.set_config(
                "digiid.analytics_retention_purge",
                "on",
                True,
            )
        )
    )
    detail_purge = await session.execute(
        delete(EvenementAnalytique).where(_condition_purge_details(maintenant))
    )
    historique_purge = await session.execute(
        delete(ScoreConfianceChauffeurAnalytique).where(
            ScoreConfianceChauffeurAnalytique.date_calcul
            < date_calcul - timedelta(days=RETENTION_HISTORIQUE_JOURS)
        )
    )
    await session.commit()

    return {
        "chauffeurs_scores": len(instantanes),
        "details_supprimes": max(detail_purge.rowcount or 0, 0),
        "scores_supprimes": max(historique_purge.rowcount or 0, 0),
    }


async def obtenir_dernier_score(
    session: AsyncSession, utilisateur_id: uuid.UUID
) -> ScoreConfianceChauffeurAnalytique | None:
    chauffeur_id_anonyme = anonymiser_identifiant_analytique(
        "chauffeur", utilisateur_id
    )
    if chauffeur_id_anonyme is None:
        return None
    return await session.scalar(
        select(ScoreConfianceChauffeurAnalytique)
        .where(
            ScoreConfianceChauffeurAnalytique.chauffeur_id_anonyme
            == chauffeur_id_anonyme
        )
        .order_by(ScoreConfianceChauffeurAnalytique.date_calcul.desc())
        .limit(1)
    )
