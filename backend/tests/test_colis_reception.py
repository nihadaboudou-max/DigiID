"""Tests des transitions de réception et de refus de colis."""
import asyncio
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.modules.logistique import schemas, service
from src.modules.logistique import routes
from src.modeles.logistique.colis import Colis
from src.modeles.logistique.colis_evenement import ColisEvenement
from src.modeles.logistique.suivi_familial_evenement import SuiviFamilialEvenement
from src.modeles.audit import JournalAudit


class SessionCapture:
    def __init__(self, colis):
        self.colis = colis
        self.ajoutes = []
        self.commits = 0
        self.utilisateurs = {}

    async def get(self, modele, identifiant):
        if modele is Colis and self.colis is not None and identifiant == self.colis.id:
            return self.colis
        return self.utilisateurs.get(identifiant)

    def add(self, objet):
        self.ajoutes.append(objet)

    async def commit(self):
        self.commits += 1

    async def refresh(self, _objet):
        return None


class ResultatVoyage:
    def __init__(self, elements):
        self.elements = elements

    def scalars(self):
        return self

    def all(self):
        return self.elements


class SessionDepartCapture(SessionCapture):
    def __init__(self, voyage, colis):
        super().__init__(None)
        self.voyage = voyage
        self.colis_voyage = colis
        self.requetes = 0

    async def get(self, modele, identifiant):
        if modele.__name__ == "Voyage" and identifiant == self.voyage.id:
            return self.voyage
        return None

    async def execute(self, _requete):
        self.requetes += 1
        return ResultatVoyage(self.colis_voyage if self.requetes == 1 else [])


def _chauffeur():
    return SimpleNamespace(id=uuid.uuid4(), role="chauffeur")


def _colis(chauffeur_id, **valeurs):
    attributs = {
        "id": uuid.uuid4(),
        "chauffeur_id": chauffeur_id,
        "voyage_id": uuid.uuid4(),
        "mode_enregistrement": "guichet",
        "statut": "a_valider",
        "reception_confirmee_le": None,
        "reception_confirmee_par_id": None,
        "gare_depart_id": uuid.uuid4(),
        "gare_arrivee_id": uuid.uuid4(),
        "arret_destination_id": None,
        "ticket_id": None,
        "expediteur_id": None,
        "destinataire_id": None,
    }
    attributs.update(valeurs)
    return SimpleNamespace(**attributs)


def test_confirmation_par_chauffeur_affecte_fait_passer_a_recu(monkeypatch):
    chauffeur = _chauffeur()
    colis = _colis(chauffeur.id)
    session = SessionCapture(colis)

    async def aucun_gerant(*_args):
        return []

    async def aucun_ticket(*_args):
        return None

    async def aucune_notification(*_args, **_kwargs):
        return None

    monkeypatch.setattr(service, "_gerants_de_gare", aucun_gerant)
    monkeypatch.setattr(service, "obtenir_ticket_du_colis", aucun_ticket)
    monkeypatch.setattr(service, "_notifier_comptes_colis", aucune_notification)
    asyncio.run(service.confirmer_reception_colis(session, colis.id, chauffeur))

    assert colis.statut == "recu_chauffeur"
    assert colis.reception_confirmee_le is not None
    assert colis.reception_confirmee_par_id == chauffeur.id
    assert any(
        isinstance(evenement, ColisEvenement)
        and evenement.type_evenement == "reception"
        for evenement in session.ajoutes
    )
    audit = next(
        entree
        for entree in session.ajoutes
        if isinstance(entree, JournalAudit)
        and entree.type_evenement == "colis_reception_confirmee"
    )
    assert audit.utilisateur_id == chauffeur.id
    assert audit.donnees_supplementaires["ancien_statut"] == "a_valider"
    assert audit.donnees_supplementaires["nouveau_statut"] == "recu_chauffeur"
    assert "motif" not in audit.donnees_supplementaires


