# -*- coding: utf-8 -*-
"""
Modèle Bagage — étiquette de traçabilité d'un sac (Plan B, P0).

Le receveur saisit le **nombre exact de sacs** (1 à 10) d'un passager/colis via
un compteur visuel. DigiID génère **une étiquette QR par sac** (numéro de série
``Sac 1/3``, ``Sac 2/3``…) imprimée **en une seule fois**.

Important : le nombre de sacs sert **uniquement** à la traçabilité et à la
vérification **anti-fraude à l'arrivée** (recompter les sacs remis à la famille) ;
il **n'impacte pas** le prix (le service est facturé 100 FCFA par passager/enfant,
quel que soit le nombre de bagages).

Le bagage est polymorphe : il peut appartenir à un **passager** (SuiviFamilial)
ou à un **colis**. Chaque sac porte un ``Ticket`` (``type=BAGAGE``) via
``ticket_id``, ce qui lui donne un QR + un code clair scannable comme les autres.
"""
import uuid
from typing import Optional

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Statuts d'un bagage (traçabilité + vérification anti-fraude à l'arrivée)
STATUTS_BAGAGE = ("attendu", "charge", "arrive", "remis", "manquant")


class Bagage(Base, MelangeTracabilite):
    """Étiquette de traçabilité d'un sac rattaché à un passager ou à un colis."""

    __tablename__ = "bagages"
    __table_args__ = (
        Index("ix_bagages_ticket_unique", "ticket_id", unique=True),
        Index("ix_bagages_suivi_familial", "suivi_familial_id"),
        Index("ix_bagages_colis", "colis_id"),
        Index("ix_bagages_statut", "statut"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Étiquette QR du sac (ticket type=BAGAGE : code clair + QR).
    ticket_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Rattaché à un passager (SuiviFamilial)…
    suivi_familial_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("suivi_familial.id", ondelete="CASCADE"),
        nullable=True,
    )
    # …ou à un colis (au moins l'un des deux est renseigné).
    colis_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("colis.id", ondelete="CASCADE"),
        nullable=True,
    )
    # Numéro de série lisible : « Sac 1/3 », « Sac 2/3 »…
    numero_serie: Mapped[str] = mapped_column(String(30), nullable=False)
    # Position dans le lot (1..N) — utile pour recompter à l'arrivée.
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    nombre_total: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    statut: Mapped[str] = mapped_column(
        String(20), nullable=False, default="attendu", server_default="attendu"
    )

    def __repr__(self) -> str:
        return f"<Bagage {self.numero_serie} statut={self.statut}>"
