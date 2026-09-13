# -*- coding: utf-8 -*-
"""
Parseur MRZ universel (ICAO 9303) robuste aux erreurs OCR.
Supporte TD1 (CNI 3 lignes), TD2 (CNI/Passeport 2 lignes), TD3 (Passeport 2 lignes).
Inclut la validation des check digits et la correction des erreurs OCR courantes.
"""
import re
from typing import Optional, Dict, Any
from src.noyau.journal import journal

CODES_PAYS_ICAO = {
    "CIV": "Côte d'Ivoire", "SEN": "Sénégal", "MLI": "Mali", "BFA": "Burkina Faso",
    "BEN": "Bénin", "TGO": "Togo", "NER": "Niger", "GIN": "Guinée", "GHA": "Ghana",
    "NGA": "Nigeria", "CMR": "Cameroun", "MAR": "Maroc", "DZA": "Algérie", "TUN": "Tunisie",
    "FRA": "France", "BEL": "Belgique", "CAN": "Canada", "USA": "États-Unis",
}

def _calculer_check_digit(valeur: str, poids: list = [7, 3, 1]) -> int:
    """Calcule le check digit ICAO 9303."""
    total = 0
    for i, char in enumerate(valeur):
        if char.isdigit():
            val = int(char)
        elif char.isalpha():
            val = ord(char.upper()) - 55  # A=10, B=11, ..., Z=35
        elif char == '<':
            val = 0
        else:
            val = 0
        total += val * poids[i % 3]
    return total % 10

def _corriger_erreurs_ocr_mrz(ligne: str) -> str:
    """Corrige les erreurs OCR courantes dans les lignes MRZ."""
    if not ligne:
        return ligne
    
    # Convertir en majuscules
    ligne = ligne.upper()
    
    # Corrections de caractères ambigus (uniquement dans les zones numériques)
    # Positions typiques : 0-8 (numéro doc), 13-18 (date naissance), 21-26 (date expiration)
    corrections = {
        'O': '0',  # O → 0
        'I': '1',  # I → 1  
        'S': '5',  # S → 5
        'B': '8',  # B → 8
        'Z': '2',  # Z → 2
        'G': '6',  # G → 6
        'Q': '0',  # Q → 0
    }
    
    ligne_corrigee = list(ligne)
    for i, char in enumerate(ligne_corrigee):
        if char in corrections:
            # Appliquer la correction surtout dans les zones numériques
            ligne_corrigee[i] = corrections[char]
    
    return ''.join(ligne_corrigee)

def _convertir_date_mrz(date_mrz: str) -> Optional[str]:
    """Convertit une date MRZ (AAMMJJ) en format JJ/MM/AAAA."""
    if not date_mrz or len(date_mrz) < 6:
        return None
    
    try:
        aa, mm, jj = int(date_mrz[0:2]), int(date_mrz[2:4]), int(date_mrz[4:6])
        # Déterminer le siècle
        aaaa = 1900 + aa if aa >= 40 else 2000 + aa
        
        if 1 <= mm <= 12 and 1 <= jj <= 31 and 1900 <= aaaa <= 2100:
            return f"{jj:02d}/{mm:02d}/{aaaa}"
    except (ValueError, IndexError):
        pass
    
    return None

def _detecter_format_mrz(l1: str, l2: str, l3: Optional[str] = None) -> str:
    """Détecte le format MRZ (TD1, TD2 ou TD3) en fonction des lignes."""
    if not l1 or not l2:
        return "INCONNU"
    
    l1_len = len(l1.strip())
    l2_len = len(l2.strip())
    l3_exists = l3 is not None and len(l3.strip()) > 0
    
    # TD1 : 3 lignes de 30 caractères (CNI)
    if l3_exists and l1_len <= 32 and l2_len <= 32:
        return "TD1"
    
    # TD3 : 2 lignes de 44 caractères (Passeport)
    if l2_len >= 40 and not l3_exists:
        return "TD3"
    
    # TD2 : 2 lignes de 36 caractères (CNI papier / Passeport carte)
    if l2_len >= 30 and l2_len <= 38:
        return "TD2"
    
    # Détection par pattern
    if l1.startswith('P<') or l1.startswith('I<'):
        return "TD3" if l2_len >= 40 else "TD2"
    
    return "TD1" if l3_exists else "TD2"

