# -*- coding: utf-8 -*-
"""
Parseur MRZ (Machine Readable Zone) universel.
La MRZ est une zone standardisée présente sur la plupart des documents
d'identité officiels : passeports, CNI, cartes de séjour, permis, etc.
Formats supportés :
TD1 (3 × 30 car.) : CNI, cartes de séjour  (majorité des CNI africaines)
TD2 (2 × 36 car.) : Cartes d'identité, permis
TD3 (2 × 44 car.) : Passeports
MRVA/MRVB       : Visas
Norme ICAO 9303 — https://www.icao.int/publications/pages/publication.aspx?docnum=9303
"""
import re
from datetime import datetime
from typing import Optional
from src.noyau.journal import journal

# =============================================================================
# Codes pays ICAO (Afrique francophone + principaux pays africains)
# =============================================================================
CODES_PAYS_ICAO: dict[str, str] = {
    # Afrique de l'Ouest
    "CIV": "Côte d'Ivoire",
    "SEN": "Sénégal",
    "MLI": "Mali",
    "BFA": "Burkina Faso",
    "BEN": "Bénin",
    "TGO": "Togo",
    "NER": "Niger",
    "GIN": "Guinée",
    "GNB": "Guinée-Bissau",
    "GHA": "Ghana",
    "NGA": "Nigeria",
    "LBR": "Liberia",
    "SLE": "Sierra Leone",
    "CPV": "Cap-Vert",
    "GMB": "Gambie",
    # Afrique centrale
    "CMR": "Cameroun",
    "CAF": "République Centrafricaine",
    "TCD": "Tchad",
    "COG": "Congo",
    "COD": "République Démocratique du Congo",
    "GAB": "Gabon",
    "GNQ": "Guinée Équatoriale",
    "STP": "Sao Tomé-et-Principe",
    # Afrique de l'Est
    "RWA": "Rwanda",
    "BDI": "Burundi",
    "UGA": "Ouganda",
    "KEN": "Kenya",
    "TZA": "Tanzanie",
    "ETH": "Éthiopie",
    "SOM": "Somalie",
    "DJI": "Djibouti",
    "SDN": "Soudan",
    "SSD": "Soudan du Sud",
    # Afrique du Nord
    "MAR": "Maroc",
    "DZA": "Algérie",
    "TUN": "Tunisie",
    "LBY": "Libye",
    "EGY": "Égypte",
    # Afrique australe
    "ZAF": "Afrique du Sud",
    "AGO": "Angola",
    "MOZ": "Mozambique",
    "ZMB": "Zambie",
    "ZWE": "Zimbabwe",
    "MWI": "Malawi",
    "BWA": "Botswana",
    "NAM": "Namibie",
    "LSO": "Lesotho",
    "SWZ": "Eswatini",
    "MUS": "Maurice",
    "MDG": "Madagascar",
    "COM": "Comores",
    "SYC": "Seychelles",
    "MRT": "Mauritanie",
}

# Codes spéciaux
CODES_SPECIAUX = {
    "UTO": "Document de voyage OACI",
    "XXA": "Apatride / Réfugié (statut à déterminer)",
    "XXB": "Réfugié (Convention de 1951)",
    "XXC": "Réfugié (autre)",
    "XXD": "Réfugié (autorité émettrice inconnue)",
    "XXX": "Document de voyage inconnu",
}

# =============================================================================
# Types de documents (ICAO)
# =============================================================================
TYPES_DOCUMENTS: dict[str, str] = {
    "P": "Passeport",
    "P<": "Passeport",
    "PN": "Passeport national",
    "PA": "Passeport diplomatique",
    "PS": "Passeport de service",
    "PC": "Passeport de courrier",
    "PM": "Passeport maritime",
    "I": "Carte d'identité",
    "ID": "Carte d'identité nationale",
    "IP": "Carte d'identité provisoire",
    "IC": "Carte d'identité (enfant)",
    "A": "Carte de séjour / Permis",
    "AS": "Carte de séjour",
    "AC": "Carte de résident",
    "C": "Permis de conduire",
    "C<": "Carte d'identité",
    "V": "Visa",
    "VA": "Visa diplomatique",
    "VB": "Visa d'affaires",
    "VD": "Visa de tourisme",
}

