# -*- coding: utf-8 -*-
"""
Parseur MRZ (Machine Readable Zone) universel et robuste aux erreurs OCR.
Formats supportés :
- TD1 (3 × 30 car.) : CNI biométriques, cartes de séjour (majorité des CNI africaines)
- TD2 (2 × 36 car.) : Cartes d'identité (ex: CNI béninoise), permis de conduire
- TD3 (2 × 44 car.) : Passeports
Norme ICAO 9303
"""
import re
from typing import Optional, Dict, Any
from src.noyau.journal import journal

# =============================================================================
# Codes pays ICAO (Afrique francophone + principaux pays)
# =============================================================================
CODES_PAYS_ICAO: dict[str, str] = {
    "CIV": "Côte d'Ivoire", "SEN": "Sénégal", "MLI": "Mali", "BFA": "Burkina Faso",
    "BEN": "Bénin", "TGO": "Togo", "NER": "Niger", "GIN": "Guinée", "GNB": "Guinée-Bissau",
    "GHA": "Ghana", "NGA": "Nigeria", "LBR": "Liberia", "SLE": "Sierra Leone",
    "CMR": "Cameroun", "CAF": "République Centrafricaine", "TCD": "Tchad",
    "COG": "Congo", "COD": "République Démocratique du Congo", "GAB": "Gabon",
    "MAR": "Maroc", "DZA": "Algérie", "TUN": "Tunisie", "LBY": "Libye", "EGY": "Égypte",
    "ZAF": "Afrique du Sud", "MDG": "Madagascar", "MUS": "Maurice", "MRT": "Mauritanie",
    "FRA": "France", "BEL": "Belgique", "CAN": "Canada", "USA": "États-Unis",
}

TYPES_DOCUMENTS: dict[str, str] = {
    "P": "Passeport", "P<": "Passeport", "PN": "Passeport national",
    "I": "Carte d'identité", "ID": "Carte d'identité nationale", "IP": "Carte d'identité provisoire",
    "A": "Carte de séjour", "AS": "Carte de séjour", "AC": "Carte de résident",
    "C": "Permis de conduire", "C<": "Carte d'identité", "V": "Visa",
}

# =============================================================================
# Fonctions utilitaires de nettoyage et validation
# =============================================================================
def _nettoyer_ligne_mrz(ligne: str, longueur_attendue: int) -> str:
    """Nettoie une ligne MRZ des artefacts OCR et la padde à la longueur attendue."""
    if not ligne:
        return "<" * longueur_attendue
    
    # 1. Majuscules et suppression des espaces insécables
    ligne = ligne.upper().replace(" ", "").replace("\u00a0", "").strip()
    
    # 2. Remplacer les caractères non valides (sauf alphanumérique et <) par <
    ligne = "".join(c if c.isalnum() or c == "<" else "<" for c in ligne)
    
    # 3. Ajuster à la longueur attendue (padding ou troncature)
    if len(ligne) > longueur_attendue:
        ligne = ligne[:longueur_attendue]
    elif len(ligne) < longueur_attendue:
        ligne = ligne + "<" * (longueur_attendue - len(ligne))
        
    return ligne

def _calculer_checksum_mrz(donnees: str) -> int:
    """Calcule le checksum ICAO 9303 (poids 7, 3, 1)."""
    poids = [7, 3, 1]
    total = 0
    for i, c in enumerate(donnees):
        if c == "<":
            valeur = 0
        elif c.isdigit():
            valeur = int(c)
        elif c.isalpha():
            valeur = ord(c.upper()) - 55  # A=10, B=11, ..., Z=35
        else:
            valeur = 0
        total += valeur * poids[i % 3]
    return total % 10

def _verifier_checksum_mrz(donnees: str, check_char: str) -> bool:
    """Vérifie le checksum ICAO 9303 d'une portion de MRZ."""
    if not donnees or not check_char or check_char == "<":
        return False
    try:
        return str(_calculer_checksum_mrz(donnees)) == str(check_char)
    except Exception:
        return False

def _convertir_date_mrz(date_mrz: str) -> Optional[str]:
    """Convertit une date MRZ (AAMMJJ) en JJ/MM/AAAA."""
    if not date_mrz or len(date_mrz) < 6:
        return None
    try:
        aa, mm, jj = int(date_mrz[0:2]), int(date_mrz[2:4]), int(date_mrz[4:6])
        aaaa = 1900 + aa if aa >= 40 else 2000 + aa
        if 1 <= mm <= 12 and 1 <= jj <= 31 and 1900 <= aaaa <= 2100:
            return f"{jj:02d}/{mm:02d}/{aaaa}"
    except ValueError:
        pass
    return None

