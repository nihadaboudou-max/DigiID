# -*- coding: utf-8 -*-
"""
Classe de base SQLAlchemy 2.0 pour tous les modèles DigiID.

Convention de nommage : on utilise les conventions PostgreSQL standard
pour que les noms de contraintes soient prévisibles et faciles à inspecter.
"""
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, MetaData
from sqlalchemy.orm import DeclarativeBase, declared_attr, Mapped, mapped_column
from sqlalchemy.sql import func


# Conventions de nommage standard pour les contraintes PostgreSQL
convention_nommage: dict[str, Any] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """
    Classe parente de tous les modèles SQLAlchemy.

    Fournit :
      - Convention de nommage standard
      - Conversion automatique CamelCase -> snake_case pour les tables
    """
    metadata = MetaData(naming_convention=convention_nommage)

    @declared_attr.directive
    def __tablename__(cls) -> str:
        """
        Convertit le nom de classe en nom de table snake_case.
        Exemple : 'JournalAudit' -> 'journal_audit'
        """
        nom = cls.__name__
        resultat = []
        for i, lettre in enumerate(nom):
            if i > 0 and lettre.isupper():
                resultat.append("_")
            resultat.append(lettre.lower())
        return "".join(resultat)


class MelangeTracabilite:
    """
    Mixin qui ajoute des colonnes de traçabilité à tout modèle.
    À hériter en plus de Base pour avoir cree_le et modifie_le automatiques.

    Important : on utilise TIMESTAMP WITH TIME ZONE explicitement, parce que
    Python envoie des datetimes avec timezone (datetime.now(timezone.utc)).
    Sans cette précision, PostgreSQL crée des colonnes sans timezone et asyncpg
    refuse l'insertion.
    """
    cree_le: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    modifie_le: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
