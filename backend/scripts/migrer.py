#!/usr/bin/env python3
"""
Script de migration robuste pour DigiID.
Gère 3 cas :
1. Base vierge (pas de tables)
   → alembic upgrade head crée toutes les tables et enregistre les versions
2. Base avec tables + alembic_version à jour
   → upgrade normal (no-op si déjà à jour)
3. Base avec tables SANS alembic_version (créées par ancien create_all)
   → stamp HEAD d'abord, puis upgrade (no-op)

Cas 3 : sans auto-stamp, `alembic upgrade head` tente de re-créer toutes les
tables une par une → DuplicateTableError sur CHAQUE migration.
"""
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, inspect, text as sa_text
from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command
from src.config import parametres

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-5s [%(name)s] %(message)s",
)
logger = logging.getLogger("migrer")


def _determiner_etat_base(engine) -> str:
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        if {"role", "utilisateur", "consentement"}.issubset(tables):
            return "TABLES_EXIST"
        return "VIERGE"


def _obtenir_revision_head() -> str:
    alembic_cfg_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    config = AlembicConfig(str(alembic_cfg_path))
    from alembic.script import ScriptDirectory
    repertoire = ScriptDirectory.from_config(config)
    tetes = repertoire.get_heads()
    if not tetes:
        raise RuntimeError("Aucune révision HEAD trouvée dans Alembic")
    return tetes[0]


def _stamp_sync(url_sync: str, revision: str):
    engine = create_engine(url_sync)
    try:
        with engine.begin() as conn:
            conn.execute(sa_text("DELETE FROM alembic_version"))
            conn.execute(
                sa_text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
                {"v": revision},
            )
            logger.info("✅ Base stampée avec %s", revision)
    finally:
        engine.dispose()


def _upgrade_alembic():
    alembic_cfg_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    config = AlembicConfig(str(alembic_cfg_path))
    alembic_command.upgrade(config, "head")


# ===========================================================================
# Correcteur de colonnes manquantes
# ===========================================================================
COLONNES_A_VERIFIER = [
    ("score_historique", "facteur_attestations", "FLOAT NOT NULL DEFAULT 0.0"),
    ("dossiers_medicaux", "patient_prenom", "VARCHAR(255)"),
    ("dossiers_medicaux", "hopital", "VARCHAR(255)"),
    ("consultations", "hopital", "VARCHAR(255)"),
    ("consultations", "type_consultation", "VARCHAR(50)"),
    ("consultations", "poids", "INTEGER"),
    ("consultations", "taille", "INTEGER"),
    ("consultations", "temperature", "INTEGER"),
    ("consultations", "pression_arterielle", "VARCHAR(20)"),
    ("consultations", "conclusion", "TEXT"),
    ("consultations", "date_controle", "DATE"),
    ("ordonnances", "hopital", "VARCHAR(255)"),
    ("ordonnances", "medecin_nom", "VARCHAR(255)"),
    ("ordonnances", "statut", "VARCHAR(20) NOT NULL DEFAULT 'active'"),
]


