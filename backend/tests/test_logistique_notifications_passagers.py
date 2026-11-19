import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import cast
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Notification, SuiviFamilial, Utilisateur
from src.modeles.logistique.notification_logistique import NotificationLogistique
from src.modules.gamification.service_notifications import _categories_filtres
from src.modules.logistique import service


class SessionNotifications:
    def __init__(self, utilisateur):
        self.utilisateur = utilisateur
        self.ajoutes = []

    async def get(self, modele, identifiant):
        if modele is Utilisateur and identifiant == self.utilisateur.id:
            return self.utilisateur
        return None

    def add(self, objet):
        self.ajoutes.append(objet)

    async def flush(self):
        return None


def test_filtre_messages_accepte_les_categories_colis_et_passagers():
    assert _categories_filtres("logistique_colis,logistique_suivi") == [
        "logistique_colis",
        "logistique_suivi",
    ]


def _preparer_notification(monkeypatch, *, type_passager="enfant"):
    utilisateur = SimpleNamespace(
        id=uuid.uuid4(),
        prenom_chiffre=None,
        nom_chiffre=None,
        digiid_public="USR123",
    )
    suivi = SimpleNamespace(
        id=uuid.uuid4(),
        type_passager=type_passager,
        enfant_nom="Aïcha Soglo",
        gare_depart_id=uuid.uuid4(),
        gare_arrivee_id=uuid.uuid4(),
        chauffeur_id=utilisateur.id,
        telephone_parent="+2290190123456",
        acheteur_tel="+2290190123456",
        proche_telephone="+2290190123456",
        sms_depart_envoye=False,
        sms_arrivee_envoye=False,
    )
    gare_arrivee_arret = uuid.uuid4()
    gares = {
        suivi.gare_depart_id: "Gare départ (Cotonou)",
        suivi.gare_arrivee_id: "Gare arrivée (Parakou)",
        gare_arrivee_arret: "Arrêt intermédiaire (Bohicon)",
    }
    ticket = SimpleNamespace(code_clair="ENF-2025-000123")
    session = SessionNotifications(utilisateur)
    appels_whatsapp = []
    appels_sms = []

    async def libelle_gare(_session, gare_id):
        return gares.get(gare_id)

    async def ticket_suivi(_session, _suivi):
        return ticket

    async def compte_par_telephone(_session, _telephone):
        return utilisateur

    def envoyer_whatsapp(telephone, message, **kwargs):
        appels_whatsapp.append((telephone, message, kwargs))
        return SimpleNamespace(
            accepte=True,
            message_id="wamid.test",
            erreur_code=None,
        )

    def envoyer_sms(telephone, message):
        appels_sms.append((telephone, message))
        return True

    monkeypatch.setattr(service, "_libelle_gare", libelle_gare)
    monkeypatch.setattr(service, "obtenir_ticket_du_suivi", ticket_suivi)
    monkeypatch.setattr(service, "_compte_par_telephone", compte_par_telephone)
    monkeypatch.setattr(service, "nom_complet", lambda _utilisateur: "Amadou Diallo")
    monkeypatch.setattr(
        service, "telephone_utilisateur", lambda _utilisateur: "+2290123456789"
    )
    monkeypatch.setattr(service, "envoyer_whatsapp", envoyer_whatsapp)
    monkeypatch.setattr(service, "envoyer_sms", envoyer_sms)
    return (
        session,
        suivi,
        utilisateur,
        ticket,
        gare_arrivee_arret,
        appels_whatsapp,
        appels_sms,
    )


def test_depart_passager_envoie_template_et_notification_plateforme_sans_doublon(
    monkeypatch,
):
    (
        session,
        suivi,
        utilisateur,
        ticket,
        _gare_arrivee_arret,
        appels_whatsapp,
        appels_sms,
    ) = _preparer_notification(monkeypatch)
    monkeypatch.setattr(
        service.parametres,
        "whatsapp_template_depart_passager_name",
        "template_depart_passager_configure",
    )
    monkeypatch.setattr(service.parametres, "sms_twilio_account_sid", "")
    monkeypatch.setattr(service.parametres, "sms_twilio_auth_token", "")
    monkeypatch.setattr(service.parametres, "sms_twilio_from", "")

    asyncio.run(
        service._notifier_suivi(
            cast(AsyncSession, session),
            cast(SuiviFamilial, suivi),
            "depart",
            suivi.gare_depart_id,
            datetime(2025, 2, 1, 10, 5, tzinfo=timezone.utc),
        )
    )

    telephone, message, options = appels_whatsapp[0]
    assert telephone == "+2290190123456"
    assert options == {
        "nom_template": "template_depart_passager_configure",
        "langue_template": "fr",
        "parametres_template": [
            "Enfant",
            "Aïcha",
            "Gare départ (Cotonou)",
            "Gare arrivée (Parakou)",
            "11:05",
            ticket.code_clair,
            "Amadou Diallo",
            "+2290123456789",
        ],
    }
    assert message == (
        "DigiID : le départ a eu lieu. Passager : Aïcha (Enfant), "
        "de Gare départ (Cotonou) vers Gare arrivée (Parakou). Départ à 11:05. "
        "Ticket : ENF-2025-000123. Chauffeur : Amadou Diallo, "
        "joignable au +2290123456789. "
        "Vous serez prévenu à l'approche et à l'arrivée."
    )
    assert appels_sms == []
    notifications_plateforme = [
        objet for objet in session.ajoutes if isinstance(objet, Notification)
    ]
    assert len(notifications_plateforme) == 1
    assert notifications_plateforme[0].utilisateur_id == utilisateur.id
    assert notifications_plateforme[0].message == message
    assert notifications_plateforme[0].lien_action == f"/suivi/{ticket.code_clair}"
    journal = [
        objet
        for objet in session.ajoutes
        if isinstance(objet, NotificationLogistique)
    ]
    assert len(journal) == 1
    assert journal[0].canal == "whatsapp"
    assert journal[0].telephone != "+2290190123456"
    assert ticket.code_clair not in journal[0].message


