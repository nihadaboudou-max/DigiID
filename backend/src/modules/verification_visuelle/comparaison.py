# -*- coding: utf-8 -*-
"""Comparaison d'embeddings faciaux pour détection de similarité."""
from typing import Iterable
from src.modules.verification_visuelle.embedding_facial import calculer_similarite

def comparer_embeddings(
    embedding: Iterable[float],
    historique: list[tuple[str, list[float]]],
    seuil: float = 0.50,  # ✅ CHANGÉ : 50% au lieu de 60%
) -> list[dict]:
    """
    Retourne la liste des enregistrements similaires détectés.
    
    Paramètres
    ----------
    embedding : Iterable[float]
        Embedding à comparer
    historique : list[tuple[str, list[float]]]
        Liste de (identifiant, vecteur_embedding)
    seuil : float
        Seuil de similarité (0.50 = 50%, 0.60 = 60%, etc.)
        ✅ Recommandé : 0.50 pour CNI/Selfie
        
    Retourne
    --------
    list[dict]
        Liste des correspondances avec scores
    """
    resultats = []
    
    for identifiant, vecteur in historique:
        similarite = calculer_similarite(embedding, vecteur)
        
        if similarite >= seuil:
            resultats.append({
                "utilisateur_id": identifiant,
                "similarite": round(similarite, 3),
            })
    
    return resultats

def comparer_pour_verification_cni(
    embedding_selfie: Iterable[float],
    embedding_cni: list[float],
) -> dict:
    """
    Compare un selfie avec l'embedding de la CNI.
    ✅ Retourne un résultat détaillé avec interprétation
    
    Paramètres
    ----------
    embedding_selfie : Iterable[float]
        Embedding du selfie
    embedding_cni : list[float]
        Embedding de la photo CNI
        
    Retourne
    --------
    dict
        {
            "correspond": bool,
            "score_confiance": float (0-1),
            "message": str,
            "seuil_utilise": float
        }
    """
    SEUIL_RECOMMANDE = 0.50  # 50%
    
    score = calculer_similarite(embedding_selfie, embedding_cni)
    
    correspond = score >= SEUIL_RECOMMANDE
    
    if correspond:
        if score >= 0.70:
            message = "Excellente correspondance. Visage confirmé."
        elif score >= 0.60:
            message = "Bonne correspondance. Visage confirmé."
        else:
            message = "Correspondance acceptable. Visage confirmé."
    else:
        if score >= 0.40:
            message = "Faible similarité. La photo peut être ancienne ou l'angle différent."
        else:
            message = "Visage non correspondant. Assurez-vous que c'est bien vous."
    
    return {
        "correspond": correspond,
        "score_confiance": round(score, 3),
        "message": message,
        "seuil_utilise": SEUIL_RECOMMANDE,
    }