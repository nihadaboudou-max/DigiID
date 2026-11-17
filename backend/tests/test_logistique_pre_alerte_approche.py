import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import cast
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Notification, ArretLigne, Ligne, Voyage
from src.modeles.logistique.notification_logistique import NotificationLogistique
from src.modules.logistique import service


class ResultatScalars:
    def __init__(self, elements):
        self.elements = elements

    def all(self):
        return self.elements


class SessionApproche:
    def __init__(self, ligne, arrets):
        self.ligne = ligne
        self.arrets = arrets
        self.voyage = None
        self.ajoutes = []

    async def get(self, modele, identifiant):
        if modele is Ligne and identifiant == self.ligne.id:
            return self.ligne
        if modele is ArretLigne:
            return next((a for a in self.arrets if a.id == identifiant), None)
        return None

    async def scalars(self, requete):
        modele = requete.column_descriptions[0]["entity"]
        if modele is ArretLigne:
            return ResultatScalars(self.arrets)
        return ResultatScalars([])

    async def scalar(self, _requete):
        if _requete.column_descriptions[0]["entity"] is Voyage:
            return self.voyage
        return None

    def add(self, objet):
        self.ajoutes.append(objet)

    async def flush(self):
        return None

    async def commit(self):
        return None


def _preparer_approche(monkeypatch, passagers):
    gare_depart_id, gare_arret_id, gare_arrivee_id = (
        uuid.uuid4(),
        uuid.uuid4(),
        uuid.uuid4(),
    )
    ligne = SimpleNamespace(
        id=uuid.uuid4(),
        gare_depart_id=gare_depart_id,
        gare_arrivee_id=gare_arrivee_id,
    )
    arret = SimpleNamespace(
        id=uuid.uuid4(),
        ligne_id=ligne.id,
        gare_id=gare_arret_id,
        ordre=1,
        actif=True,
    )
    voyage = SimpleNamespace(
        id=uuid.uuid4(),
        ligne_id=ligne.id,
        statut="en_cours",
    )
    utilisateur = SimpleNamespace(id=uuid.uuid4())
    session = SessionApproche(ligne, [arret])
    session.voyage = voyage
    libelles = {
        gare_depart_id: "Gare départ (Cotonou)",
        gare_arret_id: "Arrêt Bohicon",
        gare_arrivee_id: "Gare arrivée (Parakou)",
    }

    async def obtenir_voyage(_session, _voyage_id):
        return voyage

    async def aucun_colis(_session, _voyage_id):
        return []

    async def passagers_voyage(_session, _voyage_id):
        return passagers

    async def libelle_gare(_session, gare_id):
        return libelles.get(gare_id)

    async def ticket_suivi(_session, _suivi):
        return SimpleNamespace(code_clair="TICKET-123456")

    async def compte_par_telephone(_session, _telephone):
        return utilisateur

    appels_whatsapp = []

    def envoyer_whatsapp(telephone, message, **options):
        appels_whatsapp.append((telephone, message, options))
        return SimpleNamespace(
            accepte=True,
            message_id="wamid.approche",
            erreur_code=None,
        )

    monkeypatch.setattr(service, "obtenir_voyage", obtenir_voyage)
    monkeypatch.setattr(service, "_colis_du_voyage", aucun_colis)
    monkeypatch.setattr(service, "_passagers_du_voyage", passagers_voyage)
    monkeypatch.setattr(service, "_libelle_gare", libelle_gare)
    monkeypatch.setattr(service, "obtenir_ticket_du_suivi", ticket_suivi)
    monkeypatch.setattr(service, "_compte_par_telephone", compte_par_telephone)
    monkeypatch.setattr(service, "envoyer_whatsapp", envoyer_whatsapp)
    return session, voyage, ligne, arret, utilisateur, appels_whatsapp


