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
    # ── SÉNÉGAL ───────────────────────────────────────
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
    # ── MALI ──────────────────────────────────────────
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
    # ── CAMEROUN ───────────────────────────────────────
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
    # ── TUNISIE ────────────────────────────────────────
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
PATTERN_DATE = r"(\d{2})\s*[/.-]\s*(\d{2})\s*[/.-]\s*(\d{4})"
PATTERN_SEXE = r"\b(Masculin|Féminin|M[.]?|F[.]?|Male|Female)\b"
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
    """
    Extrait la valeur après un label sur la même ligne ou ligne suivante.
    
    Stratégies (dans l'ordre) :
      1. Label + valeur sur même ligne (avec ou sans séparateur)
      2. Label sur ligne N, valeur sur ligne N+1
      3. Fallback : recherche dans tout le texte
    """
    if not texte or not patterns_label:
        return None
    
    lignes = texte.split("\n")
    
    # ── STRATÉGIE 1 : Label et valeur sur la MÊME ligne ──
    for i, ligne in enumerate(lignes):
        ligne_propre = ligne.strip()
        for pattern in patterns_label:
            match = re.search(pattern, ligne_propre, re.IGNORECASE)
            if match:
                # Valeur sur la même ligne après le label
                valeur = ligne_propre[match.end():].strip()
                valeur = re.sub(r"^[:.\s\-/]+", "", valeur)  # Séparateurs optionnels
                valeur = re.sub(r"[:.\s\-/]+$", "", valeur)
                
                if valeur and len(valeur) >= 2:
                    return _nettoyer_valeur(valeur, contexte)
                
                # ── STRATÉGIE 2 : Valeur sur la ligne suivante ──
                if i + 1 < len(lignes):
                    suivante = lignes[i + 1].strip()
                    
                    # Vérifier que ce n'est pas un autre label
                    labels_connus = [
                        r"NOM", r"PR[EÉ]NOM", r"SEXE", r"DATE", r"NUM[EÉ]RO", 
                        r"N[°o]", r"LIEU", r"AUTORIT[EÉ]", r"TAILLE", r"EXPIR",
                        r"SURNAME", r"FIRST\s*NAME", r"OTHER\s*NAMES",
                        r"SEX", r"GENDER", r"NIN", r"ID\s*NUMBER"
                    ]
                    est_label = any(
                        re.search(label, suivante, re.IGNORECASE)
                        for label in labels_connus
                    )
                    
                    if suivante and len(suivante) > 2 and not est_label:
                        return _nettoyer_valeur(suivante, contexte)
                
                return None
    
    # ── STRATÉGIE 3 : Fallback — recherche dans tout le texte ──
    # Utile quand le label et la valeur sont séparés par plusieurs lignes
    for pattern in patterns_label:
        # Chercher le pattern suivi de n'importe quel caractère (y compris \n)
        regex_fallback = rf"{pattern}\s*[:\-/]?\s*([A-Za-zÀ-ÿ0-9\-'.,\s<>()]{{2,60}})"
        match = re.search(regex_fallback, texte, re.IGNORECASE | re.MULTILINE)
        if match:
            valeur = match.group(1).strip()
            if valeur and len(valeur) >= 2:
                return _nettoyer_valeur(valeur, contexte)
    
    return None