# =============================================================================
# Fonctions utilitaires
# =============================================================================
def _nettoyer_ligne_mrz(ligne: str, longueur_attendue: int = 30) -> str:
    """Nettoie une ligne MRZ."""
    if not ligne:
        return "<" * longueur_attendue
    ligne = ligne.upper().strip()
    # Remplacer les caractères non valides par <
    ligne = "".join(c if c.isalnum() or c == "<" else "<" for c in ligne)
    # Ajuster à la longueur attendue
    if len(ligne) > longueur_attendue:
        ligne = ligne[:longueur_attendue]
    elif len(ligne) < longueur_attendue:
        ligne = ligne + "<" * (longueur_attendue - len(ligne))
    return ligne

def _calculer_checksum_mrz(donnees: str) -> int:
    """
    Calcule le checksum ICAO 9303 pour une chaîne donnée.
    Algorithme :
       - Poids cyclique : 7, 3, 1, 7, 3, 1, ...
       - Valeur des caractères : A=10, B=11, ..., Z=35, < = 0
       - Checksum = somme pondérée modulo 10
    """
    poids = [7, 3, 1]
    total = 0
    for i, c in enumerate(donnees):
        if c == "<":
            valeur = 0
        elif c.isdigit():
            valeur = int(c)
        elif c.isalpha():
            valeur = ord(c.upper()) - 55  # A=10, B=11, ...
        else:
            valeur = 0
        total += valeur * poids[i % 3]
    return total % 10

def _verifier_checksum_mrz(donnees: str, check_char: str) -> bool:
    """
    Vérifie le checksum ICAO 9303 d'une portion de MRZ.
    """
    if not donnees or not check_char or check_char == "<":
        return False
    try:
        check_calcule = _calculer_checksum_mrz(donnees)
        return str(check_calcule) == str(check_char)
    except Exception:
        return False

def _convertir_date_mrz(date_mrz: str) -> Optional[str]:
    """
    Convertit une date MRZ (AAMMJJ) en JJ/MM/AAAA.
    Gère le casse-tête du siècle (années 1900 vs 2000) :
       - Si AA >= 40 → 19AA (né avant 1940)
       - Si AA < 40 → 20AA  (né après 2000)
    """
    if not date_mrz or len(date_mrz) < 6:
        return None
    try:
        aa = int(date_mrz[0:2])
        mm = int(date_mrz[2:4])
        jj = int(date_mrz[4:6])
        if aa >= 40:
            aaaa = 1900 + aa
        else:
            aaaa = 2000 + aa
        # Vérifier validité
        if mm < 1 or mm > 12 or jj < 1 or jj > 31:
            return None
        return f"{jj:02d}/{mm:02d}/{aaaa}"
    except ValueError:
        return None

