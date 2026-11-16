"""Tests de création idempotente des vues matérialisées logistiques."""
from src.base_donnees.vues_analytiques import (
    VUES_ANALYTIQUES_LOGISTIQUES,
    synchroniser_vues_analytiques,
)


def test_synchronisation_cree_les_vues_et_index_de_facon_idempotente():
    class ConnexionCapture:
        def __init__(self):
            self.requetes = []

        def execute(self, requete):
            self.requetes.append(str(requete))

    connexion = ConnexionCapture()
    synchroniser_vues_analytiques(connexion)

    assert len(connexion.requetes) == len(VUES_ANALYTIQUES_LOGISTIQUES) * 2
    assert (
        "CREATE MATERIALIZED VIEW IF NOT EXISTS "
        "vue_incidents_par_gare_analytique"
    ) in connexion.requetes[0]
    assert (
        "CREATE MATERIALIZED VIEW IF NOT EXISTS "
        "vue_remplissage_voyages_analytique"
    ) in connexion.requetes[2]
    assert all(
        "CREATE INDEX IF NOT EXISTS" in requete
        for requete in connexion.requetes[1::2]
    )
