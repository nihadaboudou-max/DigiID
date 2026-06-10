# -*- coding: utf-8 -*-
"""
Extraction structurée des champs de la Carte Nationale d'Identité française.

Ce module implémente les patterns de reconnaissance pour tous les champs
présents sur une CNI française, qu'il s'agisse du format ancien (1995-2021)
ou du nouveau format (2021+, format carte de crédit).

Champs extraits :
  - Nom de famille
  - Prénom(s)
  - Sexe
  - Date de naissance (JJ/MM/AAAA)
  - Lieu de naissance
  - Numéro de carte (12 car. alphanumériques)
  - Date de délivrance
  - Date d'expiration
  - Autorité de délivrance
  - Taille
  - Zone MRZ (Machine Readable Zone)
"""
import re
from typing import Optional

from src.modules.ocr_cni.schemas import (
    DonneesCNIExtraites,
    SexeCNI,
    TypeFormatCNI,
)
from src.noyau.journal import journal


# =============================================================================
# Constantes — Labels et patterns des champs CNI
# =============================================================================

# --- Labels français (nouveau format 2021) ---
LABELS_NOUVEAU = {
    "nom": [r"NOM\s*:?", r"Nom\s*:?", r"NOM\s*$", r"^NOM\b"],
    "prenoms": [r"PRENOMS?\s*:?", r"Pr[eé]nom\s*:?", r"PRÉNOMS?\s*:?"],
    "sexe": [r"SEXE\s*:?", r"Sexe\s*:?"],
    "date_naissance": [
        r"N[ée]\s*le?\s*:?",
        r"Date\s*de\s*naissance\s*:?",
        r"DATE\s*DE\s*NAISSANCE\s*:?",
    ],
    "lieu_naissance": [
        r"[Ll][iée]u?\s*de?\s*naissance\s*:?",
        r"LIEU\s*DE\s*NAISSANCE\s*:?",
        r"[Nn]é\s*[àa]\s*",
    ],
    "numero": [
        r"Num[eé]ro\s*:?\s*",
        r"N°\s*:?\s*",
        r"NUMERO\s*:?\s*",
        r"N°\s*",
    ],
    "date_delivrance": [
        r"Date\s*de\s*d[eé]livrance\s*:?",
        r"DATE\s*DE\s*D[EÉ]LIVRANCE\s*:?",
        r"D[eé]livr[ée]\s*le?\s*:?",
    ],
    "date_expiration": [
        r"Date\s*d['eé]xpiration\s*:?",
        r"DATE\s*D['EÉ]XPIRATION\s*:?",
        r"Expire\s*le?\s*:?",
        r"Expirant\s*le?\s*:?",
        r"Valable\s*jusqu['aà]\s*:?",
        r"VALIDIT[EÉ]\s*:?",
    ],
    "autorite": [
        r"Autorit[eé]\s*de?\s*d[eé]livrance\s*:?",
        r"AUTORIT[EÉ]\s*DE\s*D[EÉ]LIVRANCE\s*:?",
        r"D[eé]livr[ée]\s*par\s*:?",
    ],
    "taille": [
        r"Taille\s*:?",
        r"TAILLE\s*:?",
    ],
}

# --- Labels pour l'ancien format (1995-2021) ---
LABELS_ANCIEN = {
    "nom": [r"NOM\s*:", r"Nom\s*:"],
    "prenoms": [r"Pr[eé]nom\s*:", r"PRENOM\s*:"],
    "date_naissance": [r"N[eé]\s*le\s*:"],
    "numero": [r"N[o°]\s*:", r"Num[eé]ro\s*:"],
    "date_delivrance": [r"[lL]e\s*(\d{2}[./-]\d{2}[./-]\d{4})"],
    "signature": [r"Signature\s*du\s*titulaire"],
}

# --- Pattern générique de date (JJ/MM/AAAA) ---
PATTERN_DATE = r"(\d{2})\s*[/.\-]\s*(\d{2})\s*[/.\-]\s*(\d{4})"