# =============================================================================
# Parsing MRZ TD1 (3 × 30 caractères) — CNI, cartes de séjour
# =============================================================================
def parser_mrz_td1(l1: str, l2: str, l3: str) -> dict:
    """
    Parse une MRZ au format TD1 (3 lignes × 30 caractères).
    Format TD1 (ICAO 9303) :
       Ligne 1 (30 car) :
         [0-1]   Type document (ex: C<, I<)
         [2-4]   Pays émetteur (3 car)
         [5-14]  Numéro document (10 car)
         [15]    Check digit numéro
         [16-29] Données optionnelles (14 car)
       Ligne 2 (30 car) :
         [0-5]   Date naissance AAMMJJ (6 car)
         [6]     Check digit naissance
         [7]     Sexe (M/F/<)
         [8-13]  Date expiration AAMMJJ (6 car)
         [14]    Check digit expiration
         [15-17] Nationalité (3 car)
         [18-28] Données optionnelles (11 car)
         [29]    Check digit global
       Ligne 3 (30 car) :
         [0-29]  Nom<<Prénoms
    Retourne un dict structuré.
    """
    l1 = _nettoyer_ligne_mrz(l1, 30)
    l2 = _nettoyer_ligne_mrz(l2, 30)
    l3 = _nettoyer_ligne_mrz(l3, 30)
    resultat = {
        "type_document": "",
        "pays_emetteur": "",
        "pays_emetteur_nom": "",
        "numero_document": "",
        "date_naissance": "",
        "date_naissance_date": None,
        "sexe": "",
        "date_expiration": "",
        "date_expiration_date": None,
        "nationalite": "",
        "nationalite_nom": "",
        "nom_famille": "",
        "prenoms": "",
        "format": "TD1",
        "brut_l1": l1,
        "brut_l2": l2,
        "brut_l3": l3,
        "checksum_numero_ok": False,
        "checksum_naissance_ok": False,
        "checksum_expiration_ok": False,
        "checksum_global_ok": False,
    }
    try:
        # --- Ligne 1 ---
        type_doc = l1[0:2].strip("<")
        if len(type_doc) < 2:
            type_doc = l1[0:1]
        resultat["type_document"] = TYPES_DOCUMENTS.get(type_doc, type_doc)
        pays = l1[2:5].strip("<")
        resultat["pays_emetteur"] = pays
        resultat["pays_emetteur_nom"] = CODES_PAYS_ICAO.get(pays, pays)
        # Numéro de document (positions 5-14) + checksum (position 15)
        num_doc = l1[5:14].replace("<", "")
        cs_doc = l1[14:15] if len(l1) > 14 else ""
        resultat["numero_document"] = num_doc
        resultat["checksum_numero_ok"] = _verifier_checksum_mrz(num_doc, cs_doc)
        # --- Ligne 2 ---
        ddn = l2[0:6]
        cs_ddn = l2[6:7] if len(l2) > 6 else ""
        resultat["date_naissance"] = ddn
        resultat["date_naissance_date"] = _convertir_date_mrz(ddn)
        resultat["checksum_naissance_ok"] = _verifier_checksum_mrz(ddn, cs_ddn)
        sexe = l2[7:8].strip("<")
        resultat["sexe"] = "M" if sexe == "M" else "F" if sexe == "F" else "non_detecte"
        exp = l2[8:14]
        cs_exp = l2[14:15] if len(l2) > 14 else ""
        resultat["date_expiration"] = exp
        resultat["date_expiration_date"] = _convertir_date_mrz(exp)
        resultat["checksum_expiration_ok"] = _verifier_checksum_mrz(exp, cs_exp)
        nationalite = l2[15:18].strip("<")
        resultat["nationalite"] = nationalite
        resultat["nationalite_nom"] = CODES_PAYS_ICAO.get(nationalite, nationalite)
        # Checksum global (position 29)
        cs_global = l2[29:30] if len(l2) > 29 else ""
        if cs_global and cs_global != "<":
            donnees_globales = l1[5:15] + l2[0:7] + l2[8:15]
            resultat["checksum_global_ok"] = _verifier_checksum_mrz(donnees_globales, cs_global)
        # --- Ligne 3 ---
        # Format : Nom<<Prenoms ou Nom<Prenom<Prenom
        parties = l3.split("<<")
        if len(parties) >= 1:
            nom_mrz = parties[0].replace("<", " ").strip()
            resultat["nom_famille"] = nom_mrz
        if len(parties) >= 2:
            prenoms_mrz = parties[1].replace("<", " ").strip()
            resultat["prenoms"] = prenoms_mrz
        journal.info(
            f"MRZ TD1 parsée : nom={resultat['nom_famille']}, "
            f"prenoms={resultat['prenoms']}, numero={resultat['numero_document']}, "
            f"ddn={resultat['date_naissance']}, sexe={resultat['sexe']}"
        )
    except Exception as e:
        journal.error(f"Erreur parsing MRZ TD1 : {e}")
    return resultat

