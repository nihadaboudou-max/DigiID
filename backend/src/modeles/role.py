# -*- coding: utf-8 -*-
"""
Modèle Role — table de référence des rôles.

Permet d'ajouter des permissions fines plus tard (RBAC granulaire)
sans toucher au modèle Utilisateur.
"""
from typing import Optional

from sqlalchemy import String, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite


class Role(Base, MelangeTracabilite):
    """Table des rôles disponibles dans le système."""

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nom_technique: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
        doc="Nom technique utilisé en code (citoyen, agent, medecin, police, ong, administrateur, super_administrateur)"
    )
    nom_affichage: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        doc="Nom affiché à l'utilisateur (Citoyen, Agent, Médecin, Police, ONG, Administrateur, Super Administrateur)"
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    niveau_hierarchie: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        doc="Niveau hiérarchique — plus élevé = plus de droits"
    )

    def __repr__(self) -> str:
        return f"<Role {self.nom_technique} (niveau={self.niveau_hierarchie})>"
