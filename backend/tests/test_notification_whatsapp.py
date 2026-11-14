"""Tests de protection des données dans les notifications et templates WhatsApp."""
from types import SimpleNamespace

from src.noyau import notification


def test_envoyer_whatsapp_ajoute_le_parametre_du_bouton_url(monkeypatch):
    requetes = []
    monkeypatch.setattr(notification.parametres, "whatsapp_active", True)
    monkeypatch.setattr(notification.parametres, "whatsapp_access_token", "token")
    monkeypatch.setattr(notification.parametres, "whatsapp_phone_number_id", "123")
    monkeypatch.setattr(notification.parametres, "whatsapp_template_language", "fr")
    monkeypatch.setattr(notification.journal, "warning", lambda *args, **kwargs: None)
    monkeypatch.setattr(notification.journal, "info", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        notification.httpx,
        "post",
        lambda *args, **kwargs: (
            requetes.append(kwargs) or SimpleNamespace(status_code=200, text="{}")
        ),
    )

    assert notification.envoyer_whatsapp(
        "+2290167958834",
        "Votre code est 922807",
        nom_template="digiid_code_remise",
        parametres_template=["922807"],
        parametres_bouton_url=["922807"],
    )

    template = requetes[0]["json"]["template"]
    assert template["language"] == {"code": "fr"}
    assert template["components"] == [
        {
            "type": "body",
            "parameters": [{"type": "text", "text": "922807"}],
        },
        {
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [{"type": "text", "text": "922807"}],
        },
    ]


def test_envoyer_sms_ne_journalise_ni_numero_complet_ni_message(monkeypatch):
    journaux = []
    monkeypatch.setattr(notification.parametres, "sms_twilio_account_sid", "")
    monkeypatch.setattr(notification.parametres, "sms_twilio_auth_token", "")
    monkeypatch.setattr(notification.parametres, "sms_twilio_from", "")
    monkeypatch.setattr(
        notification.journal,
        "warning",
        lambda message, *args, **kwargs: journaux.append(message),
    )

    assert not notification.envoyer_sms(
        "+2290167958834",
        "Votre code de remise est 922807",
    )

    journal = "\n".join(journaux)
    assert "+2290167958834" not in journal
    assert "922807" not in journal
    assert "+229" in journal
