# -*- coding: utf-8 -*-
"""Détection des volumes de scans atypiques par gare et par heure."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sqlalchemy import distinct, func, select
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.analytique import (
    AlerteAnomalieScanAnalytique,
    EvenementAnalytique,
)

TYPES_EVENEMENT_SCAN = ("depart", "mise_en_transit", "arrivee", "livraison")
HEURES_MINIMUM_PAR_GARE = 24


def detecter_indices_anormaux(
    caracteristiques: list[tuple[int, int, int]],
) -> list[tuple[int, float]]:
    """Retourne les lignes atypiques et leur score, avec un résultat reproductible."""
    if len(caracteristiques) < HEURES_MINIMUM_PAR_GARE:
        return []

    donnees = np.asarray(caracteristiques, dtype=float)
    normalisees = StandardScaler().fit_transform(donnees)
    modele = IsolationForest(
        n_estimators=100,
        contamination=0.02,
        random_state=42,
        n_jobs=1,
    )
    classes = modele.fit_predict(normalisees)
    scores = -modele.decision_function(normalisees)
    return [
        (index, round(float(scores[index]), 6))
        for index, classe in enumerate(classes)
        if classe == -1
    ]


async def detecter_anomalies_scans(
    session: AsyncSession, maintenant: datetime | None = None
) -> dict[str, int]:
    """Enregistre les anomalies réelles des 24 dernières heures, sans IDs personnels."""
    maintenant = maintenant or datetime.now(timezone.utc)
    debut_historique = maintenant - timedelta(days=30)
    debut_alertes = maintenant - timedelta(hours=24)
    periode_debut = func.date_trunc("hour", EvenementAnalytique.horodatage)
    resultat = await session.execute(
        select(
            EvenementAnalytique.gare_id,
            periode_debut.label("periode_debut"),
            func.count().label("nombre_scans"),
            func.count(distinct(EvenementAnalytique.colis_id_anonyme)).label(
                "nombre_colis"
            ),
            func.count(distinct(EvenementAnalytique.chauffeur_id_anonyme)).label(
                "nombre_chauffeurs"
            ),
        )
        .where(
            EvenementAnalytique.est_simule.is_(False),
            EvenementAnalytique.type_evenement.in_(TYPES_EVENEMENT_SCAN),
            EvenementAnalytique.gare_id.is_not(None),
            EvenementAnalytique.horodatage >= debut_historique,
            EvenementAnalytique.horodatage <= maintenant,
        )
        .group_by(EvenementAnalytique.gare_id, periode_debut)
        .order_by(EvenementAnalytique.gare_id, periode_debut)
    )

    par_gare = defaultdict(list)
    for ligne in resultat.mappings():
        par_gare[ligne["gare_id"]].append(
            {
                "periode_debut": ligne["periode_debut"],
                "nombre_scans": int(ligne["nombre_scans"]),
                "nombre_colis": int(ligne["nombre_colis"]),
                "nombre_chauffeurs": int(ligne["nombre_chauffeurs"]),
            }
        )

    alertes = []
    gares_analysees = 0
    for gare_id, heures in par_gare.items():
        gares_analysees += 1
        indices = detecter_indices_anormaux(
            [
                (
                    heure["nombre_scans"],
                    heure["nombre_colis"],
                    heure["nombre_chauffeurs"],
                )
                for heure in heures
            ]
        )
        for index, score in indices:
            heure = heures[index]
            if heure["periode_debut"] < debut_alertes:
                continue
            alertes.append(
                {
                    "gare_id": gare_id,
                    "periode_debut": heure["periode_debut"],
                    "type_anomalie": "volume_scans_atypique",
                    "nombre_scans": heure["nombre_scans"],
                    "nombre_colis": heure["nombre_colis"],
                    "nombre_chauffeurs": heure["nombre_chauffeurs"],
                    "score_anomalie": score,
                }
            )

    nombre_cree = 0
    if alertes:
        requete = insert_postgresql(AlerteAnomalieScanAnalytique).values(alertes)
        resultat_insertion = await session.execute(
            requete.on_conflict_do_nothing(
                index_elements=["gare_id", "periode_debut", "type_anomalie"]
            )
        )
        nombre_cree = max(resultat_insertion.rowcount or 0, 0)
    await session.commit()
    return {"alertes_creees": nombre_cree, "gares_analysees": gares_analysees}
