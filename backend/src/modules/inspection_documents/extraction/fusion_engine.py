# -*- coding: utf-8 -*-
"""
Moteur de fusion intelligente.
Règle d'or : Le MRZ est la source de vérité absolue pour les champs critiques.
Ce module garantit que toutes les valeurs passées à Pydantic sont valides (pas de None).
"""
from src.modules.inspection_documents.schemas import DonneesDocumentExtraites, TypeDocument
from src.noyau.journal import journal

def fusionner_donnees(
    donnees_ocr: dict, 
    donnees_mrz: dict, 
    type_document: TypeDocument
) -> DonneesDocumentExtraites:
    """Fusionne les données OCR et MRZ avec priorité au MRZ."""
    
    # 1. Sécuriser les valeurs pour éviter les None qui cassent la validation Pydantic
    # L'opérateur 'or' gère à la fois les clés manquantes et les valeurs explicitement à None
    sexe_val = donnees_ocr.get("sexe") or donnees_mrz.get("sexe") or "non_detecte"
    if sexe_val not in ("M", "F", "non_detecte"):
        sexe_val = "non_detecte"
        
    # 2. Initialisation avec les données OCR/NLP (avec valeurs par défaut sûres)
    donnees_finales = DonneesDocumentExtraites(
        type_document=type_document,
        nom_famille=donnees_ocr.get("nom_famille"),
        prenoms=donnees_ocr.get("prenoms"),
        numero_document=donnees_ocr.get("numero_document"),
        date_naissance=donnees_ocr.get("date_naissance"),
        date_expiration=donnees_ocr.get("date_expiration"),
        sexe=sexe_val,  # ✅ Garanti d'être une chaîne valide ("M", "F" ou "non_detecte")
        donnees_specifiques=donnees_ocr.get("donnees_specifiques") or {},
        taux_confiance_ocr=float(donnees_ocr.get("confiance", 0.0) or 0.0),
        texte_brut=str(donnees_ocr.get("texte_brut", "")),
    )
    
    # 3. Si MRZ présente, elle ÉCRASE les champs critiques de l'OCR
    if donnees_mrz and donnees_mrz.get("nom_famille"):
        journal.info("Fusion : Priorité MRZ activée pour les champs critiques.")
        
        donnees_finales.nom_famille = donnees_mrz.get("nom_famille") or donnees_finales.nom_famille
        donnees_finales.prenoms = donnees_mrz.get("prenoms") or donnees_finales.prenoms
        donnees_finales.numero_document = donnees_mrz.get("numero_document") or donnees_finales.numero_document
        donnees_finales.date_naissance = donnees_mrz.get("date_naissance_date") or donnees_finales.date_naissance
        donnees_finales.date_expiration = donnees_mrz.get("date_expiration_date") or donnees_finales.date_expiration
        
        sexe_mrz = donnees_mrz.get("sexe")
        if sexe_mrz in ("M", "F"):
            donnees_finales.sexe = sexe_mrz
            
        donnees_finales.pays_emetteur = donnees_mrz.get("pays_emetteur_nom")
        donnees_finales.mrz_ligne_1 = donnees_ocr.get("mrz_ligne_1")
        donnees_finales.mrz_ligne_2 = donnees_ocr.get("mrz_ligne_2")
        donnees_finales.mrz_ligne_3 = donnees_ocr.get("mrz_ligne_3")
        donnees_finales.mrz_valide = True
        
    return donnees_finales