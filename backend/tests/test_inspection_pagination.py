"""Vérifie la pagination serveur de l'historique des documents."""
import asyncio
import uuid

from src.modules.inspection_documents import service


class _Scalars:
    def all(self):
        return []


class _Resultat:
    def scalars(self):
        return _Scalars()


class _SessionCapture:
    def __init__(self):
        self.requete_total = None
        self.requete_page = None

    async def scalar(self, requete):
        self.requete_total = requete
        return 12

    async def execute(self, requete):
        self.requete_page = requete
        return _Resultat()


def test_obtenir_historique_limite_et_decale_cote_serveur():
    session = _SessionCapture()
    utilisateur = type("UtilisateurTest", (), {"id": uuid.uuid4()})()

    resultat = asyncio.run(
        service.obtenir_historique(
            session,
            utilisateur,
            limite=5,
            decalage=5,
        )
    )

    requete_page = session.requete_page
    sql_page = str(requete_page.compile()).lower()
    parametres_page = requete_page.compile().params
    sql_total = str(session.requete_total.compile()).lower()

    assert "inspection_documents.utilisateur_id" in sql_total
    assert "inspection_documents.est_supprime" in sql_total
    assert "inspection_documents.utilisateur_id" in sql_page
    assert " limit " in sql_page
    assert " offset " in sql_page
    assert 5 in parametres_page.values()
    assert resultat.historique == []
    assert resultat.limite == 5
    assert resultat.total == 12
