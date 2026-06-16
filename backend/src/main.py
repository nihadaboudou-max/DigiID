# -*- coding: utf-8 -*-
"""
Application FastAPI DigiID — point d'entrée.

Assemblage final :
  - Lifecycle management (démarrage / arrêt propre)
  - Configuration CORS pour le frontend
  - Middlewares : headers de sécurité, journalisation, rate limiting
  - Gestionnaires d'erreurs uniformes
  - Routeur principal v1
  - Documentation OpenAPI auto-générée
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from src.api.v1 import routeur_v1
from src.base_donnees.session import fermer_moteur, moteur_async, FabriqueSession
from src.config import parametres
from src.middleware.gestionnaires_erreurs import enregistrer_gestionnaires_erreurs
from src.middleware.headers_securite import MiddlewareHeadersSecurite
from src.middleware.journal_requetes import MiddlewareJournalRequetes
from src.noyau import journal
from src.noyau.journal import configurer_journal


# -----------------------------------------------------------------------------
# État global de l'initialisation
# -----------------------------------------------------------------------------

# Flag indiquant si l'initialisation de la base est terminée
initialisation_terminee: bool = False


async def _initialiser_base_en_arriere_plan():
    """
    Initialisation lourde en arrière-plan (seed, feature flags).

    La création des tables est déjà faite dans cycle_de_vie avant yield.
    Cette fonction ne fait que le seed (rôles, super admin) et les
    feature flags, qui peuvent prendre du temps.
    """
    global initialisation_terminee

    try:
        # Initialiser les feature flags
        try:
            from src.modules.super_admin.service_phase6 import initialiser_feature_flags_defaut
            async with FabriqueSession() as session:
                nb_flags = await initialiser_feature_flags_defaut(session)
                if nb_flags > 0:
                    journal.info(f"Feature flags initialisés : {nb_flags} flags créés")
                else:
                    journal.info("Feature flags déjà présents — aucune initialisation nécessaire")
        except Exception as erreur:
            journal.warning(f"Initialisation feature flags ignorée : {erreur}")

        # Seed automatique
        import os
        try:
            from src.base_donnees.seed import semer_roles, creer_super_admin_initial
            journal.info("=== Tentative de seed automatique ===")
            await semer_roles()
            await creer_super_admin_initial()
            journal.info("✅ Seed automatique effectué avec succès")
        except Exception as erreur:
            journal.error(f"❌ Seed automatique échoué : {erreur}", exc_info=True)

        initialisation_terminee = True
        journal.info("=== Initialisation terminée ===")
    except Exception as erreur:
        journal.error(f"Initialisation base échouée : {erreur}", exc_info=True)
        initialisation_terminee = False


# -----------------------------------------------------------------------------
# Cycle de vie de l'application
# -----------------------------------------------------------------------------

@asynccontextmanager
async def cycle_de_vie(application: FastAPI):
    """
    Code exécuté au démarrage et à l'arrêt de l'application.

    L'initialisation lourde (DB, tables, seed) est lancée en arrière-plan
    pour que l'app réponde immédiatement aux health checks de Render (5s timeout).
    """
    # === DÉMARRAGE ===
    configurer_journal()
    journal.info(f"=== Démarrage de {parametres.nom_application} ===")
    journal.info(f"Environnement : {parametres.environnement}")
    journal.info(f"Version API : {parametres.version_api}")

    # Créer les tables IMMÉDIATEMENT (avant yield) pour que les endpoints
    # qui dépendent de la DB (upload CNI, auth, etc.) fonctionnent dès le
    # premier health check. create_all avec checkfirst=True est rapide
    # (sub-seconde) quand les tables existent déjà.
    try:
        from src.base_donnees.base import Base
        async with moteur_async.begin() as connexion:
            from sqlalchemy import text
            await connexion.execute(text("SELECT 1"))
            await connexion.run_sync(Base.metadata.create_all, checkfirst=True)
        journal.info("Tables vérifiées/créées avec succès")
    except Exception as erreur:
        journal.error(f"Échec création tables : {erreur}")
        raise  # Ne pas démarrer si les tables ne peuvent pas être créées

    # Lancer le seed (lourd) en arrière-plan
    application.state.initialisation_terminee = False
    
    async def _mettre_a_jour_statut():
        """Met à jour le statut d'initialisation sur l'app quand la tâche se termine."""
        global initialisation_terminee
        await _initialiser_base_en_arriere_plan()
        application.state.initialisation_terminee = initialisation_terminee
    
    asyncio.create_task(_mettre_a_jour_statut())

    yield  # === Application en service (accepte les requêtes immédiatement) ===

    # === ARRÊT ===
    journal.info("=== Arrêt de l'application ===")
    await fermer_moteur()


# -----------------------------------------------------------------------------
# Création de l'application
# -----------------------------------------------------------------------------

application = FastAPI(
    title=parametres.nom_application,
    description=(
        "API DigiID — Système d'identité numérique africaine par Big Data.\n\n"
        "Trois espaces séparés :\n"
        "- **Utilisateur** : `/api/v1/utilisateur/*`\n"
        "- **Administrateur** : `/api/v1/admin/*`\n"
        "- **Super Administrateur** : `/api/v1/super-admin/*`\n\n"
        "Authentification : `/api/v1/auth/*`"
    ),
    version=parametres.version_api,
    docs_url="/docs" if not parametres.est_production else None,
    redoc_url="/redoc" if not parametres.est_production else None,
    openapi_url="/openapi.json" if not parametres.est_production else None,
    lifespan=cycle_de_vie,
)


# -----------------------------------------------------------------------------
# Rate limiting global
# -----------------------------------------------------------------------------

limiteur = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{parametres.limite_requetes_par_minute_anonyme}/minute"],
)
application.state.limiter = limiteur
application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# -----------------------------------------------------------------------------
# Middlewares (l'ordre compte : le dernier ajouté s'exécute en premier)
# -----------------------------------------------------------------------------

# 1. CORS — autorise le frontend
application.add_middleware(
    CORSMiddleware,
    allow_origins=parametres.liste_origines_autorisees,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

# 2. Headers de sécurité
application.add_middleware(MiddlewareHeadersSecurite)

# 3. Journalisation des requêtes
application.add_middleware(MiddlewareJournalRequetes)


# -----------------------------------------------------------------------------
# Gestionnaires d'erreurs
# -----------------------------------------------------------------------------

enregistrer_gestionnaires_erreurs(application)


# -----------------------------------------------------------------------------
# Routeur principal
# -----------------------------------------------------------------------------

application.include_router(routeur_v1)


# -----------------------------------------------------------------------------
# Endpoint racine
# -----------------------------------------------------------------------------

@application.get("/", tags=["Racine"])
async def racine():
    """Page d'accueil de l'API — informations de base."""
    return {
        "application": parametres.nom_application,
        "version": parametres.version_api,
        "environnement": parametres.environnement,
        "documentation": "/docs" if not parametres.est_production else "désactivée en production",
        "sante": "/api/v1/sante",
    }


# -----------------------------------------------------------------------------
# Lancement direct (utile en dev sans Docker)
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:application",
        host="0.0.0.0",
        port=8000,
        reload=parametres.est_developpement,
        log_level=parametres.niveau_journal.lower(),
    )