def test_un_autre_chauffeur_ne_peut_pas_confirmer_le_colis():
    chauffeur = _chauffeur()
    colis = _colis(uuid.uuid4())
    session = SessionCapture(colis)

    with pytest.raises(HTTPException) as erreur:
        asyncio.run(service.confirmer_reception_colis(session, colis.id, chauffeur))

    assert erreur.value.status_code == 403
    assert colis.statut == "a_valider"
    assert session.commits == 0


def test_refus_remet_le_colis_non_attribue_et_detache_le_ticket(monkeypatch):
    chauffeur = _chauffeur()
    colis = _colis(
        chauffeur.id,
        statut="recu_chauffeur",
        reception_confirmee_le=object(),
        reception_confirmee_par_id=chauffeur.id,
    )
    ticket = SimpleNamespace(voyage_id=colis.voyage_id, code_clair=None)
    session = SessionCapture(colis)

    async def obtenir_ticket(_session, _colis):
        return ticket

    async def aucun_gerant(*_args):
        return []

    async def aucune_notification(*_args, **_kwargs):
        return None

    monkeypatch.setattr(service, "obtenir_ticket_du_colis", obtenir_ticket)
    monkeypatch.setattr(service, "_gerants_de_gare", aucun_gerant)
    monkeypatch.setattr(service, "_notifier_comptes_colis", aucune_notification)

    asyncio.run(
        service.refuser_reception_colis(
            session, colis.id, chauffeur, "Colis absent du chargement"
        )
    )

    assert colis.statut == "non_attribue"
    assert colis.voyage_id is None
    assert colis.chauffeur_id is None
    assert colis.reception_confirmee_le is None
    assert ticket.voyage_id is None
    evenement = next(
        objet
        for objet in session.ajoutes
        if isinstance(objet, ColisEvenement)
    )
    assert evenement.type_evenement == "refus_reception"
    assert evenement.localisation == "Colis absent du chargement"
    audit = next(
        entree
        for entree in session.ajoutes
        if isinstance(entree, JournalAudit)
        and entree.type_evenement == "colis_reception_refusee"
    )
    assert audit.donnees_supplementaires["ancien_statut"] == "recu_chauffeur"
    assert audit.donnees_supplementaires["nouveau_statut"] == "non_attribue"
    assert "Colis absent du chargement" not in str(audit.donnees_supplementaires)


def test_refus_reception_passager_desaffecte_et_notifie_les_personnes_concernees(
    monkeypatch,
):
    chauffeur = _chauffeur()
    suivi = SimpleNamespace(
        id=uuid.uuid4(),
        chauffeur_id=chauffeur.id,
        voyage_id=uuid.uuid4(),
        mode_enregistrement="guichet",
        statut="enregistre",
        gare_depart_id=uuid.uuid4(),
        reception_confirmee_le=None,
        reception_confirmee_par_id=None,
    )
    session = SessionCapture(None)
    session.utilisateurs[suivi.id] = suivi
    notifications = []

    async def notifier(*args, **kwargs):
        notifications.append((args, kwargs))

    async def aucun_ticket(*_args):
        return None

    monkeypatch.setattr(service, "_notifier_guichet_suivi", notifier)
    monkeypatch.setattr(service, "_notifier_comptes_suivi", notifier)
    monkeypatch.setattr(service, "obtenir_ticket_du_suivi", aucun_ticket)

    asyncio.run(
        service.refuser_reception_suivi(
            session, suivi.id, chauffeur, "Passager absent au départ"
        )
    )

    assert suivi.statut == "enregistre"
    assert suivi.voyage_id is None
    assert suivi.chauffeur_id is None
    assert len(notifications) == 2
    evenement = next(
        objet
        for objet in session.ajoutes
        if isinstance(objet, SuiviFamilialEvenement)
    )
    assert evenement.type_evenement == "refus_reception"
    assert evenement.localisation == "Passager absent au départ"
    assert session.commits == 1


