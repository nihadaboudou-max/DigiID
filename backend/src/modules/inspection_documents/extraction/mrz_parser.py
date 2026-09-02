# -*- coding: utf-8 -*-
"""Parseur MRZ universel (ICAO 9303). Supporte TD1, TD2, TD3."""
from datetime import datetime
from typing import Optional

CODES_PAYS_ICAO = {
    "CIV": "Côte d'Ivoire", "SEN": "Sénégal", "MLI": "Mali", "BFA": "Burkina Faso",
    "BEN": "Bénin", "TGO": "Togo", "NER": "Niger", "GIN": "Guinée", "GHA": "Ghana",
    "NGA": "Nigeria", "CMR": "Cameroun", "MAR": "Maroc", "DZA": "Algérie", "TUN": "Tunisie",
    # Ajoutez les autres pays selon vos besoins
}

def _convertir_date_mrz(date_mrz: str) -> Optional[str]:
    if not date_mrz or len(date_mrz) < 6: return None
    try:
        aa, mm, jj = int(date_mrz[0:2]), int(date_mrz[2:4]), int(date_mrz[4:6])
        aaaa = 1900 + aa if aa >= 40 else 2000 + aa
        if 1 <= mm <= 12 and 1 <= jj <= 31:
            return f"{jj:02d}/{mm:02d}/{aaaa}"
    except ValueError: pass
    return None

def parser_mrz_complet(l1: str, l2: str, l3: Optional[str] = None) -> dict:
    """Point d'entrée unique pour parser n'importe quelle MRZ."""
    resultat = {"format": "inconnu", "nom_famille": "", "prenoms": "", "numero_document": "", 
                "date_naissance_date": None, "date_expiration_date": None, "sexe": "non_detecte", "pays_emetteur": ""}
    
    if not l1 or not l2: return resultat
    
    # Détection format
    if l3 and len(l1) <= 32: resultat["format"] = "TD1"
    elif len(l2) <= 36: resultat["format"] = "TD2"
    else: resultat["format"] = "TD3"
    
    try:
        if resultat["format"] == "TD1":
            l1, l2, l3 = l1.ljust(30), l2.ljust(30), l3.ljust(30)
            resultat["pays_emetteur"] = l1[2:5].strip("<")
            resultat["numero_document"] = l1[5:14].replace("<", "")
            resultat["date_naissance_date"] = _convertir_date_mrz(l2[0:6])
            resultat["sexe"] = "M" if l2[7:8] == "M" else "F" if l2[7:8] == "F" else "non_detecte"
            resultat["date_expiration_date"] = _convertir_date_mrz(l2[8:14])
            parties = l3.split("<<")
            resultat["nom_famille"] = parties[0].replace("<", " ").strip() if parties else ""
            resultat["prenoms"] = parties[1].replace("<", " ").strip() if len(parties) > 1 else ""
            
        else: # TD2 ou TD3
            longueur = 36 if resultat["format"] == "TD2" else 44
            l1, l2 = l1.ljust(longueur), l2.ljust(longueur)
            resultat["pays_emetteur"] = l1[2:5].strip("<")
            noms = l1[5:].strip("<")
            parties = noms.split("<<")
            resultat["nom_famille"] = parties[0].replace("<", " ").strip() if parties else ""
            resultat["prenoms"] = parties[1].replace("<", " ").strip() if len(parties) > 1 else ""
            resultat["numero_document"] = l2[0:9].replace("<", "")
            resultat["date_naissance_date"] = _convertir_date_mrz(l2[13:19])
            resultat["sexe"] = "M" if l2[20:21] == "M" else "F" if l2[20:21] == "F" else "non_detecte"
            resultat["date_expiration_date"] = _convertir_date_mrz(l2[21:27])
    except Exception as e:
        from src.noyau.journal import journal
        journal.warning(f"Erreur parsing MRZ : {e}")
        
    resultat["pays_emetteur_nom"] = CODES_PAYS_ICAO.get(resultat["pays_emetteur"], resultat["pays_emetteur"])
    return resultat