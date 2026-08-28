# -*- coding: utf-8 -*-
"""
Post-traitement texte OCR pour documents d'identité africains (AMÉLIORÉ).
Changements majeurs :
  ✅ Fuzzy matching (Levenshtein) pour correction noms
  ✅ Corrections contextuelles (O→0 dans numéros, pas noms)
  ✅ Fusion dates fragmentées (15 / 05 / 1990 → 15/05/1990)
  ✅ Correction mots proches dictionnaire (70-95% match)
"""
import re
from difflib import SequenceMatcher
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

# Corrections caractères par contexte (non exhaustif)
CORRECTIONS_CARACTERES = [
    (r"0([A-Z])", r"O\1"),      # 1A → IA (contexte alphabétique)
    (r"1(?=[A-Z])", "I"),
    (r"(?<=[A-Z])1", "I"),
    (r"5(?=[A-Z])", "S"),
    (r"8(?=[A-Z])", "B"),
    (r"[|¦]", "I"),
    (r"[®©]", " "),
    (r"[_™]", " "),
]

PATTERNS_DATES = [
    (r"(\d{2})[/.-](\d{2})[/.-](\d{4})", r"\1/\2/\3"),
    (r"(\d{4})[/.-](\d{2})[/.-](\d{2})", r"\3/\2/\1"),
]

# ✅ NOUVEAU : Fuzzy matching pour noms
def _corriger_mot_inconnu(mot: str, dictionnaire: list, seuil_min: float = 0.70) -> str:
    """
    Cherche le mot le plus proche dans le dictionnaire.
    Retourne le meilleur match si 70-95% similaire (typo probable).
    """
    meilleurs = []
    for mot_ref in dictionnaire:
        ratio = SequenceMatcher(None, mot.upper(), mot_ref.upper()).ratio()
        if seuil_min <= ratio <= 0.95:  # 70-95% = typo probable
            meilleurs.append((mot_ref, ratio))
    
    if meilleurs:
        meilleur = max(meilleurs, key=lambda x: x[1])[0]
        return meilleur
    return mot  # Pas de candidat

# ✅ NOUVEAU : Fusion dates fragmentées
def _fusionner_dates(texte: str) -> str:
    """Reconstruit dates fragmentées : '15 / 05 / 1990' → '15/05/1990'"""
    # Pattern : JJ / MM / AAAA (avec espaces multiples)
    texte = re.sub(r"(\d{1,2})\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{4})",
                   r"\1/\2/\3", texte)
    # Pattern : JJ - MM - AAAA (avec tirets)
    texte = re.sub(r"(\d{1,2})\s*-\s*(\d{1,2})\s*-\s*(\d{4})",
                   r"\1/\2/\3", texte)
    return texte

# ✅ NOUVEAU : Corrections contextuelles (numéro vs nom)
def _corriger_caracteres_contexte(texte: str) -> str:
    """
    Corrige per-ligne selon le contexte détecté.
    Numéro/Date/MRZ : O→0 agressif.
    Nom/Texte : O→0 seulement si contexte fort.
    """
    lignes = texte.split("\n")
    lignes_corrigees = []
    
    for ligne in lignes:
        # Détecter si zone est numérique/MRZ
        est_numerique = (
            re.search(r"^\d{2}[/-]\d{2}[/-]\d{4}", ligne)           # Date
            or re.search(r"[A-Z]{2,}[0-9]{6,}", ligne)              # Numéro
            or re.search(r"^[<0-9]{20,}", ligne)                    # MRZ
            or re.search(r"^\d{4}[-/]\d{4,}", ligne)                # Compte/série
        )
        
        if est_numerique:
            # Zone numérique : remplacer O par 0 + I par 1
            ligne = re.sub(r"O(?=[0-9])", "0", ligne)        # O suivi de chiffre
            ligne = re.sub(r"(?<=[0-9])O", "0", ligne)       # Chiffre suivi de O
            ligne = re.sub(r"I(?=[0-9])", "1", ligne)        # I suivi de chiffre
            ligne = re.sub(r"(?<=[0-9])I", "1", ligne)       # Chiffre suivi de I
        else:
            # Zone texte : corrections légères (ne pas casser noms)
            # Remplacer I→1 SEULEMENT si clairement numérique (contexte fort)
            pass  # Pas de remplacement agressif
        
        lignes_corrigees.append(ligne)
    
    return "\n".join(lignes_corrigees)

def post_traiter_texte(texte_brut: str, contexte: str = "cni") -> str:
    """
    Applique le pipeline complet de post-traitement.
    ✅ Améliorations : fusion dates, corrections contextuelles, fuzzy match.
    """
    if not texte_brut:
        return ""
    
    texte = texte_brut
    texte = _nettoyer_texte(texte)
    texte = _corriger_caracteres_contexte(texte)  # ✅ NOUVEAU : contexte
    texte = _fusionner_dates(texte)               # ✅ NOUVEAU : fusion dates
    texte = _corriger_orthographe(texte, contexte)
    texte = _normaliser_dates(texte)
    texte = _normaliser_numero_cni(texte)
    texte = _nettoyer_final(texte)
    
    if texte != texte_brut:
        journal.info(f"Post-traitement : {len(texte_brut)} → {len(texte)} car.")
    
    return texte

