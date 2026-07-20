# -*- coding: utf-8 -*-
"""
Routeur pour la recherche faciale médicale.
Endpoint: /api/v1/medical/recherche-faciale/*
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from typing import Optional
from datetime import datetime
import time
import uuid
import base64
import io

from src.base_donnees.session import SessionLocale
from sqlalchemy.orm import Session
from src.modeles.recherche_faciale import RechercheFaciale
from src.schemas.authentification import obtenir_utilisateur_actif
from src.modeles.utilisateur import Utilisateur

routeur_recherche_faciale = APIRouter(
    prefix="/api/v1/medical/recherche-faciale",
    tags=["recherche-faciale"],
)

@routeur_recherche_faciale.post("/")
async def rechercher_personne_par_photo(
    photo: UploadFile = File(...),
    current_user: Utilisateur = Depends(obtenir_utilisateur_actif),
    db: Session = Depends(SessionLocale),
):
    """
    Recherche une personne dans la base par reconnaissance faciale.
    Similaire à l'upload de vérification visuelle mais pour la recherche.
    """
    start_time = time.time()
    
    # Vérifier le rôle (agent médical ou chef médical)
    if current_user.role not in ["agent_medical", "chef_medical"]:
        raise HTTPException(
            status_code=403,
            detail="Accès réservé aux agents médicaux"
        )
    
    try:
        # 1. Sauvegarder la photo (temporairement)
        nom_fichier = f"recherche_{uuid.uuid4()}.jpg"
        
        # Lire le contenu du fichier
        contenu_photo = await photo.read()
        
        # TODO: Ici, implémenter la vraie reconnaissance faciale
        # Pour l'instant, on fait un mock
        
        # 2. Recherche dans la base de données (MOCK - à remplacer)
        # Exemple de logique réelle à implémenter:
        # - Extraire l'embedding facial de la photo
        # - Comparer avec les embeddings stockés dans la table utilisateur
        # - Trouver la meilleure correspondance
        
        # Mock: On cherche un utilisateur au hasard (à remplacer par vraie logique)
        from src.modeles.utilisateur import Utilisateur as ModeleUtilisateur
        
        # Recherche simplifiée (à remplacer par comparaison faciale)
        utilisateur_trouve = db.query(ModeleUtilisateur).filter(
            ModeleUtilisateur.est_supprime == False
        ).first()
        
        trouve = utilisateur_trouve is not None
        score_confiance = 85.5 if trouve else 0.0  # Score mocké
        personne_trouvee_id = utilisateur_trouve.id if utilisateur_trouve else None
        
        temps_ecoule = int((time.time() - start_time) * 1000)
        
        # 3. Créer l'entrée dans l'historique
        recherche = RechercheFaciale(
            agent_medical_id=current_user.id,
            personne_trouvee_id=personne_trouvee_id,
            nom_fichier_photo=nom_fichier,
            score_confiance=score_confiance,
            temps_analyse_ms=temps_ecoule,
            resultat_recherche={
                "trouve": trouve,
                "methode": "reconnaissance_faciale",
            },
        )
        db.add(recherche)
        db.commit()
        db.refresh(recherche)
        
        # 4. Préparer les données de la personne trouvée
        personne_data = None
        if utilisateur_trouve:
            personne_data = {
                "id": str(utilisateur_trouve.id),
                "nom": utilisateur_trouve.nom or "",
                "prenom": utilisateur_trouve.prenom or "",
                "date_naissance": utilisateur_trouve.date_naissance.isoformat() if utilisateur_trouve.date_naissance else None,
                "groupe_sanguin": getattr(utilisateur_trouve, 'groupe_sanguin', 'O+'),
                "telephone": utilisateur_trouve.telephone or "",
                "contact_urgence": getattr(utilisateur_trouve, 'contact_urgence', ''),
                "photo": None,  # URL de la photo si disponible
                "antecedents": [],  # À récupérer du dossier médical
                "allergies": [],  # À récupérer du dossier médical
            }
        
        return {
            "trouve": trouve,
            "personne": personne_data,
            "score_confiance": score_confiance,
            "temps_analyse_ms": temps_ecoule,
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erreur lors de la recherche: {str(e)}")

@routeur_recherche_faciale.get("/historique")
async def obtenir_historique_recherches(
    limite: int = 10,
    current_user: Utilisateur = Depends(obtenir_utilisateur_actif),
    db: Session = Depends(SessionLocale),
):
    """
    Historique des recherches faciales (comme verification_visuelle).
    """
    if current_user.role not in ["agent_medical", "chef_medical"]:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    requete = db.query(RechercheFaciale).filter(
        RechercheFaciale.agent_medical_id == current_user.id,
        RechercheFaciale.est_supprime == False
    ).order_by(RechercheFaciale.date_recherche.desc()).limit(limite)
    
    recherches = requete.all()
    
    total = db.query(RechercheFaciale).filter(
        RechercheFaciale.agent_medical_id == current_user.id,
        RechercheFaciale.est_supprime == False
    ).count()
    
    return {
        "historique": [
            {
                "id": str(r.id),
                "date_recherche": r.date_recherche.isoformat(),
                "score_confiance": r.score_confiance,
                "personne_trouvee_id": str(r.personne_trouvee_id) if r.personne_trouvee_id else None,
            }
            for r in recherches
        ],
        "total": total,
    }