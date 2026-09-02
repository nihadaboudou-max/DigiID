# -*- coding: utf-8 -*-
"""
Vérification du checksum MRZ selon la norme ICAO 9303.
Le checksum utilise un cycle de poids [7, 3, 1] répété.
"""
from typing import Optional


# Valeurs numériques pour les caractères MRZ
VALEURS_CARACTERES = {
    **{str(i): i for i in range(10)},  # 0-9
    **{chr(ord('A') + i): 10 + i for i in range(26)},  # A-Z (10-35)
    '<': 0,  # Le filler '<' vaut 0
}


def _calculer_checksum_mrz(valeur: str) -> int:
    """
    Calcule le checksum d'un champ MRZ selon ICAO 9303.
    
    Algorithme :
    - Chaque caractère a une valeur numérique (0-9, A=10, B=11, ..., Z=35, <=0)
    - On multiplie par les poids cycliques [7, 3, 1, 7, 3, 1, ...]
    - On fait la somme modulo 10
    
    Args:
        valeur: Chaîne à valider (A-Z, 0-9, <)
    
    Returns:
        Checksum calculé (0-9)
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
    
    l1 = ligne_1.upper()
    l2 = ligne_2.upper()
    l3 = ligne_3.upper() if ligne_3 else None
    
    # Détection du format
    if l3 and len(l1) <= 32:
        # TD1 (3 × 30)
        format_mrz = "TD1"
    elif len(l2) <= 36:
        # TD2 (2 × 36)
        format_mrz = "TD2"
    else:
        # TD3 (2 × 44)
        format_mrz = "TD3"
    
    try:
        if format_mrz == "TD1":
            # TD1 : checksums dans la ligne 2
            if len(l2) >= 30:
                # Numéro de document (positions 5-14 de l1) + checksum (position 14)
                num_doc = l1[5:14]
                checksum_num_attendu = l1[14:15]
                if checksum_num_attendu.isdigit():
                    checksum_calcule = _calculer_checksum_mrz(num_doc)
                    resultats["checksum_numero"] = (str(checksum_calcule) == checksum_num_attendu)
                
                # Date de naissance (positions 0-5 de l2) + checksum (position 6)
                ddn = l2[0:6]
                checksum_ddn_attendu = l2[6:7]
                if checksum_ddn_attendu.isdigit():
                    checksum_calcule = _calculer_checksum_mrz(ddn)
                    resultats["checksum_date_naissance"] = (str(checksum_calcule) == checksum_ddn_attendu)
                
                # Date d'expiration (positions 8-13 de l2) + checksum (position 14)
                dexp = l2[8:14]
                checksum_dexp_attendu = l2[14:15]
                if checksum_dexp_attendu.isdigit():
                    checksum_calcule = _calculer_checksum_mrz(dexp)
                    resultats["checksum_date_expiration"] = (str(checksum_calcule) == checksum_dexp_attendu)
        
        else:
            # TD2 ou TD3 : checksums dans la ligne 2
            if len(l2) >= 28:
                # Numéro de document (positions 0-8) + checksum (position 9)
                num_doc = l2[0:9]
                checksum_num_attendu = l2[9:10]
                if checksum_num_attendu.isdigit():
                    checksum_calcule = _calculer_checksum_mrz(num_doc)
                    resultats["checksum_numero"] = (str(checksum_calcule) == checksum_num_attendu)
                
                # Date de naissance (positions 13-18) + checksum (position 19)
                ddn = l2[13:19]
                checksum_ddn_attendu = l2[19:20]
                if checksum_ddn_attendu.isdigit():
                    checksum_calcule = _calculer_checksum_mrz(ddn)
                    resultats["checksum_date_naissance"] = (str(checksum_calcule) == checksum_ddn_attendu)
                
                # Date d'expiration (positions 21-26) + checksum (position 27)
                dexp = l2[21:27]
                checksum_dexp_attendu = l2[27:28]
                if checksum_dexp_attendu.isdigit():
                    checksum_calcule = _calculer_checksum_mrz(dexp)
                    resultats["checksum_date_expiration"] = (str(checksum_calcule) == checksum_dexp_attendu)
        
        # MRZ valide si au moins 2 checksums sont corrects
        nb_valide = sum([
            resultats["checksum_numero"],
            resultats["checksum_date_naissance"],
            resultats["checksum_date_expiration"],
        ])
        resultats["mrz_valide"] = nb_valide >= 2
        
    except Exception as e:
        from src.noyau.journal import journal
        journal.warning(f"Erreur vérification checksum MRZ : {e}")
    
    return resultats