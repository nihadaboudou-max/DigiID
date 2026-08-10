# -*- coding: utf-8 -*-
"""
Client Redis asynchrone global pour DigiID.

Fournit un accès Redis partagé (cache, tokens QR dynamiques, etc.) entre
toutes les instances du backend.

Usage :
    from src.noyau.redis_client import redis_client

    if redis_client is not None:
        await redis_client.setex("cle", 30, "valeur")

Si le paquet `redis` n'est pas installé ou si l'URL est invalide,
`redis_client` vaut None : les modules utilisent alors leur propre
stockage de secours (ex : _StockageMemoire du module qr_dynamique).
"""
import logging

from src.config import parametres

journal = logging.getLogger("digiid.redis")

try:
    import redis.asyncio as aioredis
except ImportError:  # pragma: no cover
    aioredis = None
    journal.warning(
        "Paquet 'redis' non installé — Redis indisponible, "
        "les modules utiliseront leur stockage de secours."
    )


def _construire_client():
    """Crée le client Redis asynchrone, ou None s'il est inutilisable."""
    if aioredis is None:
        return None
    try:
        # from_url est paresseux : aucune connexion n'est ouverte ici.
        return aioredis.from_url(
            parametres.url_redis,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
    except Exception as exc:
        journal.warning("Création du client Redis impossible : %s", exc)
        return None


# Client Redis global partagé (None si indisponible).
redis_client = _construire_client()
