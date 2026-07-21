# -*- coding: utf-8 -*-
"""Routes API du module de recherche faciale médicale."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.recherche_faciale import service
from src.modules.recherche_faciale.schemas import (
    ListeRecherchesFaciales,
    ResultatRechercheFaciale,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurAutorisation
from src.noyau.journal import enregistrer_evenement_audit


routeur_recherche_faciale = APIRouter(
    prefix="/api/v1/medical/recherche-faciale",
    tags=["Recherche Faciale Médicale"],
)


@routeur_recherche_faciale.post(
    "",
    response_model=ResultatRechercheFaciale,
    status_code=status.HTTP_200_OK,
    summary="Rechercher une personne par photo (reconnaissance faciale)",
)
async def rechercher_personne_par_photo(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    photo: UploadFile = File(..., description="Photo du visage au format JPG ou PNG"),
):
    """
    Recherche une personne dans la base par reconnaissance faciale.
    Réservé aux agents médicaux et chefs médicaux.
    """
    # Vérification du rôle
    if utilisateur.role not in ("agent_medical", "chef_medical"):
        raise ErreurAutorisation(
            f"Rôle {utilisateur.role} non autorisé pour la recherche faciale.",
            message_utilisateur="Accès réservé aux agents médicaux.",
        )

    try:
        resultat = await service.effectuer_recherche_faciale(
            session=session,
            utilisateur=utilisateur,
            photo=photo,
        )

        await enregistrer_evenement_audit(
            session=session,
            type_evenement="recherche_faciale",
            description=(
                f"Recherche faciale — trouvé={resultat.trouve} "
                f"score={resultat.score_confiance:.1f}% "
                f"temps={resultat.temps_analyse_ms}ms"
            ),
            utilisateur_id=utilisateur.id,
            role_acteur=utilisateur.role,
        )

        return resultat

    except Exception as e:
        journal.error(f"Erreur lors de la recherche faciale : {e}")
        raise


@routeur_recherche_faciale.get(
    "/historique",
    response_model=ListeRecherchesFaciales,
    summary="Historique des recherches faciales de l'agent",
)
async def obtenir_historique_recherches(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
    limite: int = 10,
):
    """
    Historique des recherches faciales effectuées par l'agent médical connecté.
    Réservé aux agents médicaux et chefs médicaux.
    """
    if utilisateur.role not in ("agent_medical", "chef_medical"):
        raise ErreurAutorisation(
            f"Rôle {utilisateur.role} non autorisé.",
            message_utilisateur="Accès réservé aux agents médicaux.",
        )

    return await service.obtenir_historique(
        session=session,
        utilisateur=utilisateur,
        limite=limite,
    )
