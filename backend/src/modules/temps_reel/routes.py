"""WebSocket et contrôle de version pour la synchronisation globale."""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import FabriqueSession, obtenir_session
from src.modeles.audit import JournalAudit
from src.modeles.utilisateur import Utilisateur
from src.modules.authentification.dependances import utilisateur_courant
from src.modules.authentification.jetons import decoder_jeton
from src.modules.temps_reel.service import gestionnaire_temps_reel

routeur_temps_reel = APIRouter(prefix="/temps-reel", tags=["Synchronisation temps réel"])


async def _authentifier_websocket(token: str, session: AsyncSession) -> Utilisateur | None:
    try:
        contenu = decoder_jeton(token, type_attendu="acces")
        utilisateur = (
            await session.execute(
                select(Utilisateur).where(
                    Utilisateur.id == UUID(contenu.sub),
                    Utilisateur.est_actif.is_(True),
                    Utilisateur.est_supprime.is_(False),
                )
            )
        ).scalar_one_or_none()
        if utilisateur is None or utilisateur.role != contenu.role:
            return None
        return utilisateur
    except Exception:
        return None


@routeur_temps_reel.websocket("/ws")
async def websocket_temps_reel(
    websocket: WebSocket,
    token: Annotated[str | None, Query()] = None,
) -> None:
    await websocket.accept()
    if not token:
        await websocket.close(code=1008, reason="Authentification requise")
        return

    async with FabriqueSession() as session:
        utilisateur = await _authentifier_websocket(token, session)
    if utilisateur is None:
        await websocket.close(code=1008, reason="Session invalide")
        return

    await gestionnaire_temps_reel.ajouter(websocket)
    try:
        while True:
            # Maintient la connexion et détecte rapidement la déconnexion.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await gestionnaire_temps_reel.retirer(websocket)


@routeur_temps_reel.get("/version")
async def version_temps_reel(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _utilisateur: Annotated[Utilisateur, Depends(utilisateur_courant)],
) -> dict[str, str]:
    derniere_date = (
        await session.execute(select(func.max(JournalAudit.date_evenement)))
    ).scalar_one_or_none()
    return {
        "version": (
            derniere_date or datetime.min.replace(tzinfo=timezone.utc)
        ).isoformat()
    }
