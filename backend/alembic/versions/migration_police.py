"""migration police

Revision ID: police_001
Revises: 003_ajouter_image_data_et_index
Create Date: 2026-06-27 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'police_001'
down_revision = '003_ajouter_image_data_et_index'
branch_labels = None
depends_on = None

"""
Script de migration manuelle pour les tables du module Police.

Utilisé en complément d'Alembic pour les cas où la migration automatique
ne peut pas s'appliquer (ex: base existante sans historique Alembic).

Usage :
    python migration_police.py           # Applique les migrations
    python migration_police.py --check   # Vérifie l'état sans appliquer
    python migration_police.py --dry-run # Simule sans modifier

Pré-requis :
    - DATABASE_URL dans l'environnement ou .env
    - Connexion directe à la base PostgreSQL
"""
import argparse
import os
import sys
from typing import Optional


# =============================================================================
# Fonctions Alembic (appelées automatiquement par alembic upgrade head)
# =============================================================================


def upgrade() -> None:
    """Applique toutes les migrations police via Alembic."""
    # Migration 1 : colonnes de vérification
    op.execute("""
        ALTER TABLE verifications_police
        ADD COLUMN IF NOT EXISTS personne_email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS personne_telephone VARCHAR(50),
        ADD COLUMN IF NOT EXISTS motif_verification VARCHAR(500),
        ADD COLUMN IF NOT EXISTS localisation_lat DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS localisation_lng DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS localisation_adresse VARCHAR(500),
        ADD COLUMN IF NOT EXISTS officier_nom VARCHAR(255)
    """)

    # Migration 2 : table alertes_police
    op.execute("""
        CREATE TABLE IF NOT EXISTS alertes_police (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            officier_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
            type_alerte VARCHAR(50) NOT NULL,
            titre VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            niveau VARCHAR(20) NOT NULL DEFAULT 'info',
            est_lue BOOLEAN NOT NULL DEFAULT FALSE,
            est_active BOOLEAN NOT NULL DEFAULT TRUE,
            donnees_liees JSONB,
            date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            date_lecture TIMESTAMPTZ
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_alertes_police_officier ON alertes_police(officier_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_alertes_police_non_lues ON alertes_police(officier_id, est_lue) WHERE est_lue = FALSE")

    # Migration 3 : table notes_internes
    op.execute("""
        CREATE TABLE IF NOT EXISTS notes_internes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            officier_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
            personne_digiid VARCHAR(50) NOT NULL,
            titre VARCHAR(200) NOT NULL,
            contenu TEXT,
            categorie VARCHAR(50) NOT NULL DEFAULT 'general',
            est_important BOOLEAN NOT NULL DEFAULT FALSE,
            est_partagee BOOLEAN NOT NULL DEFAULT FALSE,
            date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            date_modification TIMESTAMPTZ
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_notes_internes_officier ON notes_internes(officier_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_notes_internes_personne ON notes_internes(personne_digiid)")

    # Migration 4 : colonnes signalements_fraude
    op.execute("""
        ALTER TABLE signalements_fraude
        ADD COLUMN IF NOT EXISTS pieces_jointes JSONB,
        ADD COLUMN IF NOT EXISTS priorite VARCHAR(20) NOT NULL DEFAULT 'normale',
        ADD COLUMN IF NOT EXISTS notes_traitement TEXT,
        ADD COLUMN IF NOT EXISTS traite_par_id UUID REFERENCES utilisateur(id) ON DELETE SET NULL
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_signalements_fraude_statut_priorite ON signalements_fraude(statut, priorite)")

    # Migration 5 : table enrolements_police
    op.execute("""
        CREATE TABLE IF NOT EXISTS enrolements_police (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            officier_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
            personne_digiid VARCHAR(50),
            nom_complet VARCHAR(255),
            statut VARCHAR(30) NOT NULL DEFAULT 'en_attente',
            type_enrolement VARCHAR(50) NOT NULL,
            donnees_saisies JSONB,
            documents_uploads JSONB,
            notes TEXT,
            date_enrolement TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            date_completion TIMESTAMPTZ
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_enrolements_police_officier ON enrolements_police(officier_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_enrolements_police_statut ON enrolements_police(statut)")


def downgrade() -> None:
    """Annule les migrations police."""
    op.execute("DROP INDEX IF EXISTS ix_enrolements_police_statut")
    op.execute("DROP INDEX IF EXISTS ix_enrolements_police_officier")
    op.execute("DROP TABLE IF EXISTS enrolements_police")
    op.execute("DROP INDEX IF EXISTS ix_signalements_fraude_statut_priorite")
    op.execute("ALTER TABLE signalements_fraude DROP COLUMN IF EXISTS traite_par_id")
    op.execute("ALTER TABLE signalements_fraude DROP COLUMN IF EXISTS notes_traitement")
    op.execute("ALTER TABLE signalements_fraude DROP COLUMN IF EXISTS priorite")
    op.execute("ALTER TABLE signalements_fraude DROP COLUMN IF EXISTS pieces_jointes")
    op.execute("DROP INDEX IF EXISTS ix_notes_internes_personne")
    op.execute("DROP INDEX IF EXISTS ix_notes_internes_officier")
    op.execute("DROP TABLE IF EXISTS notes_internes")
    op.execute("DROP INDEX IF EXISTS ix_alertes_police_non_lues")
    op.execute("DROP INDEX IF EXISTS ix_alertes_police_officier")
    op.execute("DROP TABLE IF EXISTS alertes_police")
    op.execute("ALTER TABLE verifications_police DROP COLUMN IF EXISTS officier_nom")
    op.execute("ALTER TABLE verifications_police DROP COLUMN IF EXISTS localisation_adresse")
    op.execute("ALTER TABLE verifications_police DROP COLUMN IF EXISTS localisation_lng")
    op.execute("ALTER TABLE verifications_police DROP COLUMN IF EXISTS localisation_lat")
    op.execute("ALTER TABLE verifications_police DROP COLUMN IF EXISTS motif_verification")
    op.execute("ALTER TABLE verifications_police DROP COLUMN IF EXISTS personne_telephone")
    op.execute("ALTER TABLE verifications_police DROP COLUMN IF EXISTS personne_email")


# =============================================================================
# Configuration
# =============================================================================

import argparse
import argparse
import os
import sys
from typing import Optional

try:
    import psycopg2
    from psycopg2 import sql
except ImportError:
    print("Erreur : psycopg2 n'est pas installe.")
    print("Installe-le avec : pip install psycopg2-binary")
    sys.exit(1)


# =============================================================================
# Configuration
# =============================================================================

URL_BD = os.environ.get(
    "DATABASE_URL",
    os.environ.get(
        "DB_URL",
        "postgresql://digiid:digiid@localhost:5432/digiid",
    ),
)

# =============================================================================
# Migrations à appliquer
# =============================================================================

MIGRATIONS = [
    # ------------------------------------------------------------------
    # Migration 1 : Ajout des colonnes de vérification à verifications_police
    # ------------------------------------------------------------------
    {
        "id": "001_verifications_police",
        "description": "Ajout des colonnes personnel_email, telephone, motif, localisation",
        "verification": """
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'verifications_police'
            AND column_name = 'personne_email'
        """,
        "sql": [
            """
            ALTER TABLE verifications_police
            ADD COLUMN IF NOT EXISTS personne_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS personne_telephone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS motif_verification VARCHAR(500),
            ADD COLUMN IF NOT EXISTS localisation_lat DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS localisation_lng DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS localisation_adresse VARCHAR(500),
            ADD COLUMN IF NOT EXISTS officier_nom VARCHAR(255)
            """,
        ],
    },

    # ------------------------------------------------------------------
    # Migration 2 : Table alertes_police
    # ------------------------------------------------------------------
    {
        "id": "002_alertes_police",
        "description": "Creation de la table alertes_police",
        "verification": """
            SELECT table_name FROM information_schema.tables
            WHERE table_name = 'alertes_police'
        """,
        "sql": [
            """
            CREATE TABLE IF NOT EXISTS alertes_police (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                officier_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
                type_alerte VARCHAR(50) NOT NULL,
                titre VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                niveau VARCHAR(20) NOT NULL DEFAULT 'info',
                est_lue BOOLEAN NOT NULL DEFAULT FALSE,
                est_active BOOLEAN NOT NULL DEFAULT TRUE,
                donnees_liees JSONB,
                date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                date_lecture TIMESTAMPTZ
            )
            """,
            """
            CREATE INDEX IF NOT EXISTS ix_alertes_police_officier
            ON alertes_police(officier_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS ix_alertes_police_non_lues
            ON alertes_police(officier_id, est_lue)
            WHERE est_lue = FALSE
            """,
        ],
    },

    # ------------------------------------------------------------------
    # Migration 3 : Table notes_internes (si pas déjà créée par Alembic)
    # ------------------------------------------------------------------
    {
        "id": "003_notes_internes",
        "description": "Creation de la table notes_internes",
        "verification": """
            SELECT table_name FROM information_schema.tables
            WHERE table_name = 'notes_internes'
        """,
        "sql": [
            """
            CREATE TABLE IF NOT EXISTS notes_internes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                officier_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
                personne_digiid VARCHAR(50) NOT NULL,
                titre VARCHAR(200) NOT NULL,
                contenu TEXT,
                categorie VARCHAR(50) NOT NULL DEFAULT 'general',
                est_important BOOLEAN NOT NULL DEFAULT FALSE,
                est_partagee BOOLEAN NOT NULL DEFAULT FALSE,
                date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                date_modification TIMESTAMPTZ
            )
            """,
            """
            CREATE INDEX IF NOT EXISTS ix_notes_internes_officier
            ON notes_internes(officier_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS ix_notes_internes_personne
            ON notes_internes(personne_digiid)
            """,
        ],
    },

    # ------------------------------------------------------------------
    # Migration 4 : Ajout colonnes signalements_fraude
    # ------------------------------------------------------------------
    {
        "id": "004_signalements_fraude",
        "description": "Ajout colonnes pieces_jointes, priorite, notes_traitement, traite_par_id",
        "verification": """
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'signalements_fraude'
            AND column_name = 'priorite'
        """,
        "sql": [
            """
            ALTER TABLE signalements_fraude
            ADD COLUMN IF NOT EXISTS pieces_jointes JSONB,
            ADD COLUMN IF NOT EXISTS priorite VARCHAR(20) NOT NULL DEFAULT 'normale',
            ADD COLUMN IF NOT EXISTS notes_traitement TEXT,
            ADD COLUMN IF NOT EXISTS traite_par_id UUID REFERENCES utilisateur(id) ON DELETE SET NULL
            """,
            """
            CREATE INDEX IF NOT EXISTS ix_signalements_fraude_statut_priorite
            ON signalements_fraude(statut, priorite)
            """,
        ],
    },

    # ------------------------------------------------------------------
    # Migration 5 : Table enrolements_police
    # ------------------------------------------------------------------
    {
        "id": "005_enrolements_police",
        "description": "Creation de la table enrolements_police",
        "verification": """
            SELECT table_name FROM information_schema.tables
            WHERE table_name = 'enrolements_police'
        """,
        "sql": [
            """
            CREATE TABLE IF NOT EXISTS enrolements_police (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                officier_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
                personne_digiid VARCHAR(50),
                nom_complet VARCHAR(255),
                statut VARCHAR(30) NOT NULL DEFAULT 'en_attente',
                type_enrolement VARCHAR(50) NOT NULL,
                donnees_saisies JSONB,
                documents_uploads JSONB,
                notes TEXT,
                date_enrolement TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                date_completion TIMESTAMPTZ
            )
            """,
            """
            CREATE INDEX IF NOT EXISTS ix_enrolements_police_officier
            ON enrolements_police(officier_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS ix_enrolements_police_statut
            ON enrolements_police(statut)
            """,
        ],
    },
]


# =============================================================================
# Fonctions
# =============================================================================


def get_connexion(url: str):
    """Établit la connexion à la base de données."""
    try:
        conn = psycopg2.connect(url)
        conn.autocommit = True
        return conn
    except Exception as e:
        print(f"Erreur de connexion a la base : {e}")
        sys.exit(1)


def migration_appliquee(cur, migration_id: str) -> bool:
    """Vérifie si une migration est déjà appliquée."""
    # Créer la table de suivi si elle n'existe pas
    cur.execute("""
        CREATE TABLE IF NOT EXISTS _migrations_police (
            id VARCHAR(100) PRIMARY KEY,
            description TEXT,
            appliquee_le TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    cur.execute("SELECT 1 FROM _migrations_police WHERE id = %s", (migration_id,))
    return cur.fetchone() is not None


def marquer_migration(cur, migration_id: str, description: str):
    """Marque une migration comme appliquée."""
    cur.execute(
        "INSERT INTO _migrations_police (id, description) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (migration_id, description),
    )


def appliquer_migration(cur, migration: dict, dry_run: bool = False) -> bool:
    """Applique une migration si pas déjà faite."""
    mig_id = migration["id"]

    # Vérification rapide : la colonne/table existe-t-elle déjà ?
    if migration.get("verification"):
        cur.execute(migration["verification"])
        if cur.fetchone():
            print(f"  [OK]  {mig_id} : deja appliquee (verification passee)")
            return False

    if dry_run:
        print(f"  [SIMULATION] {mig_id} : {migration['description']}")
        for sql_stmt in migration["sql"]:
            print(f"      SQL: {sql_stmt[:100]}...")
        return True

    print(f"  [APPLICATION] {mig_id} : {migration['description']}")
    for sql_stmt in migration["sql"]:
        try:
            cur.execute(sql_stmt)
            print(f"      SQL OK")
        except Exception as e:
            print(f"      ERREUR SQL : {e}")
            # Ne pas bloquer, continuer
            continue

    marquer_migration(cur, mig_id, migration["description"])
    return True


def check_status(cur) -> None:
    """Vérifie l'état des migrations sans modifier."""
    print("\n=== Etat des migrations Police ===\n")

    for mig in MIGRATIONS:
        mig_id = mig["id"]
        description = mig["description"]

        if migration_appliquee(cur, mig_id):
            print(f"  [✓] {mig_id} - {description}")
        else:
            # Vérification rapide
            if mig.get("verification"):
                cur.execute(mig["verification"])
                if cur.fetchone():
                    print(f"  [✓] {mig_id} - {description} (deja present en base)")
                else:
                    print(f"  [ ] {mig_id} - {description}")
            else:
                print(f"  [ ] {mig_id} - {description}")


# =============================================================================
# Point d'entrée
# =============================================================================


def main():
    parser = argparse.ArgumentParser(
        description="Migration manuelle des tables du module Police DigiID",
    )
    parser.add_argument(
        "--check", action="store_true",
        help="Verifie l'etat sans appliquer les migrations",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Simule l'application sans modifier la base",
    )
    parser.add_argument(
        "--url",
        default=URL_BD,
        help="URL de connexion a la base de donnees",
    )
    args = parser.parse_args()

    print(f"\nConnexion a la base de donnees...")
    conn = get_connexion(args.url)
    cur = conn.cursor()

    try:
        if args.check:
            check_status(cur)
            return

        if args.dry_run:
            print("\n=== SIMULATION : Migrations Police ===\n")
            for mig in MIGRATIONS:
                appliquer_migration(cur, mig, dry_run=True)
            print("\n=== Simulation terminee (aucune modification) ===\n")
            return

        # Application normale
        print("\n=== Application des migrations Police ===\n")
        compteur = 0
        for mig in MIGRATIONS:
            if appliquer_migration(cur, mig):
                compteur += 1

        print(f"\n=== {compteur}/{len(MIGRATIONS)} migration(s) appliquee(s) ===\n")

        # Vérification finale
        check_status(cur)

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
