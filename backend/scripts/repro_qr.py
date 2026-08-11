# -*- coding: utf-8 -*-
"""
Reproduction du flux QR Code (génération → vérification) avec stubs.

Stube les dépendances manquantes (loguru, redis) et importe le service
directement pour révéler l'exception levée pendant la vérification.
"""
import asyncio
import importlib.util
import os
import sys
import types
from uuid import UUID

# Ajoute la racine backend/ au sys.path pour pouvoir importer 'src'
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# --- Stub loguru (non installé sur le Python système) ---
mod_loguru = types.ModuleType("loguru")


class _FauxLogger:
    def info(self, *a, **k): pass
    def warning(self, *a, **k): pass
    def error(self, *a, **k): pass
    def exception(self, *a, **k): pass
    def debug(self, *a, **k): pass
    def bind(self, **k): return self
    def add(self, *a, **k): pass
    def remove(self, *a, **k): pass


mod_loguru.logger = _FauxLogger()
sys.modules["loguru"] = mod_loguru

# --- Stub redis (non installé) ---
mod_redis = types.ModuleType("redis")
mod_aioredis = types.ModuleType("redis.asyncio")
mod_redis.asyncio = mod_aioredis
sys.modules["redis"] = mod_redis
sys.modules["redis.asyncio"] = mod_aioredis

# --- Stub asyncpg (pilote PostgreSQL non installé sur le Python système) ---
sys.modules["asyncpg"] = types.ModuleType("asyncpg")


class UtilisateurStub:
    """Représente un citoyen en base (champs utilisés par verifier_qr_code)."""
    def __init__(self):
        self.id = UUID("12345678-1234-5678-1234-567812345678")
        self.digiid_public = "DIGIID-TEST-0001"
        self.nom_chiffre = None
        self.prenom_chiffre = None
        self.email_chiffre = None
        self.photo_profil_url = None
        self.est_cni_verifiee = True
        self.est_visage_verifie = True
        self.est_email_verifie = False


class AgentStub:
    def __init__(self):
        self.id = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")


class SessionStub:
    def __init__(self, citoyen):
        self.citoyen = citoyen

    async def get(self, modele, identifiant):
        return self.citoyen


def charger_service():
    """Importe src.modules.qr_dynamique.service sans passer par __init__ (routes/DB)."""
    spec = importlib.util.spec_from_file_location(
        "service_qr_dynamique", "src/modules/qr_dynamique/service.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["service_qr_dynamique"] = module
    spec.loader.exec_module(module)
    return module


async def principal():
    service = charger_service()

    citoyen = UtilisateurStub()
    session = SessionStub(citoyen)
    agent = AgentStub()

    print("=== 1. Génération du QR ===")
    genere = await service.generer_qr_code(session, citoyen)
    print(f"   OK token={genere['token'][:12]}... url={genere['qr_code_url']}")

    print("=== 1bis. Génération avec base_url (ngrok/HTTPS) ===")
    genere_ngrok = await service.generer_qr_code(
        session, citoyen, base_url="https://abcd-12-34.ngrok-free.app"
    )
    print(f"   OK url={genere_ngrok['qr_code_url']}")

    print("=== 1ter. Génération avec base_url IP HTTP ===")
    genere_ip = await service.generer_qr_code(
        session, citoyen, base_url="http://152.228.141.69:3000"
    )
    print(f"   OK url={genere_ip['qr_code_url']}")

    print("=== 2. Vérification avec le token brut ===")
    resultat = await service.verifier_qr_code(session, genere["token"], agent)
    print(f"   succes={resultat.get('succes')} message={resultat.get('message')}")

    print("=== 3. Vérification avec l'URL complète (scan caméra native) ===")
    genere2 = await service.generer_qr_code(session, citoyen)
    resultat2 = await service.verifier_qr_code(session, genere2["qr_code_url"], agent)
    print(f"   succes={resultat2.get('succes')} message={resultat2.get('message')}")

    print("=== 4. Double scan (token déjà utilisé) ===")
    resultat3 = await service.verifier_qr_code(session, genere2["token"], agent)
    print(f"   succes={resultat3.get('succes')} message={resultat3.get('message')}")

    print("\nOK: aucune exception levee pendant le flux complet.")


if __name__ == "__main__":
    try:
        asyncio.run(principal())
    except Exception as exc:
        import traceback
        traceback.print_exc()
        sys.exit(1)
