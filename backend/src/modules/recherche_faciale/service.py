# -*- coding: utf-8 -*- """Service de recherche faciale médicale — deepface, matching, historique."""
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import UploadFile
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.parametres import parametres
from src.modeles import Utilisateur
from src.modeles.recherche_faciale import RechercheFaciale
from src.modeles.verification_visuelle import VerificationVisuelle
from src.modules.recherche_faciale.schemas import (
    HistoriqueRechercheItem,
    ListeRecherchesFaciales,
    PersonneRecherchee,
    ResultatRechercheFaciale,
)
from src.modules.verification_visuelle.detection_visage import detecter_visage
from src.modules.verification_visuelle.embedding_facial import (
    calculer_similarite,
    generer_embedding,
    meilleur_score,
)
from src.noyau import dechiffrer_donnee, journal
from src.noyau.exceptions import ErreurValidation


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


async def _recuperer_tous_embeddings(
    session: AsyncSession,
) -> list[tuple[str, list[float]]]:
    """
    Récupère les embeddings faciaux de tous les utilisateurs ayant une
    vérification visuelle réussie (embedding stocké dans VerificationVisuelle).

    Retourne une liste de (utilisateur_id, vecteur_embedding).
    """
    # Sous-requête : pour chaque utilisateur, prendre l'ID de sa dernière vérification approuvée
    sous_requete = (
        select(
            VerificationVisuelle.utilisateur_id,
            func.max(VerificationVisuelle.cree_le).label("derniere_date"),
        )
        .where(
            VerificationVisuelle.embedding.isnot(None),
            VerificationVisuelle.statut == "approuve",
            VerificationVisuelle.est_supprime == False,
        )
        .group_by(VerificationVisuelle.utilisateur_id)
    ).subquery()

    requete = await session.execute(
        select(
            VerificationVisuelle.utilisateur_id,
            VerificationVisuelle.embedding,
        )
        .join(
            sous_requete,
            (VerificationVisuelle.utilisateur_id == sous_requete.c.utilisateur_id)
            & (VerificationVisuelle.cree_le == sous_requete.c.derniere_date),
        )
    )
    resultats = requete.all()
    return [
        (str(row.utilisateur_id), row.embedding)
        for row in resultats
        if row.embedding is not None
    ]


# -----------------------------------------------------------------------------
# Orchestration — recherche faciale
# -----------------------------------------------------------------------------

async def effectuer_recherche_faciale(
    session: AsyncSession,
    utilisateur: Utilisateur,
    photo: UploadFile,
) -> ResultatRechercheFaciale:
    """
    Recherche faciale complète :
      1. Détection de visage (OpenCV Haar)
      2. Extraction d'embedding (deepface Facenet512)
      3. Correspondance cosinus avec tous les embeddings stockés
      4. Meilleur score + seuil de confiance
      5. Enregistrement dans l'historique + retour du profil

    ⚠️ Nécessite deepface + tensorflow installés.
    """
    start_time = time.time()

    # 1. Lire la photo
    contenu_photo = await _lire_photo(photo)
    nom_fichier = f"recherche_{uuid.uuid4()}.jpg"

    # 2. Détection de visage
    visage_detecte, _ = detecter_visage(contenu_photo)
    if not visage_detecte:
        raise ErreurValidation(
            "Aucun visage détecté dans la photo.",
            message_utilisateur=(
                "Impossible de détecter un visage sur cette photo. "
                "Assure-toi que la photo est nette et bien éclairée."
            ),
        )

    # 3. Extraction d'embedding via deepface
    try:
        embedding_source = generer_embedding(contenu_photo)
    except ValueError as exc:
        raise ErreurValidation(
            str(exc),
            message_utilisateur=(
                "Le visage n'est pas reconnaissable. "
                "Essaie avec une photo plus nette et de face."
            ),
        )

    # 4. Récupérer tous les embeddings existants
    tous_embeddings = await _recuperer_tous_embeddings(session)

    # 5. Trouver la meilleure correspondance
    meilleur_id, meilleur_score_val = meilleur_score(tous_embeddings, embedding_source)

    # Seuils de confiance
    SEUIL_HAUTE_CONFIANCE = 0.70   # ≥ 70 % → certitude
    SEUIL_CONFIANCE_MOYENNE = 0.45  # ≥ 45 % → possible, contrôle manuel conseillé

    trouve = meilleur_id is not None and meilleur_score_val >= SEUIL_CONFIANCE_MOYENNE
    score_confiance = round(meilleur_score_val * 100, 1) if trouve else 0.0

    personne_trouvee_id = None
    personne_data = None

    if trouve and meilleur_id:
        try:
            uid = uuid.UUID(meilleur_id)
        except ValueError:
            uid = None

        if uid:
            # Chercher l'utilisateur dans la base
            requete_user = await session.execute(
                select(Utilisateur).where(
                    Utilisateur.id == uid,
                    Utilisateur.est_supprime == False,
                )
            )
            utilisateur_trouve = requete_user.scalar_one_or_none()

            if utilisateur_trouve:
                personne_trouvee_id = uid
                personne_data = await _construire_profil_personne(utilisateur_trouve)

    temps_ecoule = int((time.time() - start_time) * 1000)

    # 6. Enregistrer l'historique
    recherche = RechercheFaciale(
        agent_medical_id=utilisateur.id,
        personne_trouvee_id=personne_trouvee_id,
        nom_fichier_photo=nom_fichier,
        type_mime=photo.content_type or "image/jpeg",
        taille_octets=len(contenu_photo),
        score_confiance=score_confiance,
        temps_analyse_ms=temps_ecoule,
        resultat_recherche={
            "trouve": trouve,
            "methode": "deepface_facenet512",
            "similarite_brute": round(meilleur_score_val, 4),
            "seuil_minimum": SEUIL_CONFIANCE_MOYENNE,
            "nb_embeddings_parcourus": len(tous_embeddings),
        },
    )
    session.add(recherche)
    await session.commit()
    await session.refresh(recherche)

    journal.info(
        f"Recherche faciale : trouvé={trouve} score={score_confiance}% "
        f"embeddings={len(tous_embeddings)} temps={temps_ecoule}ms"
    )

    return ResultatRechercheFaciale(
        trouve=trouve,
        personne=personne_data,
        score_confiance=score_confiance,
        temps_analyse_ms=temps_ecoule,
        mode_developpement=False,
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
