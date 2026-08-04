# -*- coding: utf-8 -*-
"""
Extraction NLP avec spaCy pour l'Assurance Automobile — version robuste et performante.

Améliorations vs version initiale :
- Chargement PAresseux et sécurisé de spaCy : aucun crash à l'import si le
  modèle est absent ; repli automatique sur un extracteur regex.
- Pipeline allégé (tagger + parser désactivés) → analyse plus rapide.
- Extraction CONTEXTUELLE : le meilleur candidat (assuré, assureur, dates)
  est choisi selon les tokens qui entourent l'entité, pas le premier résultat NER.
- Dictionnaire des assureurs connus (recherche par mots entiers).
- Regex précompilées (compilées une seule fois au chargement).
- Filtre des bruits typographiques d'attestations (en-têtes collés par l'OCR).
- Ne lève JAMAIS d'exception.
"""
import re
from typing import Any, Dict, List, Optional, Tuple

# =============================================================================
# Chargeur spaCy paresseux
# =============================================================================
_nlp_fr = None  # None = pas encore tenté | False = échec | sinon le pipeline


def _obtenir_nlp():
    """Retourne le pipeline spaCy (fr_core_news_sm) ou None sans jamais lever d'exception."""
    global _nlp_fr
    if _nlp_fr is None:
        try:
            import spacy
            # tagger + parser désactivés : inutiles pour le NER → performance
            _nlp_fr = spacy.load("fr_core_news_sm", disable=["tagger", "parser"])
        except Exception:
            _nlp_fr = False
    return _nlp_fr if _nlp_fr is not False else None


# =============================================================================
# Constantes
# =============================================================================
ASSUREURS_CONNUS = (
    "nsia", "sunu", "saham", "vista", "zuto", "ugan", "axa", "allianz",
    "gras savoye", "colina", "groupe nsia", "nsia vie",
    "sunu assurance", "saham assurance", "atlantique assurance",
)

LABELS_IDENTITE = (
    "nom", "prenom", "prénoms", "assuré", "assure", "titulaire",
    "souscripteur", "conducteur",
)
LABELS_ASSUREUR = (
    "compagnie", "assureur", "insurer", "societe", "société",
    "assurance", "assurances",
)
LABELS_DATE_EFFET = (
    "effet", "debut", "début", "prise", "validite", "validité", "du", "commence",
)
LABELS_DATE_EXPIRATION = (
    "expiration", "echeance", "échéance", "fin", "jusqu", "au", "à", "a", "validité", "validite",
)

# Mots-clés d'en-têtes d'attestations (bruit OCR collé) — jamais des valeurs
_MOTS_CLES_ENTETES = (
    "contrat", "police", "informations", "garantie", "couverture", "document",
    "attestation", "certificat", "cotisation", "franchise", "plafond",
    "formule", "souscription", "signature", "echeance", "échéance",
)

# Regex précompilées (performance)
_PATTERN_CONTRAT = re.compile(r"\b([A-Z]{2,4}-\d{4}-\d{2}-\d{5,7})\b")
_PATTERN_CONTRAT_GENERIQUE = re.compile(r"\b([A-Z]{2,6}[-]?\d{6,12})\b")
_PATTERN_IMMATRICULATION = re.compile(r"\b([A-Z]{1,3}[-]?\d{2,4}[-]?[A-Z]{1,3})\b")
_PATTERN_PERIODE = re.compile(
    r"(?:VALABLE\s*(?:DU|DE|LE)\s*)?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})"
    r"\s*(?:AU|À|A|JUSQU['’ ]?AU?)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})",
    re.IGNORECASE,
)

MOIS_FR = {
    "janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4,
    "mai": 5, "juin": 6, "juillet": 7, "aout": 8, "août": 8,
    "septembre": 9, "octobre": 10, "novembre": 11, "decembre": 12, "décembre": 12,
}


# =============================================================================
# Helpers
# =============================================================================
def _contexte(doc, ent, largeur: int = 6) -> Tuple[str, str]:
    """Tokens (minuscules) avant / après une entité (fenêtre de contexte)."""
    avant = " ".join(t.text.lower() for t in doc[max(0, ent.start - largeur):ent.start])
    apres = " ".join(t.text.lower() for t in doc[ent.end:ent.end + largeur])
    return avant, apres


