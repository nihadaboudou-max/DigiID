# -*- coding: utf-8 -*-
"""Schémas Pydantic du module chatbot."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MessageDetail(BaseModel):
    """Un message dans une conversation."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    auteur: str         # "utilisateur" ou "assistant"
    contenu: str
    cree_le: datetime


class ConversationApercu(BaseModel):
    """Aperçu d'une conversation (pour la liste latérale)."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    titre: str
    date_dernier_message: Optional[datetime]
    cree_le: datetime


class ConversationDetail(BaseModel):
    """Conversation avec tous ses messages."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    titre: str
    cree_le: datetime
    messages: list[MessageDetail]


class ListeConversations(BaseModel):
    conversations: list[ConversationApercu]
    total: int


class NouveauMessageRequete(BaseModel):
    """Envoi d'un nouveau message — l'utilisateur tape son texte."""
    contenu: str = Field(..., min_length=1, max_length=5000)


class NouveauMessageReponse(BaseModel):
    """Réponse complète après envoi : le message de l'utilisateur + la réponse de l'assistant."""
    message_utilisateur: MessageDetail
    message_assistant: MessageDetail
