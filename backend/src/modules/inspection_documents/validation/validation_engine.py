# -*- coding: utf-8 -*-
"""
Moteur de validation dynamique selon le type de document.
Adapte les règles de validation au type détecté (CNI, passeport, permis, etc.)
"""
import re
from datetime import date, datetime
from typing import Optional
from src.modules.inspection_documents.schemas import (
    DonneesDocumentExtraites,
    ResultatValidation,
    StatutVerification,
    TypeDocument,
)
from src.modules.inspection_documents.validation.mrz_checksum import verifier_checksum_mrz
from src.noyau.journal import journal


def valider_document(donnees: DonneesDocumentExtraites) -> ResultatValidation:
    """
    Valide un document extrait selon son type.
    
    Règles dynamiques :
    - CNI/Passeport : MRZ obligatoire + checksum
    - Permis : catégories obligatoires
    - Assurance : numéro de police obligatoire
    
    Returns:
        ResultatValidation avec statut, scores et message
    """
    scores = {}
    erreurs = []
    
    # ── Validation commune à tous les documents ──
    
    # 1. Numéro de document (obligatoire pour tous)
    if donnees.numero_document:
        scores["numero_document"] = _valider_format_numero(donnees.numero_document)
        if not scores["numero_document"]:
            erreurs.append("Format du numéro de document invalide")
    else:
        scores["numero_document"] = False
        erreurs.append("Numéro de document manquant")
    
    # 2. Date de naissance (obligatoire pour tous sauf assurance)
    if donnees.type_document != TypeDocument.CARTE_ASSURANCE:
        if donnees.date_naissance:
            scores["date_naissance"] = _valider_format_date(donnees.date_naissance)
            if not scores["date_naissance"]:
                erreurs.append("Format de date de naissance invalide")
        else:
            scores["date_naissance"] = False
            erreurs.append("Date de naissance manquante")
    
    # 3. Date d'expiration (optionnelle mais vérifiée si présente)
    if donnees.date_expiration:
        scores["date_expiration"] = _valider_date_expiration(donnees.date_expiration)
        if not scores["date_expiration"]:
            erreurs.append("Document expiré")
    else:
        scores["date_expiration"] = True  # Pas d'erreur si absente
    
    # ── Validation spécifique selon le type ──
    
    if donnees.type_document in [TypeDocument.CNI_BIOMETRIQUE, TypeDocument.PASSEPORT]:
        # MRZ obligatoire
        if donnees.mrz_ligne_1 and donnees.mrz_ligne_2:
            checksums = verifier_checksum_mrz(
                donnees.mrz_ligne_1,
                donnees.mrz_ligne_2,
                donnees.mrz_ligne_3,
            )
            scores["mrz_valide"] = checksums["mrz_valide"]
            scores["checksum_numero"] = checksums["checksum_numero"]
            scores["checksum_date_naissance"] = checksums["checksum_date_naissance"]
            scores["checksum_date_expiration"] = checksums["checksum_date_expiration"]
            
            if not checksums["mrz_valide"]:
                erreurs.append("Checksum MRZ invalide")
        else:
            scores["mrz_valide"] = False
            erreurs.append("MRZ manquante ou incomplète")
    
    elif donnees.type_document == TypeDocument.PERMIS_CONDUIRE:
        # Catégories obligatoires
        categories = donnees.donnees_specifiques.get("categories_permis", [])
        scores["categories_presentes"] = len(categories) > 0
        if not scores["categories_presentes"]:
            erreurs.append("Catégories de permis manquantes")
    
    elif donnees.type_document == TypeDocument.CARTE_ASSURANCE:
        # Numéro de police obligatoire
        num_police = donnees.donnees_specifiques.get("numero_police")
        scores["numero_police"] = bool(num_police)
        if not scores["numero_police"]:
            erreurs.append("Numéro de police manquant")
    
    # ── Résultat global ──
    est_valide = all(scores.values())
    statut = StatutVerification.APPROUVE if est_valide else StatutVerification.REJETE
    
    if est_valide:
        nb_valides = sum(1 for v in scores.values() if v)
        nb_total = len(scores)
        message = f"Document valide : {nb_valides}/{nb_total} vérifications OK."
    else:
        message = "Document invalide : " + "; ".join(erreurs[:3])
    
    journal.info(
        f"Validation document : type={donnees.type_document.value}, "
        f"est_valide={est_valide}, scores={scores}"
    )
    
    return ResultatValidation(
        est_valide=est_valide,
        statut=statut,
        scores=scores,
        message=message,
        erreurs=erreurs,
    )