def _contient(contexte: str, labels) -> bool:
    return any(lab in contexte for lab in labels)


def _est_bruit(texte: str) -> bool:
    """Vrai si le texte contient un mot-clé d'en-tête d'attestation (bruit OCR)."""
    t = texte.lower()
    return any(mc in t for mc in _MOTS_CLES_ENTETES)


def _parser_date_valeur(valeur: str) -> Optional[Tuple[int, int, int]]:
    """Convertit une date (numérique ou texte français) en tuple (année, mois, jour)."""
    if not valeur:
        return None
    v = valeur.strip()
    # JJ/MM/AAAA, JJ.MM.AAAA, JJ-MM-AAAA
    m = re.match(r"^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$", v)
    if m:
        j, mois, a = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if a < 100:
            a += 2000
        return (a, mois, j)
    # AAAA-MM-JJ
    m = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$", v)
    if m:
        return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    # Texte français : "1 mai 2024", "30 avril 2025"
    m = re.match(r"^(\d{1,2})\s+([a-zà-ÿ]+)\s+(\d{2,4})$", v, re.IGNORECASE)
    if m:
        jour, mois_nom, annee = int(m.group(1)), m.group(2).lower(), int(m.group(3))
        if annee < 100:
            annee += 2000
        if mois_nom in MOIS_FR:
            return (annee, MOIS_FR[mois_nom], jour)
    return None


# =============================================================================
# Sélection intelligente des candidats
# =============================================================================
def _choisir_personne(candidats: List[Tuple[Any, str, str]]) -> Optional[str]:
    """Sélectionne la personne la plus pertinente (contexte d'identité, nom complet)."""
    meilleur, meilleur_score = None, -1
    for ent, avant, apres in candidats:
        texte = ent.text.strip()
        if len(texte) < 2 or _est_bruit(texte):
            continue
        score = 0
        if _contient(avant, LABELS_IDENTITE):
            score += 3
        if _contient(apres, LABELS_IDENTITE):
            score += 2
        if len(texte.split()) >= 2:
            score += 1  # nom complet (2+ mots) plus fiable
        if _contient(avant, LABELS_ASSUREUR):
            score -= 4  # probablement une société, pas un assuré
        if score > meilleur_score:
            meilleur, meilleur_score = texte, score
    if meilleur is None and candidats:
        premier = candidats[0][0].text.strip()
        if not _est_bruit(premier):
            return premier
    return meilleur


def _choisir_assureur(candidats_orgs: List[Tuple[Any, str, str]], texte_brut: str) -> Optional[str]:
    """Sélectionne l'assureur : d'abord les assureurs connus, puis le meilleur ORG du NER."""
    # 1) Recherche des assureurs connus dans le texte (mots entiers) — le plus fiable
    texte_lower = texte_brut.lower()
    for assureur in ASSUREURS_CONNUS:
        if re.search(r"\b" + re.escape(assureur) + r"\b", texte_lower):
            return assureur.upper()
    # 2) Meilleur candidat ORG du NER (contexte + nom contenant "assurance")
    meilleur, meilleur_score = None, -1
    for ent, avant, apres in candidats_orgs:
        texte = ent.text.strip()
        if len(texte) < 3 or _est_bruit(texte):
            continue
        score = 0
        if _contient(avant, LABELS_ASSUREUR) or _contient(apres, LABELS_ASSUREUR):
            score += 3
        if "assurance" in texte.lower() or "assurances" in texte.lower():
            score += 2
        if score > meilleur_score:
            meilleur, meilleur_score = texte, score
    return meilleur


def _classifier_dates(candidats_dates: List[Tuple[Any, str, str]]) -> Tuple[Optional[str], Optional[str]]:
    """Classe les dates en (date d'effet, date d'expiration) via le contexte."""
    effet = expiration = None
    sans_contexte: List[str] = []
    for ent, avant, apres in candidats_dates:
        date_texte = ent.text.strip()
        if _contient(avant, LABELS_DATE_EXPIRATION):
            if expiration is None:
                expiration = date_texte
        elif _contient(avant, LABELS_DATE_EFFET):
            if effet is None:
                effet = date_texte
        else:
            sans_contexte.append(date_texte)

    # Dates sans contexte : la plus ancienne = effet, la plus récente = expiration
    if (effet is None or expiration is None) and len(sans_contexte) >= 2:
        dates_valeurs = [(d, _parser_date_valeur(d)) for d in sans_contexte]
        dates_valeurs = [dv for dv in dates_valeurs if dv[1] is not None]
        if len(dates_valeurs) >= 2:
            dates_valeurs.sort(key=lambda dv: dv[1])
            if effet is None:
                effet = dates_valeurs[0][0]
            if expiration is None:
                expiration = dates_valeurs[-1][0]
    return effet, expiration


