from src.modules.logistique.service_anomalies import (
    HEURES_MINIMUM_PAR_GARE,
    detecter_indices_anormaux,
)


def test_detection_ignore_les_gares_avec_trop_peu_d_historique():
    assert detecter_indices_anormaux([(1, 1, 1)] * (HEURES_MINIMUM_PAR_GARE - 1)) == []


def test_isolation_forest_detecte_un_pic_de_scans_reproductiblement():
    observations = [(10, 8, 2)] * 30 + [(1000, 800, 20)]

    anomalies = detecter_indices_anormaux(observations)

    assert anomalies
    assert anomalies[0][0] == 30
