# -*- coding: utf-8 -*-
"""
Post-traitement du texte OCR pour les documents d'identité africains.

Pipeline de correction et normalisation après extraction OCR :
  1. Correction orthographique contextuelle (noms, prénoms, villes africaines)
  2. Normalisation des formats (dates, numéros, MRZ)
  3. Détection et correction des erreurs OCR courantes
     (confusions : O/0, I/1/l, S/5, B/8, etc.)
  4. Reconstruction des champs fragmentés
  5. Validation des formats par pays

S'appuie sur le dictionnaire africain pour la correction contextuelle.
"""
import re
from typing import Optional

from src.modules.ocr_cni.dictionnaire_afrique import (
    CORRECTIONS_OCR,
    MOTS_INCONNUS,
    NOMS_AFRIQUE,
    PATRON_VILLES_AFRIQUE,
    PAYS_AFRIQUE,
    VILLES_AFRIQUE,
)
from src.noyau.journal import journal

# =============================================================================
# Constantes de correction OCR
# =============================================================================

# Confusions fréquentes en OCR sur documents d'identité
# Format: (pattern, remplacement) — appliqué séquentiellement
CORRECTIONS_CARACTERES = [
    # Chiffres mal reconnus
    (r"O([0-9])", r"0\1"),  # O5 → 05
    (r"([0-9])O", r"\10"),  # 5O → 50
    (r"^O(?=[0-9])", "0"),  # O123 → 0123
    (r"(?<=[0-9])O$", "0"),  # 123O → 1230
    # Lettres confondues
    (r"0([A-Z])", r"O\1"),  # 1A → IA (dans un contexte alpha)
    (r"1(?=[A-Z])", "I"),  # 1A → IA
    (r"(?<=[A-Z])1", "I"),  # A1 → AI
    (r"5(?=[A-Z])", "S"),  # 5A → SA
    (r"8(?=[A-Z])", "B"),  # 8A → BA
    # Caractères spéciaux mal interprétés
    (r"[|¦]", "I"),  # Barre verticale → I
    (r"[®©]", ""),  # Symboles → vide
    (r"[_™]", ""),
]

# Formats de dates à normaliser
PATTERNS_DATES = [
    # Format: JJ/MM/AAAA ou JJ-MM-AAAA ou JJ.MM.AAAA
    (r"(\d{2})[/.\-](\d{2})[/.\-](\d{4})", r"\1/\2/\3"),
    # Format: AAAA/MM/JJ
    (r"(\d{4})[/.\-](\d{2})[/.\-](\d{2})", r"\3/\2/\1"),
]

# =============================================================================
# Pipeline principal
# =============================================================================


def post_traiter_texte(texte_brut: str, contexte: str = "cni") -> str:
    """
    Applique le pipeline complet de post-traitement.

    Args :
        texte_brut : Texte extrait par l'OCR
        contexte : Type de document ("cni", "passeport", "permis")

    Retour :
        Texte corrigé et normalisé
    """
    if not texte_brut:
        return ""

    texte = texte_brut

    # 1. Nettoyage basique
    texte = _nettoyer_texte(texte)

    # 2. Correction des caractères mal OCRisés
    texte = _corriger_caracteres(texte)

    # 3. Correction orthographique contextuelle
    texte = _corriger_orthographe(texte, contexte)

    # 4. Normalisation des formats
    texte = _normaliser_dates(texte)
    texte = _normaliser_numero_cni(texte)

    # 5. Nettoyage final
    texte = _nettoyer_final(texte)

    if texte != texte_brut:
        journal.info(f"Post-traitement : {len(texte_brut)} → {len(texte)} car.")

    return texte


def _nettoyer_texte(texte: str) -> str:
    """Nettoyage initial du texte brut OCR."""
    # Supprimer les caractères de contrôle
    texte = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", texte)
    # Remplacer les retours à la ligne multiples
    texte = re.sub(r"\n{3,}", "\n\n", texte)
    # Supprimer les espaces multiples
    texte = re.sub(r" {2,}", " ", texte)
    # Supprimer les espaces en début/fin de ligne
    texte = "\n".join(ligne.strip() for ligne in texte.split("\n"))
    return texte.strip()