def test_pre_alerte_cible_un_arret_et_notifie_par_whatsapp_et_plateforme(monkeypatch):
    passagers = []
    (
        session,
        voyage,
        ligne,
        arret,
        utilisateur,
        appels_whatsapp,
    ) = _preparer_approche(monkeypatch, passagers)
    arret_id = arret.id
    passagers.extend(
        [
            SimpleNamespace(
                id=uuid.uuid4(),
                statut="en_route",
                arret_destination_id=arret.id,
                gare_arrivee_id=arret.gare_id,
                type_passager="enfant",
                enfant_nom="Aïcha Soglo",
                telephone_parent="+2290190123456",
                acheteur_tel="+2290190123456",
                proche_telephone="+2290190123456",
                telephone_recuperation=None,
                pre_alerte_envoyee=False,
            ),
            SimpleNamespace(
                id=uuid.uuid4(),
                statut="en_route",
                arret_destination_id=None,
                gare_arrivee_id=ligne.gare_arrivee_id,
                type_passager="adulte",
                enfant_nom="Kossi",
                telephone_parent="+2290190999999",
                acheteur_tel=None,
                proche_telephone=None,
                pre_alerte_envoyee=False,
            ),
        ]
    )
    monkeypatch.setattr(service.parametres, "approche_delai_minutes", 105)
    monkeypatch.setattr(
        service.parametres,
        "whatsapp_template_approche_name",
        "digiid_approche_configurable",
    )
    monkeypatch.setattr(service.parametres, "sms_twilio_account_sid", "")
    monkeypatch.setattr(service.parametres, "sms_twilio_auth_token", "")
    monkeypatch.setattr(service.parametres, "sms_twilio_from", "")

    resultat = asyncio.run(
        service.envoyer_pre_alerte_voyage(
            cast(AsyncSession, session),
            voyage.id,
            utilisateur,
            arret_id=arret_id,
            heure_estimee=datetime(2026, 2, 1, 10, 0, tzinfo=timezone.utc),
        )
    )

    telephone, message, options = appels_whatsapp[0]
    assert telephone == "+2290190123456"
    assert options == {
        "nom_template": "digiid_approche_configurable",
        "parametres_template": [
            "L'enfant",
            "Aïcha",
            "Arrêt Bohicon",
            "105 min",
            "11:00",
            "Gare départ (Cotonou) → Gare arrivée (Parakou)",
        ],
        "langue_template": "fr",
    }
    assert message == (
        "DigiID : préparez-vous. L'enfant Aïcha arrive à Arrêt Bohicon "
        "dans environ 105 min, vers 11:00. Trajet : Gare départ (Cotonou) "
        "→ Gare arrivée (Parakou). Merci d'être sur place."
    )
    notifications_plateforme = [
        objet for objet in session.ajoutes if isinstance(objet, Notification)
    ]
    assert len(notifications_plateforme) == 1
    assert notifications_plateforme[0].utilisateur_id == utilisateur.id
    assert notifications_plateforme[0].message == message
    assert resultat["nb_passagers"] == 1
    assert "TICKET-123456" not in resultat["message"]
    assert "+2290190123456" not in resultat["message"]
    logs = [
        objet
        for objet in session.ajoutes
        if isinstance(objet, NotificationLogistique)
    ]
    assert len(logs) == 1
    assert logs[0].canal == "whatsapp"
    assert "TICKET-123456" not in logs[0].message
    assert "+2290190123456" not in logs[0].telephone


def test_pre_alerte_sans_personne_a_larret_retourne_le_message_attendu(monkeypatch):
    passagers = []
    session, voyage, ligne, arret, utilisateur, appels_whatsapp = (
        _preparer_approche(monkeypatch, passagers)
    )
    passagers.append(
        SimpleNamespace(
            id=uuid.uuid4(),
            statut="en_route",
            arret_destination_id=None,
            gare_arrivee_id=ligne.gare_arrivee_id,
            type_passager="adulte",
            enfant_nom="Kossi",
            telephone_parent="+2290190999999",
            acheteur_tel=None,
            proche_telephone=None,
            pre_alerte_envoyee=False,
        )
    )

    resultat = asyncio.run(
        service.envoyer_pre_alerte_voyage(
            cast(AsyncSession, session),
            voyage.id,
            utilisateur,
            arret_id=arret.id,
        )
    )

    assert resultat["message"] == "Personne ne descend ici."
    assert appels_whatsapp == []