def _nettoyer_valeur(valeur: str, contexte: str) -> str:
    """
    Nettoie et valide une valeur extraite par l'OCR selon son contexte.
    
    Règles critiques :
    - Rejette les valeurs purement numériques pour les noms/prénoms (anti-hallucination)
    - Normalise les dates au format JJ/MM/AAAA
    - Corrige les erreurs OCR classiques dans les numéros (O→0, I→1)
    - Retourne "non_detecte" pour le sexe quand incertain (conforme au schéma Pydantic)
    """
    if not valeur:
        return ""
    
    valeur = valeur.strip().strip(":;,.-\"' ")
    
    # ── CONTEXTE : NOM / PRÉNOMS / LIEU / AUTORITÉ ──
    # 🛡️ RÈGLE CRITIQUE : Rejeter les valeurs purement numériques
    if contexte in ("nom", "prenoms", "lieu_naissance", "autorite"):
        # Rejeter si c'est uniquement des chiffres (artefact OCR)
        if re.match(r"^\d+$", valeur):
            return ""
        # Ne garder que lettres, espaces, tirets, apostrophes et accents
        valeur = re.sub(r"[^a-zA-ZÀ-ÿ\s\-']", "", valeur)
        # Rejeter si trop court après nettoyage
        return valeur.strip() if len(valeur.strip()) >= 2 else ""
    
    # ── CONTEXTE : NUMÉRO DE DOCUMENT ──
    elif contexte == "numero":
        # Ne garder que les caractères alphanumériques
        valeur = "".join(c for c in valeur.upper() if c.isalnum())
        # Correction des erreurs OCR classiques
        valeur = valeur.replace("O", "0").replace("I", "1").replace("L", "1")
        # Limiter la longueur
        if len(valeur) > 20:
            valeur = valeur[:20]
        # Rejeter si trop court (minimum 5 caractères pour un numéro valide)
        return valeur if len(valeur) >= 5 else ""
    
    # ─ CONTEXTE : SEXE ──
    elif contexte == "sexe":
        valeur = valeur.upper().strip()
        # Cas directs
        if valeur in ("M", "H", "MASCULIN", "MALE"):
            return "M"
        if valeur in ("F", "FEMININ", "FEMALE"):
            return "F"
        # Cas partiel (première lettre)
        if valeur.startswith("MASC") or valeur.startswith("MAL"):
            return "M"
        if valeur.startswith("FEM"):
            return "F"
        # Incertain → valeur par défaut du schéma
        return "non_detecte"
    
    # ── CONTEXTE : DATE DE NAISSANCE ──
    elif contexte == "date_naissance":
        # Normaliser les séparateurs
        valeur = re.sub(r"[.\-]", "/", valeur)
        # Chercher le format JJ/MM/AAAA
        match = re.search(PATTERN_DATE, valeur)
        if match:
            jour = match.group(1).zfill(2)
            mois = match.group(2).zfill(2)
            annee = match.group(3)
            # Gérer les années à 2 chiffres
            if len(annee) == 2:
                annee = f"19{annee}" if int(annee) > 40 else f"20{annee}"
            return f"{jour}/{mois}/{annee}"
        return ""
    
    # ── CONTEXTE : TAILLE ──
    elif contexte == "taille":
        match = re.search(r"(\d{3})", valeur)
        if match:
            taille = int(match.group(1))
            # Validation : une taille humaine est entre 50 et 250 cm
            return match.group(1) if 50 <= taille <= 250 else ""
        return ""
    
    # ── CONTEXTE INCONNU : retour brut ──
    return valeur

