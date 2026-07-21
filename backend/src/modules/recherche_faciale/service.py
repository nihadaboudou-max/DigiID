# -*- coding: utf-8 -*-
"""Service de recherche faciale médicale — upload, analyse, historique."""
import time
import uuid
from typing import Optional

from fastapi import UploadFile
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.noyau import dechiffrer_donnee
from src.noyau.exceptions import ErreurValidation
from src.modeles import Utilisateur
from src.modeles.recherche_faciale import RechercheFaciale
from src.modules.recherche_faciale.schemas import (
    HistoriqueRechercheItem,
    ListeRecherchesFaciales,
    PersonneRecherchee,
    ResultatRechercheFaciale,
)


async def _lire_photo(fichier: UploadFile) -> bytes:
    """Lit le contenu d'une photo uploadée."""
    contenu = await fichier.read()
    if not contenu:
        raise ErreurValidation(
            "Fichier vide reçu pour la recherche faciale.",
            message_utilisateur="Le fichier uploadé est vide. Merci de réessayer.",
        )
    return contenu


async def _construire_profil_personne(utilisateur: Utilisateur) -> PersonneRecherchee:
    """
    Construit le profil d'une personne trouvée à partir du modèle Utilisateur.
    Les champs chiffrés sont déchiffrés avant d'être renvoyés.
    """
    return PersonneRecherchee(
        id=str(utilisateur.id),
        nom=dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else "",
        prenom=dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else "",
        date_naissance=(
            utilisateur.date_naissance.isoformat()
            if hasattr(utilisateur, "date_naissance") and utilisateur.date_naissance
            else None
        ),
        groupe_sanguin=getattr(utilisateur, "groupe_sanguin", "O+"),
        telephone=dechiffrer_donnee(utilisateur.telephone_chiffre) if utilisateur.telephone_chiffre else "",
        contact_urgence=getattr(utilisateur, "contact_urgence", ""),
        photo=None,
        antecedents=[],
        allergies=[],
        digiid=getattr(utilisateur, "digiid_public", None),
    )


# -----------------------------------------------------------------------------
# Orchestration — recherche faciale
# -----------------------------------------------------------------------------

async def effectuer_recherche_faciale(
    session: AsyncSession,
    utilisateur: Utilisateur,
    photo: UploadFile,
) -> ResultatRechercheFaciale:
    """
    Traite une photo, effectue une recherche faciale et enregistre l'historique.

    ⚠️ MODE DÉVELOPPEMENT — FONCTIONNALITÉ NON IMPLÉMENTÉE
    ======================================================
    Le vrai matching facial n'est pas encore branché.
    Le résultat renvoie toujours "non trouvé" avec score = 0.

    ------------------------------------------------------
    Implémentation réelle à prévoir (stack technique) :
    ------------------------------------------------------
    1. Détection de visage
       - Librairie : deepface (recommended) ou face_recognition (dlib)
       - Vérifier que la photo contient bien un visage (sinon → ErreurValidation)
       - Extraire le bounding box + landmarks

    2. Extraction d'embedding facial
       - Modèle : Facenet512 (128D), ArcFace (512D) ou VGG-Face
       - Normaliser le vecteur (L2 norm)
       - Stocker dans utilisateur.empreinte_faciale (déjà présent dans le modèle)

    3. Recherche par similarité cosinus
       - SELECT id, empreinte_faciale FROM utilisateur WHERE est_supprime = False
       - Calculer la distance cosinus entre l'embedding de la photo et chaque stored
       - Seuils : > 0.7 = forte confiance, 0.4-0.7 = faible, < 0.4 = rejet
       - Prendre le meilleur score (max)

    4. Journalisation
       - Enregistrer le score réel, le temps d'analyse, le modèle utilisé
       - Détecter les tentatives avec des photos sans visage (fraude potentielle)

    5. Anti-spoofing (liveness) — optionnel mais recommandé
       - Vérifier que la photo n'est pas une capture d'écran / un masque
       - deepface propose une détection de liveness basique

    Référence : backend/src/modules/verification_visuelle/service.py
    (ce module fait déjà l'extraction d'embedding et la détection anti-doublon)
    """
    start_time = time.time()

    # 1. Lire la photo
    contenu_photo = await _lire_photo(photo)
    nom_fichier = f"recherche_{uuid.uuid4()}.jpg"

    # 2. Recherche dans la base — PAS ENCORE IMPLÉMENTÉE
    # Le code ci-dessous est un placeholder qui sera remplacé par :
    #   a) deepface.extract_embedding(photo_bytes) → vecteur 128D/512D
    #   b) SELECT id, empreinte_faciale FROM utilisateur WHERE est_supprime = False
    #   c) cosine_similarity(embedding_photo, embedding_stocke) pour chaque ligne
    #   d) Meilleur score + seuil de confiance
    #
    # Résultat : on retourne "non trouvé" quel que soit le contenu de la photo.
    # Cela évite les résultats fictifs trompeurs pendant le développement.

    personne_trouvee_id = None
    trouve = False
    score_confiance = 0.0

    temps_ecoule = int((time.time() - start_time) * 1000)

    # 3. Enregistrer l'historique
    recherche = RechercheFaciale(
        agent_medical_id=utilisateur.id,
        personne_trouvee_id=personne_trouvee_id,
        nom_fichier_photo=nom_fichier,
        score_confiance=score_confiance,
        temps_analyse_ms=temps_ecoule,
        resultat_recherche={
            "trouve": trouve,
            "methode": "reconnaissance_faciale",
        },
    )
    session.add(recherche)
    await session.commit()
    await session.refresh(recherche)

    # 4. Construire la réponse
    # Pas de personne trouvée — le matching facial n'est pas implémenté
    personne_data = None

    return ResultatRechercheFaciale(
        trouve=trouve,
        personne=personne_data,
        score_confiance=score_confiance,
        temps_analyse_ms=temps_ecoule,
        mode_developpement=True,
    )


# -----------------------------------------------------------------------------
# Historique
# -----------------------------------------------------------------------------

async def obtenir_historique(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 10,
) -> ListeRecherchesFaciales:
    """Retourne l'historique des recherches faciales de l'agent médical."""
    requete = await session.execute(
        select(RechercheFaciale)
        .where(
            RechercheFaciale.agent_medical_id == utilisateur.id,
            RechercheFaciale.est_supprime == False,
        )
        .order_by(desc(RechercheFaciale.cree_le))
        .limit(limite)
    )
    recherches = requete.scalars().all()

    # Comptage total
    requete_total = await session.execute(
        select(func.count(RechercheFaciale.id))
        .where(
            RechercheFaciale.agent_medical_id == utilisateur.id,
            RechercheFaciale.est_supprime == False,
        )
    )
    total = requete_total.scalar_one()

    return ListeRecherchesFaciales(
        historique=[
            HistoriqueRechercheItem(
                id=r.id,
                date_recherche=r.cree_le,
                score_confiance=r.score_confiance,
                personne_trouvee_id=r.personne_trouvee_id,
            )
            for r in recherches
        ],
        total=total,
    )