# --- Pattern numéro CNI (12 caractères alphanumériques) ---
# Format : 12 caractères, souvent regroupés (ex: 12AB34567CD)
PATTERN_NUMERO_CNI = r"\b([A-Z0-9]{2,3}[\s\-]?[A-Z0-9]{2,3}[\s\-]?[A-Z0-9]{2,3}[\s\-]?[A-Z0-9]{2,3}[\s\-]?[A-Z0-9]{0,4})\b"

# --- Pattern sexe ---
PATTERN_SEXE = r"\b([MFmf])\b"

# --- Pattern taille ---
PATTERN_TAILLE = r"(\d{3})\s*cm"


def _nettoyer_texte(texte: str) -> str:
    """Nettoie le texte OCR pour faciliter l'extraction."""
    if not texte:
        return ""
    # Remplacer les retours à la ligne par des espaces
    texte = texte.replace("\n", " ")
    # Réduire les espaces multiples
    texte = re.sub(r"\s+", " ", texte)
    # Supprimer les caractères de contrôle
    texte = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", texte)
    return texte.strip()


def _extraire_valeur_apres_label(texte: str, patterns_label: list[str],
                                   jusqu_a: Optional[str] = None) -> Optional[str]:
    """
    Extrait la valeur qui suit un label dans le texte.

    Args :
        texte : Texte OCR complet
        patterns_label : Liste de patterns regex pour le label
        jusqu_a : Pattern optionnel pour arrêter la capture

    Retour :
        La valeur extraite, ou None si non trouvée.
    """
    for pattern in patterns_label:
        if jusqu_a:
            match = re.search(f"{pattern}\\s*(.*?)(?:{jusqu_a}|$)", texte, re.IGNORECASE)
        else:
            match = re.search(f"{pattern}\\s*(.*?)(?=\\s+(?:{'|'.join(sum(LABELS_NOUVEAU.values(), []))})|$)",
                              texte, re.IGNORECASE | re.DOTALL)
        if match:
            valeur = match.group(1).strip()
            # Nettoyer la valeur
            valeur = re.sub(r"\s+", " ", valeur)
            # Limiter à une longueur raisonnable
            max_longueur = {
                "nom": 50, "prenoms": 80, "sexe": 5,
                "date_naissance": 15, "lieu_naissance": 100,
                "numero": 20, "date_delivrance": 15, "date_expiration": 15,
                "autorite": 100, "taille": 10,
            }.get("nom", 50)  # Fallback
            # On ne peut pas savoir quel label ici, on prend 100 par défaut
            if len(valeur) > 200:
                valeur = valeur[:200]
            return valeur if valeur else None
    return None


def _extraire_valeur_apres_label_v2(texte: str, patterns_label: list[str],
                                     contexte: str = "nom") -> Optional[str]:
    """
    Version améliorée d'extraction qui utilise le contexte pour mieux capturer.

    Découpe le texte en lignes et cherche le label, puis prend la ligne suivante
    ou la valeur sur la même ligne après le label.
    """
    lignes = texte.split("\n")
    for i, ligne in enumerate(lignes):
        ligne_propre = ligne.strip()
        for pattern_label in patterns_label:
            match = re.search(pattern_label, ligne_propre, re.IGNORECASE)
            if match:
                # Valeur sur la même ligne
                valeur = re.sub(pattern_label, "", ligne_propre, flags=re.IGNORECASE).strip()
                if valeur:
                    return _nettoyer_valeur_extraite(valeur, contexte)

                # Valeur sur la ligne suivante
                if i + 1 < len(lignes):
                    valeur_suivante = lignes[i + 1].strip()
                    if valeur_suivante and not re.match(
                        r"^(" + "|".join(sum(LABELS_NOUVEAU.values(), [])) + r")",
                        valeur_suivante, re.IGNORECASE
                    ):
                        return _nettoyer_valeur_extraite(valeur_suivante, contexte)

                return None
    return None