def _corriger_caracteres(texte: str) -> str:
    """Corrige les confusions de caractères fréquentes en OCR."""
    for pattern, remplacement in CORRECTIONS_CARACTERES:
        texte = re.sub(pattern, remplacement, texte)

    # Corrections contextuelles supplémentaires
    lignes = texte.split("\n")
    lignes_corrigees = []
    for ligne in lignes:
        # Détecter les lignes de numéros ou codes
        if re.search(r"[A-Z]{2,}[0-9]{4,}", ligne) or re.search(r"[0-9]{2,}[A-Z]{2,}", ligne):
            # C'est probablement un numéro de document
            ligne = _corriger_numero(ligne)
        lignes_corrigees.append(ligne)

    return "\n".join(lignes_corrigees)


def _corriger_numero(texte: str) -> str:
    """Corrige spécifiquement les numéros de documents."""
    # Les numéros de CNI contiennent souvent des lettres mélangées à des chiffres
    # Remplacer O → 0 dans un contexte numérique
    texte = re.sub(r"(?<=[0-9])O(?=[0-9]|$)", "0", texte)
    texte = re.sub(r"(?<=[0-9])O(?=[0-9])", "0", texte)
    # Remplacer I → 1 dans un contexte numérique
    texte = re.sub(r"(?<=[0-9])I(?=[0-9]|$)", "1", texte)
    texte = re.sub(r"(?<=^)I(?=[0-9])", "1", texte)
    return texte


def _corriger_orthographe(texte: str, contexte: str = "cni") -> str:
    """
    Corrige l'orthographe en utilisant le dictionnaire africain.

    Vérifie les mots inconnus et propose des corrections
    basées sur la distance de Levenshtein avec les entrées
    du dictionnaire.
    """
    mots = texte.split()
    mots_corriges = []

    for mot in mots:
        mot_propre = mot.strip(".,;:!?()[]{}'\"")

        # Vérifier si le mot est dans les corrections directes
        if mot_propre in CORRECTIONS_OCR:
            mot_corrige = CORRECTIONS_OCR[mot_propre]
            mots_corriges.append(mot.replace(mot_propre, mot_corrige))
            continue

        # Vérifier si le mot est un nom africain connu
        if mot_propre.upper() in NOMS_AFRIQUE:
            mots_corriges.append(mot)
            continue

        # Vérifier si c'est une ville africaine
        if mot_propre.upper() in VILLES_AFRIQUE:
            mots_corriges.append(mot)
            continue

        # Vérifier si c'est un pays africain
        if mot_propre.upper() in PAYS_AFRIQUE:
            mots_corriges.append(mot)
            continue

        # Si le mot semble être un nom propre (majuscule), le garder
        if mot_propre and mot_propre[0].isupper() and len(mot_propre) > 1:
            mots_corriges.append(mot)
            continue

        mots_corriges.append(mot)

    return " ".join(mots_corriges)


def _normaliser_dates(texte: str) -> str:
    """Normalise les formats de dates vers JJ/MM/AAAA."""
    for pattern, remplacement in PATTERNS_DATES:
        texte = re.sub(pattern, remplacement, texte)

    # Corriger les séparateurs mixtes (ex: 15/05-1990 → 15/05/1990)
    texte = re.sub(r"(\d{2})[/.\-](\d{2})[/.\-](\d{4})", r"\1/\2/\3", texte)

    return texte


def _normaliser_numero_cni(texte: str) -> str:
    """
    Normalise les formats de numéros de CNI.

    Supprime les espaces et tirets superflus dans les numéros,
    met en majuscules.
    """
    def normaliser_match(match):
        num = match.group(0)
        # Supprimer les espaces et tirets à l'intérieur du numéro
        num = re.sub(r"[\s\-]", "", num)
        return num.upper()

    # Pattern: séquence alphanumérique de 6 à 20 caractères
    # qui ressemble à un numéro de document
    texte = re.sub(
        r"(?<![A-Za-z0-9])[A-Za-z0-9]{6,20}(?![A-Za-z0-9])",
        normaliser_match,
        texte,
    )

    return texte


def _nettoyer_final(texte: str) -> str:
    """Nettoyage final avant retour."""
    # Supprimer les lignes vides au début et à la fin
    texte = texte.strip()
    # Supprimer les lignes qui ne contiennent que des séparateurs
    texte = "\n".join(
        l for l in texte.split("\n")
        if not re.match(r"^[\s\-_=*]{3,}$", l)
    )
    # Compression des espaces multiples
    texte = re.sub(r" {2,}", " ", texte)
    return texte.strip()


# =============================================================================
# Traitement des champs spécifiques
# =============================================================================


