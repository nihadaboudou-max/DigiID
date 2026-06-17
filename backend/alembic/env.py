# -*- coding: utf-8 -*-
"""
Configuration de l'environnement Alembic pour DigiID.

Ce fichier lit la configuration depuis nos paramètres centralisés
et importe tous les modèles pour qu'Alembic puisse les détecter.
"""
import asyncio
from logging.config import fileConfig

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

# Métadonnées cible pour autogénération
target_metadata = Base.metadata


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
