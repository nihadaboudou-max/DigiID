# -*- coding: utf-8 -*-
"""Service de recherche faciale médicale — upload, analyse, historique."""
import time
import uuid
from typing import Optional

from fastapi import UploadFile
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.recherche_faciale import RechercheFaciale
from src.modules.recherche_faciale.schemas import (
    HistoriqueRechercheItem,
    ListeRecherchesFaciales,
    PersonneRecherchee,
    ResultatRechercheFaciale,
)
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
    """Construit le profil d'une personne trouvée à partir du modèle Utilisateur."""
    return PersonneRecherchee(
        id=str(utilisateur.id),
        nom=utilisateur.nom_chiffre or "",
        prenom=utilisateur.prenom_chiffre or "",
        date_naissance=(
            utilisateur.date_naissance.isoformat()
            if hasattr(utilisateur, "date_naissance") and utilisateur.date_naissance
            else None
        ),
        groupe_sanguin=getattr(utilisateur, "groupe_sanguin", "O+"),
        telephone=utilisateur.telephone_chiffre or "",
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

    TODO: Implémenter la vraie reconnaissance faciale (embedding + matching).
          Pour l'instant, le matching est mocké.
    """
    start_time = time.time()

    # 1. Lire la photo
    contenu_photo = await _lire_photo(photo)
    nom_fichier = f"recherche_{uuid.uuid4()}.jpg"

    # 2. Recherche dans la base (MOCK — à remplacer par vrai matching facial)
    # Logique réelle à implémenter :
    #   - Extraire l'embedding facial de la photo
    #   - Comparer avec les embeddings stockés dans utilisateur.empreinte_faciale
    #   - Trouver la meilleure correspondance avec un score de similarité

    requete = await session.execute(
        select(Utilisateur)
        .where(Utilisateur.est_supprime == False)
        .limit(1)
    )
    utilisateur_trouve = requete.scalar_one_or_none()

    trouve = utilisateur_trouve is not None
    score_confiance = 85.5 if trouve else 0.0  # Score mocké
    personne_trouvee_id = utilisateur_trouve.id if utilisateur_trouve else None

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
    personne_data = None
    if utilisateur_trouve:
        personne_data = await _construire_profil_personne(utilisateur_trouve)

    return ResultatRechercheFaciale(
        trouve=trouve,
        personne=personne_data,
        score_confiance=score_confiance,
        temps_analyse_ms=temps_ecoule,
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
