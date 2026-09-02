# -*- coding: utf-8 -*-
"""
Extracteur NLP (Regex avancées) pour documents sans MRZ.
Gère : Permis de conduire, Cartes d'assurance, Anciennes CNI.
Inclut des règles anti-hallucination strictes.
"""
import re
from typing import Optional, Dict

def _nettoyer_valeur_securisee(valeur: str, contexte: str) -> Optional[str]:
    """Nettoie et VALIDE la valeur pour empêcher les artefacts OCR."""
    if not valeur: return None
    valeur = valeur.strip().strip(":;,.-\"' ")
    
    if contexte in ("nom", "prenoms"):
        if re.match(r"^\d+$", valeur): return None  # Rejeté : pas un nom
        valeur = re.sub(r"[^a-zA-ZÀ-ÿ\s\-']", "", valeur)
        return valeur.strip() if len(valeur.strip()) >= 2 else None
    elif contexte == "numero":
        valeur = "".join(c for c in valeur.upper() if c.isalnum())
        return valeur if 5 <= len(valeur) <= 20 else None
    elif contexte == "date":
        match = re.search(r"(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{2,4})", valeur)
        if match:
            j, m, a = match.groups()
            a = f"19{a}" if len(a) == 2 and int(a) > 40 else f"20{a}" if len(a) == 2 else a
            return f"{j.zfill(2)}/{m.zfill(2)}/{a}"
    elif contexte == "sexe":
        v = valeur.upper()[:1]
        return "M" if v in ("M", "H") else "F" if v == "F" else None
    return valeur if valeur else None

def extraire_permis_conduire(texte: str) -> Dict:
    """Extraction spécifique pour Permis de Conduire."""
    resultats = {}
    texte_upper = texte.upper()
    
    # Numéro de permis
    match = re.search(r"(?:N[°O]|NUM[ÉE]RO|PERMIS)\s*[:\-]?\s*([A-Z0-9\-]{8,20})", texte_upper)
    if match: resultats["numero_document"] = _nettoyer_valeur_securisee(match.group(1), "numero")
    
    # Catégories (A, B, C, D, E)
    match_cat = re.search(r"CATEGORIE(?:S)?\s*[:\-]?\s*([A-E, ]+)", texte, re.IGNORECASE)
    if match_cat: resultats["categories_permis"] = [c.strip() for c in match_cat.group(1).split(",") if c.strip()]
    
    # Dates
    match_date = re.search(r"(?:D[ÉE]LIVR[ÉE]|DATE)\s*(?:LE|DE)?\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})", texte, re.IGNORECASE)
    if match_date: resultats["date_delivrance"] = _nettoyer_valeur_securisee(match_date.group(1), "date")
    
    return resultats

def extraire_carte_assurance(texte: str) -> Dict:
    """Extraction spécifique pour Cartes d'Assurance."""
    resultats = {}
    texte_upper = texte.upper()
    
    # Numéro de police / contrat
    match = re.search(r"(?:N[°O]\s*(?:DE\s*)?POLICE|CONTRAT|N[°O]\s*CLIENT)\s*[:\-]?\s*([A-Z0-9\-]{6,20})", texte_upper)
    if match: resultats["numero_police"] = _nettoyer_valeur_securisee(match.group(1), "numero")
    
    # Compagnie d'assurance (souvent en haut du document)
    lignes = texte.split("\n")
    if lignes:
        premiere_ligne = lignes[0].strip()
        if len(premiere_ligne) > 3 and not re.match(r"^\d+$", premiere_ligne):
            resultats["compagnie_assurance"] = premiere_ligne
            
    # Date d'expiration / validité
    match_exp = re.search(r"(?:VALABLE\s*(?:JUSQU|AU)|EXPIRATION|FIN\s*DE\s*VALIDIT[EÉ])\s*[:\-]?\s*(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})", texte, re.IGNORECASE)
    if match_exp: resultats["date_expiration"] = _nettoyer_valeur_securisee(match_exp.group(1), "date")
    
    return resultats

def extraire_par_labels(texte: str, patterns: Dict[str, list]) -> Dict:
    """Extraction générique basée sur des labels (NOM, PRÉNOM, etc.)."""
    resultats = {}
    lignes = texte.split("\n")
    
    for champ, regex_list in patterns.items():
        for regex in regex_list:
            for i, ligne in enumerate(lignes):
                match = re.search(regex, ligne, re.IGNORECASE)
                if match:
                    # Même ligne
                    val = ligne[match.end():].strip()
                    if val and len(val) > 1:
                        resultats[champ] = _nettoyer_valeur_securisee(val, champ)
                        break
                    # Ligne suivante
                    if i + 1 < len(lignes):
                        val_suiv = lignes[i+1].strip()
                        if val_suiv and len(val_suiv) > 1 and not re.match(r"^(NOM|PRÉNOM|SEXE|DATE)", val_suiv.upper()):
                            resultats[champ] = _nettoyer_valeur_securisee(val_suiv, champ)
                            break
            if champ in resultats: break
    return resultats