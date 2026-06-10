# -*- coding: utf-8 -*-
"""
Modèles Conversation et Message — mémoire conversationnelle du chatbot.

Chaque utilisateur a plusieurs conversations indépendantes. Chaque
conversation contient une suite de messages (utilisateur / assistant).

Le chatbot envoie au LLM les N derniers messages comme contexte —
c'est la "mémoire" qui permet au chatbot de se souvenir de ce qu'on
a dit dans les échanges précédents.
"""
import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.base_donnees.base import Base, MelangeTracabilite


class Conversation(Base, MelangeTracabilite):
    """Une conversation = un fil d'échanges entre l'utilisateur et le chatbot."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Titre généré automatiquement à partir du premier message
    # (Phase 3 : on prend les 80 premiers caractères du premier message)
    titre: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        default="Nouvelle conversation",
        doc="Titre court de la conversation, affiché dans la liste latérale"
    )

    # Mise à jour à chaque nouveau message — utile pour trier les conversations
    date_dernier_message: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # Relation vers les messages (cascade : supprimer la conversation supprime ses messages)
    messages: Mapped[List["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.cree_le",
    )

    def __repr__(self) -> str:
        return f"<Conversation '{self.titre}' utilisateur={self.utilisateur_id}>"


class Message(Base, MelangeTracabilite):
    """Un message dans une conversation — soit de l'utilisateur, soit de l'assistant."""

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversation.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # "utilisateur" ou "assistant" — détermine de quel côté apparaît la bulle
    auteur: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        doc="'utilisateur' = humain, 'assistant' = chatbot"
    )

    # Texte brut du message
    contenu: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Optionnel : nombre de tokens utilisés (pour la facturation LLM)
    tokens_utilises: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        doc="Nombre de tokens consommés par le LLM pour cette réponse"
    )

    # Relation inverse vers la conversation
    conversation: Mapped["Conversation"] = relationship(back_populates="messages")

    def __repr__(self) -> str:
        apercu = self.contenu[:50] + "..." if len(self.contenu) > 50 else self.contenu
        return f"<Message {self.auteur}: '{apercu}'>"