def test_affectation_notifie_le_chauffeur_et_audite_le_changement(monkeypatch):
    agent = SimpleNamespace(id=uuid.uuid4(), role="receveur")
    chauffeur = SimpleNamespace(
        id=uuid.uuid4(),
        role="chauffeur",
        telephone_chiffre="telephone-chiffre",
    )
    voyage = SimpleNamespace(
        id=uuid.uuid4(),
        chauffeur_id=chauffeur.id,
        ligne_id=uuid.uuid4(),
    )
    colis = _colis(
        None,
        voyage_id=None,
        statut="non_attribue",
        reception_confirmee_le=None,
        reception_confirmee_par_id=None,
    )
    ticket = SimpleNamespace(voyage_id=None)
    session = SessionCapture(colis)
    notifications_in_app = []
    notifications_externes = []

    async def verifier_existe(_session, modele, _identifiant, _nom):
        return voyage if modele is service.Voyage else chauffeur

    async def verifier_trajet(*_args):
        return None

    async def libelle_voyage(*_args):
        return "Gare A - Gare B"

    async def obtenir_ticket(_session, _colis):
        return ticket

    async def creer_notification(_session, utilisateur, **options):
        notifications_in_app.append((utilisateur, options))

    def ajouter_notification(_session, **options):
        notifications_externes.append(options)

    monkeypatch.setattr(service, "_verifier_existe", verifier_existe)
    monkeypatch.setattr(service, "_verifier_trajet_du_voyage", verifier_trajet)
    monkeypatch.setattr(service, "_libelle_voyage", libelle_voyage)
    monkeypatch.setattr(service, "obtenir_ticket_du_colis", obtenir_ticket)
    monkeypatch.setattr(service, "creer_notification", creer_notification)
    monkeypatch.setattr(service, "_ajouter_notification", ajouter_notification)
    monkeypatch.setattr(service, "dechiffrer_donnee", lambda _valeur: "+22901000000")

    asyncio.run(
        service.affecter_colis(
            session,
            colis.id,
            schemas.AffectationRequest(voyage_id=voyage.id),
            agent,
        )
    )

    assert colis.statut == "a_valider"
    assert notifications_in_app[0][0] is chauffeur
    assert notifications_in_app[0][1]["titre"] == "Colis à valider"
    assert notifications_externes[0]["destinataire_role"] == "chauffeur"
    assert notifications_externes[0]["type_evenement"] == "affectation"
    audit = next(
        entree
        for entree in session.ajoutes
        if isinstance(entree, JournalAudit)
        and entree.type_evenement == "colis_affectation"
    )
    assert audit.donnees_supplementaires["ancien_statut"] == "non_attribue"
    assert audit.donnees_supplementaires["nouveau_statut"] == "a_valider"


def test_notification_de_refus_est_adressee_au_guichet(monkeypatch):
    agent = SimpleNamespace(
        id=uuid.uuid4(),
        telephone_chiffre="telephone-chiffre",
    )
    colis = _colis(uuid.uuid4(), enregistre_par_id=agent.id)
    session = SessionCapture(colis)
    session.utilisateurs[agent.id] = agent
    notifications_in_app = []
    notifications_externes = []

    async def creer_notification(_session, utilisateur, **options):
        notifications_in_app.append((utilisateur, options))

    def ajouter_notification(_session, **options):
        notifications_externes.append(options)

    async def obtenir_ticket(_session, _colis):
        return SimpleNamespace(code_clair="COLIS-TEST")

    async def aucun_gerant(*_args):
        return []

    monkeypatch.setattr(service, "creer_notification", creer_notification)
    monkeypatch.setattr(service, "_ajouter_notification", ajouter_notification)
    monkeypatch.setattr(service, "dechiffrer_donnee", lambda _valeur: "+22901000000")
    monkeypatch.setattr(service, "obtenir_ticket_du_colis", obtenir_ticket)
    monkeypatch.setattr(service, "_gerants_de_gare", aucun_gerant)

    asyncio.run(
        service._notifier_guichet_colis(
            session,
            colis,
            titre="Réception refusée",
            message="Le chauffeur a refusé le colis. Motif : colis absent.",
            type_evenement="refus_reception",
        )
    )

    assert notifications_in_app[0][0] is agent
    assert "Motif : colis absent." in notifications_in_app[0][1]["message"]
    assert notifications_externes[0]["destinataire_role"] == "guichet"
    assert notifications_externes[0]["type_evenement"] == "refus_reception"


