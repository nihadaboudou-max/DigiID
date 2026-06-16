# -*- coding: utf-8 -*-
"""
Extraction structurée des champs de documents d'identité africains.

Supporte :
  - CNI (Côte d'Ivoire, Sénégal, Mali, Burkina Faso, Niger, Bénin, Togo, etc.)
  - Carte d'Identité Biométrique (CIP) — format ECOWAS
  - Passeports africains (via MRZ universel)
  - Carte de séjour / Permis de résidence
  - Permis de conduire
  - Tout document avec MRZ (fallback universel)

Stratégie :
  1. Détection du pays et type de document
  2. Extraction par patterns spécifiques au pays
  3. Fallback MRZ (standard ICAO 9303)
  4. Extraction générique par regex (dernier recours)
"""
import re
from typing import Optional

from src.modules.ocr_cni.mrz_parser import (
    CODES_PAYS_ICAO,
    parser_mrz_complet,
    verifier_checksum_mrz,
)
from src.modules.ocr_cni.schemas import (
    DonneesCNIExtraites,
    SexeCNI,
    TypeFormatCNI,
)
from src.noyau.journal import journal


# =============================================================================
# PATTERNS MULTI-PAYS
# =============================================================================
# Structure : pays -> { champs -> [patterns_regex] }

PATTERNS_DOCUMENTS: dict = {

    # ── CÔTE D'IVOIRE ──────────────────────────────────
    "cote_ivoire": {
        "indices_reconnaissance": [
            r"R[EÉ]PUBLIQUE\s*DE\s*C[OÔ]TE\s*D[''`]IVOIRE",
            r"COTE\s*D[''`]IVOIRE",
            r"CARTE\s*NATIONALE\s*D[''`]IDENTIT[EÉ]",
            r"CNI\s*CI",
        ],
        "champs": {
            "nom": [r"NOM\s*[:\\-]?\s*", r"Nom\s*[:\\-]?\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*[:\\-]?\s*", r"Pr[eé]nom(?:s)?\s*[:\\-]?\s*"],
            "sexe": [r"SEXE\s*[:\\-]?\s*", r"Sexe\s*[:\\-]?\s*"],
            "date_naissance": [r"N[EÉ][E\s]*LE?\s*[:\\-]?\s*", r"DATE\s*DE\s*NAISSANCE\s*[:\\-]?\s*", r"N[ée]\s*le\s*"],
            "lieu_naissance": [r"[Ll][iée]u?\s*de?\s*naissance\s*[:\\-]?\s*", r"LIEU\s*DE\s*NAISSANCE\s*[:\\-]?\s*", r"[Nn][eé]\s*[àa]\s*"],
            "numero": [r"N[Uu][Mm][Ee][Rr][Oo]\s*[:\\-]?\s*", r"N[°o]\s*[:\\-]?\s*", r"NUM[EÉ]RO\s*[:\\-]?\s*"],
            "date_delivrance": [r"DATE\s*DE\s*D[EÉ]LIVRANCE\s*[:\\-]?\s*", r"D[EÉ]LIVR[EÉ]\s*LE?\s*[:\\-]?\s*"],
            "date_expiration": [r"DATE\s*D[''`]EXPIRATION\s*[:\\-]?\s*", r"VALIDIT[EÉ]\s*[:\\-]?\s*", r"EXPIRATION\s*[:\\-]?\s*", r"VALABLE\s*JUSQU[''`]AU?\s*[:\\-]?\s*"],
            "autorite": [r"AUTORIT[EÉ]\s*DE\s*D[EÉ]LIVRANCE\s*[:\\-]?\s*", r"Autorit[eé]\s*d[ée]livrance\s*[:\\-]?\s*"],
            "taille": [r"TAILLE\s*[:\\-]?\s*", r"Taille\s*[:\\-]?\s*"],
        },
    },

    # ── SÉNÉGAL ────────────────────────────────────────
    "senegal": {
        "indices_reconnaissance": [
            r"R[EÉ]PUBLIQUE\s*DU\s*S[EÉ]N[EÉ]GAL",
            r"S[EÉ]N[EÉ]GAL",
            r"CARTE\s*NATIONALE\s*D[''`]IDENTIT[EÉ]\s*S[EÉ]N[EÉ]GALAISE",
        ],
        "champs": {
            "nom": [r"NOM\s*[:\\-]?\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*[:\\-]?\s*"],
            "sexe": [r"SEXE\s*[:\\-]?\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*[:\\-]?\s*", r"DATE\s*NAISSANCE\s*[:\\-]?\s*"],
            "lieu_naissance": [r"[Ll][iée]u?\s*naissance\s*[:\\-]?\s*"],
            "numero": [r"N[Uu][Mm][EÉ][Rr][Oo]\s*[:\\-]?\s*", r"N[°o]\s*[:\\-]?\s*"],
            "date_delivrance": [r"D[EÉ]LIVR[EÉ]\s*LE?\s*[:\\-]?\s*"],
            "date_expiration": [r"EXPIRATION\s*[:\\-]?\s*"],
            "taille": [r"TAILLE\s*[:\\-]?\s*"],
        },
    },

    # ── MALI ───────────────────────────────────────────
    "mali": {
        "indices_reconnaissance": [
            r"R[EÉ]PUBLIQUE\s*DU\s*MALI",
            r"CARTE\s*NATIONALE\s*D[''`]IDENTIT[EÉ]\s*MALIENNE",
        ],
        "champs": {
            "nom": [r"NOM\s*[:\\-]?\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "sexe": [r"SEXE\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "lieu_naissance": [r"[Ll][iée]u?\s*naissance\s*"],
            "numero": [r"N[°o]\s*", r"NUMERO\s*"],
            "date_delivrance": [r"D[EÉ]LIVR[EÉ]\s*LE?\s*"],
            "date_expiration": [r"DATE\s*EXPIRATION\s*"],
        },
    },

    # ── BURKINA FASO ───────────────────────────────────
    "burkina": {
        "indices_reconnaissance": [
            r"BURKINA\s*FASO",
            r"CARTE\s*NATIONALE\s*D[''`]IDENTIT[EÉ]\s*BURKINAB[EÉ]",
        ],
        "champs": {
            "nom": [r"NOM\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "sexe": [r"SEXE\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "numero": [r"N[°o]\s*"],
            "date_delivrance": [r"D[EÉ]LIVR[EÉ]\s*LE?\s*"],
            "date_expiration": [r"EXPIRATION\s*"],
        },
    },

    # ── NIGER ───────────────────────────────────────────
    "niger": {
        "indices_reconnaissance": [
            r"R[EÉ]PUBLIQUE\s*DU\s*NIGER",
            r"CARTE\s*NATIONALE\s*D[''`]IDENTIT[EÉ]",
        ],
        "champs": {
            "nom": [r"NOM\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "sexe": [r"SEXE\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "numero": [r"N[°o]\s*"],
        },
    },

    # ── BÉNIN ───────────────────────────────────────────
    "benin": {
        "indices_reconnaissance": [r"R[EÉ]PUBLIQUE\s*DU\s*B[EÉ]NIN", r"B[EÉ]NIN"],
        "champs": {
            "nom": [r"NOM\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "numero": [r"N[°o]\s*", r"NUMERO\s*"],
        },
    },

    # ── TOGO ────────────────────────────────────────────
    "togo": {
        "indices_reconnaissance": [r"R[EÉ]PUBLIQUE\s*TOGOLAISE", r"TOGO", r"CARTE\s*D[''`]IDENTIT[EÉ]\s*TOGOLAISE"],
        "champs": {
            "nom": [r"NOM\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "sexe": [r"SEXE\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "numero": [r"N[°o]\s*"],
        },
    },

    # ── GHANA ───────────────────────────────────────────
    "ghana": {
        "indices_reconnaissance": [
            r"GHANA\s*CARD", r"REPUBLIC\s*OF\s*GHANA",
            r"NIA\s*", r"NATIONAL\s*IDENTITY\s*CARD",
        ],
        "champs": {
            "nom": [r"SURNAME\s*[:\\-]?\s*", r"LAST\s*NAME\s*[:\\-]?\s*"],
            "prenoms": [r"OTHER\s*NAMES\s*[:\\-]?\s*", r"FIRST\s*NAME(?:S)?\s*[:\\-]?\s*", r"GIVEN\s*NAMES?\s*"],
            "sexe": [r"SEX\s*[:\\-]?\s*"],
            "date_naissance": [r"DATE\s*OF\s*BIRTH\s*[:\\-]?\s*", r"D[.:]?\s*O[.:]?\s*B[.:]?\s*"],
            "numero": [r"NIN\s*[:\\-]?\s*", r"ID\s*NUMBER\s*[:\\-]?\s*", r"NATIONAL\s*ID\s*"],
        },
    },

    # ── NIGERIA ─────────────────────────────────────────
    "nigeria": {
        "indices_reconnaissance": [
            r"NIGERIA", r"NATIONAL\s*IDENTITY\s*NUMBER",
            r"NIN\s*", r"NIMC\s*", r"FEDERAL\s*REPUBLIC\s*OF\s*NIGERIA",
        ],
        "champs": {
            "nom": [r"SURNAME\s*[:\\-]?\s*", r"LAST\s*NAME\s*[:\\-]?\s*"],
            "prenoms": [r"FIRST\s*NAME(?:S)?\s*[:\\-]?\s*", r"GIVEN\s*NAMES?\s*"],
            "sexe": [r"SEX\s*[:\\-]?\s*", r"GENDER\s*[:\\-]?\s*"],
            "date_naissance": [r"DATE\s*OF\s*BIRTH\s*[:\\-]?\s*", r"D[.:]?\s*O[.:]?\s*B[.:]?\s*"],
            "numero": [r"NIN\s*[:\\-]?\s*", r"NATIONAL\s*ID(?:ENTITY)?\s*(?:NUMBER)?\s*"],
            "lieu_naissance": [r"PLACE\s*OF\s*BIRTH\s*"],
            "date_expiration": [r"EXPIRY\s*DATE\s*", r"EXPIRES?\s*"],
        },
    },

    # ── CAMEROUN ────────────────────────────────────────
    "cameroun": {
        "indices_reconnaissance": [
            r"R[EÉ]PUBLIQUE\s*DU\s*CAMEROUN", r"CAMEROUN", r"CAMEROON",
        ],
        "champs": {
            "nom": [r"NOM\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "sexe": [r"SEXE\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "numero": [r"N[°o]\s*", r"NUMERO\s*"],
        },
    },

    # ── MAROC ───────────────────────────────────────────
    "maroc": {
        "indices_reconnaissance": [
            r"ROYAUME\s*DU\s*MAROC", r"MAROC",
            r"CARTE\s*NATIONALE\s*D[''`]IDENTIT[EÉ]\s*",
        ],
        "champs": {
            "nom": [r"NOM\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "sexe": [r"SEXE\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "numero": [r"N[°o]\s*", r"CIN\s*"],
        },
    },

    # ── ALGÉRIE ─────────────────────────────────────────
    "algerie": {
        "indices_reconnaissance": [
            r"ALG[EÉ]RIE", r"R[EÉ]PUBLIQUE\s*ALG[EÉ]RIENNE",
            r"CARTE\s*NATIONALE\s*D[''`]IDENTIT[EÉ]\s*ALG[EÉ]RIENNE",
        ],
        "champs": {
            "nom": [r"NOM\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "sexe": [r"SEXE\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "numero": [r"N[°o]\s*"],
        },
    },

    # ── TUNISIE ─────────────────────────────────────────
    "tunisie": {
        "indices_reconnaissance": [
            r"TUNISIE", r"R[EÉ]PUBLIQUE\s*TUNISIENNE",
            r"CARTE\s*D[''`]IDENTIT[EÉ]\s*NATIONALE",
        ],
        "champs": {
            "nom": [r"NOM\s*"],
            "prenoms": [r"PR[EÉ]NOM(?:S)?\s*"],
            "date_naissance": [r"N[EÉ]\s*LE?\s*"],
            "numero": [r"N[°o]\s*"],
        },
    },
}


# =============================================================================
# PATTERNS GÉNÉRIQUES
# =============================================================================

PATTERN_DATE = r"(\d{2})\s*[/.\-]\s*(\d{2})\s*[/.\-]\s*(\d{4})"
PATTERN_SEXE = r"\b(Masculin|Féminin|M[\.]?|F[\.]?|Male|Female)\b"
PATTERN_TAILLE = r"(\d{3})\s*cm"
PATTERN_NIN = r"\b(\d{11})\b"


# =============================================================================
# Fonctions d'extraction
# =============================================================================

def _nettoyer_texte(texte: str) -> str:
    if not texte:
        return ""
    texte = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", texte)
    return texte.strip()


def _detecter_pays(texte: str) -> Optional[str]:
    texte_upper = texte.upper()
    for pays, config in PATTERNS_DOCUMENTS.items():
        for indice in config["indices_reconnaissance"]:
            if re.search(indice, texte_upper):
                journal.info(f"Pays détecté : {pays}")
                return pays
    return None


def _extraire_valeur_label(texte: str, patterns_label: list[str], contexte: str = "nom") -> Optional[str]:
    """Extrait la valeur après un label sur la même ligne ou ligne suivante."""
    lignes = texte.split("\n")
    for i, ligne in enumerate(lignes):
        ligne_propre = ligne.strip()
        for pattern in patterns_label:
            match = re.search(pattern, ligne_propre, re.IGNORECASE)
            if match:
                # Valeur sur la même ligne après le label
                valeur = ligne_propre[match.end():].strip()
                valeur = re.sub(r"^[:\\-.\s]+", "", valeur)
                valeur = re.sub(r"[:\\-.\s]+$", "", valeur)
                if valeur and not re.match(r"^\s*$", valeur):
                    return _nettoyer_valeur(valeur, contexte)

                # Valeur sur la ligne suivante
                if i + 1 < len(lignes):
                    suivante = lignes[i + 1].strip()
                    # Ne pas prendre si c'est un autre label
                    est_label = any(
                        re.search(p, suivante, re.IGNORECASE)
                        for cfg in PATTERNS_DOCUMENTS.values()
                        for chpats in cfg["champs"].values()
                        for p in chpats
                    )
                    if suivante and len(suivante) > 3 and not est_label:
                        return _nettoyer_valeur(suivante, contexte)

                return None
    return None


def _nettoyer_valeur(valeur: str, contexte: str) -> str:
    valeur = valeur.strip().strip(":;,.- ")

    if contexte == "numero":
        valeur = "".join(c for c in valeur.upper() if c.isalnum())
        if len(valeur) > 20:
            valeur = valeur[:20]

    elif contexte == "sexe":
        valeur = valeur.upper()[:1]
        if valeur in ("M", "F"):
            return valeur
        if valeur.upper().startswith("MASC"):
            return "M"
        if valeur.upper().startswith("FEM"):
            return "F"
        return "non_detecte"

    elif contexte == "date_naissance":
        valeur = re.sub(r"[.\-]", "/", valeur)
        match = re.search(PATTERN_DATE, valeur)
        if match:
            valeur = f"{match.group(1)}/{match.group(2)}/{match.group(3)}"

    elif contexte == "taille":
        match = re.search(r"(\d{3})", valeur)
        if match:
            valeur = match.group(1)

    return valeur


def _extraire_generique(texte: str) -> dict:
    """Extraction de dernier recours : patterns universels."""
    resultats: dict = {}
    texte_upper = texte.upper()

    # NIN Nigeria (11 chiffres)
    nin = re.search(PATTERN_NIN, texte)
    if nin:
        resultats["numero_cni"] = nin.group(1)

    # Numéros CNI (8-15 alphanum)
    numeros = re.findall(r"\b([A-Z0-9]{9,15})\b", texte_upper)
    for num in numeros:
        if not re.match(r"^[A-Z]{6,}$", num):
            resultats.setdefault("numero_cni", num)
            break

    # Dates
    dates = re.findall(PATTERN_DATE, texte)
    if dates:
        d = dates[0]
        resultats["date_naissance"] = f"{d[0]}/{d[1]}/{d[2]}"

    # Sexe
    sexe = re.search(PATTERN_SEXE, texte, re.IGNORECASE)
    if sexe:
        s = sexe.group(1).upper()[:1]
        resultats["sexe"] = "M" if s == "M" else "F"

    # Taille
    taille = re.search(PATTERN_TAILLE, texte, re.IGNORECASE)
    if taille:
        resultats["taille"] = taille.group(1)

    return resultats


def _fusionner_mrz_donnees(donnees: DonneesCNIExtraites, mrz_parse: dict) -> DonneesCNIExtraites:
    """MRZ comble les champs manquants de l'OCR."""
    modifs = {}
    if mrz_parse.get("nom_famille") and not donnees.nom_famille:
        modifs["nom_famille"] = mrz_parse["nom_famille"]
    if mrz_parse.get("prenoms") and not donnees.prenoms:
        modifs["prenoms"] = mrz_parse["prenoms"]
    if mrz_parse.get("numero_document") and not donnees.numero_cni:
        modifs["numero_cni"] = mrz_parse["numero_document"]
    if mrz_parse.get("date_naissance_date") and not donnees.date_naissance:
        modifs["date_naissance"] = mrz_parse["date_naissance_date"]
    if mrz_parse.get("sexe") and (not donnees.sexe or donnees.sexe == "non_detecte"):
        modifs["sexe"] = mrz_parse["sexe"]
    if mrz_parse.get("date_expiration_date") and not donnees.date_expiration:
        modifs["date_expiration"] = mrz_parse["date_expiration_date"]
    if modifs:
        return donnees.model_copy(update=modifs)
    return donnees


# =============================================================================
# Point d'entrée principal
# =============================================================================

def extraire_donnees_cni(
    texte_brut: str,
    confiance: float = 0.0,
    mrz_lignes: tuple = (None, None, None),
) -> DonneesCNIExtraites:
    """
    Extrait les champs d'un document d'identité depuis le texte OCR.

    Pipeline :
      1. Nettoyage du texte
      2. Détection du pays → patterns spécifiques
      3. Parsing MRZ (universel, standard ICAO 9303)
      4. Fusion MRZ → OCR
      5. Extraction générique (fallback)
    """
    if not texte_brut:
        return DonneesCNIExtraites(
            format_carte="non_reconnu",
            texte_brut="",
            taux_confiance_moyen=confiance,
        )

    texte = _nettoyer_texte(texte_brut)

    # ── Étape 1 : Détection du pays ──
    pays = _detecter_pays(texte)
    format_carte: TypeFormatCNI = "non_reconnu"
    if pays:
        format_carte = "nouveau_2021"  # Format biométrique moderne

    # ── Étape 2 : Extraction par pays ──
    nom = None
    prenoms = None
    sexe_str: SexeCNI = "non_detecte"
    date_naissance = None
    lieu_naissance = None
    numero = None
    date_delivrance = None
    date_expiration = None
    autorite = None
    taille = None

    if pays and pays in PATTERNS_DOCUMENTS:
        champs = PATTERNS_DOCUMENTS[pays]["champs"]

        nom = _extraire_valeur_label(texte, champs.get("nom", []), "nom")
        prenoms = _extraire_valeur_label(texte, champs.get("prenoms", []), "prenoms")

        sexe_val = _extraire_valeur_label(texte, champs.get("sexe", []), "sexe")
        if sexe_val:
            sexe_str = sexe_val
            if sexe_str not in ("M", "F"):
                sexe_str = "non_detecte"

        date_naissance = _extraire_valeur_label(texte, champs.get("date_naissance", []), "date_naissance")
        lieu_naissance = _extraire_valeur_label(texte, champs.get("lieu_naissance", []), "lieu_naissance")
        numero = _extraire_valeur_label(texte, champs.get("numero", []), "numero")
        date_delivrance = _extraire_valeur_label(texte, champs.get("date_delivrance", []), "date_delivrance")
        date_expiration = _extraire_valeur_label(texte, champs.get("date_expiration", []), "date_expiration")
        autorite = _extraire_valeur_label(texte, champs.get("autorite", []), "autorite")
        taille = _extraire_valeur_label(texte, champs.get("taille", []), "taille")

    # ── Étape 3 : Parsing MRZ (universel) ──
    mrz_parse = {}
    l1, l2, l3 = mrz_lignes
    if l1 and l2:
        mrz_parse = parser_mrz_complet(l1, l2, l3)
        journal.info(f"MRZ parsée : format={mrz_parse.get('format')}, pays={mrz_parse.get('pays_emetteur')}, type={mrz_parse.get('type_document')}")

        # MRZ comble les champs manquants
        if not nom:
            nom = mrz_parse.get("nom_famille")
        if not prenoms:
            prenoms = mrz_parse.get("prenoms")
        if not numero:
            numero = mrz_parse.get("numero_document")
        if not date_naissance:
            date_naissance = mrz_parse.get("date_naissance_date")
        if sexe_str == "non_detecte" and mrz_parse.get("sexe"):
            sexe_str = mrz_parse["sexe"]
        if not date_expiration:
            date_expiration = mrz_parse.get("date_expiration_date")

    # ── Étape 4 : Extraction générique (fallback) ──
    if not any([nom, prenoms, date_naissance, numero]):
        journal.info("Extraction spécifique infructueuse, tentative générique...")
        generique = _extraire_generique(texte)
        numero = numero or generique.get("numero_cni")
        date_naissance = date_naissance or generique.get("date_naissance")

    # ── Construction du résultat ──
    donnees = DonneesCNIExtraites(
        nom_famille=nom,
        prenoms=prenoms,
        sexe=sexe_str,
        date_naissance=date_naissance,
        lieu_naissance=lieu_naissance,
        numero_cni=numero,
        date_delivrance=date_delivrance,
        date_expiration=date_expiration,
        autorite_delivrance=autorite,
        taille=taille,
        mrz_ligne_1=mrz_lignes[0] if len(mrz_lignes) > 0 else None,
        mrz_ligne_2=mrz_lignes[1] if len(mrz_lignes) > 1 else None,
        mrz_ligne_3=mrz_lignes[2] if len(mrz_lignes) > 2 else None,
        format_carte=format_carte,
        texte_brut=texte_brut[:5000],
        taux_confiance_moyen=confiance,
    )

    # ── Fusion MRZ → OCR ──
    if mrz_parse:
        donnees = _fusionner_mrz_donnees(donnees, mrz_parse)

    champs_trouves = sum(1 for v in [nom, prenoms, date_naissance, numero, date_expiration] if v)
    journal.info(f"Extraction document : pays={pays or 'inconnu'}, MRZ={'OK' if mrz_parse else 'NON'}, champs={champs_trouves}/5")

    return donnees
