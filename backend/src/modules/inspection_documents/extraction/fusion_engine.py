# -*- coding: utf-8 -*-
"""
Moteur de fusion intelligente.
Règle d'or : Le MRZ est la source de vérité absolue pour les champs critiques.
"""
from src.modules.inspection_documents.schemas import DonneesDocumentExtraites, TypeDocument
from src.noyau.journal import journal

def fusionner_donnees(
    donnees_ocr: dict, 
    donnees_mrz: dict, 
    type_document: TypeDocument
) -> DonneesDocumentExtraites:
    """Fusionne les données OCR et MRZ avec priorité au MRZ."""
    
    # Initialisation avec les données OCR/NLP
    donnees_finales = DonneesDocumentExtraites(
        type_document=type_document,
        nom_famille=donnees_ocr.get("nom_famille"),
        prenoms=donnees_ocr.get("prenoms"),
        numero_document=donnees_ocr.get("numero_document"),
        date_naissance=donnees_ocr.get("date_naissance"),
        date_expiration=donnees_ocr.get("date_expiration"),
        sexe=donnees_ocr.get("sexe", "non_detecte"),
        donnees_specifiques=donnees_ocr.get("donnees_specifiques", {}),
        taux_confiance_ocr=donnees_ocr.get("confiance", 0.0),
        texte_brut=donnees_ocr.get("texte_brut", ""),
    )
    
    # Si MRZ présente, elle ÉCRASE les champs critiques de l'OCR
    if donnees_mrz and donnees_mrz.get("nom_famille"):
        journal.info("Fusion : Priorité MRZ activée pour les champs critiques.")
        donnees_finales.nom_famille = donnees_mrz.get("nom_famille") or donnees_finales.nom_famille
        donnees_finales.prenoms = donnees_mrz.get("prenoms") or donnees_finales.prenoms
        donnees_finales.numero_document = donnees_mrz.get("numero_document") or donnees_finales.numero_document
        donnees_finales.date_naissance = donnees_mrz.get("date_naissance_date") or donnees_finales.date_naissance
        donnees_finales.date_expiration = donnees_mrz.get("date_expiration_date") or donnees_finales.date_expiration
        if donnees_mrz.get("sexe") in ("M", "F"):
            donnees_finales.sexe = donnees_mrz["sexe"]
        donnees_finales.pays_emetteur = donnees_mrz.get("pays_emetteur_nom")
        donnees_finales.mrz_ligne_1 = donnees_ocr.get("mrz_ligne_1")
        donnees_finales.mrz_ligne_2 = donnees_ocr.get("mrz_ligne_2")
        donnees_finales.mrz_ligne_3 = donnees_ocr.get("mrz_ligne_3")
        donnees_finales.mrz_valide = True
        
    return donnees_finales