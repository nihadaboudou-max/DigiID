# -*- coding: utf-8 -*-
"""
Parseur MRZ (Machine Readable Zone) universel.

La MRZ est une zone standardisée présente sur la plupart des documents
d'identité officiels : passeports, CNI, cartes de séjour, permis, etc.

Formats supportés :
  - TD1 (3 × 30 car.) : CNI, cartes de séjour  (majorité des CNI africaines)
  - TD2 (2 × 36 car.) : Cartes d'identité, permis
  - TD3 (2 × 44 car.) : Passeports
  - MRVA/MRVB       : Visas

Norme ICAO 9303 — https://www.icao.int/publications/pages/publication.aspx?docnum=9303
"""
import re
from datetime import datetime
from typing import Optional


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
    "CIV": "Côte d'Ivoire",
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
    "V": "Visa",
    "VA": "Visa diplomatique",
    "VB": "Visa d'affaires",
    "VD": "Visa de tourisme",
}


# =============================================================================
# Parsing MRZ TD1 (3 × 30 caractères) — CNI, cartes de séjour
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


def parser_mrz_td1(l1: str, l2: str, l3: str) -> dict:
    """
    Parse une MRZ au format TD1 (3 lignes × 30 caractères).

    Format TD1 :
      Ligne 1 : [0-5] Type doc  [5-30] Pays émetteur + Numéro doc + checksum
      Ligne 2 : [0-6] Date naiss + checksum  [6-14] Sexe  [14-20] Date expir + checksum
                [20-29] Nationalité  [29-30] Checksum global optionnel
      Ligne 3 : [0-30] Nom, Prénoms (<< séparateur)

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

        # Numéro de document (positions 5-14) + checksum (position 14)
        num_doc = l1[5:14].replace("<", "")
        cs_doc = l1[14:15]
        resultat["numero_document"] = num_doc

        # --- Ligne 2 ---
        ddn = l2[0:6]
        resultat["date_naissance"] = ddn
        resultat["date_naissance_date"] = _convertir_date_mrz(ddn)

        sexe = l2[7:8].strip("<")
        resultat["sexe"] = "M" if sexe == "M" else "F" if sexe == "F" else "non_detecte"

        exp = l2[8:14]
        resultat["date_expiration"] = exp
        resultat["date_expiration_date"] = _convertir_date_mrz(exp)

        nationalite = l2[15:18].strip("<")
        resultat["nationalite"] = nationalite
        resultat["nationalite_nom"] = CODES_PAYS_ICAO.get(nationalite, nationalite)

        # --- Ligne 3 ---
        # Format : Nom<<Prenoms ou Nom<Prenom<Prenom
        parties = l3.split("<<")
        if len(parties) >= 1:
            # Le nom peut être avant le premier <<
            nom_mrz = parties[0].replace("<", " ").strip()
            resultat["nom_famille"] = nom_mrz

        if len(parties) >= 2:
            prenoms_mrz = parties[1].replace("<", " ").strip()
            resultat["prenoms"] = prenoms_mrz

    except Exception:
        pass

    return resultat


def parser_mrz_td3(l1: str, l2: str) -> dict:
    """
    Parse une MRZ au format TD3 (2 lignes × 44 caractères) — Passeports.

    Format TD3 (passeport) :
      Ligne 1 : [0-2] Type doc  [2-5] Pays  [5-44] Nom<<Prénoms
      Ligne 2 : [0-9] Numéro doc + checksum  [9-15] Nationalité
                [15-21] Date naiss + checksum  [21-22] Sexe
                [22-28] Date expir + checksum  [28-43] Personnel
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
    }

    try:
        type_doc = l1[0:2].strip("<")
        resultat["type_document"] = TYPES_DOCUMENTS.get(type_doc, type_doc)
        pays = l1[2:5].strip("<")
        resultat["pays_emetteur"] = pays
        resultat["pays_emetteur_nom"] = CODES_PAYS_ICAO.get(pays, pays)

        # Nom et prénoms (positions 5-44)
        noms = l1[5:44].strip("<")
        parties = noms.split("<<")
        if parties:
            resultat["nom_famille"] = parties[0].replace("<", " ")
        if len(parties) > 1:
            resultat["prenoms"] = parties[1].replace("<", " ")

        # Ligne 2
        num_doc = l2[0:9].replace("<", "")
        resultat["numero_document"] = num_doc

        ddn = l2[13:19]
        resultat["date_naissance"] = ddn
        resultat["date_naissance_date"] = _convertir_date_mrz(ddn)

        sexe = l2[20:21].strip("<")
        resultat["sexe"] = "M" if sexe == "M" else "F" if sexe == "F" else "non_detecte"

        exp = l2[21:27]
        resultat["date_expiration"] = exp
        resultat["date_expiration_date"] = _convertir_date_mrz(exp)

        nationalite = l2[10:13].strip("<")
        resultat["nationalite"] = nationalite
        resultat["nationalite_nom"] = CODES_PAYS_ICAO.get(nationalite, nationalite)

    except Exception:
        pass

    return resultat


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


def verifier_checksum_mrz(ligne: str) -> bool:
    """
    Vérifie le checksum d'une ligne MRZ.

    Le checksum ICAO 9303 calcule une somme de contrôle
    sur les caractères (A=10, B=11, ... Z=35) modulo 10.
    """
    if not ligne:
        return False

    ligne = ligne.replace("<", "0")
    total = 0
    for i, c in enumerate(ligne):
        if c.isdigit():
            valeur = int(c)
        elif c.isalpha():
            valeur = ord(c) - 55  # A=10, B=11, ...
        else:
            valeur = 0

        # Poids : 7, 3, 1, 7, 3, 1... (cycle)
        poids = [7, 3, 1]
        total += valeur * poids[i % 3]

    return total % 10 == 0


def detecter_format_mrz(l1: str, l2: str, l3: Optional[str] = None) -> str:
    """Détecte le format MRZ en fonction de la longueur des lignes."""
    if l3:
        # TD1 : 3 lignes de 30 caractères
        if len(l1) <= 32 and len(l2) <= 32 and len(l3) <= 32:
            return "TD1"
    if l2:
        if len(l2) <= 36:
            return "TD2"
        if len(l2) <= 44:
            return "TD3"
    return "inconnu"


def parser_mrz_complet(l1: str, l2: str, l3: Optional[str] = None) -> dict:
    """
    Parseur MRZ universel : détecte le format et extrait les données.

    Point d'entrée unique pour parser n'importe quelle MRZ.
    """
    format_mrz = detecter_format_mrz(l1, l2, l3)

    if format_mrz == "TD1" and l3:
        resultat = parser_mrz_td1(l1, l2, l3)
    elif format_mrz == "TD3":
        resultat = parser_mrz_td3(l1, l2)
    elif format_mrz == "TD2":
        # TD2 similaire à TD3 mais 2×36
        resultat = parser_mrz_td3(l1, l2)
        resultat["format"] = "TD2"
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
        }

    return resultat
