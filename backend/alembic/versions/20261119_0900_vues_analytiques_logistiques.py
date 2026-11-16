"""Ajoute les vues matérialisées d'analyse logistique."""
from typing import Sequence, Union

from alembic import op
from src.base_donnees.vues_analytiques import VUES_ANALYTIQUES_LOGISTIQUES


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

    for creation_vue, creation_index in VUES_ANALYTIQUES_LOGISTIQUES:
        op.execute(creation_vue)
        op.execute(creation_index)


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS vue_remplissage_voyages_analytique")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS vue_incidents_par_gare_analytique")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS vue_flux_par_ligne_analytique")
