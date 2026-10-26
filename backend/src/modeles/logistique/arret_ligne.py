# -*- coding: utf-8 -*-
"""
Modèle ArretLigne — les arrêts intermédiaires ordonnés d'un trajet.

Une ligne relie une gare de départ à une gare d'arrivée. Sur le terrain, un car
ne s'arrête pas toujours au terminus : il dépose des sacs et des passagers à
Dassa, Savè, Bohicon… Sans cette table, tous les colis d'un voyage étaient
mélangés et le chauffeur devait trier à l'arrivée.

``ordre`` fixe la séquence des arrêts (1 = premier arrêt après le départ, le
plus grand nombre = terminus). La liste du chauffeur est triée sur cet ordre :
il sait, dans sa feuille de route, ce qu'il doit descendre à chaque étape.
"""
import uuid

from sqlalchemy import Boolean, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class ArretLigne(Base, MelangeTracabilite):
    """Arrêt intermédiaire d'une ligne, positionné par ``ordre``."""

    __tablename__ = "arrets_ligne"
    __table_args__ = (
        # Une gare ne figure qu'une fois sur un trajet…
        UniqueConstraint("ligne_id", "gare_id", name="uq_arrets_ligne_gare"),
        # …et deux arrêts ne peuvent pas occuper la même position.
        UniqueConstraint("ligne_id", "ordre", name="uq_arrets_ligne_ordre"),
        Index("ix_arrets_ligne_ligne", "ligne_id"),
        Index("ix_arrets_ligne_gare", "gare_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    ligne_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lignes.id", ondelete="CASCADE"),
        nullable=False,
    )
    gare_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("gares.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # 1 = premier arrêt, 2 = suivant… Le terminus est l'arrêt de plus grand ordre.
    ordre: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    actif: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    def __repr__(self) -> str:
        return f"<ArretLigne ligne={self.ligne_id} gare={self.gare_id} ordre={self.ordre}>"
