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
# Ajouter le répertoire parent au path pour pouvoir importer les modules
# depuis l'entrypoint (où PYTHONPATH=/app)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from sqlalchemy import create_engine, inspect, text as sa_text
from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command
from src.config import parametres
# Configuration du logging
logging.basicConfig(
level=logging.INFO,
format="%(levelname)-5s [%(name)s] %(message)s",
)
logger = logging.getLogger("migrer")
def _determiner_etat_base(engine) -> str:
    """
    Vérifie si les tables principales existent dans la base.
    Retourne :
    - "VIERGE" : aucune table
    - "TABLES_EXIST" : au moins les tables principales existent
    """
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        if {"role", "utilisateur", "consentement"}.issubset(tables):
            return "TABLES_EXIST"
        return "VIERGE"


def _obtenir_revision_head() -> str:
    """Récupère la révision HEAD depuis le répertoire de scripts Alembic."""
    alembic_cfg_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    config = AlembicConfig(str(alembic_cfg_path))
    from alembic.script import ScriptDirectory
    repertoire = ScriptDirectory.from_config(config)
    tetes = repertoire.get_heads()
    if not tetes:
        raise RuntimeError("Aucune révision HEAD trouvée dans Alembic")
    return tetes[0]


def _stamp_sync(url_sync: str, revision: str):
    """
    Stamp alembic_version avec HEAD.
    La table existe déjà en TEXT (recréée par _recreer_alembic_version_texte).
    On se contente de DELETE + INSERT.
    """
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
    """Lance alembic upgrade head (utilise env.py -> moteur async)."""
    alembic_cfg_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    config = AlembicConfig(str(alembic_cfg_path))
    alembic_command.upgrade(config, "head")