def _nettoyer_valeur_extraite(valeur: str, contexte: str) -> str:
    """Nettoie une valeur extraite selon son contexte."""
    # Enlever les caractères non pertinents aux extrémités
    valeur = valeur.strip().strip(":;,.-")

    if contexte == "numero":
        # Ne garder que les caractères alphanumériques
        valeur = "".join(c for c in valeur.upper() if c.isalnum())

    elif contexte == "date_naissance":
        # Nettoyer les séparateurs de date
        valeur = re.sub(r"[.\-]", "/", valeur)
        # Vérifier que ça ressemble à une date
        if not re.match(r"\d{2}/\d{2}/\d{4}", valeur):
            # Chercher un pattern date dans la valeur
            match = re.search(PATTERN_DATE, valeur)
            if match:
                valeur = f"{match.group(1)}/{match.group(2)}/{match.group(3)}"

    elif contexte == "sexe":
        valeur = valeur.upper()[:1]
        if valeur not in ("M", "F"):
            return "non_detecte"

    return valeur


def _detecter_format_carte(texte: str) -> TypeFormatCNI:
    """
    Détecte le format de la carte CNI à partir du texte OCR.

    Le nouveau format (2021) est au format carte de crédit et contient
    généralement les labels "NOM", "PRENOMS", "SEXE" clairement séparés.
    """
    # Indices du nouveau format
    indices_nouveau = [
        "RÉPUBLIQUE FRANÇAISE",
        "REPUBLIQUE FRANCAISE",
        "RF",
        "NOM\nPRENOMS",
        "NOM\nPRÉNOMS",
    ]
    for indice in indices_nouveau:
        if indice in texte.upper().replace(" ", ""):
            return "nouveau_2021"

    # Indices de l'ancien format
    indices_ancien = [
        "CARTE NATIONALE D'IDENTITÉ",
        "CARTE NATIONALE D'IDENTITE",
        "CNI",
        "RÉPUBLIQUE FRANÇAISE",
    ]
    for indice in indices_ancien:
        if indice in texte.upper():
            return "ancien"

    return "non_reconnu"


def _extraire_depuis_texte_brut(texte: str) -> dict:
    """
    Extraction de secours : tente d'extraire des informations depuis
    le texte brut en utilisant des patterns génériques.
    """
    resultats = {}

    # Chercher un numéro CNI (12 caractères alphanumériques)
    matches = re.findall(r"\b([A-Z0-9]{12})\b", texte.upper())
    if matches:
        resultats["numero_cni"] = matches[0]

    # Chercher des dates
    dates = re.findall(PATTERN_DATE, texte)
    if dates:
        # La première date est souvent la date de naissance
        resultats["date_naissance"] = f"{dates[0][0]}/{dates[0][1]}/{dates[0][2]}"

    # Chercher le sexe
    match_sexe = re.search(r"\b(Féminin|Masculin|M|F)\b", texte, re.IGNORECASE)
    if match_sexe:
        sexe = match_sexe.group(1).upper()
        if sexe in ("FÉMININ", "F"):
            resultats["sexe"] = "F"
        elif sexe in ("MASCULIN", "M"):
            resultats["sexe"] = "M"

    # Chercher la taille
    match_taille = re.search(r"(\d{3})\s*cm", texte, re.IGNORECASE)
    if match_taille:
        resultats["taille"] = match_taille.group(1)

    return resultats


