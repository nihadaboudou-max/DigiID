# -*- coding: utf-8 -*-
"""Base commune des documents d'inspection — « 1 document = 1 table ».

`BaseDocumentInspection` est un *mixin* SQLAlchemy qui rassemble TOUS les
champs communs à un document d'identité :

  - métadonnées du fichier (nom, type MIME, taille, chemin) ;
  - identité commune (nom, prénoms, sexe, n° de document, nationalité…) ;
  - MRZ (3 lignes + validité) ;
  - résultat OCR (texte brut, taux de confiance) ;
  - validation (statut, est_valide, scores par contrôle) ;
  - audit / soft-delete (cree_le, mis_a_jour_le, est_supprime, date_suppression).

Chaque table spécialisée (permis, assurance, carte grise, séjour, consulaire,
passeport, CNI) hérite de ce mixin et n'ajoute QUE ses colonnes métier typées.
Ainsi, il n'y a plus de champ JSON « fourre-tout » : chaque information vit dans
une colonne requêtable et indexable.

⚠️ Choix assumé — les champs de **date d'identité** (`date_naissance`,
`date_delivrance`, `date_expiration`) restent déclarés dans chaque table
concrète : ils sont déjà typés ``DATE`` en base et consommés comme objets
``date`` par les services OCR existants. Les inclure dans le mixin imposerait
une conversion de colonne destructive, contraire au principe « additif,
jamais destructif » (section 2 de l'architecture cible).
"""
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import declared_attr
from sqlalchemy.sql import func


# Table spécialisée recevant les données détaillées de chaque type de document.
# Sert à la table-index `inspection_documents` (colonne `table_cible`).
TABLE_PAR_TYPE: dict[str, str] = {
    "cni_biometrique": "verification_cni",
    "cni_papier": "verification_cni",
    "passeport": "passeports",
    "permis_conduire": "permis_conduire",
    "carte_assurance": "assurances_auto",
    "carte_grise": "cartes_grises",
    "carte_sejour": "cartes_sejour",
    "carte_consulaire": "cartes_consulaires",
}


def table_pour_type(type_document: str | None) -> str | None:
    """Renvoie le nom de la table spécialisée associée à un type de document."""
    if type_document is None:
        return None
    return TABLE_PAR_TYPE.get(str(type_document))


class BaseDocumentInspection:
    """Mixin : champs communs à tous les documents d'inspection."""

    # --- Clé primaire & propriétaire ---
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4, index=True)

    @declared_attr
    def utilisateur_id(cls):  # noqa: N805 - nom imposé par SQLAlchemy
        return Column(
            PG_UUID(as_uuid=True),
            ForeignKey("utilisateur.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )

    # --- Identification du document ---
    type_document = Column(String(50), nullable=True, index=True)
    face = Column(String(20), nullable=True, default="recto")

    # --- Métadonnées du fichier ---
    nom_fichier = Column(String(255), nullable=True)
    type_mime = Column(String(100), nullable=True)
    taille_octets = Column(Integer, nullable=True)
    document_chemin = Column(String(500), nullable=True)

    # --- Biométrie : photo du titulaire portée par le document ---
    # Renseignées UNIQUEMENT quand le document contient une photo d'identité
    # (passeport, permis de conduire, carte de séjour, carte consulaire…).
    # Les documents qui n'en contiennent pas (attestation d'assurance, carte
    # grise) laissent ces deux colonnes à NULL : la vérification visuelle les
    # ignore alors explicitement.
    #
    # ⚠️ Noms volontairement distincts de `photo_chemin` / `embedding_photo_cni`
    # déjà déclarés par `VerificationCNI`, qui hérite AUSSI de ce mixin.
    photo_titulaire_chemin = Column(
        String(500), nullable=True,
        doc="Chemin de l'image du document contenant la photo du titulaire",
    )
    embedding_photo_document = Column(
        JSON, nullable=True,
        doc="Embedding facial (512D) de la photo du titulaire — NULL si le document n'en contient pas",
    )

    # --- Identité commune ---
    nom_famille = Column(String(255), nullable=True)
    prenoms = Column(String(255), nullable=True)
    sexe = Column(String(10), nullable=True)
    numero_document = Column(String(100), nullable=True, index=True)
    lieu_naissance = Column(String(255), nullable=True)
    autorite_delivrance = Column(String(255), nullable=True)
    nationalite = Column(String(100), nullable=True)
    taille = Column(String(10), nullable=True)

    # --- MRZ ---
    mrz_ligne_1 = Column(Text, nullable=True)
    mrz_ligne_2 = Column(Text, nullable=True)
    mrz_ligne_3 = Column(Text, nullable=True)
    mrz_valide = Column(Boolean, nullable=True, default=False)

    # --- Résultat OCR ---
    texte_brut = Column(Text, nullable=True)
    taux_confiance_ocr = Column(Float, nullable=True)

    # --- Validation ---
    statut = Column(String(30), nullable=True, default="en_attente")
    est_valide = Column(Boolean, nullable=True, default=True)
    scores_validation = Column(JSON, nullable=True)

    # --- Audit & soft-delete ---
    cree_le = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    mis_a_jour_le = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    est_supprime = Column(Boolean, nullable=True, default=False)
    date_suppression = Column(DateTime(timezone=True), nullable=True)
