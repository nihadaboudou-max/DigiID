# -*- coding: utf-8 -*-
"""
Génération d'embedding facial via deepface (Facenet512/ArcFace).
Version optimisée : passage direct du tableau NumPy à DeepFace pour éviter 
les erreurs de lecture de fichier et les écritures disque inutiles.
"""
from typing import Iterable, Optional
import numpy as np
import cv2
from src.noyau import journal

_BACKEND: str = "retinaface"  
_MODELE: str = "Facenet512" 
_HANDLE_DEEPFACE = None

def _obtenir_deepface():
    """Importe et retourne le module DeepFace (lazy)."""
    global _HANDLE_DEEPFACE
    if _HANDLE_DEEPFACE is None:
        try:
            from deepface import DeepFace
            _HANDLE_DEEPFACE = DeepFace
            journal.info("Module DeepFace chargé avec succès.")
        except ImportError:
            raise RuntimeError(
                "deepface n'est pas installé. "
                "Exécute : docker compose exec backend pip install deepface tensorflow"
            )
    return _HANDLE_DEEPFACE

def _optimiser_image_cni(image_bytes: bytes) -> bytes:
    """Applique un filtre CLAHE pour réduire les reflets du plastique de la CNI."""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            journal.warning("Échec du décodage de l'image pour CLAHE.")
            return image_bytes

        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        img_clahe = cv2.merge((l, a, b))
        img_final = cv2.cvtColor(img_clahe, cv2.COLOR_LAB2BGR)

        _, buffer = cv2.imencode('.jpg', img_final, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return buffer.tobytes()
    except Exception as e:
        journal.warning(f"Erreur lors de l'optimisation CLAHE : {e}")
        return image_bytes

def generer_embedding(
    image_bytes: bytes,
    modele: str = _MODELE,
    detecter_visage: bool = True,
    appliquer_clahe: bool = True,
) -> list[float]:
    """
    Extrait un embedding facial (vecteur 512D) via deepface Facenet512.
    """
    DeepFace = _obtenir_deepface()
    
    # Prétraitement optionnel pour les CNI
    if appliquer_clahe:
        image_bytes = _optimiser_image_cni(image_bytes)

    # Vérification stricte du type
    if not isinstance(image_bytes, (bytes, bytearray)):
        raise ValueError(f"Type d'image invalide attendu: bytes, reçu: {type(image_bytes)}")

    # Décoder l'image en tableau numpy directement (évite les écritures disque et les bugs de cv2.imread dans DeepFace)
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_array = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img_array is None:
        raise ValueError("Le fichier image est corrompu ou illisible par OpenCV.")

    try:
        # 2. DeepFace.represent avec le tableau numpy directement
        # CORRECTION CRITIQUE : On passe le tableau numpy, pas un chemin de fichier (str)
        resultat = DeepFace.represent(
            img_path=img_array,  
            model_name=modele,
            detector_backend=_BACKEND,
            enforce_detection=detecter_visage,
            align=True,
        )
    except ValueError as exc:
        # Fallback : Si retinaface échoue, on tente avec opencv
        journal.warning(f"Échec avec {_BACKEND}, tentative avec opencv : {exc}")
        try:
            resultat = DeepFace.represent(
                img_path=img_array,
                model_name=modele,
                detector_backend="opencv",
                enforce_detection=detecter_visage,
                align=True,
            )
        except Exception as fallback_exc:
            raise ValueError(f"Aucun visage détecté dans l'image : {fallback_exc}") from fallback_exc
    except Exception as exc:
        raise RuntimeError(f"Erreur lors de l'extraction de l'embedding : {exc}") from exc
            
    if not resultat or not isinstance(resultat, list) or len(resultat) == 0 or "embedding" not in resultat[0]:
        raise ValueError("deepface n'a pas retourné d'embedding valide.")
        
    embedding: list[float] = resultat[0]["embedding"]
    
    # 3. Normalisation L2
    norme = np.linalg.norm(embedding)
    if norme > 0:
        embedding = (np.array(embedding) / norme).tolist()
        
    return embedding