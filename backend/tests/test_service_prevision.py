import pytest

from src.modules.logistique.service_prevision import calculer_moyennes_serie


def test_prevision_compare_moyenne_ponderee_et_moyenne_simple():
    assert calculer_moyennes_serie([0, 1, 2, 3, 4, 5, 6]) == (4.0, 3.0)


def test_prevision_refuse_une_serie_incomplete():
    with pytest.raises(ValueError, match="exactement sept jours"):
        calculer_moyennes_serie([1, 2, 3])
