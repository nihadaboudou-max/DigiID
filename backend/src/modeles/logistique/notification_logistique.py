# -*- coding: utf-8 -*-
"""
Modèle NotificationLogistique — journal des SMS/alertes du pivot logistique (S7).

Chaque alerte (départ / arrivée / livraison) est tracée : destinataire, canal,
message réellement composé et statut d'envoi. En **mode mock** (aucun
agrégateur SMS configuré — cf. ``noyau/notification.py``), ce journal rend le
SMS simulé **visible** dans l'interface (page de suivi, fiche colis).
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Canaux d'alerte
CANAUX_NOTIFICATION = ("sms", "email", "appel")

# Type de l'objet notifié (polymorphe, comme les tickets)
TYPES_CIBLE_NOTIFICATION = ("colis", "suivi_familial")


class NotificationLogistique(Base, MelangeTracabilite):
    """Trace d'une alerte logistique envoyée (SMS mock puis réel)."""

    __tablename__ = "notifications_logistique"
    __table_args__ = (
        Index("ix_notifs_logistique_cible", "type_cible", "cible_id"),
        Index("ix_notifs_logistique_evenement", "type_evenement"),
        Index("ix_notifs_logistique_telephone", "telephone"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    canal: Mapped[str] = mapped_column(
        String(20), nullable=False, default="sms", server_default="sms"
    )
    # Cible polymorphe : ``colis`` / ``suivi_familial`` (pas de FK, cf. tickets).
    type_cible: Mapped[str] = mapped_column(String(30), nullable=False)
    cible_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    type_evenement: Mapped[str] = mapped_column(String(40), nullable=False)
    # Rôle du destinataire : ``destinataire`` / ``expediteur`` / ``parent``.
    destinataire_role: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    telephone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    # ``False`` si l'envoi a échoué (mode réel non configuré / erreur opérateur).
    envoye: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    def __repr__(self) -> str:
        return (
            f"<NotificationLogistique {self.canal} {self.type_cible} "
            f"{self.type_evenement} envoye={self.envoye}>"
        )