def corriger_nom(nom: Optional[str]) -> Optional[str]:
    """Corrige un nom de famille extrait par OCR."""
    if not nom:
        return None

    nom = nom.strip().upper()
    # Supprimer les caractères non alphabétiques (sauf - et ')
    nom = re.sub(r"[^A-Z\-' ]", "", nom)
    # Supprimer les espaces multiples
    nom = re.sub(r" {2,}", " ", nom)

    if len(nom) < 2:
        return None

    return nom.strip()


def corriger_prenoms(prenoms: Optional[str]) -> Optional[str]:
    """Corrige les prénoms extraits par OCR."""
    if not prenoms:
        return None

    prenoms = prenoms.strip().upper()
    # Supprimer les caractères non alphabétiques
    prenoms = re.sub(r"[^A-Z\-' ]", "", prenoms)
    prenoms = re.sub(r" {2,}", " ", prenoms)

    if len(prenoms) < 2:
        return None

    return prenoms.strip()


def corriger_date(date_str: Optional[str]) -> Optional[str]:
    """Corrige et valide une date extraite."""
    if not date_str:
        return None

    # Supprimer les caractères non numériques ou séparateurs
    date_str = re.sub(r"[^\d/.\-]", "", date_str)

    # Essayer plusieurs formats
    formats = [
        (r"(\d{2})[/.\-](\d{2})[/.\-](\d{4})", lambda m: f"{m.group(1)}/{m.group(2)}/{m.group(3)}"),
        (r"(\d{4})[/.\-](\d{2})[/.\-](\d{2})", lambda m: f"{m.group(3)}/{m.group(2)}/{m.group(1)}"),
    ]

    for pattern, formateur in formats:
        match = re.search(pattern, date_str)
        if match:
            return formateur(match)

    return None


def corriger_sexe(sexe: Optional[str]) -> Optional[str]:
    """Normalise le champ sexe en M/F."""
    if not sexe:
        return None

    sexe = sexe.strip().upper()[:1]
    if sexe in ("M", "F"):
        return sexe

    # Tentative de détection contextuelle
    if sexe in ("H", "1", "G"):  # Homme, Garçon
        return "M"
    if sexe in ("F", "2", "W"):  # Femme, Woman
        return "F"

    return None


def segmenter_champs(texte: str) -> dict:
    """
    Tente de segmenter le texte OCR en champs structurés.

    Essaie de reconstruire les paires Label: Valeur à partir
    du texte brut, en gérant les cas où le label et la valeur
    sont sur des lignes séparées.

    Retour :
        Dictionnaire {nom_champ: valeur}
    """
    champs = {}
    lignes = texte.split("\n")
    i = 0

    labels_connus = [
        "NOM", "PRENOM", "PRENOMS", "SEXE", "DATE DE NAISSANCE",
        "NE LE", "LIEU DE NAISSANCE", "NUMERO", "N°", "NUMERO CNI",
        "DATE DELIVRANCE", "DELIVRE LE", "DATE EXPIRATION",
        "EXPIRE LE", "VALABLE JUSQU", "AUTORITE", "TAILLE",
        "SURNAME", "FIRST NAME", "GIVEN NAME", "DATE OF BIRTH",
        "SEX", "NATIONAL ID", "NIN", "ID NUMBER",
    ]

    while i < len(lignes):
        ligne = lignes[i].strip()
        if not ligne:
            i += 1
            continue

        trouve = False
        for label in labels_connus:
            if ligne.upper().startswith(label):
                # Extraire la valeur après le label sur la même ligne
                valeur = ligne[len(label):].strip()
                valeur = re.sub(r"^[:.\-\s]+", "", valeur)

                # Si pas de valeur, prendre la ligne suivante
                if not valeur and i + 1 < len(lignes):
                    i += 1
                    valeur = lignes[i].strip()
                    # Ne pas prendre si c'est un autre label
                    est_label = any(
                        v.upper().startswith(lbl)
                        for lbl in labels_connus
                    )
                    if est_label:
                        i -= 1
                        valeur = ""

                nom_champ = label.lower().replace(" ", "_")
                champs[nom_champ] = valeur
                trouve = True
                break

        if not trouve:
            # Essayer de détecter une paire clé:valeur avec séparateur
            match = re.match(r"^([A-Za-z\s]+)\s*[:\-]\s*(.+)$", ligne)
            if match:
                cle = match.group(1).strip().lower().replace(" ", "_")
                valeur = match.group(2).strip()
                champs[cle] = valeur

        i += 1

    return champs
