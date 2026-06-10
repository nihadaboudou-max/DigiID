# -*- coding: utf-8 -*-
"""
Gestion des sessions SQLAlchemy asynchrones.

Une session est créée par requête HTTP (dépendance FastAPI),
puis fermée automatiquement à la fin. Les transactions sont
gérées explicitement par les services métier.
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.config import parametres
from src.noyau import journal

# --- Moteur asynchrone (un seul pour toute l'application) ---
moteur_async = create_async_engine(
    parametres.url_base_donnees,
    echo=parametres.debug,        # Logger les requêtes SQL en mode debug
    pool_size=10,                  # Connexions persistantes
    max_overflow=20,               # Connexions supplémentaires en cas de pic
    pool_pre_ping=True,            # Vérifier la connexion avant chaque emprunt
    pool_recycle=3600,             # Recycler les connexions après 1h
)


# --- Fabrique de sessions ---
FabriqueSession = async_sessionmaker(
    bind=moteur_async,
    class_=AsyncSession,
    expire_on_commit=False,        # Permet d'utiliser les objets après commit
    autoflush=False,
)


async def obtenir_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dépendance FastAPI pour injecter une session base de données dans une route.

    Usage :
        @routeur.get("/exemple")
        async def exemple(session: AsyncSession = Depends(obtenir_session)):
            ...

    La session est créée à l'entrée et fermée à la sortie, même en cas d'exception.
    """
    async with FabriqueSession() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            journal.exception("Erreur durant la session de base de données — rollback effectué")
            raise
        finally:
            await session.close()


async def initialiser_base_donnees() -> None:
    """
    Initialise les tables (utilisé en dev/test).
    En production, on utilise Alembic à la place.
    """
    from src.base_donnees.base import Base
    # Important : importer tous les modèles pour qu'ils s'enregistrent
    from src.modeles import (  # noqa: F401
        utilisateur, role, audit, session_authentification, consentement,
        score_historique, document, conversation,
        activite_quotidienne, badge, notification, parrainage,
    )

    async with moteur_async.begin() as connexion:
        await connexion.run_sync(Base.metadata.create_all)
    journal.info("Base de données initialisée")


async def fermer_moteur() -> None:
    """À appeler au shutdown de l'application."""
    await moteur_async.dispose()
    journal.info("Moteur base de données fermé")
