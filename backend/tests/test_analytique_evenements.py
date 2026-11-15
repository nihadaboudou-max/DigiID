"""Tests de la pseudonymisation des identifiants analytiques."""
import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects import postgresql

from src.modeles.analytique import (
    _collecter_evenement_colis,
    anonymiser_identifiant_analytique,
)
from src.modeles.logistique.colis_evenement import ColisEvenement


def test_identifiants_analytiques_sont_stables_et_separes_par_type():
    identifiant = uuid.UUID("eb20f01d-856c-44de-9ab1-bbe811c4096d")

    colis = anonymiser_identifiant_analytique("colis", identifiant)
    chauffeur = anonymiser_identifiant_analytique("chauffeur", identifiant)

    assert colis is not None
    assert chauffeur is not None
    assert colis == anonymiser_identifiant_analytique("colis", identifiant)
    assert colis != chauffeur
    assert str(identifiant) not in colis
    assert str(identifiant) not in chauffeur
    assert anonymiser_identifiant_analytique("colis", None) is None


class _ResultatContexte:
    def mappings(self):
        return self

    def one_or_none(self):
        return {
            "voyage_id": uuid.UUID("0cf7bdf3-84f4-4a46-91e8-5dad7d1df8d3"),
            "chauffeur_id": uuid.UUID("9b80a017-4a7b-4ccd-a226-65abf16e67f7"),
            "ligne_id": uuid.UUID("f3f0752a-f710-4155-95e3-e3d2c10f155a"),
            "depart_prevu_le": None,
            "ligne_gare_depart_id": uuid.UUID("cb6ab371-efde-4fe9-9181-d492f279c9d4"),
            "ligne_gare_arrivee_id": uuid.UUID("001e38b0-bcc5-4cf5-95d2-485953600caa"),
            "ligne_distance_km": 120.0,
            "ligne_duree_min": 180,
            "ligne_actif": True,
            "gare_id": uuid.UUID("cb6ab371-efde-4fe9-9181-d492f279c9d4"),
            "gare_code": "COT",
            "gare_nom": "Gare de Cotonou",
            "gare_ville": "Cotonou",
            "gare_actif": True,
        }


class _ConnexionCapture:
    def __init__(self):
        self.tables_inserees = []
        self.parametres = []

    def execute(self, requete):
        if requete.is_select:
            requete.compile(dialect=postgresql.dialect())
            return _ResultatContexte()
        compilee = requete.compile(dialect=postgresql.dialect())
        self.tables_inserees.append(requete.table.name)
        self.parametres.append(compilee.params)


def test_evenement_colis_est_copie_en_analytique_sans_id_source():
    colis_id = uuid.UUID("b8e3f89f-57fb-4b19-8802-3547ab62a90d")
    voyage_id = uuid.UUID("0cf7bdf3-84f4-4a46-91e8-5dad7d1df8d3")
    chauffeur_id = uuid.UUID("9b80a017-4a7b-4ccd-a226-65abf16e67f7")
    horodatage = datetime(2026, 11, 15, 18, 0, tzinfo=timezone.utc)
    connexion = _ConnexionCapture()
    evenement = ColisEvenement(
        colis_id=colis_id,
        type_evenement="depart",
        horodatage=horodatage,
    )

    _collecter_evenement_colis(None, connexion, evenement)

    assert connexion.tables_inserees == [
        "dimension_date_analytique",
        "dimension_gare_analytique",
        "dimension_ligne_analytique",
        "dimension_chauffeur_analytique",
        "evenements_analytiques",
    ]
    fait = connexion.parametres[-1]
    assert fait["colis_id_anonyme"] == anonymiser_identifiant_analytique(
        "colis", colis_id
    )
    assert fait["voyage_id_anonyme"] == anonymiser_identifiant_analytique(
        "voyage", voyage_id
    )
    assert fait["chauffeur_id_anonyme"] == anonymiser_identifiant_analytique(
        "chauffeur", chauffeur_id
    )
    assert str(colis_id) not in str(fait)
    assert str(voyage_id) not in str(fait)
    assert str(chauffeur_id) not in str(fait)