def _extraire_generique(texte: str) -> dict:
    """Extraction de dernier recours : patterns universels."""
    resultats: dict = {}
    texte_upper = texte.upper()
    # 🔑 NUMÉRO CNI - Plusieurs patterns
    patterns_numero = [
        r"N[°O]\s*[:\-]?\s*([A-Z0-9]{8,20})",
        r"NUMERO\s*[:\-]?\s*([A-Z0-9]{8,20})",
        r"NIN\s*[:\-]?\s*(\d{11,15})",
        r"ID\s*(?:NUMBER)?\s*[:\-]?\s*([A-Z0-9]{8,20})",
        r"CARTE\s*N°\s*([A-Z0-9]{8,15})",
    ]
    for pattern in patterns_numero:
        match = re.search(pattern, texte_upper)
        if match:
            resultats["numero_cni"] = match.group(1).strip()
            break
    # Pattern 2 : NIN Nigeria (11 chiffres)
    if "numero_cni" not in resultats:
        nin = re.search(r"\b(\d{11})\b", texte)
        if nin:
            resultats["numero_cni"] = nin.group(1)
    # Pattern 3 : Chercher une longue séquence alphanumérique (fallback)
    if "numero_cni" not in resultats:
        numeros = re.findall(r"\b([A-Z0-9]{10,15})\b", texte_upper)
        for num in numeros:
            if not re.match(r"^[A-Z]{8,}$", num) and not re.match(r"^\d{8}$", num):
                resultats["numero_cni"] = num
                break
    #  DATE DE NAISSANCE - Formats multiples
    patterns_date = [
        r"N[ÉEÉ]\s+LE?\s+[:\-]?\s*(\d{1,2}\s*[/\-\.]\s*\d{1,2}\s*[/\-\.]\s*\d{2,4})",
        r"DATE\s+DE\s+NAISSANCE\s*[:\-]?\s*(\d{1,2}\s*[/\-\.]\s*\d{1,2}\s*[/\-\.]\s*\d{2,4})",
        r"NE\s+LE?\s+[:\-]?\s*(\d{1,2}\s*[/\-\.]\s*\d{1,2}\s*[/\-\.]\s*\d{2,4})",
        r"DATE\s+NAISSANCE\s*[:\-]?\s*(\d{1,2}\s*[/\-\.]\s*\d{1,2}\s*[/\-\.]\s*\d{2,4})",
    ]
    for pattern in patterns_date:
        match = re.search(pattern, texte_upper)
        if match:
            date_str = match.group(1).replace(" ", "")
            resultats["date_naissance"] = re.sub(r"[\-\.]", "/", date_str)
            break
    # Fallback : chercher une date au format JJ/MM/AAAA
    if "date_naissance" not in resultats:
        dates = re.findall(r"(\d{2})\s*[/.\-]\s*(\d{2})\s*[/.\-]\s*(\d{4})", texte)
        if dates:
            d = dates[0]
            aaaa = d[2]
            if len(aaaa) == 2:
                aaaa = "19" + aaaa if int(aaaa) > 40 else "20" + aaaa
            resultats["date_naissance"] = f"{d[0].zfill(2)}/{d[1].zfill(2)}/{aaaa}"
    # ♂️♀️ SEXE - Patterns multiples
    patterns_sexe = [
        (r"SEXE\s*[:\-]?\s*(MASCULIN|FEMININ|M|F)\b", lambda x: "M" if x.upper().startswith("M") else "F"),
        (r"SEX\s*[:\-]?\s*(MALE|FEMALE|M|F)\b", lambda x: "M" if x.upper() in ("MALE", "M") else "F"),
        (r"\b(MASCULIN)\b", lambda x: "M"),
        (r"\b(FEMININ)\b", lambda x: "F"),
        (r"\b(MALE)\b", lambda x: "M"),
        (r"\b(FEMALE)\b", lambda x: "F"),
    ]
    for pattern, transform in patterns_sexe:
        match = re.search(pattern, texte_upper)
        if match:
            resultats["sexe"] = transform(match.group(1))
            break
    # Fallback : chercher M ou F isolé près d'un label
    if "sexe" not in resultats:
        match_sexe_isole = re.search(r"SEXE\s*[:\-]?\s*([MF])\b", texte_upper)
        if match_sexe_isole:
            resultats["sexe"] = match_sexe_isole.group(1)
    # 📏 TAILLE (optionnel)
    match_taille = re.search(r"(\d{3})\s*cm", texte, re.IGNORECASE)
    if match_taille:
        resultats["taille"] = match_taille.group(1)
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
    # ─ Étape 2 : Extraction par pays ──
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
    nationalite = None
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
        
        # ✅ EXTRAIRE LA NATIONALITÉ DEPUIS LE MRZ
        if len(l1) >= 5:
            code_nationalite_mrz = l1[2:5]  # Positions 2-4 de la ligne 1
            nationalite = CODES_PAYS_ICAO.get(code_nationalite_mrz)
            journal.info(f"Nationalité extraite du MRZ: {nationalite} (code: {code_nationalite_mrz})")
 
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
    # ── Debug : Voir ce qui a été extrait ──
    journal.info(f"DEBUG EXTRACTION - Pays: {pays}")
    journal.info(f"DEBUG EXTRACTION - Nom: {nom}, Prénoms: {prenoms}")
    journal.info(f"DEBUG EXTRACTION - Sexe: {sexe_str}, Date naissance: {date_naissance}")
    journal.info(f"DEBUG EXTRACTION - Numéro: {numero}")
    journal.info(f"DEBUG EXTRACTION - MRZ lignes: {mrz_lignes}")
    # ── Étape 4 : Extraction générique (fallback) ──
    # ✅ CORRECTION : Toujours initialiser generique pour éviter NameError
    generique: dict = {}
    if not all([nom, prenoms, numero, date_naissance]):
        journal.info("Extraction spécifique infructueuse, tentative générique...")
        generique = _extraire_generique(texte)
        # Appliquer les résultats génériques si les champs sont vides
        numero = numero or generique.get("numero_cni")
        date_naissance = date_naissance or generique.get("date_naissance")
        # ✅ Récupérer le sexe s'il n'a pas été détecté
        if sexe_str == "non_detecte":
            sexe_gen = generique.get("sexe")
            if sexe_gen:
                sexe_str = sexe_gen
        # Récupérer la taille si manquante
        if not taille:
            taille = generique.get("taille")
        journal.info(f"Fallback générique - Numéro: {numero}, Date: {date_naissance}, Sexe: {sexe_str}")
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
        nationalite=nationalite,
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