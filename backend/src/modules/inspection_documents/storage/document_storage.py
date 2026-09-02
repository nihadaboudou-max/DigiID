# -*- coding: utf-8 -*-
"""
Gestion du stockage physique des documents scannés.
Sauvegarde les images dans un système de fichiers structuré par date.
"""
import os
import uuid
from datetime import datetime
from pathlib import Path
from src.noyau.journal import journal

# Répertoire de base pour les uploads (configurable via variable d'environnement)
BASE_DIR_UPLOADS = Path(os.getenv("DIR_UPLOADS", "/app/uploads/documents"))

def stocker_document(contenu_bytes: bytes, extension: str = "jpg", prefixe: str = "doc") -> str:
    """
    Stocke un document et retourne son chemin relatif.
    
    Structure : /uploads/documents/YYYY/MM/uuid_prefixe.ext
    """
    try:
        # Création de la structure de dossiers par année/mois
        now = datetime.now()
        dossier_annee = str(now.year)
        dossier_mois = f"{now.month:02d}"
        chemin_dossier = BASE_DIR_UPLOADS / dossier_annee / dossier_mois
        
        chemin_dossier.mkdir(parents=True, exist_ok=True)
        
        # Génération d'un nom de fichier unique et sécurisé
        nom_fichier = f"{uuid.uuid4().hex}_{prefixe}.{extension.lower()}"
        chemin_complet = chemin_dossier / nom_fichier
        
        # Écriture du fichier
        with open(chemin_complet, "wb") as f:
            f.write(contenu_bytes)
            
        # Retourne le chemin relatif (pour stockage en base de données)
        chemin_relatif = f"documents/{dossier_annee}/{dossier_mois}/{nom_fichier}"
        journal.info(f"Document stocké avec succès : {chemin_relatif}")
        
        return chemin_relatif
        
    except Exception as e:
        journal.error(f"Échec du stockage du document : {e}")
        raise RuntimeError("Impossible de sauvegarder le document sur le serveur.")