# ===========================================================================
# Correcteur de colonnes manquantes
# ===========================================================================
# Problème : les tables ont été créées par l'ancien create_all() à un instant T.
# Les colonnes ajoutées AUX MODÈLES PYTHON après cette date n'existent PAS en base.
# Exemple : score_historique.facteur_attestations ajoutée après la suppression de
# create_all(). Les migrations Alembic ne sont jamais appliquées car mon script
# stamp HEAD, ce qui fait qu'Alembic ne les exécute pas.
#
# Solution : AVANT de stamp HEAD, inspecter le schéma réel et ajouter les colonnes
# manquantes via ALTER TABLE ADD COLUMN IF NOT EXISTS.
# ===========================================================================
COLONNES_A_VERIFIER = [
    # (table, colonne, type_sql)
    # Ajoutées par les migrations après la suppression de create_all :
    ("score_historique", "facteur_attestations", "FLOAT NOT NULL DEFAULT 0.0"),
    # Migration 20260620_1200_enrichissement_medical
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
    """
    Ajoute les colonnes manquantes dans les tables existantes.
    Utilise ALTER TABLE ADD COLUMN IF NOT EXISTS (PostgreSQL 9.6+).
    """
    with engine.connect() as conn:
        tables_presentes = set(inspect(conn).get_table_names())
        for table, colonne, type_sql in COLONNES_A_VERIFIER:
            if table not in tables_presentes:
                continue
            # Vérifier si la colonne existe déjà
            with engine.connect() as conn:
                col_infos = [c["name"] for c in inspect(conn).get_columns(table)]
                if colonne in col_infos:
                    continue
                # Ajouter la colonne manquante
                sql = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {colonne} {type_sql}"
                with engine.begin() as conn:
                    conn.execute(sa_text(sql))
                    logger.warning("⚠️  Colonne manquante ajoutée : %s.%s (%s)", table, colonne, type_sql)

    # Cas spécial : numero_ordonnance (plus complexe : unique, sequence, NOT NULL)
    if "ordonnances" in tables_presentes:
        with engine.connect() as conn:
            col_infos = [c["name"] for c in inspect(conn).get_columns("ordonnances")]
            if "numero_ordonnance" not in col_infos:
                with engine.begin() as conn:
                    # Créer la séquence
                    conn.execute(sa_text(
                        "CREATE SEQUENCE IF NOT EXISTS seq_numero_ordonnance START 1"
                    ))
                    # Ajouter la colonne (nullable d'abord)
                    conn.execute(sa_text(
                        "ALTER TABLE ordonnances ADD COLUMN IF NOT EXISTS numero_ordonnance VARCHAR(30)"
                    ))
                    # Remplir les enregistrements existants
                    conn.execute(sa_text("""
                        UPDATE ordonnances
                        SET numero_ordonnance = 'ORD-'
                        || TO_CHAR(NOW(), 'YYYY')
                        || '-'
                        || LPAD(nextval('seq_numero_ordonnance')::text, 6, '0')
                        WHERE numero_ordonnance IS NULL
                    """))
                    # Rendre NOT NULL
                    conn.execute(sa_text(
                        "ALTER TABLE ordonnances ALTER COLUMN numero_ordonnance SET NOT NULL"
                    ))
                    logger.warning("⚠️  Colonne manquante ajoutée : ordonnances.numero_ordonnance (VARCHAR(30) UNIQUE)")

        # Contrainte unique (dans un block séparé)
        try:
            with engine.begin() as conn:
                conn.execute(sa_text(
                    "ALTER TABLE ordonnances ADD CONSTRAINT uq_ordonnances_numero UNIQUE (numero_ordonnance)"
                ))
        except Exception:
            logger.warning("⚠️  Contrainte unique déjà présente sur ordonnances.numero_ordonnance")


# ===========================================================================
# Correcteur de tables manquantes (ajout pour document_identite)
# ===========================================================================
# Problème : certaines tables ont été ajoutées par des migrations récentes
# mais le script stamp HEAD avant qu'Alembic ne puisse les créer.
# Solution : détecter ces tables critiques et les créer manuellement en SQL.
# ===========================================================================

TABLES_CRITIQUES_A_VERIFIER = ["document_identite"]


def _tables_manquantes(engine) -> list[str]:
    """Retourne la liste des tables critiques manquantes."""
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        return [t for t in TABLES_CRITIQUES_A_VERIFIER if t not in tables]


def _creer_table_document_identite(engine):
    """
    Crée la table document_identite si elle n'existe pas.
    Reproduction fidèle de la migration 20260620_2100_document_identite.
    """
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())
        if "document_identite" in tables:
            logger.info("✓ Table document_identite déjà présente")
            return

        logger.warning("⚠️  Table document_identite manquante → création manuelle...")
        with engine.begin() as conn:
            conn.execute(sa_text("""
                CREATE TABLE document_identite (
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
            # Index
            conn.execute(sa_text(
                "CREATE INDEX IF NOT EXISTS ix_document_identite_utilisateur_id "
                "ON document_identite(utilisateur_id)"
            ))
            conn.execute(sa_text(
                "CREATE INDEX IF NOT EXISTS ix_document_identite_type_document "
                "ON document_identite(type_document)"
            ))

        logger.info("✅ Table document_identite créée avec succès")


def _recreer_alembic_version_texte(url_sync: str) -> str | None:
    """
    RECRÉE TOUJOURS alembic_version avec version_num en TEXT.
    Même si la base est vierge, on pré-crée la table pour
    empêcher Alembic d'utiliser VARCHAR(32) par défaut.
    Retourne la version actuelle (si existait), None sinon.
    """
    engine = create_engine(url_sync)
    try:
        # Lire l'ancienne version si elle existe
        version_actuelle = None
        with engine.connect() as conn:
            tables = set(inspect(conn).get_table_names())
            if "alembic_version" in tables:
                result = conn.execute(sa_text(
                    "SELECT version_num FROM alembic_version LIMIT 1"
                ))
                row = result.fetchone()
                version_actuelle = row[0] if row else None

        # DROP + CREATE atomique
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
    """
    Exécute les migrations selon l'état de la base.
    Algorithme :
    1. Vérifier si les tables principales existent (ou base vierge)
    2. TOUJOURS recréer alembic_version avec TEXT (pour révisions longues)
    3. Si tables existent :
       a. CORRIGER les colonnes manquantes (ajoutées aux modèles après create_all)
       b. CORRIGER les tables manquantes (ex: document_identite)
       c. Stamp HEAD dans alembic_version
       d. Alembic upgrade head (no-op car HEAD déjà présent)
    4. Si vierge : upgrade simple (alembic crée tout)
    """
    url_sync = parametres.url_base_donnees_sync
    logger.info("Connexion à %s@%s:%s/%s",
                parametres.postgres_utilisateur,
                parametres.postgres_host,
                parametres.postgres_port,
                parametres.postgres_nom_base)

    try:
        # --- Étape 1 : état de la base ---
        moteur = create_engine(url_sync)
        try:
            etat = _determiner_etat_base(moteur)
        finally:
            moteur.dispose()
        logger.info("État de la base : %s", etat)

        # --- Étape 2 : recréer alembic_version en TEXT ---
        _recreer_alembic_version_texte(url_sync)

        # --- Étape 3 : décision ---
        if etat == "VIERGE":
            logger.info("Base vierge → upgrade crée les tables...")
            _upgrade_alembic()
        else:
            # 3a. Ajouter les colonnes manquantes (avant le stamp)
            moteur = create_engine(url_sync)
            try:
                _corriger_colonnes_manquantes(moteur)
            finally:
                moteur.dispose()

            # 3b. Vérifier et créer les tables critiques manquantes
            # (ex: document_identite qui a été ajoutée après le create_all initial)
            moteur = create_engine(url_sync)
            try:
                manquantes = _tables_manquantes(moteur)
                if manquantes:
                    logger.warning("⚠️  Tables critiques manquantes détectées : %s", manquantes)
                    if "document_identite" in manquantes:
                        _creer_table_document_identite(moteur)
                else:
                    logger.info("✓ Toutes les tables critiques sont présentes")
            finally:
                moteur.dispose()

            # 3c. Stamp HEAD
            revision = _obtenir_revision_head()
            logger.info("Tables existantes → stamp %s puis upgrade...", revision)
            _stamp_sync(url_sync, revision)

            # 3d. Upgrade (no-op)
            _upgrade_alembic()

        logger.info("✅ Migration terminée avec succès")

    except Exception:
        logger.exception("❌ Échec de la migration")
        sys.exit(1)


if __name__ == "__main__":
    executer_migrations()