def _nettoyer_texte(texte: str) -> str:
    """Nettoyage initial du texte brut OCR."""
    texte = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", " ", texte)
    texte = re.sub(r"\n{3,}", "\n\n", texte)
    texte = re.sub(r" {2,}", "  ", texte)
    texte = "\n".join(ligne.strip() for ligne in texte.split("\n"))
    return texte.strip()

def _normaliser_dates(texte: str) -> str:
    """Normalise les formats de dates vers JJ/MM/AAAA."""
    for pattern, remplacement in PATTERNS_DATES:
        texte = re.sub(pattern, remplacement, texte)
    texte = re.sub(r"(\d{2})[/.\-](\d{2})[/.\-](\d{4})", r"\1/\2/\3", texte)
    return texte

def _normaliser_numero_cni(texte: str) -> str:
    """Normalise numéros CNI : supprime espaces/tirets, majuscules."""
    def normaliser_match(match):
        num = match.group(0)
        num = re.sub(r"[\s\-]", "", num)
        return num.upper()
    
    texte = re.sub(
        r"(?<![A-Za-z0-9])[A-Za-z0-9]{6,20}(?![A-Za-z0-9])",
        normaliser_match,
        texte,
    )
    return texte

# ✅ NOUVEAU : Correction orthographe avec fuzzy match
def _corriger_orthographe(texte: str, contexte: str = "cni") -> str:
    """
    Corrige l'orthographe avec fuzzy matching.
    Cherche les mots proches du dictionnaire (70-95% similaire).
    """
    mots = texte.split()
    mots_corriges = []
    
    for mot in mots:
        mot_propre = mot.strip(".,;:!?()[]{}'\"")
        
        # Vérifier corrections directes
        if mot_propre in CORRECTIONS_OCR:
            mot_corrige = CORRECTIONS_OCR[mot_propre]
            mots_corriges.append(mot.replace(mot_propre, mot_corrige))
            continue
        
        # Vérifier noms africains connus
        if mot_propre.upper() in NOMS_AFRIQUE:
            mots_corriges.append(mot)
            continue
        
        # Vérifier villes africaines
        if mot_propre.upper() in VILLES_AFRIQUE:
            mots_corriges.append(mot)
            continue
        
        # Vérifier pays africains
        if mot_propre.upper() in PAYS_AFRIQUE:
            mots_corriges.append(mot)
            continue
        
        # ✅ NOUVEAU : Fuzzy matching pour noms propres
        if mot_propre and mot_propre[0].isupper() and len(mot_propre) > 2:
            # C'est probablement un nom propre — chercher proche dans NOMS_AFRIQUE
            mot_fuzzy = _corriger_mot_inconnu(mot_propre, NOMS_AFRIQUE, seuil_min=0.70)
            if mot_fuzzy != mot_propre:
                mots_corriges.append(mot.replace(mot_propre, mot_fuzzy))
                continue
        
        # Garder tel quel sinon
        mots_corriges.append(mot)
    
    return " ".join(mots_corriges)

def _nettoyer_final(texte: str) -> str:
    """Nettoyage final avant retour."""
    texte = texte.strip()
    texte = "\n".join(
        l for l in texte.split("\n")
        if not re.match(r"^[\s-_=*]{3,}$", l)
    )
    texte = re.sub(r" {2,}", "  ", texte)
    return texte.strip()

# =============================================================================
# Traitement des champs spécifiques (inchangé)
# =============================================================================

def corriger_nom(nom: Optional[str]) -> Optional[str]:
    """Corrige un nom de famille extrait par OCR."""
    if not nom:
        return None
    nom = nom.strip().upper()
    nom = re.sub(r"[^A-Z\-' ]", "", nom)
    nom = re.sub(r" {2,}", " ", nom)
    if len(nom) < 2:
        return None
    return nom.strip()

def corriger_prenoms(prenoms: Optional[str]) -> Optional[str]:
    """Corrige les prénoms extraits par OCR."""
    if not prenoms:
        return None
    prenoms = prenoms.strip().upper()
    prenoms = re.sub(r"[^A-Z\-' ]", "", prenoms)
    prenoms = re.sub(r" {2,}", " ", prenoms)
    if len(prenoms) < 2:
        return None
    return prenoms.strip()

def corriger_date(date_str: Optional[str]) -> Optional[str]:
    """Corrige et valide une date extraite."""
    if not date_str:
        return None
    date_str = re.sub(r"[^\d/.\-]", "", date_str)
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
    if sexe in ("H", "1", "G"):
        return "M"
    if sexe in ("F", "2", "W"):
        return "F"
    return None

def segmenter_champs(texte: str) -> dict:
    """Segmente texte OCR brut en champs structurés."""
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
                valeur = ligne[len(label):].strip()
                valeur = re.sub(r"^[:.\-\s]+", "", valeur)
                
                if not valeur and i + 1 < len(lignes):
                    i += 1
                    valeur = lignes[i].strip()
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
            match = re.match(r"^([A-Za-z\s]+)\s*[:\-]\s*(.+)$", ligne)
            if match:
                cle = match.group(1).strip().lower().replace(" ", "_")
                valeur = match.group(2).strip()
                champs[cle] = valeur
        
        i += 1
    
    return champs