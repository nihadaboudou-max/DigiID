# -*- coding: utf-8 -*-
"""
Modèle SuiviFamilial — enfants voyageant seuls, rassurés par SMS (Plan B, S7).

Fort impact social : une famille confie un enfant à un transporteur ; DigiID
émet un **ticket ``type=ENFANT``** (QR + numéro en clair) et prévient le parent
par **SMS au départ puis à l'arrivée**. L'enfant reste identifié dans le temps
via le ticket polymorphe, exactement comme un colis.
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Cycle de vie d'un suivi familial
# « enregistre_direct » : passager enregistré **par le chauffeur en route**
# (client monté en cours de trajet) — même flux de suivi que les autres.
STATUTS_SUIVI_FAMILIAL = (
    "enregistre", "enregistre_direct", "en_route", "arrive", "annule"
)

# Origine de l'enregistrement : guichet (receveur) ou chauffeur directement.
MODES_ENREGISTREMENT_SUIVI = ("guichet", "chauffeur_direct")


class SuiviFamilial(Base, MelangeTracabilite):
    """Enfant confié à un voyage, suivi par la famille (page publique + SMS)."""

    __tablename__ = "suivi_familial"
    __table_args__ = (
        Index("ix_suivi_familial_ticket_unique", "ticket_id", unique=True),
        Index("ix_suivi_familial_voyage", "voyage_id"),
        Index("ix_suivi_familial_chauffeur", "chauffeur_id"),
        Index("ix_suivi_familial_gare_depart", "gare_depart_id"),
        Index("ix_suivi_familial_gare_arrivee", "gare_arrivee_id"),
        Index("ix_suivi_familial_statut", "statut"),
        Index("ix_suivi_familial_enregistre_par", "enregistre_par_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Ticket porteur (type=ENFANT) : QR + numéro en clair pour la page publique.
    ticket_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True,
    )
    enfant_nom: Mapped[str] = mapped_column(String(150), nullable=False)
    enfant_age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    enfant_sexe: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    parent_nom: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    telephone_parent: Mapped[str] = mapped_column(String(30), nullable=False)
    # ─── Enregistrement & contacts (P0 ajusté) ───────────────────────
    # Type de passager : « enfant » (voyage sous la responsabilité d'un tiers)
    # ou « adulte » (voyageur autonome).
    type_passager: Mapped[str] = mapped_column(
        String(10), nullable=False, default="enfant", server_default="enfant"
    )
    # Adulte : son propre numéro. Enfant : numéro de l'acheteur du ticket.
    telephone_passager: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    # Acheteur du ticket (pour un enfant : la personne qui a payé le voyage).
    acheteur_nom: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    acheteur_tel: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    # Proche de confiance à prévenir (en plus du parent/passager).
    proche_nom: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    proche_telephone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    # Nombre de sacs (1 à 10) — traçabilité + anti-fraude, **sans impact** sur le prix.
    nombre_bagages: Mapped[int] = mapped_column(
        Integer, nullable=False, default=1, server_default="1"
    )
    # Chauffeur **explicitement** affecté (obligatoire à l'enregistrement).
    chauffeur_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Pré-alerte d'arrivée imminente (bouton « Prévenir de l'approche ») :
    # garde-fou pour n'envoyer les SMS qu'une seule fois.
    pre_alerte_envoyee: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Compte DigiID du parent (facultatif : la famille reçoit souvent juste les SMS).
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    gare_depart_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gares.id", ondelete="RESTRICT"),
        nullable=False,
    )
    gare_arrivee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gares.id", ondelete="RESTRICT"),
        nullable=False,
    )
    voyage_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("voyages.id", ondelete="SET NULL"),
        nullable=True,
    )
    statut: Mapped[str] = mapped_column(
        String(30), nullable=False, default="enregistre", server_default="enregistre"
    )
    # Origine de l'enregistrement : « guichet » (receveur) ou « chauffeur_direct »
    # (passager monté en route, enregistré par le chauffeur).
    mode_enregistrement: Mapped[str] = mapped_column(
        String(20), nullable=False, default="guichet", server_default="guichet"
    )
    # Garde-fous : un SMS de départ / d'arrivée ne part qu'une seule fois.
    sms_depart_envoye: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    sms_arrivee_envoye: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    # Agent (receveur) qui a enregistré l'enfant.
    enregistre_par_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<SuiviFamilial {self.enfant_nom} statut={self.statut}>"