# =============================================================================
# Extracteurs regex (contrat, immatriculation, période)
# =============================================================================
def _extraire_numero_contrat(texte_brut: str) -> Optional[str]:
    texte = texte_brut.upper()
    m = _PATTERN_CONTRAT.search(texte)
    if m:
        return m.group(1)
    m = _PATTERN_CONTRAT_GENERIQUE.search(texte)
    if m:
        return m.group(1)
    return None


def _extraire_immatriculation(texte_brut: str) -> Optional[str]:
    texte = texte_brut.upper()
    for m in _PATTERN_IMMATRICULATION.finditer(texte):
        candidat = m.group(1)
        # Éviter les faux positifs (numéros de contrat longs, montants)
        if re.search(r"\d{4,}", candidat) and "-" not in candidat:
            continue
        return candidat
    return None


def _extraction_regex_secours(texte_brut: str, resultats: Dict[str, Any]) -> None:
    """Extraction minimale par regex quand spaCy est indisponible."""
    resultats["numero_contrat"] = _extraire_numero_contrat(texte_brut)
    resultats["immatriculation"] = _extraire_immatriculation(texte_brut)

    texte = texte_brut.upper()
    m = _PATTERN_PERIODE.search(texte)
    if m:
        resultats["date_effet"] = m.group(1)
        resultats["date_expiration"] = m.group(2)

    texte_lower = texte_brut.lower()
    for assureur in ASSUREURS_CONNUS:
        if re.search(r"\b" + re.escape(assureur) + r"\b", texte_lower):
            resultats["organisation"] = assureur.upper()
            break


# =============================================================================
# Fonction principale
# =============================================================================
def extraire_avec_nlp(texte_brut: str) -> Dict[str, Any]:
    """
    Extrait les entités d'une attestation d'assurance (assuré, assureur, dates,
    contrat, immatriculation) en combinant spaCy (NER) et des regex précompilées.

    Retourne toujours un dictionnaire avec les mêmes clés ; ne lève jamais d'exception.
    """
    resultats = {
        "nom_personne": None,
        "organisation": None,
        "date_effet": None,
        "date_expiration": None,
        "lieu": None,
        "numero_contrat": None,
        "immatriculation": None,
    }

    if not texte_brut:
        return resultats

    nlp = _obtenir_nlp()
    if nlp is None:
        _extraction_regex_secours(texte_brut, resultats)
        return resultats

    try:
        # Limiter la taille analysée par spaCy (performance / sécurité)
        doc = nlp(texte_brut[:5000])
    except Exception:
        _extraction_regex_secours(texte_brut, resultats)
        return resultats

    candidats_personnes: List[Tuple[Any, str, str]] = []
    candidats_orgs: List[Tuple[Any, str, str]] = []
    candidats_dates: List[Tuple[Any, str, str]] = []

    for ent in doc.ents:
        avant, apres = _contexte(doc, ent)
        if ent.label_ == "PERSON":
            candidats_personnes.append((ent, avant, apres))
        elif ent.label_ == "ORG":
            candidats_orgs.append((ent, avant, apres))
        elif ent.label_ == "DATE":
            candidats_dates.append((ent, avant, apres))
        elif ent.label_ == "GPE" and not resultats["lieu"]:
            resultats["lieu"] = ent.text.strip()

    resultats["nom_personne"] = _choisir_personne(candidats_personnes)
    resultats["organisation"] = _choisir_assureur(candidats_orgs, texte_brut)
    resultats["date_effet"], resultats["date_expiration"] = _classifier_dates(candidats_dates)
    resultats["numero_contrat"] = _extraire_numero_contrat(texte_brut)
    resultats["immatriculation"] = _extraire_immatriculation(texte_brut)

    return resultats