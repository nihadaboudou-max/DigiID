# -*- coding: utf-8 -*-
"""
Extraction NLP avec spaCy pour l'Assurance Automobile.
"""
import re
from typing import Optional, Dict, Any
import spacy
from spacy.tokens import Doc

# Charger le modèle français (à faire une seule fois au démarrage)
try:
    nlp_fr = spacy.load("fr_core_news_sm")
except OSError:
    raise RuntimeError(
        "Modèle spaCy fr_core_news_sm non installé. "
        "Exécutez: python -m spacy download fr_core_news_sm"
    )

# Ajouter des patterns personnalisés pour les assurances
from spacy.matcher import Matcher

matcher = Matcher(nlp_fr.vocab)

# Patterns pour numéro de contrat
matcher.add("NUMERO_CONTRAT", [
    [{"LOWER": {"IN": ["n°", "numero", "numéro", "n"]}}, {"LOWER": {"IN": ["contrat", "police"]}}, {"LOWER": ":"}, {"IS_DIGIT": True}],
    [{"LOWER": {"IN": ["contrat", "police"]}}, {"LOWER": "n°"}, {"IS_DIGIT": True}],
])

# Patterns pour immatriculation (format européen)
matcher.add("IMMATRICULATION", [
    [{"LOWER": "immatriculation"}, {"LOWER": ":"}, {"SHAPE": "XX-ddd-XX"}],
    [{"LOWER": "plaque"}, {"LOWER": ":"}, {"SHAPE": "XX-ddd-XX"}],
])

def extraire_avec_nlp(texte_brut: str) -> Dict[str, Any]:
    """
    Extrait les entités nommées avec spaCy + patterns personnalisés.
    """
    if not texte_brut:
        return {}
    
    # Traiter le texte avec spaCy
    doc: Doc = nlp_fr(texte_brut)
    
    resultats = {
        'nom_personne': None,
        'organisation': None,
        'date_effet': None,
        'date_expiration': None,
        'lieu': None,
        'numero_contrat': None,
        'immatriculation': None,
    }
    
    # 1. Extraire les entités nommées standard (NER)
    for ent in doc.ents:
        if ent.label_ == "PERSON" and not resultats['nom_personne']:
            resultats['nom_personne'] = ent.text
        elif ent.label_ == "ORG" and not resultats['organisation']:
            resultats['organisation'] = ent.text
        elif ent.label_ == "GPE" and not resultats['lieu']:
            resultats['lieu'] = ent.text
        elif ent.label_ == "DATE":
            # Distinguer date d'effet et expiration par le contexte
            texte_autour = ent.text
            if "effet" in texte_autour.lower() or "début" in texte_autour.lower():
                resultats['date_effet'] = ent.text
            elif "expiration" in texte_autour.lower() or "échéance" in texte_autour.lower() or "fin" in texte_autour.lower():
                resultats['date_expiration'] = ent.text
    
    # 2. Utiliser les patterns personnalisés
    matches = matcher(doc)
    for match_id, start, end in matches:
        rule_id = nlp_fr.vocab.strings[match_id]
        span = doc[start:end]
        
        if rule_id == "NUMERO_CONTRAT":
            # Extraire le numéro (dernier token de la séquence)
            resultats['numero_contrat'] = span.text.split()[-1]
        elif rule_id == "IMMATRICULATION":
            resultats['immatriculation'] = span.text.split()[-1]
    
    # 3. Chercher des patterns spécifiques avec regex sur le texte complet
    # Numéro de contrat (format ZT-2024-05-000123)
    match_contrat = re.search(r'\b([A-Z]{2,4}[\-]\d{4}[\-]\d{2}[\-]\d{5,7})\b', texte_brut)
    if match_contrat:
        resultats['numero_contrat'] = match_contrat.group(1)
    
    # Immatriculation (format AA-123-BB)
    match_immat = re.search(r'\b([A-Z]{1,3}[\-]?\d{2,4}[\-]?[A-Z]{1,3})\b', texte_brut)
    if match_immat and not resultats['immatriculation']:
        resultats['immatriculation'] = match_immat.group(1)
    
    # Dates avec contexte
    match_date_effet = re.search(r'(?:effet|début).*?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})', texte_brut, re.IGNORECASE)
    if match_date_effet:
        resultats['date_effet'] = match_date_effet.group(1)
    
    match_date_expiration = re.search(r'(?:expiration|échéance|fin).*?(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})', texte_brut, re.IGNORECASE)
    if match_date_expiration:
        resultats['date_expiration'] = match_date_expiration.group(1)
    
    return resultats