# =============================================================================
# Parseurs spécifiques par format
# =============================================================================
def parser_mrz_td1(l1: str, l2: str, l3: str) -> Dict[str, Any]:
    """Parse une MRZ au format TD1 (3 lignes × 30 caractères)."""
    l1, l2, l3 = _nettoyer_ligne_mrz(l1, 30), _nettoyer_ligne_mrz(l2, 30), _nettoyer_ligne_mrz(l3, 30)
    erreurs = []
    
    try:
        pays = l1[2:5].strip("<")
        num_doc = l1[5:14].replace("<", "")
        cs_doc = l1[14:15]
        
        ddn = l2[0:6]
        cs_ddn = l2[6:7]
        sexe = "M" if l2[7:8] == "M" else "F" if l2[7:8] == "F" else "non_detecte"
        
        exp = l2[8:14]
        cs_exp = l2[14:15]
        
        nationalite = l2[15:18].strip("<")
        
        parties = l3.split("<<")
        nom_famille = parties[0].replace("<", " ").strip() if parties else ""
        prenoms = parties[1].replace("<", " ").strip() if len(parties) > 1 else ""
        
        # Validations checksum
        if not _verifier_checksum_mrz(num_doc, cs_doc): erreurs.append("Checksum numéro invalide")
        if not _verifier_checksum_mrz(ddn, cs_ddn): erreurs.append("Checksum naissance invalide")
        if not _verifier_checksum_mrz(exp, cs_exp): erreurs.append("Checksum expiration invalide")
        
        cs_global = l2[29:30]
        if cs_global and cs_global != "<":
            donnees_globales = l1[5:15] + l2[0:7] + l2[8:15]
            if not _verifier_checksum_mrz(donnees_globales, cs_global):
                erreurs.append("Checksum global invalide")

        return {
            "format": "TD1",
            "nom_famille": nom_famille,
            "prenoms": prenoms,
            "numero_document": num_doc,
            "date_naissance_date": _convertir_date_mrz(ddn),
            "date_expiration_date": _convertir_date_mrz(exp),
            "sexe": sexe,
            "pays_emetteur": pays,
            "pays_emetteur_nom": CODES_PAYS_ICAO.get(pays, pays),
            "nationalite": nationalite,
            "nationalite_nom": CODES_PAYS_ICAO.get(nationalite, nationalite),
            "mrz_valide": len(erreurs) == 0,
            "erreurs_mrz": erreurs
        }
    except Exception as e:
        journal.error(f"Erreur parsing MRZ TD1 : {e}")
        return {"format": "TD1", "mrz_valide": False, "erreurs_mrz": [str(e)]}


def parser_mrz_td2(l1: str, l2: str) -> Dict[str, Any]:
    """Parse une MRZ au format TD2 (2 lignes × 36 caractères) - Ex: CNI Bénin."""
    l1, l2 = _nettoyer_ligne_mrz(l1, 36), _nettoyer_ligne_mrz(l2, 36)
    erreurs = []
    
    try:
        pays = l1[2:5].strip("<")
        reste_noms = l1[5:36].strip("<")
        parties = reste_noms.split("<<")
        nom_famille = parties[0].replace("<", " ").strip() if parties else ""
        prenoms = parties[1].replace("<", " ").strip() if len(parties) > 1 else ""
        
        # Ligne 2 : Positions ICAO exactes
        num_doc = l2[0:9].replace("<", "")
        cs_doc = l2[9:10]
        
        nationalite = l2[10:13].strip("<")
        
        ddn = l2[13:19]
        cs_ddn = l2[19:20]
        
        sexe = "M" if l2[20:21] == "M" else "F" if l2[20:21] == "F" else "non_detecte"
        
        # ✅ CORRECTION CRITIQUE : 6 caractères pour la date (21 à 26 inclus)
        exp = l2[21:27]
        cs_exp = l2[27:28]
        
        # Validations checksum
        if not _verifier_checksum_mrz(num_doc, cs_doc): erreurs.append("Checksum numéro invalide")
        if not _verifier_checksum_mrz(ddn, cs_ddn): erreurs.append("Checksum naissance invalide")
        if not _verifier_checksum_mrz(exp, cs_exp): erreurs.append("Checksum expiration invalide")
        
        if len(l2) >= 36:
            cs_global = l2[35:36]
            if cs_global and cs_global != "<":
                # Check global TD2 : numéro(0-9) + naissance(13-19) + expiration(21-27)
                donnees_globales = l2[0:10] + l2[13:20] + l2[21:28]
                if not _verifier_checksum_mrz(donnees_globales, cs_global):
                    erreurs.append("Checksum global invalide")

        return {
            "format": "TD2",
            "nom_famille": nom_famille,
            "prenoms": prenoms,
            "numero_document": num_doc,
            "date_naissance_date": _convertir_date_mrz(ddn),
            "date_expiration_date": _convertir_date_mrz(exp),
            "sexe": sexe,
            "pays_emetteur": pays,
            "pays_emetteur_nom": CODES_PAYS_ICAO.get(pays, pays),
            "nationalite": nationalite,
            "nationalite_nom": CODES_PAYS_ICAO.get(nationalite, nationalite),
            "mrz_valide": len(erreurs) == 0,
            "erreurs_mrz": erreurs
        }
    except Exception as e:
        journal.error(f"Erreur parsing MRZ TD2 : {e}")
        return {"format": "TD2", "mrz_valide": False, "erreurs_mrz": [str(e)]}


