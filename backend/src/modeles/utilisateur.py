# -*- coding: utf-8 -*-
"""
Modèle Utilisateur — table principale du système DigiID.

Stocke tout ce qui identifie une personne dans le système :
  - Identifiant unique (UUID)
  - Email (chiffré au repos)
  - Mot de passe (haché Argon2id)
  - Rôle (utilisateur / administrateur / super_administrateur)
  - 2FA (secret TOTP chiffré)
  - État du compte (actif, verrouillé, supprimé)
  - DigiID public (identifiant numérique 16 caractères partageable)

Sécurité :
  - Le mot de passe est haché, pas chiffré (irréversible)
  - L'email est chiffré au repos (réversible mais inutilisable sans la clé)
  - Le secret 2FA est chiffré au repos
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.modeles.consentement import Consentement
from src.modeles.session_authentification import SessionAuthentification
from src.base_donnees.base import Base, MelangeTracabilite
from src.config.constantes import RolesUtilisateur


class Utilisateur(Base, MelangeTracabilite):
    """Table des utilisateurs DigiID (tous rôles confondus)."""

    # --- Identité ---
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        doc="Identifiant interne unique"
    )
    digiid_public: Mapped[Optional[str]] = mapped_column(
        String(16),
        unique=True,
        index=True,
        nullable=True,
        doc="Identifiant numérique partageable, 16 caractères alphanumériques"
    )

    # --- Authentification ---
    email_chiffre: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        doc="Email chiffré AES-256-GCM"
    )
    email_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        doc="Hash SHA-256 de l'email en clair, pour recherche sans déchiffrer"
    )
    mot_de_passe_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Hash Argon2id du mot de passe"
    )

    # --- Identité personnelle (chiffrée) ---
    prenom_chiffre: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    nom_chiffre: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    telephone_chiffre: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    ville: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pays: Mapped[Optional[str]] = mapped_column(String(50), default="Sénégal")

    # --- Rôle et permissions ---
    role: Mapped[str] = mapped_column(
        String(50),
        default=RolesUtilisateur.CITOYEN.value,
        nullable=False,
        index=True,
    )

    # --- 2FA ---
    secret_2fa_chiffre: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    deux_fa_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # --- État du compte ---
    est_actif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    est_email_verifie: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    est_verrouille: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    date_verrouillage: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    tentatives_connexion_echouees: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # --- Scoring DigiID ---
    score_actuel: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        doc="Score de confiance 0-100, calculé périodiquement"
    )
    date_dernier_calcul_score: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # --- Engagement et gamification ---
    streak_actuel: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        index=True,
        doc="Nombre de jours consecutifs d'activite (pour les recompenses)"
    )
    streak_record: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Record personnel de streak"
    )
    bonus_score_cumule: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        doc="Total des bonus de score accumules (badges, streak, etc.)"
    )
    code_parrainage: Mapped[Optional[str]] = mapped_column(
        String(8),
        unique=True,
        index=True,
        nullable=True,
        doc="Code de parrainage personnel unique (8 caracteres alphanumeriques majuscules)"
    )

    # --- Reconnaissance faciale (embedding) ---
    empreinte_faciale: Mapped[Optional[bytes]] = mapped_column(
        nullable=True,
        doc="Vecteur d'embedding facial (512 floats sérialisés) pour anti-doublon"
    )
    est_visage_verifie: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        doc="Indique si l'utilisateur a réussi la vérification faciale"
    )
    date_verification_visage: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        doc="Date de la dernière vérification faciale réussie"
    )

    # --- Vérification CNI (carte d'identité) ---
    est_cni_verifiee: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
        doc="Indique si l'utilisateur a soumis une CNI valide"
    )
    date_verification_cni: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        doc="Date de la dernière vérification CNI réussie"
    )

    # --- Date globale de mise à jour des vérifications ---
    date_derniere_mise_a_jour_verifications: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        doc="Date de la dernière mise à jour de l'une des vérifications"
    )

    # --- Suppression logique (droit à l'oubli) ---
    est_supprime: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    date_suppression: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # --- Connexion ---
    date_derniere_connexion: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ip_derniere_connexion: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    # --- Cloisonnement multi-niveaux (Domaines & Départements) ---
    domaine_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("domaines.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Domaine organisationnel auquel appartient l'utilisateur"
    )
    departement_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("departements.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Département fonctionnel auquel appartient l'utilisateur"
    )
    est_chef_departement: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        server_default="false",
        doc="Indique si l'utilisateur est chef de département"
    )
    superieur_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("utilisateur.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        doc="Supérieur hiérarchique direct (pour la chaîne de commandement)"
    )

    # --- Relations ---
    sessions_authentification: Mapped[list["SessionAuthentification"]] = relationship(
        back_populates="utilisateur",
        cascade="all, delete-orphan",
    )
    consentements: Mapped[list["Consentement"]] = relationship(
        back_populates="utilisateur",
        cascade="all, delete-orphan",
    )

    # --- Relations multi-niveaux (forward references pour éviter imports circulaires) ---
    domaine = relationship(
        "Domaine",
        foreign_keys=[domaine_id],
        backref="utilisateurs",
        lazy="selectin",
    )
    departement = relationship(
        "Departement",
        foreign_keys=[departement_id],
        backref="utilisateurs",
        lazy="selectin",
    )
    superieur = relationship(
        "Utilisateur",
        foreign_keys=[superieur_id],
        remote_side=[id],
        backref="subordonnes",
        lazy="selectin",
    )

    # --- Index composites pour requêtes fréquentes ---
    __table_args__ = (
        Index("ix_utilisateur_role_actif", "role", "est_actif"),
        Index("ix_utilisateur_role_supprime", "role", "est_supprime"),
        Index("ix_utilisateur_domaine", "domaine_id"),
        Index("ix_utilisateur_departement", "departement_id"),
        Index("ix_utilisateur_chef", "est_chef_departement"),
    )

    def __repr__(self) -> str:
        return f"<Utilisateur id={self.id} role={self.role} actif={self.est_actif}>"