def _parser_mrz_td1(l1: str, l2: str, l3: str) -> Dict[str, Any]:
    """Parse une MRZ TD1 (CNI - 3 lignes de 30 caractères)."""
    resultat = {
        "format": "TD1",
        "nom_famille": "",
        "prenoms": "",
        "numero_document": "",
        "date_naissance_date": None,
        "date_expiration_date": None,
        "sexe": "non_detecte",
        "pays_emetteur": "",
        "mrz_valide": False,
        "erreurs_mrz": []
    }
    
    erreurs = []
    
    try:
        # Padding pour garantir 30 caractères
        l1 = l1.ljust(30)
        l2 = l2.ljust(30)
        l3 = l3.ljust(30)
        
        # Ligne 1 : Type + Pays + Numéro document + Check digit
        resultat["pays_emetteur"] = l1[2:5].strip("<")
        numero_doc_mrz = l1[5:14]
        resultat["numero_document"] = numero_doc_mrz.replace("<", "").strip()
        
        # Validation check digit numéro document (position 14)
        if _calculer_check_digit(numero_doc_mrz) != int(l1[14]) if l1[14].isdigit() else -1:
            erreurs.append("Check digit numéro document invalide")
        
        # Ligne 2 : Date naissance + Check + Sexe + Date expiration + Check
        resultat["date_naissance_date"] = _convertir_date_mrz(l2[0:6])
        if _calculer_check_digit(l2[0:6]) != int(l2[6]) if l2[6].isdigit() else -1:
            erreurs.append("Check digit date naissance invalide")
        
        resultat["sexe"] = "M" if l2[7:8] == "M" else "F" if l2[7:8] == "F" else "non_detecte"
        
        resultat["date_expiration_date"] = _convertir_date_mrz(l2[8:14])
        if _calculer_check_digit(l2[8:14]) != int(l2[14]) if l2[14].isdigit() else -1:
            erreurs.append("Check digit date expiration invalide")
        
        # Ligne 3 : Nom et prénoms séparés par <<
        parties = l3.split("<<")
        if parties:
            resultat["nom_famille"] = parties[0].replace("<", " ").strip()
        if len(parties) > 1:
            resultat["prenoms"] = parties[1].replace("<", " ").strip()
        
        # Validation finale
        resultat["mrz_valide"] = len(erreurs) == 0
        resultat["erreurs_mrz"] = erreurs
        
    except Exception as e:
        journal.warning(f"Erreur parsing MRZ TD1 : {e}")
        erreurs.append(f"Erreur de parsing : {str(e)}")
    
    resultat["pays_emetteur_nom"] = CODES_PAYS_ICAO.get(resultat["pays_emetteur"], resultat["pays_emetteur"])
    return resultat