def _valider_format_numero(numero: str) -> bool:
    """Valide le format d'un numéro de document."""
    if not numero:
        return False
    # Nettoyage
    numero_propre = "".join(c for c in numero.upper() if c.isalnum())
    # Longueur : 5 à 20 caractères (tolérance OCR)
    return 5 <= len(numero_propre) <= 20


_MOIS = {
    "JANVIER": 1, "JANV": 1, "JAN": 1, "JANUARY": 1,
    "FEVRIER": 2, "FEVR": 2, "FEV": 2, "FEBRUARY": 2, "FEB": 2,
    "MARS": 3, "MAR": 3, "MARCH": 3,
    "AVRIL": 4, "AVR": 4, "APRIL": 4, "APR": 4,
    "MAI": 5, "MAY": 5,
    "JUIN": 6, "JUN": 6, "JUNE": 6,
    "JUILLET": 7, "JUIL": 7, "JUL": 7, "JULY": 7,
    "AOUT": 8, "AOU": 8, "AUGUST": 8, "AUG": 8,
    "SEPTEMBRE": 9, "SEPT": 9, "SEP": 9, "SEPTEMBER": 9,
    "OCTOBRE": 10, "OCT": 10, "OCTOBER": 10,
    "NOVEMBRE": 11, "NOV": 11, "NOVEMBER": 11,
    "DECEMBRE": 12, "DEC": 12, "DECEMBER": 12,
}


def _sans_accents(texte: str) -> str:
    for a, b in [("É", "E"), ("È", "E"), ("Ê", "E"), ("Ë", "E"),
                 ("À", "A"), ("Â", "A"), ("Ä", "A"),
                 ("Î", "I"), ("Ï", "I"),
                 ("Ô", "O"), ("Ö", "O"),
                 ("Ù", "U"), ("Û", "U"), ("Ü", "U"),
                 ("Ç", "C")]:
        texte = texte.replace(a, b)
    return texte


def _parser_date_tolerant(date_str: str) -> Optional[date]:
    """Parse une date de façon tolérante → date Python, ou None."""
    if not date_str:
        return None
    v = date_str.strip().strip(".:;,")

    def _construire(jour: int, mois: int, annee: int) -> Optional[date]:
        try:
            return date(annee, mois, jour)
        except ValueError:
            return None  # essayer le format suivant

    def _resoudre_annee(annee_txt: str) -> int:
        a = int(annee_txt)
        if len(annee_txt) == 2:
            return 1900 + a if a >= 40 else 2000 + a
        return a

    # 1) JJ/MM/AAAA | JJ-MM-AAAA | JJ.MM.AAAA (séparateurs variés)
    m = re.search(r"(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{2,4})", v)
    if m:
        d = _construire(int(m.group(1)), int(m.group(2)), _resoudre_annee(m.group(3)))
        if d:
            return d

    # 2) JJ Mois AAAA (mois en lettres)
    m = re.search(r"(\d{1,2})\s*[/.\- ]\s*([A-Za-zÀ-ÿ]{3,})\s*[/.\- ]\s*(\d{2,4})", v)
    if m:
        mois = _MOIS.get(_sans_accents(m.group(2)).upper().rstrip("."))
        if mois:
            d = _construire(int(m.group(1)), mois, _resoudre_annee(m.group(3)))
            if d:
                return d

    # 3) AAAA-MM-JJ (ISO)
    m = re.search(r"^(\d{4})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{1,2})$", v)
    if m:
        d = _construire(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if d:
            return d

    # 4) Compact JJMMAAAA ou JJMMAA
    m = re.search(r"^(\d{2})(\d{2})(\d{4}|\d{2})$", v)
    if m:
        d = _construire(int(m.group(1)), int(m.group(2)), _resoudre_annee(m.group(3)))
        if d:
            return d

    return None


def _valider_format_date(date_str: str) -> bool:
    """Valide une date de naissance (formats tolérants)."""
    if not date_str:
        return False
    d = _parser_date_tolerant(date_str)
    return d is not None and d <= date.today()


def _valider_date_expiration(date_str: str) -> bool:
    """Vérifie que la date d'expiration n'est pas passée."""
    if not date_str:
        return True  # Pas d'erreur si absente
    dexp = _parser_date_tolerant(date_str)
    if dexp is None:
        return False
    return dexp >= date.today()