"""Arrêts intermédiaires + prise en charge / remise au guichet

ID de révision : 20261010_1000_arrets_ligne_prise_en_charge
Révision précédente : 20261007_1000_base_document_inspection
Créée le : 2026-10-10 10:00:00.000000

Réponses aux écarts constatés sur le terrain :

  - ``arrets_ligne`` : une ligne de car ne va pas toujours au terminus. Le
    chauffeur doit savoir **où descendre chaque colis** (Dassa, Savè, Bohicon…)
    et le guichet saisit la destination réelle. ``ordre`` fixe la tournée.
  - ``colis.arret_destination_id`` / ``suivi_familial.arret_destination_id`` :
    l'arrêt de descente, distinct du terminus de la ligne.
  - ``reception_confirmee_*`` : le chauffeur confirme avoir physiquement pris
    en charge le colis/passager ; la fiche est alors figée (plus de correction
    guichet, plus de réaffectation).
  - ``remis_guichet_*`` : le chauffeur dépose le colis au guichet d'arrivée ;
    c'est le guichet qui constate ensuite la remise finale au destinataire.

Principe additif : uniquement des ``ADD COLUMN IF NOT EXISTS`` et une
``CREATE TABLE IF NOT EXISTS``. ``scripts/migrer.py`` applique déjà ces
colonnes sur une base existante ; cette migration sécurise une base vierge et
laisse une trace.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20261010_1000_arrets_ligne_prise_en_charge"
down_revision: Union[str, None] = "20261007_1000_base_document_inspection"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS arrets_ligne (
            id UUID PRIMARY KEY,
            ligne_id UUID NOT NULL REFERENCES lignes(id) ON DELETE CASCADE,
            gare_id UUID NOT NULL REFERENCES gares(id) ON DELETE RESTRICT,
            ordre INTEGER NOT NULL DEFAULT 1,
            actif BOOLEAN NOT NULL DEFAULT true,
            cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT uq_arrets_ligne_gare UNIQUE (ligne_id, gare_id),
            CONSTRAINT uq_arrets_ligne_ordre UNIQUE (ligne_id, ordre)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_arrets_ligne_ligne ON arrets_ligne (ligne_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_arrets_ligne_gare ON arrets_ligne (gare_id)")

    for table in ("colis", "suivi_familial"):
        op.execute(
            f"""
            ALTER TABLE {table}
              ADD COLUMN IF NOT EXISTS arret_destination_id UUID
                REFERENCES arrets_ligne(id) ON DELETE SET NULL,
              ADD COLUMN IF NOT EXISTS reception_confirmee_le TIMESTAMP WITH TIME ZONE,
              ADD COLUMN IF NOT EXISTS reception_confirmee_par_id UUID
                REFERENCES utilisateur(id) ON DELETE SET NULL,
              ADD COLUMN IF NOT EXISTS remis_guichet_le TIMESTAMP WITH TIME ZONE,
              ADD COLUMN IF NOT EXISTS remis_guichet_par_id UUID
                REFERENCES utilisateur(id) ON DELETE SET NULL
            """
        )
        op.execute(
            f"CREATE INDEX IF NOT EXISTS ix_{table}_arret_destination "
            f"ON {table} (arret_destination_id)"
        )


def downgrade() -> None:
    for table in ("colis", "suivi_familial"):
        op.execute(f"DROP INDEX IF EXISTS ix_{table}_arret_destination")
        for colonne in (
            "remis_guichet_par_id",
            "remis_guichet_le",
            "reception_confirmee_par_id",
            "reception_confirmee_le",
            "arret_destination_id",
        ):
            op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS {colonne}")
    op.execute("DROP INDEX IF EXISTS ix_arrets_ligne_gare")
    op.execute("DROP INDEX IF EXISTS ix_arrets_ligne_ligne")
    op.execute("DROP TABLE IF EXISTS arrets_ligne")