def test_code_colis_est_masque_dans_le_journal_de_notification(monkeypatch):
    gare_depart_id, gare_arrivee_id = uuid.uuid4(), uuid.uuid4()
    ligne = SimpleNamespace(
        id=uuid.uuid4(),
        gare_depart_id=gare_depart_id,
        gare_arrivee_id=gare_arrivee_id,
    )
    session = SessionApproche(ligne, [])
    session.voyage = SimpleNamespace(id=uuid.uuid4())
    monkeypatch.setattr(
        service,
        "envoyer_whatsapp",
        lambda *_args, **_kwargs: SimpleNamespace(
            accepte=True,
            message_id="wamid.colis",
            erreur_code=None,
        ),
    )

    service._ajouter_notification_approche(
        session,
        type_cible="colis",
        cible_id=uuid.uuid4(),
        destinataire_role="destinataire",
        telephone="+2290190123456",
        message=(
            "DigiID : préparez-vous. Le colis TICKET123ABC arrive à Bohicon."
        ),
        parametres_template=[
            "Le colis",
            "TICKET123ABC",
            "Bohicon",
            "45 min",
            "10:00",
            "Cotonou → Parakou",
        ],
    )

    journal_notification = next(
        objet
        for objet in session.ajoutes
        if isinstance(objet, NotificationLogistique)
    )
    assert "TICKET123ABC" not in journal_notification.message
    assert "[code masqué]" in journal_notification.message


def test_automatisation_estime_chaque_arret_seulement_si_duree_connue(monkeypatch):
    gare_depart_id, gare_arret_id, gare_arrivee_id = (
        uuid.uuid4(),
        uuid.uuid4(),
        uuid.uuid4(),
    )
    ligne = SimpleNamespace(
        id=uuid.uuid4(),
        gare_depart_id=gare_depart_id,
        gare_arrivee_id=gare_arrivee_id,
        duree_min=200,
    )
    arret = SimpleNamespace(
        id=uuid.uuid4(),
        ligne_id=ligne.id,
        gare_id=gare_arret_id,
        ordre=1,
        actif=True,
    )
    date_depart = datetime(2026, 2, 1, 8, 0, tzinfo=timezone.utc)
    voyage = SimpleNamespace(
        id=uuid.uuid4(),
        ligne_id=ligne.id,
        date_depart=date_depart,
        statut="en_cours",
    )
    session = SessionApproche(ligne, [arret])
    session.voyages = [voyage]
    colis = SimpleNamespace(
        statut="en_transit",
        gare_arrivee_id=gare_arret_id,
        arret_destination_id=arret.id,
    )
    appels = []

    async def colis_du_voyage(_session, _voyage_id):
        return [colis]

    async def passagers_du_voyage(_session, _voyage_id):
        return []

    async def envoyer(_session, voyage_id, _utilisateur, **options):
        appels.append((voyage_id, options))
        return {"nb_sms": 1}

    async def scalars(requete):
        modele = requete.column_descriptions[0]["entity"]
        return ResultatScalars(
            session.voyages if modele is Voyage else session.arrets
        )

    session.scalars = scalars
    monkeypatch.setattr(service, "_colis_du_voyage", colis_du_voyage)
    monkeypatch.setattr(service, "_passagers_du_voyage", passagers_du_voyage)
    monkeypatch.setattr(service, "envoyer_pre_alerte_voyage", envoyer)
    monkeypatch.setattr(service.parametres, "approche_delai_minutes", 105)

    nombre = asyncio.run(
        service.envoyer_pre_alertes_automatiques(
            session, maintenant=date_depart + timedelta(minutes=10)
        )
    )

    assert nombre == 1
    assert appels[0][1]["arret_id"] == arret.id
    assert appels[0][1]["gare_id"] == gare_arret_id
    assert appels[0][1]["heure_estimee"] == date_depart + timedelta(minutes=100)
    assert appels[0][1]["automatique"] is True


def test_automatisation_ignore_les_lignes_sans_duree(monkeypatch):
    session, voyage, ligne, _arret, _utilisateur, _appels = _preparer_approche(
        monkeypatch, []
    )
    ligne.duree_min = None
    session.voyages = [voyage]
    appels = []

    async def scalars(requete):
        return ResultatScalars(
            session.voyages
            if requete.column_descriptions[0]["entity"] is Voyage
            else session.arrets
        )

    async def envoyer(*_args, **_kwargs):
        appels.append(True)
        return {"nb_sms": 1}

    session.scalars = scalars
    monkeypatch.setattr(service, "envoyer_pre_alerte_voyage", envoyer)

    nombre = asyncio.run(service.envoyer_pre_alertes_automatiques(session))

    assert nombre == 0
    assert appels == []
