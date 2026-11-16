import asyncio
from datetime import datetime, timedelta, timezone
import hashlib
from types import SimpleNamespace
import uuid

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles.logistique.notification_logistique import NotificationLogistique
from src.modules.logistique import service


class SessionFictive:
    def __init__(self):
        self.ajoutes = []
        self.commits = 0

    async def scalar(self, _requete):
        return None

    async def get(self, _modele, _identifiant):
        return None

    def add(self, objet):
        self.ajoutes.append(objet)

    async def commit(self):
        self.commits += 1


def test_code_remise_enfant_utilise_whatsapp_puis_sms_secours(monkeypatch):
    session = SessionFictive()
    suivi = SimpleNamespace(
        id=uuid.uuid4(),
        type_passager="enfant",
        telephone_recuperation="+2290190123456",
        enfant_nom="Aïcha Soglo",
        code_remise_hash=None,
        code_remise_chiffre=None,
        code_remise_expire_le=None,
        code_remise_tentatives=0,
    )
    ticket = SimpleNamespace(code_clair="ENF-TEST-01")
    appels_whatsapp = []
    appels_sms = []

    monkeypatch.setattr(service.secrets, "randbelow", lambda _maximum: 123456)
    monkeypatch.setattr(service.parametres, "whatsapp_active", True)
    monkeypatch.setattr(
        service,
        "envoyer_whatsapp",
        lambda telephone, message, **options: (
            appels_whatsapp.append((telephone, message, options))
            or SimpleNamespace(
                accepte=False,
                message_id=None,
                erreur_code="refuse",
                erreur_message="Envoi refusé",
            )
        ),
    )
    monkeypatch.setattr(
        service,
        "envoyer_sms",
        lambda telephone, message: appels_sms.append((telephone, message)) or True,
    )

    expire_le = asyncio.run(
        service.preparer_code_remise_suivi(
            session, suivi, ticket, renouveller=False
        )
    )

    assert expire_le is not None
    assert timedelta(minutes=29, seconds=59) <= (
        expire_le - datetime.now(timezone.utc)
    ) <= timedelta(minutes=30)
    telephone, message, options = appels_whatsapp[0]
    assert telephone == suivi.telephone_recuperation
    assert options == {
        "nom_template": "digiid_code_remise_enfant_auth",
        "parametres_template": ["123456"],
        "parametres_bouton_url": ["123456"],
        "langue_template": "fr",
    }
    assert message == "123456 est votre code de vérification."
    assert "Aïcha" not in message
    assert "ENF-TEST-01" not in message
    assert appels_sms == [
        (
            telephone,
            "DigiID : code de remise de Aïcha (ticket ENF-TEST-01) : 123456. "
            "Ne le donnez qu'à la personne présente devant vous pour récupérer "
            "l'enfant. Valable 30 minutes.",
        )
    ]
    assert suivi.code_remise_hash == hashlib.sha256(b"123456").hexdigest()
    assert suivi.code_remise_chiffre != "123456"
    logs = [
        objet for objet in session.ajoutes
        if isinstance(objet, NotificationLogistique)
    ]
    assert len(logs) == 2
    assert all("123456" not in objet.message for objet in logs)
    assert all(telephone not in objet.telephone for objet in logs)


def test_trois_codes_incorrects_detruisent_le_code_et_sont_audites():
    identifiant_utilisateur = uuid.uuid4()
    suivi = SimpleNamespace(
        id=uuid.uuid4(),
        type_passager="enfant",
        statut="arrive",
        chauffeur_id=uuid.uuid4(),
        remis_guichet_le=datetime.now(timezone.utc),
        remis_guichet_a_id=identifiant_utilisateur,
        code_remise_hash=hashlib.sha256(b"123456").hexdigest(),
        code_remise_chiffre="chiffre",
        code_remise_expire_le=datetime.now(timezone.utc) + timedelta(minutes=30),
        code_remise_tentatives=0,
    )
    session = SessionFictive()
    session.suivi = suivi

    # La route/service ne doit pouvoir récupérer le code brut par le journal.
    original_get = session.get

    async def get(modele, identifiant):
        if identifiant == suivi.id:
            return suivi
        return await original_get(modele, identifiant)

    session.get = get
    utilisateur = SimpleNamespace(
        id=identifiant_utilisateur,
        role="receveur",
    )
    async def executer_tentative():
        return await service.enregistrer_evenement_suivi(
            session,
            suivi.id,
            service.schemas.SuiviFamilialEvenementCreate(
                type_evenement="livraison",
                code_confirmation="000000",
            ),
            utilisateur,
        )

    async def lancer():
        for _ in range(3):
            try:
                await executer_tentative()
            except HTTPException as erreur:
                assert erreur.status_code == 400
            else:
                raise AssertionError("Une tentative avec un code invalide a réussi.")

    asyncio.run(lancer())

    assert suivi.code_remise_tentatives == 3
    assert suivi.code_remise_hash is None
    assert suivi.code_remise_chiffre is None
    assert session.commits == 3
    assert all(
        "000000" not in repr(getattr(audit, "donnees_supplementaires", {}))
        for audit in session.ajoutes
    )
