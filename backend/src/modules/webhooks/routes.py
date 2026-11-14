"""Réception sécurisée des callbacks de statut WhatsApp Cloud API."""
import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config import parametres
from src.modeles.logistique.notification_logistique import NotificationLogistique


routeur_webhooks = APIRouter(
    prefix="/api/v1/webhooks/whatsapp",
    tags=["Webhooks"],
)

_STATUTS_AUTORISES = {"sent", "delivered", "read", "failed"}
_PRIORITE_STATUT = {
    "accepted": 0,
    "sent": 1,
    "failed": 1,
    "delivered": 2,
    "read": 3,
}


def _signature_valide(corps: bytes, signature: str, secret: str) -> bool:
    if not signature.startswith("sha256="):
        return False
    attendue = "sha256=" + hmac.new(
        secret.encode("utf-8"), corps, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, attendue)


def _horodatage_meta(valeur: Any) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(valeur), tz=timezone.utc)
    except (OverflowError, OSError, TypeError, ValueError):
        return None


def _extraire_statuts(payload: dict[str, Any]) -> list[dict[str, Any]]:
    statuts: list[dict[str, Any]] = []
    entrees = payload.get("entry", [])
    if not isinstance(entrees, list):
        return statuts
    for entree in entrees:
        if not isinstance(entree, dict):
            continue
        changements = entree.get("changes", [])
        if not isinstance(changements, list):
            continue
        for changement in changements:
            if not isinstance(changement, dict):
                continue
            valeur = changement.get("value", {})
            if not isinstance(valeur, dict):
                continue
            statuts_valeur = valeur.get("statuses", [])
            if not isinstance(statuts_valeur, list):
                continue
            for statut in statuts_valeur:
                if (
                    isinstance(statut, dict)
                    and isinstance(statut.get("status"), str)
                    and statut.get("status") in _STATUTS_AUTORISES
                    and isinstance(statut.get("id"), str)
                    and statut["id"]
                ):
                    statuts.append(statut)
    return statuts


def _message_erreur_meta(statut: dict[str, Any]) -> tuple[str | None, str | None]:
    erreurs = statut.get("errors")
    if not isinstance(erreurs, list) or not erreurs or not isinstance(erreurs[0], dict):
        return None, None
    erreur = erreurs[0]
    code = erreur.get("code")
    code_texte = str(code) if code is not None else None
    donnees = erreur.get("error_data")
    details = donnees.get("details") if isinstance(donnees, dict) else None
    messages = [
        valeur
        for valeur in (erreur.get("title"), erreur.get("message"), details)
        if isinstance(valeur, str) and valeur
    ]
    return code_texte, " — ".join(dict.fromkeys(messages))[:2000] or None


def _appliquer_statut(
    notification: NotificationLogistique, evenement: dict[str, Any]
) -> bool:
    nouveau = evenement["status"]
    precedent = notification.whatsapp_statut
    date_evenement = _horodatage_meta(evenement.get("timestamp"))
    date_precedente = notification.whatsapp_statut_le

    if precedent in {"delivered", "read"} and nouveau not in {"delivered", "read"}:
        return False
    if precedent == "failed" and nouveau == "sent":
        return False
    if (
        date_evenement is not None
        and date_precedente is not None
        and date_evenement < date_precedente
    ):
        return False
    if (
        precedent in _PRIORITE_STATUT
        and _PRIORITE_STATUT[nouveau] < _PRIORITE_STATUT[precedent]
    ):
        return False

    notification.whatsapp_statut = nouveau
    notification.whatsapp_statut_le = date_evenement or datetime.now(timezone.utc)
    notification.envoye = nouveau != "failed"
    if nouveau == "failed":
        (
            notification.whatsapp_erreur_code,
            notification.whatsapp_erreur_message,
        ) = _message_erreur_meta(evenement)
    else:
        notification.whatsapp_erreur_code = None
        notification.whatsapp_erreur_message = None
    return True


@routeur_webhooks.get("", response_class=PlainTextResponse)
async def verifier_webhook(
    hub_mode: str = Query("", alias="hub.mode"),
    hub_verify_token: str = Query("", alias="hub.verify_token"),
    hub_challenge: str = Query("", alias="hub.challenge"),
) -> PlainTextResponse:
    """Vérification initiale du webhook par Meta."""
    if not parametres.whatsapp_verify_token:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WHATSAPP_VERIFY_TOKEN n'est pas configuré.",
        )
    if (
        hub_mode != "subscribe"
        or not hub_challenge
        or not hmac.compare_digest(hub_verify_token, parametres.whatsapp_verify_token)
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Vérification refusée.")
    return PlainTextResponse(hub_challenge)


@routeur_webhooks.post("")
async def recevoir_statuts_whatsapp(
    requete: Request,
    session: AsyncSession = Depends(obtenir_session),
) -> dict[str, int | str]:
    """Valide la signature Meta puis met à jour les statuts des messages."""
    secret = parametres.whatsapp_app_secret
    if not secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WHATSAPP_APP_SECRET n'est pas configuré.",
        )

    corps = await requete.body()
    if len(corps) > 1024 * 1024:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Webhook trop volumineux.",
        )
    signature = requete.headers.get("x-hub-signature-256", "")
    if not _signature_valide(corps, signature, secret):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Signature invalide.")
    try:
        payload = json.loads(corps)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="JSON invalide.") from None
    if not isinstance(payload, dict) or payload.get("object") != "whatsapp_business_account":
        return {"statut": "ignore", "mis_a_jour": 0}

    evenements = _extraire_statuts(payload)
    identifiants = {evenement["id"] for evenement in evenements}
    if not identifiants:
        return {"statut": "ok", "mis_a_jour": 0}

    resultat = await session.execute(
        select(NotificationLogistique)
        .where(
            NotificationLogistique.canal == "whatsapp",
            NotificationLogistique.whatsapp_message_id.in_(identifiants),
        )
        .with_for_update()
    )
    notifications = {
        notification.whatsapp_message_id: notification
        for notification in resultat.scalars().all()
    }

    mis_a_jour = 0
    for evenement in evenements:
        notification = notifications.get(evenement["id"])
        if notification is not None and _appliquer_statut(notification, evenement):
            mis_a_jour += 1
    if mis_a_jour:
        await session.commit()
    return {"statut": "ok", "mis_a_jour": mis_a_jour}
