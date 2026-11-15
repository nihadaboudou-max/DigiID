from datetime import datetime, timezone

from scripts import generer_donnees_analytiques as generateur


def test_generateur_simule_exactement_quatre_gares_et_lignes():
    gares = generateur._donnees_gares()
    lignes = generateur._donnees_lignes(gares)

    assert len(gares) == 4
    assert len(lignes) == 4
    assert all("simulé" in gare["ville"] for gare in gares)


def test_evenements_simules_sont_deterministes_et_distincts(monkeypatch):
    monkeypatch.setattr(generateur, "NOMBRE_COLIS", 24)
    maintenant = datetime(2026, 11, 15, 12, tzinfo=timezone.utc)
    gares = generateur._donnees_gares()
    lignes = generateur._donnees_lignes(gares)
    chauffeurs = [f"chauffeur-{index}" for index in range(32)]

    premier = generateur._lots_evenements(
        maintenant, gares, lignes, chauffeurs
    )
    second = generateur._lots_evenements(
        maintenant, gares, lignes, chauffeurs
    )

    evenements = [evenement for lot, _ in premier for evenement in lot]
    repetitions = [evenement for lot, _ in second for evenement in lot]
    assert len(evenements) == 24 * len(generateur.EVENEMENTS)
    assert [evenement["id"] for evenement in evenements] == [
        evenement["id"] for evenement in repetitions
    ]
    assert len({evenement["id"] for evenement in evenements}) == len(evenements)
    assert all(evenement["est_simule"] for evenement in evenements)
    assert sum(
        evenement["type_evenement"] == "livraison" for evenement in evenements
    ) == 24
