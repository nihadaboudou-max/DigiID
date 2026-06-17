# -*- coding: utf-8 -*-
"""
Configuration de l'environnement Alembic pour DigiID.

Ce fichier lit la configuration depuis nos paramètres centralisés
et importe tous les modèles pour qu'Alembic puisse les détecter.

Auto-stamp : si les tables existent déjà (créées par un précédent create_all)
mais que la table alembic_version est absente, on stamp automatiquement la
base avec la révision HEAD avant de lancer les migrations.

IMPORTANT : l'auto-stamp utilise une CONNEXION SYNC TOTALEMENT SÉPARÉE,
fermée AVANT qu'Alembic ne crée son moteur async. Ceci évite tout conflit
de transaction (InFailedSQLTransactionError).
"""
import asyncio
import logging
from logging.config import fileConfig

from sqlalchemy import create_engine, inspect, pool, text as sa_text
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Importer la base et tous les modèles pour qu'Alembic les voie
from src.base_donnees.base import Base
from src.modeles import (  # noqa: F401
    utilisateur, role, audit, session_authentification, consentement,
    score_historique, document, conversation,
    activite_quotidienne, badge, notification, parrainage,
    fraude_incident, verification_visuelle,
    configuration_systeme,
    verification_cni,
    attestation_communautaire,
    dossier_medical,
    enrolement,
    verification_police,
    ong,
)
from src.config import parametres

# Configuration des logs Alembic
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Remplacer l'URL par celle de nos paramètres
config.set_main_option("sqlalchemy.url", parametres.url_base_donnees)

# Logger local
logger = logging.getLogger("alembic.env")

# Métadonnées cible pour autogénération
target_metadata = Base.metadata


# =============================================================================
# Auto-stamp : connexion SYNC séparée, fermée avant l'engine async d'Alembic.
# =============================================================================

def _auto_stamp_si_besoin() -> None:
    """
    Vérifie si les tables principales existent sans alembic_version.
    Dans ce cas, stamp la base avec HEAD via une connexion SYNC séparée.
    
    La connexion est intégralement fermée avant qu'Alembic ne crée
    son moteur async, ce qui évite tout conflit de transaction.
    """
    moteur_sync = None
    try:
        url_sync = parametres.url_base_donnees_sync
        moteur_sync = create_engine(url_sync)

        with moteur_sync.connect() as conn:
            tables = set(inspect(conn).get_table_names())

            # Si alembic_version existe déjà, rien à faire
            if "alembic_version" in tables:
                return

            # Vérifier si les tables principales existent (créées par create_all)
            tables_principales = {"role", "utilisateur", "consentement"}
            if not tables_principales.issubset(tables):
                # Base vierge — les migrations créeront tout
                return

        # === Tables existent MAIS alembic_version absente ===
        # Utiliser une NOUVELLE transaction pour le stamp
        from alembic.script import ScriptDirectory
        repertoire = ScriptDirectory.from_config(context.config)
        tetes = repertoire.get_heads()
        if not tetes:
            logger.warning("Aucune révision HEAD trouvée — auto-stamp ignoré")
            return

        tete = tetes[0]

        with moteur_sync.begin() as conn:
            conn.execute(sa_text(
                "CREATE TABLE IF NOT EXISTS alembic_version "
                "(version_num VARCHAR(32) NOT NULL)"
            ))
            conn.execute(sa_text("DELETE FROM alembic_version"))
            conn.execute(
                sa_text("INSERT INTO alembic_version (version_num) VALUES (:v)"),
                {"v": tete},
            )

        logger.warning(
            "⚠️  Tables existantes détectées SANS alembic_version — "
            "auto-stamp avec %s ✓", tete
        )

    except Exception as exc:
        logger.warning("Auto-stamp ignoré (%s)", exc)
    finally:
        if moteur_sync is not None:
            moteur_sync.dispose()


def lancer_migrations_hors_ligne() -> None:
    """
    Mode hors ligne : génère le SQL sans connexion à la base.
    Utile pour inspecter les migrations sans appliquer.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def appliquer_migrations(connexion) -> None:
    """Applique les migrations dans une transaction."""
    context.configure(
        connection=connexion,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def lancer_migrations_en_ligne() -> None:
    """Mode en ligne : connexion réelle et application des migrations."""
    # Auto-stamp AVANT de créer l'engine async — connexion SYNC séparée
    # qui sera fermée avant qu'Alembic n'utilise sa propre connexion.
    _auto_stamp_si_besoin()

    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = parametres.url_base_donnees

    moteur = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with moteur.connect() as connexion:
        await connexion.run_sync(appliquer_migrations)

    await moteur.dispose()


if context.is_offline_mode():
    lancer_migrations_hors_ligne()
else:
    asyncio.run(lancer_migrations_en_ligne())