# =============================================================================
# Parsing MRZ TD3 (2 × 44 caractères) — Passeports
# =============================================================================
def parser_mrz_td3(l1: str, l2: str) -> dict:
    """
    Parse une MRZ au format TD3 (2 lignes × 44 caractères) — Passeports.
    Format TD3 (ICAO 9303) :
       Ligne 1 (44 car) :
         [0-1]   Type document (ex: P<)
         [2-4]   Pays émetteur (3 car)
         [5-43]  Nom<<Prénoms (39 car)
       Ligne 2 (44 car) :
         [0-8]   Numéro document (9 car)
         [9]     Check digit numéro
         [10-12] Nationalité (3 car)
         [13-18] Date naissance AAMMJJ (6 car)
         [19]    Check digit naissance
         [20]    Sexe (M/F/<)
         [21-26] Date expiration AAMMJJ (6 car)
         [27]    Check digit expiration
         [28-41] Données personnelles (14 car)
         [42-43] Check digits (2 car)
    """
    l1 = _nettoyer_ligne_mrz(l1, 44)
    l2 = _nettoyer_ligne_mrz(l2, 44)
    resultat = {
        "type_document": "",
        "pays_emetteur": "",
        "pays_emetteur_nom": "",
        "numero_document": "",
        "date_naissance": "",
        "date_naissance_date": None,
        "sexe": "",
        "date_expiration": "",
        "date_expiration_date": None,
        "nationalite": "",
        "nationalite_nom": "",
        "nom_famille": "",
        "prenoms": "",
        "format": "TD3",
        "brut_l1": l1,
        "brut_l2": l2,
        "checksum_numero_ok": False,
        "checksum_naissance_ok": False,
        "checksum_expiration_ok": False,
        "checksum_global_ok": False,
    }
    try:
        type_doc = l1[0:2].strip("<")
        resultat["type_document"] = TYPES_DOCUMENTS.get(type_doc, type_doc)
        pays = l1[2:5].strip("<")
        resultat["pays_emetteur"] = pays
        resultat["pays_emetteur_nom"] = CODES_PAYS_ICAO.get(pays, pays)
        # Nom et prénoms (positions 5-43)
        noms = l1[5:44].strip("<")
        parties = noms.split("<<")
        if parties:
            resultat["nom_famille"] = parties[0].replace("<", " ").strip()
        if len(parties) > 1:
            resultat["prenoms"] = parties[1].replace("<", " ").strip()
        # Ligne 2
        num_doc = l2[0:9].replace("<", "")
        cs_doc = l2[9:10] if len(l2) > 9 else ""
        resultat["numero_document"] = num_doc
        resultat["checksum_numero_ok"] = _verifier_checksum_mrz(num_doc, cs_doc)
        nationalite = l2[10:13].strip("<")
        resultat["nationalite"] = nationalite
        resultat["nationalite_nom"] = CODES_PAYS_ICAO.get(nationalite, nationalite)
        ddn = l2[13:19]
        cs_ddn = l2[19:20] if len(l2) > 19 else ""
        resultat["date_naissance"] = ddn
        resultat["date_naissance_date"] = _convertir_date_mrz(ddn)
        resultat["checksum_naissance_ok"] = _verifier_checksum_mrz(ddn, cs_ddn)
        sexe = l2[20:21].strip("<")
        resultat["sexe"] = "M" if sexe == "M" else "F" if sexe == "F" else "non_detecte"
        exp = l2[21:27]
        cs_exp = l2[27:28] if len(l2) > 27 else ""
        resultat["date_expiration"] = exp
        resultat["date_expiration_date"] = _convertir_date_mrz(exp)
        resultat["checksum_expiration_ok"] = _verifier_checksum_mrz(exp, cs_exp)
        journal.info(
            f"MRZ TD3 parsée : nom={resultat['nom_famille']}, "
            f"prenoms={resultat['prenoms']}, numero={resultat['numero_document']}, "
            f"ddn={resultat['date_naissance']}, sexe={resultat['sexe']}"
        )
    except Exception as e:
        journal.error(f"Erreur parsing MRZ TD3 : {e}")
    return resultat

