import asyncio
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from src.config import parametres
from src.modules.authentification import verification_code
from src.modules.utilisateurs.routes import ModificationTelephone, modifier_telephone
from src.schemas.authentification import (
    VerificationEnvoyerRequete,
    VerificationVerifierRequete,
)


class _ResultatVide:
    def scalars(self):
        return self

    def all(self):
        return []


class _SessionVerification:
    def __init__(self):
        self.ajoutes = []

    async def execute(self, _requete):
        return _ResultatVide()

    def add(self, objet):
        self.ajoutes.append(objet)

    async def flush(self):
        return None

    async def commit(self):
        return None


def test_modification_telephone_utilise_whatsapp_uniquement():
    demande = ModificationTelephone(telephone="+22901000000")

    assert demande.canal == "whatsapp"
    with pytest.raises(ValidationError):
        ModificationTelephone(telephone="+22901000000", canal="sms")

    assert VerificationEnvoyerRequete(canal="whatsapp").canal == "whatsapp"
    with pytest.raises(ValidationError):
        VerificationEnvoyerRequete(canal="sms")
    with pytest.raises(ValidationError):
        VerificationVerifierRequete(code="123456", canal="sms")


def test_code_telephone_est_envoye_avec_le_template_existant_sans_sms(monkeypatch):
    session = _SessionVerification()
    appels_whatsapp = []
    utilisateur = SimpleNamespace(id=uuid.uuid4(), prenom_chiffre=None)

    def envoyer_whatsapp(telephone, message, **options):
        appels_whatsapp.append((telephone, message, options))
        return SimpleNamespace(accepte=True)

    monkeypatch.setattr(
        verification_code,
        "generer_code_verification",
        lambda _taille: "123456",
    )
    monkeypatch.setattr(verification_code, "envoyer_whatsapp", envoyer_whatsapp)
    monkeypatch.setattr(
        verification_code,
        "envoyer_sms_verification",
        lambda *_args: pytest.fail("Aucun SMS ne doit être tenté"),
    )
    monkeypatch.setattr(
        parametres,
        "whatsapp_template_name",
        "digiid_notification_logistique",
    )
    monkeypatch.setattr(parametres, "whatsapp_template_language", "fr")
    monkeypatch.setattr(parametres, "cle_secrete_jwt", "secret-de-test")

    resultat = asyncio.run(
        verification_code.generer_et_envoyer_code(
            session=session,
            utilisateur=utilisateur,
            email=None,
            telephone="+22901000000",
            canal=verification_code.CANAL_WHATSAPP,
            type_verification="changement_telephone",
        )
    )

    assert resultat["succes_envoi"] is True
    telephone, message, options = appels_whatsapp[0]
    assert telephone == "+22901000000"
    assert message == "Ton code de confirmation DigiID est 123456."
    assert options == {
        "nom_template": "digiid_notification_logistique",
        "parametres_template": [message],
        "langue_template": "fr",
    }


def test_echec_configuration_whatsapp_ne_passe_pas_par_sms(monkeypatch):
    monkeypatch.setattr(parametres, "whatsapp_active", False)
    demande = ModificationTelephone(telephone="+22901000000")

    with pytest.raises(HTTPException) as erreur:
        asyncio.run(
            modifier_telephone(
                demande,
                _SessionVerification(),
                SimpleNamespace(id=uuid.uuid4()),
            )
        )

    assert erreur.value.status_code == 503
    assert "Aucun SMS de secours" in erreur.value.detail
