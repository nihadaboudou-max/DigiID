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
    """Exécute les migrations selon l'état de la base."""
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

        # Étape 2 : TOUJOURS recréer alembic_version avec TEXT
        # Évite StringDataRightTruncation pour révisions >32 chars.
        _recreer_alembic_version_texte(url_sync)

        # Étape 3 : décision
        if etat == "VIERGE":
            # Base vierge → upgrade crée les tables (alembic_version en TEXT)
            logger.info("Base vierge → upgrade crée les tables...")
            _upgrade_alembic()
        else:
            # Tables existent → stamp HEAD puis upgrade (no-op)
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