def parser_mrz_td3(l1: str, l2: str) -> Dict[str, Any]:
    """Parse une MRZ au format TD3 (2 lignes × 44 caractères) - Passeports."""
    l1, l2 = _nettoyer_ligne_mrz(l1, 44), _nettoyer_ligne_mrz(l2, 44)
    erreurs = []
    
    try:
        pays = l1[2:5].strip("<")
        noms = l1[5:44].strip("<")
        parties = noms.split("<<")
        nom_famille = parties[0].replace("<", " ").strip() if parties else ""
        prenoms = parties[1].replace("<", " ").strip() if len(parties) > 1 else ""
        
        num_doc = l2[0:9].replace("<", "")
        cs_doc = l2[9:10]
        
        nationalite = l2[10:13].strip("<")
        
        ddn = l2[13:19]
        cs_ddn = l2[19:20]
        
        sexe = "M" if l2[20:21] == "M" else "F" if l2[20:21] == "F" else "non_detecte"
        
        exp = l2[21:27]
        cs_exp = l2[27:28]
        
        if not _verifier_checksum_mrz(num_doc, cs_doc): erreurs.append("Checksum numéro invalide")
        if not _verifier_checksum_mrz(ddn, cs_ddn): erreurs.append("Checksum naissance invalide")
        if not _verifier_checksum_mrz(exp, cs_exp): erreurs.append("Checksum expiration invalide")

        return {
            "format": "TD3",
            "nom_famille": nom_famille,
            "prenoms": prenoms,
            "numero_document": num_doc,
            "date_naissance_date": _convertir_date_mrz(ddn),
            "date_expiration_date": _convertir_date_mrz(exp),
            "sexe": sexe,
            "pays_emetteur": pays,
            "pays_emetteur_nom": CODES_PAYS_ICAO.get(pays, pays),
            "nationalite": nationalite,
            "nationalite_nom": CODES_PAYS_ICAO.get(nationalite, nationalite),
            "mrz_valide": len(erreurs) == 0,
            "erreurs_mrz": erreurs
        }
    except Exception as e:
        journal.error(f"Erreur parsing MRZ TD3 : {e}")
        return {"format": "TD3", "mrz_valide": False, "erreurs_mrz": [str(e)]}

# =============================================================================
# Point d'entrée universel
# =============================================================================
def detecter_format_mrz(l1: str, l2: str, l3: Optional[str] = None) -> str:
    """Détecte le format MRZ en fonction de la longueur des lignes."""
    if l3 and len(l1.strip()) <= 32 and len(l2.strip()) <= 32:
        return "TD1"
    if 34 <= len(l2.strip()) <= 38:
        return "TD2"
    if len(l2.strip()) >= 40:
        return "TD3"
    return "inconnu"

def parser_mrz_complet(l1: str, l2: str, l3: Optional[str] = None) -> Dict[str, Any]:
    """Parseur MRZ universel : détecte le format et extrait les données."""
    if not l1 or not l2:
        return {"format": "inconnu", "mrz_valide": False, "erreurs_mrz": ["Lignes MRZ manquantes"]}
    
    format_mrz = detecter_format_mrz(l1, l2, l3)
    journal.info(f"MRZ : Format détecté = {format_mrz}")
    
    if format_mrz == "TD1" and l3:
        return parser_mrz_td1(l1, l2, l3)
    elif format_mrz == "TD2":
        return parser_mrz_td2(l1, l2)
    elif format_mrz == "TD3":
        return parser_mrz_td3(l1, l2)
    else:
        journal.warning(f"MRZ : Format inconnu ou non supporté ({format_mrz})")
        return {"format": format_mrz, "mrz_valide": False, "erreurs_mrz": ["Format non reconnu"]}