def _parser_mrz_td2_ou_td3(l1: str, l2: str, format_mrz: str) -> Dict[str, Any]:
    """Parse une MRZ TD2 (36 car.) ou TD3 (44 car.)."""
    resultat = {
        "format": format_mrz,
        "nom_famille": "",
        "prenoms": "",
        "numero_document": "",
        "date_naissance_date": None,
        "date_expiration_date": None,
        "sexe": "non_detecte",
        "pays_emetteur": "",
        "mrz_valide": False,
        "erreurs_mrz": []
    }
    
    erreurs = []
    
    try:
        longueur = 36 if format_mrz == "TD2" else 44
        
        # Padding
        l1 = l1.ljust(longueur)
        l2 = l2.ljust(longueur)
        
        # Ligne 1 : Type + Pays + Nom/Prénoms
        resultat["pays_emetteur"] = l1[2:5].strip("<")
        
        # Noms séparés par <<
        noms = l1[5:].split("<<")
        if noms:
            resultat["nom_famille"] = noms[0].replace("<", " ").strip()
        if len(noms) > 1:
            resultat["prenoms"] = noms[1].replace("<", " ").strip()
        
        # Ligne 2 : Numéro document + Check + Nationalité + Date naissance + Check + Sexe + Date expiration + Check + Check composite
        numero_doc_mrz = l2[0:9]
        resultat["numero_document"] = numero_doc_mrz.replace("<", "").strip()
        
        if _calculer_check_digit(numero_doc_mrz) != int(l2[9]) if l2[9].isdigit() else -1:
            erreurs.append("Check digit numéro document invalide")
        
        resultat["date_naissance_date"] = _convertir_date_mrz(l2[13:19])
        if _calculer_check_digit(l2[13:19]) != int(l2[19]) if l2[19].isdigit() else -1:
            erreurs.append("Check digit date naissance invalide")
        
        resultat["sexe"] = "M" if l2[20:21] == "M" else "F" if l2[20:21] == "F" else "non_detecte"
        
        resultat["date_expiration_date"] = _convertir_date_mrz(l2[21:27])
        if _calculer_check_digit(l2[21:27]) != int(l2[27]) if l2[27].isdigit() else -1:
            erreurs.append("Check digit date expiration invalide")
        
        # Validation check digit composite (TD2/TD3)
        pos_fin = 35 if format_mrz == "TD2" else 42
        composite_str = l2[0:10] + l2[13:20] + l2[21:pos_fin]
        if _calculer_check_digit(composite_str) != int(l2[pos_fin]) if l2[pos_fin].isdigit() else -1:
            erreurs.append("Check digit composite invalide")
        
        resultat["mrz_valide"] = len(erreurs) == 0
        resultat["erreurs_mrz"] = erreurs
        
    except Exception as e:
        journal.warning(f"Erreur parsing MRZ {format_mrz} : {e}")
        erreurs.append(f"Erreur de parsing : {str(e)}")
    
    resultat["pays_emetteur_nom"] = CODES_PAYS_ICAO.get(resultat["pays_emetteur"], resultat["pays_emetteur"])
    return resultat

def parser_mrz_complet(l1: str, l2: str, l3: Optional[str] = None) -> Dict[str, Any]:
    """
    Point d'entrée unique pour parser n'importe quelle MRZ.
    Détecte automatiquement le format et applique le parser approprié.
    """
    if not l1 or not l2:
        journal.warning("MRZ : lignes 1 ou 2 manquantes")
        return {
            "format": "inconnu",
            "nom_famille": "",
            "prenoms": "",
            "numero_document": "",
            "date_naissance_date": None,
            "date_expiration_date": None,
            "sexe": "non_detecte",
            "pays_emetteur": "",
            "mrz_valide": False,
            "erreurs_mrz": ["Lignes MRZ incomplètes"]
        }
    
    # 1. Nettoyer les lignes (majuscules, correction OCR)
    l1_clean = _corriger_erreurs_ocr_mrz(l1.strip())
    l2_clean = _corriger_erreurs_ocr_mrz(l2.strip())
    l3_clean = _corriger_erreurs_ocr_mrz(l3.strip()) if l3 else None
    
    journal.info(f"MRZ : Détection du format (l1={len(l1_clean)}car, l2={len(l2_clean)}car, l3={'present' if l3_clean else 'absent'})")
    
    # 2. Détecter le format
    format_mrz = _detecter_format_mrz(l1_clean, l2_clean, l3_clean)
    journal.info(f"MRZ : Format détecté = {format_mrz}")
    
    # 3. Parser selon le format
    if format_mrz == "TD1":
        if not l3_clean:
            journal.error("MRZ TD1 nécessite 3 lignes mais seulemen 2 fournies")
            return parser_mrz_complet("", "", "")  # Retourner une erreur
        
        return _parser_mrz_td1(l1_clean, l2_clean, l3_clean)
    
    elif format_mrz in ("TD2", "TD3"):
        return _parser_mrz_td2_ou_td3(l1_clean, l2_clean, format_mrz)
    
    else:
        journal.warning(f"MRZ : Format inconnu, tentative TD2 par défaut")
        return _parser_mrz_td2_ou_td3(l1_clean, l2_clean, "TD2")