# -*- coding: utf-8 -*-
"""
Modèle ProfilLogistique — dossier professionnel d'un acteur du pivot logistique.

Objet : **fiabiliser** la chaîne « qui conduit et qui enregistre ». Un chauffeur
ou un receveur déclare sa pièce d'identité, son permis (chauffeur) et son
véhicule ; un gérant de gare (ou un administrateur) **valide** le dossier.

Tant qu'un dossier n'est pas validé, l'acteur peut utiliser le pivot mais
l'interface affiche clairement « vérification en attente » (aucun blocage
technique : on privilégie l'usage terrain).

Ce dossier est **distinct** de la carte DigiID du citoyen
(``utilisateur.qr_token_digiid``) : ici, il s'agit de la preuve métier
d'exercice du métier de transporteur.
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base, MelangeTracabilite

# Type de professionnel concerné par un dossier logistique.
TYPES_PROFIL_LOGISTIQUE = ("chauffeur", "receveur")

# Statut de vérification métier du dossier.
STATUTS_VERIFICATION_PROFIL = ("en_attente", "verifie", "rejete")


class ProfilLogistique(Base, MelangeTracabilite):
    """Dossier professionnel (pièce d'identité, permis, véhicule) d'un acteur."""

    __tablename__ = "profils_logistiques"
    __table_args__ = (
        Index("ix_profils_logistiques_utilisateur_unique", "utilisateur_id", unique=True),
        Index("ix_profils_logistiques_identifiant_unique", "identifiant_public", unique=True),
        Index("ix_profils_logistiques_type_profil", "type_profil"),
        Index("ix_profils_logistiques_statut", "statut_verification"),
        Index("ix_profils_logistiques_vehicule", "vehicule_immatriculation"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Compte DigiID de l'acteur (un seul dossier par acteur).
    utilisateur_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Métier déclaré : chauffeur ou receveur (guichetier).
    type_profil: Mapped[str] = mapped_column(String(20), nullable=False)
    # Identifiant public lisible du dossier, ex. « CHF-4F2A19 » (partagé aux usagers).
    identifiant_public: Mapped[str] = mapped_column(String(20), nullable=False)

    # ─── Pièce d'identité ────────────────────────────────────────────
    type_piece: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    numero_piece: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    piece_verifiee: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # ─── Permis de conduire (chauffeur) ──────────────────────────────
    permis_numero: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    permis_categorie: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    permis_expiration: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    permis_verifie: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # ─── Véhicule déclaré (chauffeur) ────────────────────────────────
    vehicule_immatriculation: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    vehicule_marque: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    vehicule_modele: Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    vehicule_capacite: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ─── Photo (contrôle visuel du porteur de la carte) ──────────────
    photo_verifiee: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # ─── Décision de vérification métier ─────────────────────────────
    statut_verification: Mapped[str] = mapped_column(
        String(20), nullable=False, default="en_attente", server_default="en_attente"
    )
    est_verifie: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    verifie_le: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verifie_par_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return (
            f"<ProfilLogistique {self.identifiant_public} "
            f"type={self.type_profil} statut={self.statut_verification}>"
        )
