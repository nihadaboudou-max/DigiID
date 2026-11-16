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
            requetes.append(kwargs)
            or SimpleNamespace(
                status_code=200,
                text="{}",
                json=lambda: {"messages": [{"id": "wamid.test-123"}]},
            )
        ),
    )

    resultat = notification.envoyer_whatsapp(
        "+2290167958834",
        "Votre code est 922807",
        nom_template="digiid_code_remise",
        parametres_template=["922807"],
        parametres_bouton_url=["922807"],
    )

    assert resultat.accepte is True
    assert resultat.message_id == "wamid.test-123"
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


def test_envoyer_whatsapp_peut_forcer_la_langue_du_template(monkeypatch):
    requetes = []
    monkeypatch.setattr(notification.parametres, "whatsapp_active", True)
    monkeypatch.setattr(notification.parametres, "whatsapp_access_token", "token")
    monkeypatch.setattr(notification.parametres, "whatsapp_phone_number_id", "123")
    monkeypatch.setattr(notification.parametres, "whatsapp_template_language", "en")
    monkeypatch.setattr(notification.journal, "warning", lambda *args, **kwargs: None)
    monkeypatch.setattr(notification.journal, "info", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        notification.httpx,
        "post",
        lambda *args, **kwargs: (
            requetes.append(kwargs)
            or SimpleNamespace(
                status_code=200,
                text="{}",
                json=lambda: {"messages": [{"id": "wamid.test-123"}]},
            )
        ),
    )

    resultat = notification.envoyer_whatsapp(
        "+2290167958834",
        "Message",
        nom_template="digiid_depart_passager",
        parametres_template=["Enfant", "Aïcha"],
        langue_template="fr",
    )

    assert resultat.accepte is True
    assert requetes[0]["json"]["template"]["language"] == {"code": "fr"}


def test_envoyer_whatsapp_retourne_les_details_d_erreur_meta(monkeypatch):
    monkeypatch.setattr(notification.parametres, "whatsapp_active", True)
    monkeypatch.setattr(notification.parametres, "whatsapp_access_token", "token")
    monkeypatch.setattr(notification.parametres, "whatsapp_phone_number_id", "123")
    monkeypatch.setattr(notification.journal, "warning", lambda *args, **kwargs: None)
    monkeypatch.setattr(notification.journal, "error", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        notification.httpx,
        "post",
        lambda *args, **kwargs: SimpleNamespace(
            status_code=400,
            json=lambda: {
                "error": {
                    "code": 131008,
                    "title": "Paramètre manquant",
                    "error_data": {"details": "Le bouton exige une variable."},
                }
            },
        ),
    )

    resultat = notification.envoyer_whatsapp("+22990000000", "Message")

    assert resultat.accepte is False
    assert resultat.erreur_code == "131008"
    assert "bouton" in resultat.erreur_message


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


def test_envoyer_email_mock_ne_journalise_pas_le_code(monkeypatch):
    journaux = []
    monkeypatch.setattr(notification.parametres, "sendgrid_api_key", "")
    monkeypatch.setattr(notification.parametres, "smtp_mot_de_passe", "")
    monkeypatch.setattr(
        notification.journal,
        "warning",
        lambda message, *args, **kwargs: journaux.append(message),
    )

    assert not notification.envoyer_email(
        "personne@example.com",
        "Code de vérification",
        "Votre code est 482731",
    )

    journal = "\n".join(journaux)
    assert "482731" not in journal
    assert "Corps:" not in journal


def test_email_de_recuperation_contient_le_code_et_le_delai(monkeypatch):
    emails = []
    monkeypatch.setattr(
        notification,
        "envoyer_email",
        lambda destinataire, sujet, texte, html: (
            emails.append((destinataire, sujet, texte, html)) or True
        ),
    )

    assert notification.envoyer_email_code_recuperation(
        "personne@example.com",
        "482731",
        "Amadou",
    )

    destinataire, sujet, texte, html = emails[0]
    assert destinataire == "personne@example.com"
    assert "réinitialisation du mot de passe" in sujet
    assert "482731" in texte
    assert "482731" in html
    assert "2 minutes" in texte


def test_erreur_sendgrid_ne_journalise_pas_le_corps(monkeypatch):
    journaux = []
    monkeypatch.setattr(notification.parametres, "sendgrid_api_key", "cle-test")
    monkeypatch.setattr(notification.journal, "info", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        notification.journal,
        "error",
        lambda message, *args, **kwargs: journaux.append(message),
    )
    monkeypatch.setattr(
        notification.httpx,
        "post",
        lambda *args, **kwargs: SimpleNamespace(
            status_code=400,
            text="Erreur pour le code 482731",
        ),
    )

    assert not notification._envoyer_via_sendgrid(
        "personne@example.com",
        "Code de vérification",
        "Votre code est 482731",
    )

    assert "482731" not in "\n".join(journaux)
