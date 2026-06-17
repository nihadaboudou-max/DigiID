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


def _verifier_etat_base(engine) -> str:
    """
    Vérifie l'état de la base de données.
    
    Retourne :
      - "VIERGE" : aucune table
      - "ALEMBIC_OK" : alembic_version présente et pleine
      - "ALEMBIC_VIDE" : alembic_version existe mais vide
      - "TABLES_EXIST" : tables principales existent mais alembic_version absente
    """
    with engine.connect() as conn:
        tables = set(inspect(conn).get_table_names())

        if "alembic_version" in tables:
            result = conn.execute(sa_text("SELECT COUNT(*) FROM alembic_version"))
            count = result.scalar()
            if count > 0:
                return "ALEMBIC_OK"
            else:
                return "ALEMBIC_VIDE"

        # Vérifier si les tables principales existent
        tables_principales = {"role", "utilisateur", "consentement"}
        if tables_principales.issubset(tables):
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
    Stamp la base avec la révision donnée en utilisant une connexion synchrone.
    
    On évite d'utiliser alembic_command.stamp() car il passe par env.py
    (moteur async) et peut causer des conflits de transaction.
    """
    engine = create_engine(url_sync)
    try:
        with engine.begin() as conn:
            # Créer alembic_version si absente
            conn.execute(sa_text(
                "CREATE TABLE IF NOT EXISTS alembic_version "
                "(version_num VARCHAR(32) NOT NULL)"
            ))
            # Vider les entrées existantes
            conn.execute(sa_text("DELETE FROM alembic_version"))
            # Insérer la révision HEAD
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


def executer_migrations():
    """Exécute les migrations selon l'état de la base."""
    url_sync = parametres.url_base_donnees_sync
    logger.info("Connexion à %s@%s:%s/%s",
                parametres.postgres_utilisateur,
                parametres.postgres_host,
                parametres.postgres_port,
                parametres.postgres_nom_base)

    try:
        engine = create_engine(url_sync)
        try:
            etat = _verifier_etat_base(engine)
        finally:
            engine.dispose()

        logger.info("État de la base : %s", etat)

        if etat == "VIERGE":
            logger.info("Base vierge → alembic upgrade head crée toutes les tables")
            _upgrade_alembic()

        elif etat == "ALEMBIC_OK":
            logger.info("alembic_version présent → upgrade normal")
            _upgrade_alembic()

        elif etat == "ALEMBIC_VIDE":
            revision = _obtenir_revision_head()
            logger.info("alembic_version vide → stamp %s puis upgrade", revision)
            _stamp_sync(url_sync, revision)
            _upgrade_alembic()

        elif etat == "TABLES_EXIST":
            revision = _obtenir_revision_head()
            logger.warning(
                "Tables principales détectées SANS alembic_version !\n"
                "  → Stamp %s pour éviter les DuplicateTableError\n"
                "  → Puis upgrade (no-op car base déjà à jour)",
                revision,
            )
            _stamp_sync(url_sync, revision)
            _upgrade_alembic()

        logger.info("✅ Migration terminée avec succès")

    except Exception:
        logger.exception("❌ Échec de la migration")
        sys.exit(1)


if __name__ == "__main__":
    executer_migrations()