def extraire_donnees_cni(texte_brut: str,
                          confiance: float = 0.0,
                          mrz_lignes: tuple = (None, None, None)) -> DonneesCNIExtraites:
    """
    Extrait tous les champs structurés d'une CNI depuis le texte OCR brut.

    Args :
        texte_brut : Texte complet extrait par l'OCR
        confiance : Taux de confiance moyen de l'OCR (0-100)
        mrz_lignes : Tuple des 3 lignes MRZ

    Retour :
        DonneesCNIExtraites avec les champs remplis selon ce qui a été trouvé.
    """
    if not texte_brut:
        return DonneesCNIExtraites(
            format_carte="non_reconnu",
            texte_brut="",
            taux_confiance_moyen=confiance,
        )

    texte = texte_brut
    format_carte = _detecter_format_carte(texte)

    # Choisir les labels selon le format
    labels = LABELS_NOUVEAU if format_carte == "nouveau_2021" else LABELS_ANCIEN
    if format_carte == "non_reconnu":
        labels = LABELS_NOUVEAU  # Fallback sur nouveau format

    # --- Extraction structurée ---

    # Nom de famille
    nom = _extraire_valeur_apres_label_v2(texte, labels["nom"], "nom")

    # Prénom(s)
    prenoms = _extraire_valeur_apres_label_v2(texte, labels["prenoms"], "prenoms")

    # Sexe
    sexe_str = _extraire_valeur_apres_label_v2(texte, labels["sexe"], "sexe")
    if sexe_str:
        sexe_str = sexe_str.upper()[:1]
        if sexe_str not in ("M", "F"):
            sexe_str = "non_detecte"
    else:
        # Fallback : chercher dans le texte
        match_sexe = re.search(r"\b(Masculin|Féminin|M\.|F\.)\b", texte, re.IGNORECASE)
        if match_sexe:
            s = match_sexe.group(1).upper()
            sexe_str = "F" if s.startswith("F") else "M"
        else:
            sexe_str = "non_detecte"

    # Date de naissance
    date_naissance = _extraire_valeur_apres_label_v2(texte, labels["date_naissance"], "date_naissance")

    # Lieu de naissance
    lieu_naissance_extrait = _extraire_valeur_apres_label_v2(texte, labels["lieu_naissance"], "lieu_naissance")

    # Numéro CNI
    numero = _extraire_valeur_apres_label_v2(texte, labels["numero"], "numero")
    if numero:
        # Nettoyer et formater
        numero = "".join(c for c in numero.upper() if c.isalnum())
        if len(numero) <= 15:
            pass  # Format plausible
        else:
            numero = None

    # Si pas de numéro trouvé, chercher dans le texte brut
    if not numero:
        # Chercher un pattern de 12 caractères alphanumériques
        matches = re.findall(r"\b([A-Z0-9]{12})\b", texte.upper())
        if matches:
            # Filtrer les faux positifs (mots trop communs)
            for m in matches:
                if not re.match(r"^[A-Z]{6,}$", m):  # Éviter les mots seulement alpha
                    numero = m
                    break

    # Date de délivrance
    date_delivrance = _extraire_valeur_apres_label_v2(texte, labels["date_delivrance"], "date_delivrance")

    # Date d'expiration
    date_expiration = _extraire_valeur_apres_label_v2(texte, labels["date_expiration"], "date_expiration")

    # Autorité de délivrance
    autorite = _extraire_valeur_apres_label_v2(texte, labels["autorite"], "autorite")

    # Taille
    taille = _extraire_valeur_apres_label_v2(texte, labels["taille"], "taille")

    # Si certains champs sont manquants, essayer l'extraction depuis le texte brut
    if not any([nom, prenoms, date_naissance, numero]):
        journal.info("Extraction structurée limitée, tentative d'extraction brute...")
        extraits_bruts = _extraire_depuis_texte_brut(texte)
        numero = numero or extraits_bruts.get("numero_cni")
        date_naissance = date_naissance or extraits_bruts.get("date_naissance")

    # Normalisation des dates
    for champ_date in [date_naissance, date_delivrance, date_expiration]:
        if champ_date:
            # Nettoyer
            champ_date = re.sub(r"[.\-]", "/", champ_date)
            # Extraire juste la date si entourée d'autres textes
            match = re.search(PATTERN_DATE, champ_date)
            if match:
                champ_date = f"{match.group(1)}/{match.group(2)}/{match.group(3)}"

    # Construire le résultat
    donnees = DonneesCNIExtraites(
        nom_famille=nom,
        prenoms=prenoms,
        sexe=sexe_str,  # type: ignore
        date_naissance=date_naissance,
        lieu_naissance=lieu_naissance_extrait,
        numero_cni=numero,
        date_delivrance=date_delivrance,
        date_expiration=date_expiration,
        autorite_delivrance=autorite,
        taille=taille,
        mrz_ligne_1=mrz_lignes[0],
        mrz_ligne_2=mrz_lignes[1],
        mrz_ligne_3=mrz_lignes[2],
        format_carte=format_carte,
        texte_brut=texte_brut[:5000],  # Limiter la taille stockée
        taux_confiance_moyen=confiance,
    )

    journal.info(
        f"Extraction CNI terminée : format={format_carte}, "
        f"champs_trouvés={sum(1 for v in [nom, prenoms, date_naissance, numero, date_expiration] if v)}/5"
    )

    return donnees
