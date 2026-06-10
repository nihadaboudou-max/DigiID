# -*- coding: utf-8 -*-
"""
Middleware de journalisation des requêtes HTTP.

Chaque requête entrante est journalisée avec :
  - Un identifiant unique (request_id) pour corrélation
  - Méthode HTTP, chemin
  - Temps de traitement
  - Code de statut
  - IP du client

Permet de :
  - Tracer une requête à travers les logs applicatifs
  - Détecter les requêtes lentes
  - Détecter les comportements anormaux
"""
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from src.noyau import journal


class MiddlewareJournalRequetes(BaseHTTPMiddleware):
    """Journalise chaque requête HTTP entrante."""

    async def dispatch(self, requete: Request, prochain_appel):
        # Générer ou récupérer l'identifiant de requête
        request_id = requete.headers.get("X-Request-ID") or str(uuid.uuid4())
        requete.state.request_id = request_id

        # Lier l'ID à toutes les entrées de journal de cette requête
        journal_lie = journal.bind(request_id=request_id)

        debut = time.perf_counter()
        ip_client = requete.client.host if requete.client else "0.0.0.0"

        journal_lie.info(
            f"-> {requete.method} {requete.url.path}",
            ip=ip_client,
            chemin=requete.url.path,
            methode=requete.method,
        )

        try:
            reponse = await prochain_appel(requete)
        except Exception as erreur:
            duree_ms = (time.perf_counter() - debut) * 1000
            journal_lie.exception(
                f"!! {requete.method} {requete.url.path} : exception non gérée ({duree_ms:.0f}ms)",
            )
            raise

        duree_ms = (time.perf_counter() - debut) * 1000
        niveau = "warning" if duree_ms > 1000 else "info"
        getattr(journal_lie, niveau)(
            f"<- {requete.method} {requete.url.path} {reponse.status_code} ({duree_ms:.0f}ms)",
            code_statut=reponse.status_code,
            duree_ms=round(duree_ms, 1),
        )

        # Ajouter l'ID à la réponse pour que le client puisse le citer en cas de bug
        reponse.headers["X-Request-ID"] = request_id
        return reponse
