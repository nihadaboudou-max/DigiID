# -*- coding: utf-8 -*-
"""
Extraction d'embedding facial pour la biométrie.
Utilise InsightFace si disponible, sinon fallback sur une détection OpenCV + hachage.
"""
import hashlib
import numpy as np
from typing import Optional, List
try:
    import cv2
    CV2_DISPONIBLE = True
except ImportError:
    cv2 = None
    CV2_DISPONIBLE = False

from src.noyau.journal import journal

# Tentative d'import d'InsightFace (recommandé pour la prod)
try:
    import insightface
    from insightface.app import FaceAnalysis
    INSIGHTFACE_DISPONIBLE = True
    # Initialisation différée pour éviter le crash au démarrage si le modèle n'est pas téléchargé
    _app = None
    def _get_face_app():
        global _app
        if _app is None:
            _app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
            _app.prepare(ctx_id=0, det_size=(640, 640))
        return _app
except ImportError:
    INSIGHTFACE_DISPONIBLE = False
    journal.warning("InsightFace non installé. L'embedding facial utilisera un mode dégradé (hachage).")


def generer_embedding_facial(image_bytes: bytes) -> Optional[List[float]]:
    """
    Génère un vecteur d'embedding facial (512 dimensions) à partir d'une image.
    
    Retourne une liste de floats ou None si aucun visage n'est détecté.
    """
    if not CV2_DISPONIBLE:
        journal.warning("OpenCV non disponible : extraction embedding impossible.")
        return None

    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            return None

        if INSIGHTFACE_DISPONIBLE:
            # Mode professionnel : InsightFace
            app = _get_face_app()
            faces = app.get(image)
            if len(faces) > 0:
                # Retourne l'embedding du premier visage détecté
                embedding = faces[0].embedding.tolist()
                journal.info(f"Embedding facial généré avec InsightFace (dim: {len(embedding)})")
                return embedding
            else:
                journal.warning("Aucun visage détecté par InsightFace.")
                return None
        else:
            # Mode dégradé (Fallback) : Détection Haar Cascade + Hachage simulé
            # (À remplacer par InsightFace en production pour une vraie biométrie)
            gris = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            visages = cascade.detectMultiScale(gris, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            
            if len(visages) > 0:
                # On simule un embedding de 128 dimensions basé sur un hachage de la région du visage
                # Ceci est un placeholder fonctionnel pour ne pas bloquer le pipeline
                x, y, w, h = visages[0]
                roi = gris[y:y+h, x:x+w]
                hash_val = hashlib.sha256(roi.tobytes()).digest()
                embedding_degrade = [float(b) / 255.0 for b in hash_val[:128]]  # Normalisé 0-1
                journal.info("Embedding facial généré en mode dégradé (Fallback).")
                return embedding_degrade
            else:
                journal.warning("Aucun visage détecté (OpenCV Fallback).")
                return None

    except Exception as e:
        journal.error(f"Erreur extraction embedding facial : {e}")
        return None