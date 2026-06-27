# -*- coding: utf-8 -*-
"""
Configuration de l'environnement Alembic pour DigiID.

Ce fichier lit la configuration depuis nos paramètres centralisés
et importe tous les modèles pour qu'Alembic puisse les détecter.

Note : la gestion des tables préexistantes (créées par un ancien create_all)
est assurée par scripts/migrer.py AVANT d'appeler alembic upgrade head.
Ce script nettoie et stamp alembic_version avec TEXT comme type de colonne
pour accepter les révisions longues (>32 chars).
"""
from logging.config import fileConfig

from sqlalchemy import create_engine, pool

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
    token_reinitialisation,
)
from src.config import parametres

# Configuration des logs Alembic
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Remplacer l'URL par celle de nos paramètres (version SYNC pour Alembic)
config.set_main_option("sqlalchemy.url", parametres.url_base_donnees_sync)

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


def lancer_migrations_en_ligne() -> None:
    """Mode en ligne : connexion réelle et application des migrations."""
    import logging
    logger = logging.getLogger("migrer")
    logger.info("Création de l'engine SYNC vers %s...", parametres.url_base_donnees_sync.split('@')[1] if '@' in parametres.url_base_donnees_sync else parametres.url_base_donnees_sync)
    moteur = create_engine(
        parametres.url_base_donnees_sync,
        poolclass=pool.NullPool,
        echo=True,
    )
    logger.info("Engine créé, connexion...")
    try:
        with moteur.connect() as connexion:
            logger.info("Connexion établie, application des migrations...")
            appliquer_migrations(connexion)
            logger.info("✅ Migrations appliquées avec succès")
    except Exception as e:
        logger.error("❌ Erreur pendant les migrations: %s", str(e)[:500])
        import traceback
        logger.error("Traceback:\n%s", traceback.format_exc())
        raise
    finally:
        moteur.dispose()
        logger.info("Engine disposé")


if context.is_offline_mode():
    lancer_migrations_hors_ligne()
else:
    lancer_migrations_en_ligne()
