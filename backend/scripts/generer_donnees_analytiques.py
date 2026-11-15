# -*- coding: utf-8 -*-
"""Génère un jeu analytique simulé et idempotent de 50 000 colis.

À exécuter depuis ``backend`` après application des migrations Alembic.
"""
import asyncio
import random
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as insert_postgresql

from src.base_donnees.session import FabriqueSession
from src.modeles.analytique import (
    DimensionChauffeurAnalytique,
    DimensionDateAnalytique,
    DimensionGareAnalytique,
    DimensionLigneAnalytique,
    EvenementAnalytique,
    anonymiser_identifiant_analytique,
)

SEED_SIMULATION = 20261115
NOMBRE_COLIS = 50_000
DUREE_JOURS = 180
TAILLE_LOT = 3_000
ESPACE_UUID = uuid.UUID("88c2091e-49f7-4e49-9b90-6f7a3ba1fa45")
VILLES = ("Cotonou", "Porto-Novo", "Bohicon", "Parakou")
EVENEMENTS = ("enregistrement", "depart", "arrivee", "livraison")


def _uuid_simulation(genre: str, numero: int) -> uuid.UUID:
    return uuid.uuid5(ESPACE_UUID, f"{genre}:{numero}")


def _donnees_gares() -> list[dict]:
    return [
        {
            "gare_id": _uuid_simulation("gare", index),
            "code": f"SIM-G{index + 1}",
            "nom": f"Gare simulée {ville}",
            "ville": f"{ville} (simulé)",
            "actif": True,
        }
        for index, ville in enumerate(VILLES)
    ]


def _donnees_lignes(gares: list[dict]) -> list[dict]:
    lignes = []
    for depart in range(len(gares)):
        arrivee = (depart + 1) % len(gares)
        lignes.append(
            {
                "ligne_id": _uuid_simulation("ligne", depart),
                "gare_depart_id": gares[depart]["gare_id"],
                "gare_arrivee_id": gares[arrivee]["gare_id"],
                "distance_km": float(40 + depart * 75),
                "duree_min": 60 + depart * 45,
                "actif": True,
            }
        )
    return lignes


def _date_dimension(jour: date) -> dict:
    return {
        "date_id": jour,
        "annee": jour.year,
        "mois": jour.month,
        "jour": jour.day,
        "jour_semaine": jour.weekday(),
        "semaine_iso": jour.isocalendar().week,
        "trimestre": (jour.month - 1) // 3 + 1,
    }


def _lots_evenements(
    maintenant: datetime,
    gares: list[dict],
    lignes: list[dict],
    chauffeurs: list[str],
):
    hasard = random.Random(SEED_SIMULATION)
    lots = []
    lot = []
    dates = set()

    for colis_index in range(NOMBRE_COLIS):
        voyage_index = colis_index // 12
        ligne = lignes[voyage_index % len(lignes)]
        gare_depart = gares[voyage_index % len(gares)]
        gare_arrivee = gares[(voyage_index + 1) % len(gares)]
        chauffeur_anonyme = chauffeurs[voyage_index % len(chauffeurs)]
        colis_uuid = _uuid_simulation("colis", colis_index)
        voyage_uuid = _uuid_simulation("voyage", voyage_index)

        retard_jours = hasard.randrange(2, DUREE_JOURS)
        heure_depart = hasard.randrange(5, 23)
        depart_prevu = (
            maintenant.replace(hour=heure_depart, minute=0, second=0, microsecond=0)
            - timedelta(days=retard_jours)
        )
        livraison = depart_prevu + timedelta(hours=1 + hasard.randrange(1, 13))
        heures_evenements = (
            depart_prevu - timedelta(hours=hasard.randrange(1, 8)),
            depart_prevu,
            livraison - timedelta(minutes=hasard.randrange(15, 90)),
            livraison,
        )
        gares_evenements = (
            gare_depart,
            gare_depart,
            gare_arrivee,
            gare_arrivee,
        )

        for type_evenement, horodatage, gare in zip(
            EVENEMENTS, heures_evenements, gares_evenements
        ):
            dates.add(horodatage.date())
            lot.append(
                {
                    "id": _uuid_simulation(f"evenement:{type_evenement}", colis_index),
                    "type_evenement": type_evenement,
                    "colis_id_anonyme": anonymiser_identifiant_analytique(
                        "colis", colis_uuid
                    ),
                    "voyage_id_anonyme": anonymiser_identifiant_analytique(
                        "voyage", voyage_uuid
                    ),
                    "chauffeur_id_anonyme": chauffeur_anonyme,
                    "gare_id": gare["gare_id"],
                    "ligne_id": ligne["ligne_id"],
                    "date_id": horodatage.date(),
                    "horodatage": horodatage,
                    "depart_prevu_le": depart_prevu,
                    "est_simule": True,
                }
            )
            if len(lot) >= TAILLE_LOT:
                lots.append((lot, dates))
                lot = []
                dates = set()

    if lot:
        lots.append((lot, dates))
    return lots


async def generer_donnees_simulees() -> dict[str, int]:
    maintenant = datetime.now(timezone.utc).replace(
        minute=0, second=0, microsecond=0
    )
    gares = _donnees_gares()
    lignes = _donnees_lignes(gares)
    chauffeurs: list[str] = []
    for index in range(32):
        identifiant = _uuid_simulation("chauffeur", index)
        pseudonyme = anonymiser_identifiant_analytique("chauffeur", identifiant)
        chauffeurs.append(pseudonyme)

    async with FabriqueSession() as session:
        await session.execute(
            insert_postgresql(DimensionGareAnalytique)
            .values(gares)
            .on_conflict_do_nothing(index_elements=["gare_id"])
        )
        await session.execute(
            insert_postgresql(DimensionLigneAnalytique)
            .values(lignes)
            .on_conflict_do_nothing(index_elements=["ligne_id"])
        )
        await session.execute(
            insert_postgresql(DimensionChauffeurAnalytique)
            .values(
                [
                    {"chauffeur_id_anonyme": pseudonyme}
                    for pseudonyme in chauffeurs
                ]
            )
            .on_conflict_do_nothing(index_elements=["chauffeur_id_anonyme"])
        )

        nombre_evenements = 0
        nombre_colis = 0
        for lot, dates in _lots_evenements(maintenant, gares, lignes, chauffeurs):
            calendriers = [_date_dimension(jour) for jour in dates]
            if calendriers:
                await session.execute(
                    insert_postgresql(DimensionDateAnalytique)
                    .values(calendriers)
                    .on_conflict_do_nothing(index_elements=["date_id"])
                )
            resultat = await session.execute(
                insert_postgresql(EvenementAnalytique)
                .values(lot)
                .on_conflict_do_nothing(index_elements=["id"])
            )
            nombre_evenements += max(resultat.rowcount or 0, 0)
            nombre_colis += len({ligne["colis_id_anonyme"] for ligne in lot})

        await session.execute(
            text("REFRESH MATERIALIZED VIEW vue_flux_par_ligne_analytique")
        )
        await session.commit()

    return {
        "colis_simules": nombre_colis,
        "evenements_inseres": nombre_evenements,
        "gares_simulees": len(gares),
    }


if __name__ == "__main__":
    resultat_generation = asyncio.run(generer_donnees_simulees())
    print(
        "Simulation terminée : "
        f"{resultat_generation['colis_simules']} colis, "
        f"{resultat_generation['evenements_inseres']} événements, "
        f"{resultat_generation['gares_simulees']} gares."
    )
