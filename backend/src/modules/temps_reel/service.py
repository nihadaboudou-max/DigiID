"""Gestionnaire central des connexions temps réel."""

import asyncio
import json
from typing import Any

from fastapi import WebSocket

from src.noyau.redis_client import redis_client

CANAL_TEMPS_REEL = "digiid:temps-reel"


class GestionnaireTempsReel:
    def __init__(self) -> None:
        self._connexions: set[WebSocket] = set()
        self._verrou = asyncio.Lock()

    async def ajouter(self, websocket: WebSocket) -> None:
        async with self._verrou:
            self._connexions.add(websocket)

    async def retirer(self, websocket: WebSocket) -> None:
        async with self._verrou:
            self._connexions.discard(websocket)

    async def diffuser_localement(self, evenement: dict[str, Any]) -> None:
        message = json.dumps(evenement, ensure_ascii=False)
        async with self._verrou:
            connexions = tuple(self._connexions)

        resultats = await asyncio.gather(
            *(connexion.send_text(message) for connexion in connexions),
            return_exceptions=True,
        )
        connexions_a_retirer = {
            connexion
            for connexion, resultat in zip(connexions, resultats)
            if isinstance(resultat, Exception)
        }
        for connexion in connexions_a_retirer:
            await self.retirer(connexion)

    async def diffuser(self, evenement: dict[str, Any]) -> None:
        await self.diffuser_localement(evenement)
        if redis_client is not None:
            try:
                await redis_client.publish(CANAL_TEMPS_REEL, json.dumps(evenement))
            except Exception:
                # Le WebSocket local reste fonctionnel si Redis est indisponible.
                pass


gestionnaire_temps_reel = GestionnaireTempsReel()
