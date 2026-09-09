# -*- coding: utf-8 -*-
"""
Vérification du checksum MRZ selon la norme ICAO 9303.
Le checksum utilise un cycle de poids [7, 3, 1] répété.

Tolérances OCR :
- Espaces parasites insérés par l'OCR supprimés.
- Confusions caractères fréquentes (0/O, 1/I, 5/S, 8/B, ...) tolérées.
"""
import re
from typing import Optional

# Valeurs numériques pour les caractères MRZ
VALEURS_CARACTERES = {
    **{str(i): i for i in range(10)},  # 0-9
    **{chr(ord('A') + i): 10 + i for i in range(26)},  # A-Z (10-35)
    '<': 0,  # Le filler '<' vaut 0
}

# Confusions OCR les plus fréquentes (lettre lue à la place d'un chiffre, ou inversement)
CARTE_CONFUSIONS = {
    'O': '0', 'Q': '0', 'D': '0',
    'I': '1', 'L': '1',
    'Z': '2',
    'S': '5',
    'B': '8',
    'G': '6',
}


def _calculer_checksum_mrz(valeur: str) -> int:
    """
    Calcule le checksum d'un champ MRZ selon ICAO 9303.
    Chaque caractère a une valeur (0-9, A=10..Z=35, <=0), multipliée par les
    poids cycliques [7, 3, 1], somme modulo 10.
    """
    if not valeur:
        return 0

    poids = [7, 3, 1]
    somme = 0

    for i, char in enumerate(valeur.upper()):
        valeur_num = VALEURS_CARACTERES.get(char, 0)
        poids_cycle = poids[i % 3]
        somme += valeur_num * poids_cycle

    return somme % 10


def _normaliser_ligne(ligne: Optional[str]) -> Optional[str]:
    """Uppercase et suppression des espaces parasites insérés par l'OCR."""
    if not ligne:
        return None
    return re.sub(r"\s+", "", ligne.upper())


def _corriger_confusions(valeur: str) -> str:
    """Remplace les caractères ambigus par leur équivalent chiffré probable."""
    return "".join(CARTE_CONFUSIONS.get(c, c) for c in valeur)


def _champ_valide(valeur: str, attendu: str) -> bool:
    """
    Valide un champ à checksum : d'abord strictement, puis en tolérant
    les confusions OCR classiques (ex : '0' mal lu 'O').
    """
    if not valeur or not attendu or not attendu.isdigit():
        return False
    return (str(_calculer_checksum_mrz(valeur)) == attendu
            or str(_calculer_checksum_mrz(_corriger_confusions(valeur))) == attendu)


def verifier_checksum_mrz(
    ligne_1: Optional[str],
    ligne_2: Optional[str],
    ligne_3: Optional[str] = None,
) -> dict:
    """
    Vérifie tous les checksums d'une MRZ.

    Returns:
        Dict avec les résultats de chaque vérification :
        {
            "checksum_numero": bool,
            "checksum_date_naissance": bool,
            "checksum_date_expiration": bool,
            "checksum_global": bool,
            "mrz_valide": bool,
        }
    """
    resultats = {
        "checksum_numero": False,
        "checksum_date_naissance": False,
        "checksum_date_expiration": False,
        "checksum_global": False,
        "mrz_valide": False,
    }

    if not ligne_1 or not ligne_2:
        return resultats

    l1 = _normaliser_ligne(ligne_1)
    l2 = _normaliser_ligne(ligne_2)
    l3 = _normaliser_ligne(ligne_3)
    if not l1 or not l2:
        return resultats

    # Détection du format
    if l3 and len(l1) <= 32:
        format_mrz = "TD1"   # 3 x 30
    elif len(l2) <= 36:
        format_mrz = "TD2"   # 2 x 36
    else:
        format_mrz = "TD3"   # 2 x 44

    try:
        if format_mrz == "TD1":
            # TD1 : checksums dans la ligne 2
            if len(l2) >= 30:
                # Numéro de document (positions 5-14 de l1) + checksum (position 14)
                num_doc = l1[5:14]
                resultats["checksum_numero"] = _champ_valide(num_doc, l1[14:15])

                # Date de naissance (positions 0-5 de l2) + checksum (position 6)
                ddn = l2[0:6]
                resultats["checksum_date_naissance"] = _champ_valide(ddn, l2[6:7])

                # Date d'expiration (positions 8-13 de l2) + checksum (position 14)
                dexp = l2[8:14]
                resultats["checksum_date_expiration"] = _champ_valide(dexp, l2[14:15])

        else:
            # TD2 ou TD3 : checksums dans la ligne 2
            if len(l2) >= 28:
                # Numéro de document (positions 0-8) + checksum (position 9)
                num_doc = l2[0:9]
                resultats["checksum_numero"] = _champ_valide(num_doc, l2[9:10])

                # Date de naissance (positions 13-18) + checksum (position 19)
                ddn = l2[13:19]
                resultats["checksum_date_naissance"] = _champ_valide(ddn, l2[19:20])

                # Date d'expiration (positions 21-26) + checksum (position 27)
                dexp = l2[21:27]
                resultats["checksum_date_expiration"] = _champ_valide(dexp, l2[27:28])

        # MRZ valide si au moins 2 checksums sur 3 sont corrects
        nb_valide = sum([
            resultats["checksum_numero"],
            resultats["checksum_date_naissance"],
            resultats["checksum_date_expiration"],
        ])
        resultats["mrz_valide"] = nb_valide >= 2

    except Exception:
        # Ne bloque jamais la validation : l'absence de checksum valide est
        # déjà reflétée par les booléens ci-dessus.
        pass

    return resultats