def test_suivi_public_affiche_les_notifications_reelles_sans_exposer_le_motif():
    gare_id = uuid.uuid4()
    evenement = SimpleNamespace(
        type_evenement="refus_reception",
        horodatage=datetime.now(timezone.utc),
        localisation="Motif privé",
        gare_id=gare_id,
    )

    public = service._evenements_publics([evenement], {gare_id: "Gare"})

    assert public[0].localisation is None
    assert public[0].horodatage == evenement.horodatage
    assert not hasattr(public[0], "acteur_nom")
    notifications = service._notifications_publiques(
        [
            SimpleNamespace(
                type_evenement="refus_reception",
                canal="sms",
                destinataire_role="guichet",
                telephone="+22901000000",
                message="Motif privé",
                envoye=True,
                cree_le=datetime.now(timezone.utc),
            ),
            SimpleNamespace(
                type_evenement="affectation",
                canal="whatsapp",
                destinataire_role="chauffeur",
                telephone="**0000",
                message="Colis affecté",
                envoye=False,
                cree_le=datetime.now(timezone.utc),
            ),
        ]
    )

    assert len(notifications) == 2
    assert notifications[0].message == (
        "Le chauffeur a refusé la prise en charge. "
        "Le guichet doit réaffecter le colis."
    )
    assert notifications[0].telephone_masque != "+22901000000"
    assert notifications[1].type_evenement == "affectation"
    assert notifications[1].envoye is False


def test_participant_associe_par_telephone_peut_acceder_au_recu(monkeypatch):
    utilisateur = SimpleNamespace(id=uuid.uuid4(), est_telephone_verifie=True)
    colis = SimpleNamespace(
        expediteur_id=None,
        destinataire_id=None,
        expediteur_tel="+22901000000",
        destinataire_tel="+22902000000",
    )

    async def trouver_compte(_session, telephone):
        return utilisateur if telephone == colis.expediteur_tel else None

    monkeypatch.setattr(service, "_compte_par_telephone", trouver_compte)

    assert asyncio.run(
        routes._est_participant_colis(object(), colis, utilisateur)
    )


def test_participant_non_verifie_ne_peut_pas_acceder_au_recu_par_identifiant():
    utilisateur = SimpleNamespace(
        id=uuid.uuid4(),
        est_telephone_verifie=False,
    )
    colis = SimpleNamespace(
        expediteur_id=utilisateur.id,
        destinataire_id=None,
        expediteur_tel=None,
        destinataire_tel=None,
    )

    assert not asyncio.run(
        routes._est_participant_colis(object(), colis, utilisateur)
    )


def test_recherche_de_compte_par_telephone_exige_un_numero_verifie():
    class SessionCaptureRequete:
        requete = None

        async def scalar(self, requete):
            self.requete = requete
            return None

    session = SessionCaptureRequete()

    assert asyncio.run(
        service._compte_par_telephone(session, "+2290199000011")
    ) is None
    sql = str(session.requete.compile()).lower()
    assert "utilisateur.est_telephone_verifie is true" in sql


def test_compte_non_verifie_ne_peut_pas_reveler_un_code_de_remise():
    from src.modules.gamification.service_notifications import (
        obtenir_code_remise_notification,
    )

    utilisateur = SimpleNamespace(est_telephone_verifie=False)

    with pytest.raises(HTTPException) as erreur:
        asyncio.run(obtenir_code_remise_notification(object(), utilisateur, uuid.uuid4()))

    assert erreur.value.status_code == 404