# =============================================================================
# Parsing MRZ TD2 (2 × 36 caractères) — CNI béninoises, etc.
# =============================================================================
def parser_mrz_td2(l1: str, l2: str) -> dict:
    """
    Parse une MRZ au format TD2 (2 lignes × 36 caractères) — CNI béninoises, etc.
    Format TD2 (ICAO 9303 exact) :
       Ligne 1 (36 car) :
         [0-1]   Type document (ex: C<, I<)
         [2-4]   Pays émetteur (3 car)
         [5-35]  Nom<<Prénoms (31 car)
       Ligne 2 (36 car) :
         [0-8]   Numéro document (9 car)
         [9]     Check digit numéro
         [10-12] Nationalité (3 car)
         [13-18] Date naissance AAMMJJ (6 car)
         [19]    Check digit naissance
         [20]    Sexe (M/F/<)
         [21-26] Date expiration AAMMJJ (6 car)
         [27]    Check digit expiration
         [28-34] Données optionnelles (7 car)
         [35]    Check digit global
    """
    # Nettoyage robuste
    l1 = l1.upper().replace(" ", "").replace("\u00a0", "")
    l2 = l2.upper().replace(" ", "").replace("\u00a0", "")
    l1 = "".join(c for c in l1 if c.isalnum() or c == "<")
    l2 = "".join(c for c in l2 if c.isalnum() or c == "<")
    l1 = _nettoyer_ligne_mrz(l1, 36)
    l2 = _nettoyer_ligne_mrz(l2, 36)
    resultat = {
        "type_document": "",
        "pays_emetteur": "",
        "pays_emetteur_nom": "",
        "numero_document": "",
        "date_naissance": "",
        "date_naissance_date": None,
        "sexe": "",
        "date_expiration": "",
        "date_expiration_date": None,
        "nationalite": "",
        "nationalite_nom": "",
        "nom_famille": "",
        "prenoms": "",
        "format": "TD2",
        "brut_l1": l1,
        "brut_l2": l2,
        "checksum_numero_ok": False,
        "checksum_naissance_ok": False,
        "checksum_expiration_ok": False,
        "checksum_global_ok": False,
    }
    try:
        # === LIGNE 1 ===
        if len(l1) >= 10:
            type_doc = l1[0:2].strip("<")
            resultat["type_document"] = TYPES_DOCUMENTS.get(type_doc, type_doc)
            pays = l1[2:5].strip("<")
            resultat["pays_emetteur"] = pays
            resultat["pays_emetteur_nom"] = CODES_PAYS_ICAO.get(pays, pays)
            # Nom et prénoms (positions 5-35)
            reste = l1[5:36].strip("<")
            parties = reste.split("<<")
            if parties and parties[0]:
                resultat["nom_famille"] = parties[0].replace("<", " ").strip()
            if len(parties) > 1 and parties[1]:
                resultat["prenoms"] = parties[1].replace("<", " ").strip()
        # === LIGNE 2 (positions ICAO exactes) ===
        if len(l2) >= 30:
            # Numéro document : positions 0-8 (9 caractères)
            numero_brut = l2[0:10].replace("<", "")
            check_numero = l2[10] if len(l2) > 10 else ""
            resultat["numero_document"] = numero_brut
            resultat["checksum_numero_ok"] = _verifier_checksum_mrz(numero_brut, check_numero)
            # Nationalité : positions 10-12 (3 caractères)
            nationalite = l2[10:13].strip("<")
            resultat["nationalite"] = nationalite
            resultat["nationalite_nom"] = CODES_PAYS_ICAO.get(nationalite, nationalite)
            # Date naissance : positions 13-18 (AAMMJJ)
            ddn = l2[13:19]
            check_ddn = l2[19] if len(l2) > 19 else ""
            resultat["date_naissance"] = ddn
            resultat["date_naissance_date"] = _convertir_date_mrz(ddn)
            resultat["checksum_naissance_ok"] = _verifier_checksum_mrz(ddn, check_ddn)
            # Sexe : position 20
            sexe = l2[20:21].strip("<")
            resultat["sexe"] = "M" if sexe == "M" else "F" if sexe == "F" else "non_detecte"
            # ✅ CORRECTION CRITIQUE : Date expiration — positions 21-26 (6 caractères AAMMJJ)
            # Avant : exp = l2[21:26] → seulement 5 caractères → date tronquée !
            # Après : exp = l2[21:27] → 6 caractères corrects
            exp = l2[21:27]
            check_exp = l2[27] if len(l2) > 27 else ""
            resultat["date_expiration"] = exp
            resultat["date_expiration_date"] = _convertir_date_mrz(exp)
            resultat["checksum_expiration_ok"] = _verifier_checksum_mrz(exp, check_exp)
            # Check digit global : position 35
            if len(l2) >= 36:
                check_global = l2[35]
                # Le check global porte sur : numéro(0-9) + naissance(13-19) + expiration(21-27)
                donnees_globales = l2[0:10] + l2[13:20] + l2[21:28]
                resultat["checksum_global_ok"] = _verifier_checksum_mrz(donnees_globales, check_global)
        journal.info(
            f"MRZ TD2 parsée : nom={resultat['nom_famille']}, "
            f"prenoms={resultat['prenoms']}, numero={resultat['numero_document']}, "
            f"ddn={resultat['date_naissance']}, sexe={resultat['sexe']}, "
            f"exp={resultat['date_expiration']}, "
            f"checksums: num={resultat['checksum_numero_ok']}, "
            f"ddn={resultat['checksum_naissance_ok']}, "
            f"exp={resultat['checksum_expiration_ok']}, "
            f"global={resultat['checksum_global_ok']}"
        )
    except Exception as e:
        journal.error(f"Erreur parsing MRZ TD2 : {e}")
    return resultat