def _corriger_colonnes_manquantes(engine):
    with engine.connect() as conn:
        tables_presentes = set(inspect(conn).get_table_names())

    for table, colonne, type_sql in COLONNES_A_VERIFIER:
        if table not in tables_presentes:
            continue
        with engine.connect() as conn:
            col_infos = [c["name"] for c in inspect(conn).get_columns(table)]
            if colonne in col_infos:
                continue
        sql = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {colonne} {type_sql}"
        with engine.begin() as conn:
            conn.execute(sa_text(sql))
            logger.warning("⚠️  Colonne manquante ajoutée : %s.%s (%s)", table, colonne, type_sql)

    with engine.connect() as conn:
        tables_presentes = set(inspect(conn).get_table_names())

    if "ordonnances" in tables_presentes:
        with engine.connect() as conn:
            col_infos = [c["name"] for c in inspect(conn).get_columns("ordonnances")]
        if "numero_ordonnance" not in col_infos:
            with engine.begin() as conn:
                conn.execute(sa_text(
                    "CREATE SEQUENCE IF NOT EXISTS seq_numero_ordonnance START 1"
                ))
                conn.execute(sa_text(
                    "ALTER TABLE ordonnances ADD COLUMN IF NOT EXISTS numero_ordonnance VARCHAR(30)"
                ))
                conn.execute(sa_text("""
                    UPDATE ordonnances
                    SET numero_ordonnance = 'ORD-'
                    || TO_CHAR(NOW(), 'YYYY')
                    || '-'
                    || LPAD(nextval('seq_numero_ordonnance')::text, 6, '0')
                    WHERE numero_ordonnance IS NULL
                """))
                conn.execute(sa_text(
                    "ALTER TABLE ordonnances ALTER COLUMN numero_ordonnance SET NOT NULL"
                ))
                logger.warning("⚠️  Colonne manquante ajoutée : ordonnances.numero_ordonnance")

        try:
            with engine.begin() as conn:
                conn.execute(sa_text(
                    "ALTER TABLE ordonnances ADD CONSTRAINT uq_ordonnances_numero "
                    "UNIQUE (numero_ordonnance)"
                ))
        except Exception:
            logger.warning("⚠️  Contrainte unique déjà présente sur ordonnances.numero_ordonnance")


# ===========================================================================
# Correcteur de tables manquantes
# ===========================================================================
TABLES_CRITIQUES_A_VERIFIER = ["document_identite", "code_verification"]


def _tables_manquantes(engine) -> list[str]:
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        return [t for t in TABLES_CRITIQUES_A_VERIFIER if t not in tables]


