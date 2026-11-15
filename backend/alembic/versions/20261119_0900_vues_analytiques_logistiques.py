"""Ajoute les vues matérialisées d'analyse logistique."""
from typing import Sequence, Union

from alembic import op


revision: str = "20261119_0900"
down_revision: Union[str, None] = "20261118_0900"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE MATERIALIZED VIEW vue_flux_par_ligne_analytique AS
        SELECT
            evenement.date_id AS jour,
            gare_depart.ville AS depart,
            gare_arrivee.ville AS arrivee,
            evenement.est_simule,
            COUNT(DISTINCT evenement.colis_id_anonyme)::INTEGER AS colis_livres
        FROM evenements_analytiques AS evenement
        JOIN dimension_ligne_analytique AS ligne
          ON ligne.ligne_id = evenement.ligne_id
        JOIN dimension_gare_analytique AS gare_depart
          ON gare_depart.gare_id = ligne.gare_depart_id
        JOIN dimension_gare_analytique AS gare_arrivee
          ON gare_arrivee.gare_id = ligne.gare_arrivee_id
        WHERE evenement.type_evenement = 'livraison'
          AND evenement.colis_id_anonyme IS NOT NULL
        GROUP BY evenement.date_id, gare_depart.ville, gare_arrivee.ville,
                 evenement.est_simule
        """
    )
    op.execute(
        """
        CREATE INDEX ix_vue_flux_ligne_jour_route
        ON vue_flux_par_ligne_analytique (est_simule, jour, depart, arrivee)
        """
    )

    op.execute(
        """
        CREATE MATERIALIZED VIEW vue_incidents_par_gare_analytique AS
        WITH incidents AS (
            SELECT
                (evenement.horodatage AT TIME ZONE 'UTC')::DATE AS jour,
                gare.nom AS gare,
                gare.ville AS ville
            FROM colis_evenements AS evenement
            JOIN gares AS gare ON gare.id = evenement.gare_id
            WHERE evenement.type_evenement = 'incident'

            UNION ALL

            SELECT
                (evenement.horodatage AT TIME ZONE 'UTC')::DATE AS jour,
                gare.nom AS gare,
                gare.ville AS ville
            FROM suivi_familial_evenements AS evenement
            JOIN gares AS gare ON gare.id = evenement.gare_id
            WHERE evenement.type_evenement = 'incident'
        )
        SELECT
            jour,
            gare,
            ville,
            COUNT(*)::INTEGER AS incidents_signales
        FROM incidents
        GROUP BY jour, gare, ville
        """
    )
    op.execute(
        """
        CREATE INDEX ix_vue_incidents_gare_jour
        ON vue_incidents_par_gare_analytique (jour, ville, gare)
        """
    )

    op.execute(
        """
        CREATE MATERIALIZED VIEW vue_remplissage_voyages_analytique AS
        WITH passagers_par_voyage AS (
            SELECT
                suivi.voyage_id,
                COUNT(*) FILTER (WHERE suivi.statut <> 'annule')::INTEGER AS passagers
            FROM suivi_familial AS suivi
            WHERE suivi.voyage_id IS NOT NULL
            GROUP BY suivi.voyage_id
        ),
        voyages AS (
            SELECT
                (voyage.date_depart AT TIME ZONE 'UTC')::DATE AS jour,
                gare_depart.ville AS depart,
                gare_arrivee.ville AS arrivee,
                vehicule.capacite,
                COALESCE(passagers.passagers, 0) AS passagers
            FROM voyages AS voyage
            JOIN lignes AS ligne ON ligne.id = voyage.ligne_id
            JOIN gares AS gare_depart ON gare_depart.id = ligne.gare_depart_id
            JOIN gares AS gare_arrivee ON gare_arrivee.id = ligne.gare_arrivee_id
            JOIN vehicules AS vehicule ON vehicule.id = voyage.vehicule_id
            LEFT JOIN passagers_par_voyage AS passagers
              ON passagers.voyage_id = voyage.id
            WHERE voyage.statut <> 'annule'
        )
        SELECT
            jour,
            depart,
            arrivee,
            COUNT(*)::INTEGER AS voyages_total,
            COUNT(*) FILTER (WHERE capacite > 0)::INTEGER AS voyages_mesurables,
            COALESCE(
                SUM(passagers) FILTER (WHERE capacite > 0),
                0
            )::INTEGER AS passagers_mesures,
            COALESCE(
                SUM(capacite) FILTER (WHERE capacite > 0),
                0
            )::INTEGER AS places_disponibles,
            ROUND(
                100.0
                * SUM(passagers) FILTER (WHERE capacite > 0)
                / NULLIF(SUM(capacite) FILTER (WHERE capacite > 0), 0),
                1
            ) AS taux_remplissage_pct
        FROM voyages
        GROUP BY jour, depart, arrivee
        """
    )
    op.execute(
        """
        CREATE INDEX ix_vue_remplissage_ligne_jour
        ON vue_remplissage_voyages_analytique (jour, depart, arrivee)
        """
    )


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS vue_remplissage_voyages_analytique")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS vue_incidents_par_gare_analytique")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS vue_flux_par_ligne_analytique")
