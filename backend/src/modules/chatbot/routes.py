# -*- coding: utf-8 -*-
"""Routes API du module chatbot."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modeles import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.chatbot import service
from src.modules.chatbot.schemas import (
    ConversationApercu, ConversationDetail, ListeConversations,
    MessageDetail, NouveauMessageRequete, NouveauMessageReponse,
)


routeur_chatbot = APIRouter(
    prefix="/api/v1/utilisateur/chatbot",
    tags=["Chatbot"],
)


@routeur_chatbot.post(
    "/conversations",
    response_model=ConversationApercu,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une nouvelle conversation vide",
)
async def creer(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.creer_conversation(session, utilisateur)


@routeur_chatbot.get(
    "/conversations",
    response_model=ListeConversations,
    summary="Lister mes conversations",
)
async def lister(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    conversations = await service.lister_conversations(session, utilisateur)
    return ListeConversations(
        conversations=[ConversationApercu.model_validate(c) for c in conversations],
        total=len(conversations),
    )


@routeur_chatbot.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetail,
    summary="Voir une conversation avec ses messages",
)
async def voir(
    conversation_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    return await service.obtenir_conversation_avec_messages(
        session, utilisateur, conversation_id,
    )


@routeur_chatbot.post(
    "/conversations/{conversation_id}/messages",
    response_model=NouveauMessageReponse,
    summary="Envoyer un message — la réponse de l'assistant est incluse",
)
async def envoyer(
    conversation_id: UUID,
    donnees: NouveauMessageRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    message_user, message_assistant = await service.envoyer_message(
        session, utilisateur, conversation_id, donnees.contenu,
    )
    return NouveauMessageReponse(
        message_utilisateur=MessageDetail.model_validate(message_user),
        message_assistant=MessageDetail.model_validate(message_assistant),
    )


@routeur_chatbot.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une conversation et tous ses messages",
)
async def supprimer(
    conversation_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
):
    await service.supprimer_conversation(session, utilisateur, conversation_id)
