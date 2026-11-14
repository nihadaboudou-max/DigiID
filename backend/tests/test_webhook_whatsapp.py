"""Tests de validation et de mise à jour des statuts WhatsApp."""
import asyncio
import hashlib
import hmac
import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from src.config import parametres
from src.modeles.logistique.notification_logistique import NotificationLogistique
from src.modules.webhooks.routes import (
    recevoir_statuts_whatsapp,
    verifier_webhook,
)


class SessionFactice:
    def __init__(self, notifications):
        self.notifications = notifications
        self.commit_count = 0

    async def execute(self, _requete):
        return SimpleNamespace(
            scalars=lambda: SimpleNamespace(all=lambda: self.notifications)
        )

    async def commit(self):
        self.commit_count += 1


def _requete_webhook(corps: bytes, secret: str) -> Request:
    signature = hmac.new(secret.encode(), corps, hashlib.sha256).hexdigest()

    async def recevoir():
        return {"type": "http.request", "body": corps, "more_body": False}

    return Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "https",
            "path": "/api/v1/webhooks/whatsapp",
            "raw_path": b"/api/v1/webhooks/whatsapp",
            "query_string": b"",
            "headers": [
                (b"x-hub-signature-256", f"sha256={signature}".encode()),
            ],
            "client": ("test", 1234),
            "server": ("test", 443),
        },
        receive=recevoir,
    )


def _notification(message_id: str) -> NotificationLogistique:
    return NotificationLogistique(
        canal="whatsapp",
        type_cible="colis",
        type_evenement="depart",
        message="Notification de test",
        envoye=True,
        whatsapp_message_id=message_id,
        whatsapp_statut="accepted",
    )


def test_verifier_webhook_meta(monkeypatch):
    monkeypatch.setattr(
        parametres, "whatsapp_verify_token", "test-verification-token"
    )

    reponse = asyncio.run(
        verifier_webhook(
            hub_mode="subscribe",
            hub_verify_token="test-verification-token",
            hub_challenge="challenge-123",
        )
    )

    assert reponse.status_code == 200
    assert reponse.body == b"challenge-123"


def test_verifier_webhook_refuse_un_token_incorrect(monkeypatch):
    monkeypatch.setattr(parametres, "whatsapp_verify_token", "expected-token")

    with pytest.raises(HTTPException) as erreur:
        asyncio.run(
            verifier_webhook(
                hub_mode="subscribe",
                hub_verify_token="wrong-token",
                hub_challenge="challenge-123",
            )
        )

    assert erreur.value.status_code == 403


def test_webhook_rejette_une_signature_invalide(monkeypatch):
    corps = b'{"object":"whatsapp_business_account"}'
    requete = _requete_webhook(corps, "wrong-secret")
    requete.scope["headers"] = [(b"x-hub-signature-256", b"sha256=invalid")]
    monkeypatch.setattr(parametres, "whatsapp_app_secret", "correct-secret")

    with pytest.raises(HTTPException) as erreur:
        asyncio.run(recevoir_statuts_whatsapp(requete, SessionFactice([])))

    assert erreur.value.status_code == 401


def test_webhook_enregistre_livraison_et_empeche_le_recul_du_statut(monkeypatch):
    message_id = "wamid.test-123"
    notification = _notification(message_id)
    session = SessionFactice([notification])
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "statuses": [
                                {
                                    "id": message_id,
                                    "status": "delivered",
                                    "timestamp": "1794672000",
                                }
                            ]
                        }
                    }
                ]
            }
        ],
    }
    corps = json.dumps(payload).encode()
    monkeypatch.setattr(parametres, "whatsapp_app_secret", "test-secret")

    reponse = asyncio.run(
        recevoir_statuts_whatsapp(_requete_webhook(corps, "test-secret"), session)
    )

    assert reponse == {"statut": "ok", "mis_a_jour": 1}
    assert notification.whatsapp_statut == "delivered"
    assert notification.envoye is True
    assert session.commit_count == 1

    payload["entry"][0]["changes"][0]["value"]["statuses"][0].update(
        status="sent", timestamp="1794671999"
    )
    corps_ancien = json.dumps(payload).encode()
    reponse_ancienne = asyncio.run(
        recevoir_statuts_whatsapp(
            _requete_webhook(corps_ancien, "test-secret"), session
        )
    )
    assert reponse_ancienne["mis_a_jour"] == 0
    assert notification.whatsapp_statut == "delivered"


def test_webhook_enregistre_les_details_meta_d_un_echec(monkeypatch):
    message_id = "wamid.failed-123"
    notification = _notification(message_id)
    session = SessionFactice([notification])
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "statuses": [
                                {
                                    "id": message_id,
                                    "status": "failed",
                                    "timestamp": "1794672000",
                                    "errors": [
                                        {
                                            "code": 131008,
                                            "title": "Paramètre manquant",
                                            "error_data": {
                                                "details": "Le bouton URL exige un paramètre."
                                            },
                                        }
                                    ],
                                }
                            ]
                        }
                    }
                ]
            }
        ],
    }
    monkeypatch.setattr(parametres, "whatsapp_app_secret", "test-secret")

    reponse = asyncio.run(
        recevoir_statuts_whatsapp(
            _requete_webhook(json.dumps(payload).encode(), "test-secret"),
            session,
        )
    )

    assert reponse["mis_a_jour"] == 1
    assert notification.whatsapp_statut == "failed"
    assert notification.envoye is False
    assert notification.whatsapp_erreur_code == "131008"
    assert "bouton URL" in notification.whatsapp_erreur_message
