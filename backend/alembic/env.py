# -*- coding: utf-8 -*-
"""
Configuration de l'environnement Alembic pour DigiID.

Ce fichier lit la configuration depuis nos paramètres centralisés
et importe tous les modèles pour qu'Alembic puisse les détecter.

Gère aussi le cas où les tables existent déjà (créées par un précédent
create_all()) mais où la table alembic_version est absente : dans ce cas,
on stamp automatiquement la base avec la révision HEAD pour éviter
un DuplicateTableError sur la première migration.
"""
import asyncio
import logging
from logging.config import fileConfig

from sqlalchemy import inspect, text as sa_text
from sqlalchemy import pool
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
# Auto-stamp : si les tables existent déjà (create_all précédent) mais que
# la table alembic_version est absente, on stamp la base avec HEAD pour
# éviter un DuplicateTableError sur les CREATE TABLE de la migration initiale.
# =============================================================================

def _auto_stamp_si_besoin(connexion) -> None:
    """
    Vérifie si les tables principales existent sans alembic_version.
    Dans ce cas, stamp automatiquement la base avec la révision HEAD
    pour que les migrations futures soient cohérentes.
    """
    try:
        inspecteur = inspect(connexion)
        tables = inspecteur.get_table_names()

        if "alembic_version" not in tables:
            # Vérifier si les tables clés existent (créées par un ancien create_all)
            tables_principales = {"role", "utilisateur", "consentement"}
            if tables_principales.issubset(set(tables)):
                # Récupérer la révision HEAD
                from alembic.script import ScriptDirectory
                repertoire_scripts = ScriptDirectory.from_config(context.config)
                tetes = repertoire_scripts.get_heads()
                if tetes:
                    tete = tetes[0]
                    logger.warning(
                        "Tables existantes détectées sans alembic_version — "
                        "auto-stamp avec %s", tete
                    )
                    # Créer alembic_version si elle n'existe pas
                    connexion.execute(
                        sa_text(
                            "CREATE TABLE IF NOT EXISTS alembic_version "
                            "(version_num VARCHAR(32) NOT NULL)"
                        )
                    )
                    # Vérifier si alembic_version a déjà une entrée
                    resultat = connexion.execute(
                        sa_text("SELECT COUNT(*) FROM alembic_version")
                    )
                    if resultat.scalar() == 0:
                        connexion.execute(
                            sa_text(
                                "INSERT INTO alembic_version (version_num) "
                                "VALUES (:v)"
                            ),
                            {"v": tete},
                        )
                    logger.info(
                        "✅ Base auto-stampée avec %s — les migrations existantes "
                        "sont marquées comme appliquées", tete
                    )
    except Exception as exc:
        logger.warning("Auto-stamp ignoré (%s)", exc)


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
    # Auto-stamp si nécessaire avant d'appliquer les migrations
    # (empêche DuplicateTableError sur les tables créées par create_all)
    _auto_stamp_si_besoin(connexion)

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