def _creer_table_document_identite(engine):
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        if "document_identite" in tables:
            logger.info("✓ Table document_identite déjà présente")
            return

    logger.warning("⚠️  Table document_identite manquante → création manuelle...")
    with engine.begin() as conn:
        conn.execute(sa_text("""
            CREATE TABLE IF NOT EXISTS document_identite (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                utilisateur_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
                type_document VARCHAR(20) NOT NULL,
                est_actif BOOLEAN NOT NULL DEFAULT true,
                source VARCHAR(10) DEFAULT 'manuel',
                a_ete_corrige BOOLEAN NOT NULL DEFAULT false,
                verification_id UUID,
                numero_document VARCHAR(50),
                nom_complet VARCHAR(255),
                date_naissance DATE,
                lieu_naissance VARCHAR(255),
                nationalite VARCHAR(100) DEFAULT 'Sénégalaise',
                sexe VARCHAR(1),
                adresse VARCHAR(500),
                date_delivrance DATE,
                date_expiration DATE,
                pays_emetteur VARCHAR(100) DEFAULT 'Sénégal',
                autorite_delivrance VARCHAR(255),
                profession VARCHAR(255),
                taille_cm INTEGER,
                categories_permis VARCHAR(50),
                centre_examen VARCHAR(255),
                numero_permis VARCHAR(50),
                compagnie_assurance VARCHAR(255),
                type_couverture VARCHAR(100),
                numero_contrat VARCHAR(50),
                immatriculation_vehicule VARCHAR(20),
                marque_vehicule VARCHAR(100),
                modele_vehicule VARCHAR(100),
                annee_vehicule INTEGER,
                cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(sa_text(
            "CREATE INDEX IF NOT EXISTS ix_document_identite_utilisateur_id "
            "ON document_identite(utilisateur_id)"
        ))
        conn.execute(sa_text(
            "CREATE INDEX IF NOT EXISTS ix_document_identite_type_document "
            "ON document_identite(type_document)"
        ))
    logger.info("✅ Table document_identite créée avec succès")


def _creer_table_code_verification(engine):
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        if "code_verification" in tables:
            logger.info("✓ Table code_verification déjà présente")
            return

    logger.warning("⚠️  Table code_verification manquante → création manuelle...")
    with engine.begin() as conn:
        conn.execute(sa_text("""
            CREATE TABLE IF NOT EXISTS code_verification (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                utilisateur_id UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
                canal VARCHAR(20) NOT NULL,
                code VARCHAR(10) NOT NULL,
                destination VARCHAR(255) NOT NULL,
                tentative INTEGER NOT NULL DEFAULT 0,
                est_utilise BOOLEAN NOT NULL DEFAULT false,
                date_expiration TIMESTAMP WITH TIME ZONE NOT NULL,
                type_verification VARCHAR(50) NOT NULL DEFAULT 'email',
                cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(sa_text(
            "CREATE INDEX IF NOT EXISTS ix_code_verification_utilisateur_id "
            "ON code_verification(utilisateur_id)"
        ))
    logger.info("✅ Table code_verification créée avec succès")


def _recreer_alembic_version_texte(url_sync: str) -> str | None:
    engine = create_engine(url_sync)
    try:
        version_actuelle = None
        with engine.connect() as conn:
            tables = set(inspect(conn).get_table_names())
            if "alembic_version" in tables:
                result = conn.execute(sa_text(
                    "SELECT version_num FROM alembic_version LIMIT 1"
                ))
                row = result.fetchone()
                version_actuelle = row[0] if row else None

        with engine.begin() as conn:
            conn.execute(sa_text("DROP TABLE IF EXISTS alembic_version"))
            conn.execute(sa_text(
                "CREATE TABLE alembic_version (version_num TEXT NOT NULL)"
            ))
            if version_actuelle:
                conn.execute(
                    sa_text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
                    {"v": version_actuelle},
                )
                logger.info("↻ alembic_version recréée (TEXT), version %s conservée",
                            version_actuelle)
            else:
                logger.info("✓ alembic_version créée (TEXT, vide)")
        return version_actuelle
    finally:
        engine.dispose()


def executer_migrations():
    url_sync = parametres.url_base_donnees_sync
    logger.info("Connexion à %s@%s:%s/%s",
                parametres.postgres_utilisateur,
                parametres.postgres_host,
                parametres.postgres_port,
                parametres.postgres_nom_base)

    try:
        # Étape 1 : état de la base
        moteur = create_engine(url_sync)
        try:
            etat = _determiner_etat_base(moteur)
        finally:
            moteur.dispose()
        logger.info("État de la base : %s", etat)

        # Étape 2 : recréer alembic_version en TEXT
        _recreer_alembic_version_texte(url_sync)

        # Étape 3 : décision
        if etat == "VIERGE":
            logger.info("Base vierge → upgrade crée toutes les tables...")
            _upgrade_alembic()
        else:
            # 3a. Colonnes manquantes
            moteur = create_engine(url_sync)
            try:
                _corriger_colonnes_manquantes(moteur)
            finally:
                moteur.dispose()

            # 3b. Tables manquantes
            moteur = create_engine(url_sync)
            try:
                manquantes = _tables_manquantes(moteur)
                if manquantes:
                    logger.warning("⚠️  Tables critiques manquantes : %s", manquantes)
                    if "document_identite" in manquantes:
                        _creer_table_document_identite(moteur)
                    if "code_verification" in manquantes:
                        _creer_table_code_verification(moteur)
                else:
                    logger.info("✓ Toutes les tables critiques sont présentes")
            finally:
                moteur.dispose()

            # 3c. Stamp HEAD puis upgrade (no-op)
            revision = _obtenir_revision_head()
            logger.info("Tables existantes → stamp %s puis upgrade...", revision)
            _stamp_sync(url_sync, revision)
            _upgrade_alembic()

        logger.info("✅ Migration terminée avec succès")

    except Exception:
        logger.exception("❌ Échec de la migration")
        sys.exit(1)


if __name__ == "__main__":
    executer_migrations()
