"""Base commune des documents — « 1 document = 1 table » (étape S8)

ID de révision : 20261007_1000_base_document_inspection
Révision précédente : 20261006_1000_identite_digiid_profils
Créée le : 2026-10-07 10:00:00.000000

S8 — Refonte documents :

  - introduit ``BaseDocumentInspection`` (mixin SQLAlchemy) qui rassemble tous
    les champs communs d'un document (fichier, identité, MRZ, OCR, validation,
    audit). Chaque table spécialisée (``verification_cni``, ``permis_conduire``,
    ``assurances_auto``, ``cartes_grises``, ``cartes_sejour``,
    ``cartes_consulaires``, ``passeports``) hérite du mixin et ne garde que ses
    colonnes métier typées (plus de JSON fourre-tout) ;
  - transforme ``inspection_documents`` en **table-index** de scan : elle pointe
    vers la table spécialisée via ``table_cible`` + ``document_id``.

⚠️ Principe « additif, jamais destructif » : cette migration **n'ajoute que des
colonnes** (``ADD COLUMN IF NOT EXISTS``). Elle ne modifie ni ne supprime
aucune colonne ou donnée existante — en particulier les colonnes de date
d'identité (``date_naissance``/``date_delivrance``/``date_expiration``) restent
en type ``DATE`` pour les tables historiques. Les instructions sont
idempotentes : sur une base existante, ``scripts/migrer.py`` applique déjà ces
colonnes ; cette migration sert de trace et sécurise une base vierge.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261007_1000_base_document_inspection"
down_revision: Union[str, None] = "20261006_1000_identite_digiid_profils"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Colonnes communes (mixin ``BaseDocumentInspection``) ajoutées à CHAQUE table.
COLONNES_COMMUNES: list[tuple[str, str]] = [
    ("type_document", "VARCHAR(50)"),
    ("face", "VARCHAR(20)"),
    ("nom_fichier", "VARCHAR(255)"),
    ("type_mime", "VARCHAR(100)"),
    ("taille_octets", "INTEGER"),
    ("document_chemin", "VARCHAR(500)"),
    ("nom_famille", "VARCHAR(255)"),
    ("prenoms", "VARCHAR(255)"),
    ("sexe", "VARCHAR(10)"),
    ("numero_document", "VARCHAR(100)"),
    ("lieu_naissance", "VARCHAR(255)"),
    ("autorite_delivrance", "VARCHAR(255)"),
    ("nationalite", "VARCHAR(100)"),
    ("taille", "VARCHAR(10)"),
    ("mrz_ligne_1", "TEXT"),
    ("mrz_ligne_2", "TEXT"),
    ("mrz_ligne_3", "TEXT"),
    ("mrz_valide", "BOOLEAN DEFAULT false"),
    ("texte_brut", "TEXT"),
    ("taux_confiance_ocr", "DOUBLE PRECISION"),
    ("statut", "VARCHAR(30) DEFAULT 'en_attente'"),
    ("est_valide", "BOOLEAN DEFAULT true"),
    ("scores_validation", "JSON"),
    ("mis_a_jour_le", "TIMESTAMP WITH TIME ZONE DEFAULT NOW()"),
    ("est_supprime", "BOOLEAN DEFAULT false"),
    ("date_suppression", "TIMESTAMP WITH TIME ZONE"),
]

TABLES_DOCUMENTS: list[str] = [
    "verification_cni",
    "permis_conduire",
    "assurances_auto",
    "cartes_grises",
    "cartes_sejour",
    "cartes_consulaires",
    "passeports",
]

# Colonnes de la table-index ``inspection_documents``.
COLONNES_INDEX: list[tuple[str, str]] = [
    ("table_cible", "VARCHAR(100)"),
    ("document_id", "VARCHAR(36)"),
]


def upgrade() -> None:
    for table in TABLES_DOCUMENTS:
        for colonne, type_sql in COLONNES_COMMUNES:
            op.execute(
                f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {colonne} {type_sql}"
            )

    for colonne, type_sql in COLONNES_INDEX:
        op.execute(
            "ALTER TABLE inspection_documents "
            f"ADD COLUMN IF NOT EXISTS {colonne} {type_sql}"
        )

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_inspection_documents_table_cible "
        "ON inspection_documents(table_cible)"
    )


def downgrade() -> None:
    # Retrait **non destructif** : seules les colonnes *introduites* par cette
    # migration sont supprimées. Les colonnes communes déjà présentes sur
    # certaines tables historiques (nom_famille, mrz_ligne_*, est_valide,
    # mis_a_jour_le…) sont volontairement conservées pour ne jamais détruire de
    # données existantes.
    op.execute("DROP INDEX IF EXISTS ix_inspection_documents_table_cible")
    for colonne, _ in COLONNES_INDEX:
        op.execute(
            f"ALTER TABLE inspection_documents DROP COLUMN IF EXISTS {colonne}"
        )

    colonnes_nouvelles = ["type_document", "document_chemin", "numero_document"]
    for table in TABLES_DOCUMENTS:
        for colonne in colonnes_nouvelles:
            op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS {colonne}")
    # ``mis_a_jour_le`` n'était absent que sur la CNI.
    op.execute(
        "ALTER TABLE verification_cni DROP COLUMN IF EXISTS mis_a_jour_le"
    )