# =============================================================================
# Détection de format et parseur universel
# =============================================================================
def detecter_format_mrz(l1: str, l2: str, l3: Optional[str] = None) -> str:
    """Détecte le format MRZ en fonction de la longueur des lignes."""
    if l3:
        # TD1 : 3 lignes de 30 caractères
        if len(l1) <= 32 and len(l2) <= 32 and len(l3) <= 32:
            return "TD1"
    if l2:
        # TD2 : 2 lignes de 36 caractères
        if 34 <= len(l1) <= 38 and 34 <= len(l2) <= 38:
            return "TD2"
        # TD3 : 2 lignes de 44 caractères
        if len(l2) <= 44:
            return "TD3"
    return "inconnu"

def parser_mrz_complet(l1: str, l2: str, l3: Optional[str] = None) -> dict:
    """
    Parseur MRZ universel : détecte le format et extrait les données.
    """
    format_mrz = detecter_format_mrz(l1, l2, l3)
    if format_mrz == "TD1" and l3:
        resultat = parser_mrz_td1(l1, l2, l3)
    elif format_mrz == "TD2":
        resultat = parser_mrz_td2(l1, l2)
    elif format_mrz == "TD3":
        resultat = parser_mrz_td3(l1, l2)
    else:
        resultat = {
            "type_document": "Inconnu",
            "pays_emetteur": l1[2:5].strip("<") if len(l1) >= 5 else "",
            "numero_document": "",
            "date_naissance": "",
            "sexe": "",
            "date_expiration": "",
            "nationalite": "",
            "nom_famille": "",
            "prenoms": "",
            "format": format_mrz,
            "checksum_numero_ok": False,
            "checksum_naissance_ok": False,
            "checksum_expiration_ok": False,
            "checksum_global_ok": False,
        }
    return resultat

# =============================================================================
# Alias pour compatibilité avec extraction_cni.py
# =============================================================================
def verifier_checksum_mrz(ligne: str) -> bool:
    """
    Vérifie le checksum ICAO 9303 d'une ligne MRZ complète.
    Alias public de _verifier_checksum_mrz pour compatibilité.
    """
    if not ligne or len(ligne) < 2:
        return False
    # La dernière position est le checksum
    donnees = ligne[:-1]
    check_char = ligne[-1]
    return _verifier_checksum_mrz(donnees, check_char)

def calculer_checksum_mrz(donnees: str) -> int:
    """
    Calcule le checksum ICAO 9303 pour une chaîne donnée.
    Alias public de _calculer_checksum_mrz pour compatibilité.
    """
    return _calculer_checksum_mrz(donnees)