def test_depart_adulte_utilise_le_type_et_le_prenom_attendus(monkeypatch):
    (
        session,
        suivi,
        _utilisateur,
        _ticket,
        _gare_arrivee_arret,
        appels_whatsapp,
        _appels_sms,
    ) = _preparer_notification(monkeypatch, type_passager="adulte")

    asyncio.run(
        service._notifier_suivi(
            cast(AsyncSession, session),
            cast(SuiviFamilial, suivi),
            "depart",
            suivi.gare_depart_id,
            datetime(2025, 2, 1, 10, 5, tzinfo=timezone.utc),
        )
    )

    assert appels_whatsapp[0][2]["parametres_template"][:2] == [
        "Adulte",
        "Aïcha",
    ]


def test_arrivee_passager_utilise_arret_et_sms_en_secours(monkeypatch):
    (
        session,
        suivi,
        _utilisateur,
        _ticket,
        gare_arrivee_arret,
        appels_whatsapp,
        appels_sms,
    ) = _preparer_notification(monkeypatch)
    monkeypatch.setattr(
        service.parametres,
        "whatsapp_template_arrivee_passager_name",
        "template_arrivee_passager_configure",
    )
    monkeypatch.setattr(service.parametres, "sms_twilio_account_sid", "AC-test")
    monkeypatch.setattr(service.parametres, "sms_twilio_auth_token", "token-test")
    monkeypatch.setattr(service.parametres, "sms_twilio_from", "+22900000000")
    monkeypatch.setattr(
        service,
        "envoyer_whatsapp",
        lambda telephone, message, **kwargs: (
            appels_whatsapp.append((telephone, message, kwargs))
            or SimpleNamespace(
                accepte=False,
                message_id=None,
                erreur_code="TEMPORAIRE",
            )
        ),
    )

    asyncio.run(
        service._notifier_suivi(
            cast(AsyncSession, session),
            cast(SuiviFamilial, suivi),
            "arrivee",
            gare_arrivee_arret,
            datetime(2025, 2, 1, 10, 5, tzinfo=timezone.utc),
        )
    )

    assert (
        appels_whatsapp[0][2]["nom_template"]
        == "template_arrivee_passager_configure"
    )
    assert appels_whatsapp[0][2]["langue_template"] == "fr"
    assert appels_whatsapp[0][2]["parametres_template"] == [
        "Enfant",
        "Aïcha",
        "Gare départ (Cotonou)",
        "Arrêt intermédiaire (Bohicon)",
        "11:05",
        "ENF-2025-000123",
        "Amadou Diallo",
        "+2290123456789",
    ]
    assert appels_whatsapp[0][1] == (
        "DigiID : arrivée confirmée. Passager : Aïcha (Enfant) est arrivé à "
        "Arrêt intermédiaire (Bohicon), parti de Gare départ (Cotonou). "
        "Arrivée à 11:05. Ticket : ENF-2025-000123. "
        "Chauffeur : Amadou Diallo, joignable au +2290123456789."
    )
    assert len(appels_sms) == 1
    assert "arrivé à Arrêt intermédiaire (Bohicon)" in appels_sms[0][1]
    notifications_plateforme = [
        objet for objet in session.ajoutes if isinstance(objet, Notification)
    ]
    assert len(notifications_plateforme) == 1
    journal = [
        objet
        for objet in session.ajoutes
        if isinstance(objet, NotificationLogistique)
    ]
    assert [objet.canal for objet in journal] == ["whatsapp", "sms"]


def test_echec_whatsapp_sans_sms_configure_est_journalise_sans_bloquer(
    monkeypatch,
):
    (
        session,
        suivi,
        _utilisateur,
        _ticket,
        _gare_arrivee_arret,
        _appels_whatsapp,
        appels_sms,
    ) = _preparer_notification(monkeypatch)
    journaux = []
    monkeypatch.setattr(service.parametres, "sms_twilio_account_sid", "")
    monkeypatch.setattr(service.parametres, "sms_twilio_auth_token", "")
    monkeypatch.setattr(service.parametres, "sms_twilio_from", "")
    monkeypatch.setattr(
        service,
        "envoyer_whatsapp",
        lambda *_args, **_kwargs: SimpleNamespace(
            accepte=False,
            message_id=None,
            erreur_code="TEMPORAIRE",
        ),
    )
    monkeypatch.setattr(
        service.journal,
        "warning",
        lambda message, *args, **kwargs: journaux.append(message),
    )

    asyncio.run(
        service._notifier_suivi(
            cast(AsyncSession, session),
            cast(SuiviFamilial, suivi),
            "depart",
            suivi.gare_depart_id,
            datetime(2025, 2, 1, 10, 5, tzinfo=timezone.utc),
        )
    )

    assert appels_sms == []
    assert any("aucun fournisseur SMS configuré" in message for message in journaux)
    assert all("+2290190123456" not in message for message in journaux)
