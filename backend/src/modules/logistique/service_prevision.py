# -*- coding: utf-8 -*-
"""Prévision journalière de la demande à partir des livraisons réelles."""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert as insert_postgresql
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.analytique import PrevisionDemandeLigneAnalytique


def calculer_moyennes_serie(demandes_journalieres: list[int]) -> tuple[float, float]:
    """Compare une moyenne récente pondérée à la moyenne simple sur sept jours."""
    if len(demandes_journalieres) != 7:
        raise ValueError("La série de demande doit contenir exactement sept jours.")
    if any(demande < 0 for demande in demandes_journalieres):
        raise ValueError("La demande journalière ne peut pas être négative.")

    moyenne_simple = sum(demandes_journalieres) / 7
    poids = range(1, 8)
    moyenne_ponderee = sum(
        demande * poids_jour
        for demande, poids_jour in zip(demandes_journalieres, poids)
    ) / sum(poids)
    return round(moyenne_ponderee, 2), round(moyenne_simple, 2)


async def calculer_previsions_demande(
    session: AsyncSession, maintenant: datetime | None = None
) -> dict[str, int]:
    """Évalue les prévisions échues, puis enregistre celles du jour par ligne."""
    maintenant = maintenant or datetime.now(timezone.utc)
    aujourd_hui = maintenant.date()
    debut_historique = aujourd_hui - timedelta(days=30)

    resultat = await session.execute(
        text(
            """
            SELECT jour, depart, arrivee, colis_livres
            FROM vue_flux_par_ligne_analytique
            WHERE est_simule IS FALSE
              AND jour >= :debut
              AND jour < :aujourd_hui
            """
        ),
        {"debut": debut_historique, "aujourd_hui": aujourd_hui},
    )
    demandes: dict[tuple[date, str, str], int] = {}
    routes: set[tuple[str, str]] = set()
    for ligne in resultat.mappings():
        cle = (ligne["jour"], ligne["depart"], ligne["arrivee"])
        demandes[cle] = int(ligne["colis_livres"])
        routes.add((ligne["depart"], ligne["arrivee"]))

    predictions_echues = list(
        await session.scalars(
            select(PrevisionDemandeLigneAnalytique).where(
                PrevisionDemandeLigneAnalytique.date_prevue >= debut_historique,
                PrevisionDemandeLigneAnalytique.date_prevue < aujourd_hui,
            )
        )
    )
    evaluations = 0
    for prediction in predictions_echues:
        demande_reelle = demandes.get(
            (prediction.date_prevue, prediction.depart, prediction.arrivee), 0
        )
        prediction.demande_reelle = demande_reelle
        prediction.erreur_absolue = round(
            abs(prediction.demande_prevue - demande_reelle), 2
        )
        prediction.erreur_moyenne_simple = round(
            abs(prediction.moyenne_simple - demande_reelle), 2
        )
        evaluations += 1

    lignes_a_inserer = []
    for depart, arrivee in routes:
        serie = [
            demandes.get((aujourd_hui - timedelta(days=jour), depart, arrivee), 0)
            for jour in range(7, 0, -1)
        ]
        demande_prevue, moyenne_simple = calculer_moyennes_serie(serie)
        lignes_a_inserer.append(
            {
                "date_prevue": aujourd_hui,
                "depart": depart,
                "arrivee": arrivee,
                "demande_prevue": demande_prevue,
                "moyenne_simple": moyenne_simple,
                "calcule_le": maintenant,
            }
        )

    if lignes_a_inserer:
        requete = insert_postgresql(PrevisionDemandeLigneAnalytique).values(
            lignes_a_inserer
        )
        await session.execute(
            requete.on_conflict_do_update(
                index_elements=["date_prevue", "depart", "arrivee"],
                set_={
                    "demande_prevue": requete.excluded.demande_prevue,
                    "moyenne_simple": requete.excluded.moyenne_simple,
                    "calcule_le": requete.excluded.calcule_le,
                },
            )
        )

    await session.execute(
        delete(PrevisionDemandeLigneAnalytique).where(
            PrevisionDemandeLigneAnalytique.date_prevue
            < aujourd_hui - timedelta(days=90)
        )
    )
    await session.commit()
    return {
        "previsions_calculees": len(lignes_a_inserer),
        "previsions_evaluees": evaluations,
    }
