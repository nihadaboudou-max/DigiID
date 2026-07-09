# -*- coding: utf-8 -*-
"""
Modèle AttestationCommunautaire — Étape 4.
"""
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Enum as SAEnum,
    Boolean, Float, CheckConstraint, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from src.base_donnees.base import Base


class AttestationCommunautaire(Base):
    """Attestation de confiance communautaire entre deux utilisateurs DigiID."""
    __tablename__ = "attestations_communautaires"

    # --- Identifiants ---
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # --- Relations ---
    attestant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("utilisateurs.id", ondelete="CASCADE"),  # ✅ Corrigé : utilisateurs (pluriel)
        nullable=False,
        index=True,
    )
    atteste_id = Column(
        UUID(as_uuid=True),
        ForeignKey("utilisateurs.id", ondelete="CASCADE"),  # ✅ Corrigé
        nullable=False,
        index=True,
    )

    # --- Contenu ---
    type_attestation = Column(
        SAEnum(
            "identite", "competence", "moralite",
            "residence", "activite", "personnalise",
            name="type_attestation_enum",
        ),
        nullable=False,
        default="identite",
        comment="Catégorie de l'attestation",
    )
    titre = Column(
        String(200),
        nullable=False,
        comment="Titre court décrivant l'attestation",
    )
    description = Column(
        Text,
        nullable=True,
        comment="Description détaillée de l'attestation",
    )
    forces = Column(
        Text,
        nullable=True,
        comment="Forces/qualités observées chez la personne attestée",
    )
    lien_connu_depuis = Column(
        String(100),
        nullable=True,
        comment="Depuis quand l'attestant connaît l'attesté",
    )
    lien_nature = Column(
        String(100),
        nullable=True,
        comment="Nature du lien (collègue, voisin, ami, famille, etc.)",
    )

    # --- Cycle de vie --- ✅ CORRIGÉ : minuscules cohérentes avec frontend
    statut = Column(
        SAEnum(
            "en_attente", "validee", "refusee", "expiree",  # ✅ minuscules
            name="statut_attestation_enum",
        ),
        nullable=False,
        default="en_attente",
        index=True,
        comment="Statut actuel de l'attestation",
    )
    motif_refus = Column(
        Text,
        nullable=True,
        comment="Motif de refus (si statut = refusee)",
    )
    date_soumission = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        comment="Date de création/soumission",
    )
    date_validation = Column(  # ✅ CORRIGÉ : date_validation (cohérent avec routes)
        DateTime(timezone=True),
        nullable=True,
        comment="Date de la décision (validation/refus)",
    )
    valide_par = Column(  # ✅ AJOUTÉ : qui a validé/refusé
        UUID(as_uuid=True),
        ForeignKey("utilisateurs.id", ondelete="SET NULL"),
        nullable=True,
        comment="ID du super admin qui a validé/refusé",
    )
    date_expiration = Column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date d'expiration (1 an après validation si non précisé)",
    )

    # --- Métriques ---
    poids_score = Column(
        Float,
        nullable=False,
        default=5.0,
        comment="Points de score attribués à l'attesté si validée",
    )
    signature_numerique = Column(
        Text,
        nullable=True,
        comment="Signature numérique optionnelle",
    )

    # --- Flags ---
    est_active = Column(
        Boolean,
        nullable=False,
        default=True,
        comment="Si False, l'attestation est désactivée",
    )
    est_visible_public = Column(
        Boolean,
        nullable=False,
        default=False,
        comment="Si True, visible sur le profil public",
    )

    # --- Relations ORM ---
    attestant = relationship(
        "Utilisateur",
        foreign_keys=[attestant_id],
        backref="attestations_donnees",
        lazy="selectin",
    )
    atteste = relationship(
        "Utilisateur",
        foreign_keys=[atteste_id],
        backref="attestations_recues",
        lazy="selectin",
    )
    valideur = relationship(  # ✅ AJOUTÉ
        "Utilisateur",
        foreign_keys=[valide_par],
        backref="attestations_validees",
        lazy="selectin",
    )

    # --- Contraintes ---
    __table_args__ = (
        CheckConstraint(
            "attestant_id != atteste_id",
            name="ck_attestation_pas_auto",
        ),
        Index(
            "ix_attestations_attestant_atteste",
            "attestant_id", "atteste_id",
        ),
        Index(
            "ix_attestations_statut_date",
            "statut", "date_soumission",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<AttestationCommunautaire(id={self.id}, "
            f"attestant={self.attestant_id}, "
            f"atteste={self.atteste_id}, "
            f"type={self.type_attestation}, "
            f"statut={self.statut})>"
        )

    def valider(self, valideur_id) -> None:
        """Valide l'attestation et calcule la date d'expiration (1 an)."""
        self.statut = "validee"
        self.date_validation = datetime.now(timezone.utc)
        self.valide_par = valideur_id
        if not self.date_expiration:
            self.date_expiration = datetime.now(timezone.utc) + timedelta(days=365)
        self.est_active = True

    def refuser(self, motif: str, valideur_id) -> None:
        """Refuse l'attestation avec un motif."""
        self.statut = "refusee"
        self.date_validation = datetime.now(timezone.utc)
        self.valide_par = valideur_id
        self.motif_refus = motif
        self.est_active = False

    def expirer(self) -> None:
        """Marque l'attestation comme expirée."""
        self.statut = "expiree"
        self.est_active = False

    def desactiver(self) -> None:
        """Désactive l'attestation (sans changer son statut)."""
        self.est_active = False

    def reactiver(self) -> None:
        """Réactive une attestation validée."""
        if self.statut == "validee":
            self.est_active = True