def test_colis_recu_ne_peut_pas_etre_reaffecte_sans_refus():
    chauffeur = _chauffeur()
    colis = _colis(
        chauffeur.id,
        statut="recu_chauffeur",
        reception_confirmee_le=object(),
    )
    session = SessionCapture(colis)

    with pytest.raises(HTTPException) as erreur:
        asyncio.run(
            service.affecter_colis(
                session,
                colis.id,
                schemas.AffectationRequest(voyage_id=None),
                chauffeur,
            )
        )

    assert erreur.value.status_code == 409


def test_depart_demande_confirmation_si_des_colis_sont_a_valider():
    voyage = SimpleNamespace(
        id=uuid.uuid4(),
        statut="planifie",
        date_depart=datetime.now(timezone.utc),
    )
    colis = _colis(uuid.uuid4(), voyage_id=voyage.id)
    session = SessionDepartCapture(voyage, [colis])

    with pytest.raises(HTTPException) as erreur:
        asyncio.run(
            service.valider_depart_voyage(
                session, voyage.id, _chauffeur()
            )
        )

    assert erreur.value.status_code == 409
    assert erreur.value.detail["code"] == "COLIS_A_VALIDER"
    assert erreur.value.detail["nb_colis"] == 1
    assert colis.statut == "a_valider"
    assert session.commits == 0


def test_depart_retire_les_colis_non_valides_et_ne_fait_partir_que_les_valides(
    monkeypatch,
):
    voyage = SimpleNamespace(
        id=uuid.uuid4(),
        statut="planifie",
        date_depart=datetime.now(timezone.utc),
    )
    chauffeur = _chauffeur()
    en_attente = _colis(chauffeur.id, voyage_id=voyage.id)
    recu = _colis(
        chauffeur.id,
        voyage_id=voyage.id,
        statut="recu_chauffeur",
        reception_confirmee_le=datetime.now(timezone.utc),
    )
    direct = _colis(
        chauffeur.id,
        voyage_id=voyage.id,
        statut="enregistre_direct",
        mode_enregistrement="chauffeur_direct",
    )
    tickets = {
        colis.id: SimpleNamespace(
            voyage_id=voyage.id,
            statut="emis",
            code_clair=f"COLIS-{index}",
        )
        for index, colis in enumerate((en_attente, recu, direct), start=1)
    }

    async def obtenir_ticket(_session, colis):
        return tickets[colis.id]

    async def notifier(*_args, **_kwargs):
        return None

    async def aucun_gerant(*_args):
        return []

    monkeypatch.setattr(service, "obtenir_ticket_du_colis", obtenir_ticket)
    monkeypatch.setattr(service, "_notifier_comptes_colis", notifier)
    monkeypatch.setattr(service, "_notifier_scan_colis", notifier)
    monkeypatch.setattr(service, "_gerants_de_gare", aucun_gerant)
    session = SessionDepartCapture(voyage, [en_attente, recu, direct])

    resultat = asyncio.run(
        service.valider_depart_voyage(
            session,
            voyage.id,
            chauffeur,
            confirmer_colis_non_valides=True,
        )
    )

    assert resultat["nb_colis"] == 2
    assert resultat["nb_colis_retires"] == 1
    assert en_attente.statut == "non_attribue"
    assert en_attente.voyage_id is None
    assert en_attente.chauffeur_id is None
    assert tickets[en_attente.id].voyage_id is None
    assert recu.statut == "en_transit"
    assert direct.statut == "en_transit"
    types_evenements = [
        objet.type_evenement
        for objet in session.ajoutes
        if isinstance(objet, ColisEvenement)
    ]
    assert "retrait_depart" in types_evenements
    assert types_evenements.count("depart") == 2
    audit_retrait = next(
        entree
        for entree in session.ajoutes
        if isinstance(entree, JournalAudit)
        and entree.type_evenement == "colis_retrait_depart"
    )
    assert audit_retrait.donnees_supplementaires["ancien_statut"] == "a_valider"
    assert audit_retrait.donnees_supplementaires["nouveau_statut"] == "non_attribue"
