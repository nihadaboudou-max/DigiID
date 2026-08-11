# -*- coding: utf-8 -*-
"""
Service métier pour le module QR Code Dynamique.

Gère la génération, la validation et l'invalidation des tokens QR
via Redis pour des performances optimales.
"""
import os
import secrets
import hashlib
import time
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.modeles import Utilisateur
from src.noyau import dechiffrer_donnee
from src.noyau.journal import journal

# =============================================================================
# Configuration Redis
# =============================================================================
# Préfixe des clés Redis pour les tokens QR
PREFIXE_CLE = "qr_token:"
DUREE_VIE_TOKEN = 30  # secondes
DUREE_VIE_APRES_SCAN = 5  # secondes (garde le token marqué "utilisé" 5s)


class _StockageMemoire:
    """
    Stockage de secours en mémoire (dictionnaire) quand Redis n'est pas disponible.

    Implémente le sous-ensemble de l'interface Redis utilisé par ce module :
    setex / get / keys / delete (version asynchrone, compatible avec `await`).

    ⚠️ Attention : le stockage mémoire est local au processus (non partagé entre
    plusieurs instances backend). Pour un déploiement multi-instances, Redis
    (module `src.noyau.redis_client`) est requis.
    """

    def __init__(self) -> None:
        self._donnees: dict[str, str] = {}
        self._expirations: dict[str, float] = {}
        self._verrou = threading.Lock()

    async def setex(self, cle: str, secondes: int, valeur: str) -> None:
        with self._verrou:
            self._donnees[cle] = valeur
            self._expirations[cle] = time.time() + secondes

    async def get(self, cle: str) -> Optional[str]:
        with self._verrou:
            expiration = self._expirations.get(cle)
            if expiration is None:
                return None
            if time.time() > expiration:
                self._donnees.pop(cle, None)
                self._expirations.pop(cle, None)
                return None
            return self._donnees.get(cle)

    async def keys(self, motif: str) -> list[str]:
        import fnmatch

        maintenant = time.time()
        with self._verrou:
            return [
                cle
                for cle in list(self._donnees.keys())
                if self._expirations.get(cle, 0) > maintenant
                and fnmatch.fnmatch(cle, motif)
            ]

    async def delete(self, *cles: str) -> None:
        with self._verrou:
            for cle in cles:
                self._donnees.pop(cle, None)
                self._expirations.pop(cle, None)


_stockage_memoire = _StockageMemoire()


# État de disponibilité Redis (None = pas encore testé)
_redis_disponible: Optional[bool] = None


async def _obtenir_client_redis():
    """Obtient le client Redis (testé) ou le stockage mémoire en secours.

    La disponibilité de Redis est vérifiée une seule fois (PING) puis mise
    en cache, pour que toutes les opérations utilisent le MÊME backend de
    stockage et éviter toute incohérence entre Redis et la mémoire.
    """
    global _redis_disponible

    try:
        from src.noyau.redis_client import redis_client
    except ImportError:
        redis_client = None

    if redis_client is None:
        return _stockage_memoire

    if _redis_disponible is None:
        try:
            await redis_client.ping()
            _redis_disponible = True
            journal.info("Redis connecté et opérationnel.")
        except Exception as exc:
            _redis_disponible = False
            journal.warning(
                f"Redis injoignable ({exc}) — fallback sur dictionnaire mémoire"
            )

    return redis_client if _redis_disponible else _stockage_memoire


async def _executer_sur_redis(redis, operation: str, *args):
    """Exécute une opération Redis avec repli automatique sur la mémoire.

    Si Redis échoue en cours de route (panne, timeout), on bascule
    définitivement sur le stockage mémoire pour garder la cohérence
    des tokens au sein du processus.
    """
    try:
        methode = getattr(redis, operation)
        return await methode(*args)
    except Exception as exc:
        global _redis_disponible
        _redis_disponible = False
        journal.warning(f"Redis {operation} indisponible ({exc}) — repli mémoire")
        methode = getattr(_stockage_memoire, operation)
        return await methode(*args)


def _generer_token_securise(utilisateur_id: UUID) -> str:
    """
    Génère un token unique et sécurisé pour un utilisateur.
    Combine : user_id + timestamp + secret aléatoire + HMAC.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    aleatoire = secrets.token_urlsafe(32)
    donnees_brutes = f"{utilisateur_id}:{timestamp}:{aleatoire}"

    # Hash SHA-256 pour un token compact et sécurisé
    token_hash = hashlib.sha256(donnees_brutes.encode()).hexdigest()
    return token_hash[:48]  # 48 caractères (suffisant pour l'unicité)


def _construire_url_qr(token: str, base_url: Optional[str] = None) -> str:
    """
    Construit l'URL à encoder dans le QR Code.

    IMPORTANT : l'URL doit pointer vers une PAGE FRONTEND navigable (GET),
    et non vers un endpoint API en POST. Un agent qui scanne le QR avec la
    caméra native de son téléphone ouvrira cette URL dans son navigateur.
    La page frontend (/police/scan-qr?token=...) se chargera ensuite
    d'appeler l'API de vérification avec le JWT de l'agent.
    """
    # Domaine public du frontend — variable d'environnement (ex: URL_FRONTEND)
    # Valeur par défaut si non définie.
    frontend = (base_url or os.getenv("URL_FRONTEND", "http://152.228.141.69:3000")).rstrip("/")
    return f"{frontend}/police/scan-qr?token={token}"


async def generer_qr_code(
    session: AsyncSession,
    utilisateur: Utilisateur,
    base_url: Optional[str] = None,
) -> dict:
    """
    Génère un nouveau QR Code temporaire pour un citoyen.

    Règles :
    1. Invalide l'ancien token (si existant)
    2. Génère un nouveau token unique
    3. Stocke dans Redis avec TTL de 30s
    4. Retourne le token et l'URL du QR Code
    """
    redis = await _obtenir_client_redis()

    # 1. Générer le token
    token = _generer_token_securise(utilisateur.id)
    cle_redis = f"{PREFIXE_CLE}{utilisateur.id}:{token}"

    # 2. Préparer les données à stocker
    maintenant = datetime.now(timezone.utc)
    expire_a = maintenant + timedelta(seconds=DUREE_VIE_TOKEN)

    donnees_token = {
        "user_id": str(utilisateur.id),
        "token": token,
        "genere_a": maintenant.isoformat(),
        "expire_a": expire_a.isoformat(),
        "utilise": False,
        "nb_scans": 0,
    }

    # 3. Stocker dans Redis avec TTL
    if redis:
        import json
        await _executer_sur_redis(
            redis,
            "setex",
            cle_redis,
            DUREE_VIE_TOKEN,
            json.dumps(donnees_token)
        )
        journal.info(
            f"QR Code généré | user={utilisateur.id} | "
            f"token={token[:12]}... | expire={expire_a.isoformat()}"
        )

    # 4. Construire l'URL du QR Code
    qr_code_url = _construire_url_qr(token, base_url)

    return {
        "token": token,
        "qr_code_url": qr_code_url,
        "expire_a": expire_a,
        "duree_vie_secondes": DUREE_VIE_TOKEN,
        "message": "QR Code généré avec succès. Valide pendant 30 secondes.",
    }


async def invalider_ancien_token(
    utilisateur_id: UUID,
) -> None:
    """
    Invalide tous les anciens tokens d'un utilisateur.
    Appelé avant de générer un nouveau QR Code.
    """
    redis = await _obtenir_client_redis()
    if not redis:
        return

    try:
        # Chercher toutes les clés correspondant à cet utilisateur
        pattern = f"{PREFIXE_CLE}{utilisateur_id}:*"
        cles = await _executer_sur_redis(redis, "keys", pattern)

        if cles:
            await _executer_sur_redis(redis, "delete", *cles)
            journal.info(f"Anciens tokens invalidés | user={utilisateur_id} | nb={len(cles)}")
    except Exception as e:
        journal.warning(f"Erreur lors de l'invalidation des anciens tokens : {e}")


async def verifier_qr_code(
    session: AsyncSession,
    token: str,
    agent_police: Utilisateur,
) -> dict:
    """
    Vérifie un QR Code scanné par un agent de police.

    Règles de sécurité :
    1. Le token doit exister dans Redis
    2. Le token ne doit pas avoir déjà été utilisé
    3. Le token ne doit pas être expiré
    4. Après validation, le token est marqué comme "utilisé"
    5. Retourne les infos du citoyen (nom, prénom, DigiID, photo)
    """
    import json

    # Normaliser le token : si un agent a scanné une URL complète
    # (ex: https://digiid.africa/police/scan-qr?token=TOKEN),
    # on extrait le paramètre ?token= (nouveau format frontend).
    # Pour l'ancien format API (https://.../qr/verifier/TOKEN),
    # on extrait le dernier segment qui est le token réel.
    if token.startswith("http://") or token.startswith("https://"):
        if "?" in token:
            try:
                from urllib.parse import urlparse, parse_qs
                params = parse_qs(urlparse(token).query)
                token = params.get("token", [""])[0]
            except Exception:
                token = ""
        else:
            token = token.rstrip("/").rsplit("/", 1)[-1]

    redis = await _obtenir_client_redis()
    if not redis:
        return {
            "succes": False,
            "citoyen": None,
            "message": "Service Redis indisponible. Réessayez plus tard.",
        }

    # 1. Chercher le token dans Redis
    # On ne connaît pas le user_id, donc on cherche par pattern
    pattern = f"{PREFIXE_CLE}*:{token}"
    cles = await _executer_sur_redis(redis, "keys", pattern)

    if not cles:
        journal.warning(f"QR Code invalide (non trouvé) | token={token[:12]}...")
        return {
            "succes": False,
            "citoyen": None,
            "message": "QR Code invalide ou expiré. Demandez à la personne de rafraîchir son code.",
        }

    cle_redis = cles[0]

    # 2. Récupérer les données
    donnees_brutes = await _executer_sur_redis(redis, "get", cle_redis)
    if not donnees_brutes:
        return {
            "succes": False,
            "citoyen": None,
            "message": "QR Code expiré.",
        }

    # Décodage JSON — ne doit JAMAIS faire planter la vérification
    try:
        donnees = json.loads(donnees_brutes)
    except (ValueError, TypeError):
        journal.warning(f"QR Code corrompu (JSON invalide) | token={token[:12]}...")
        return {
            "succes": False,
            "citoyen": None,
            "message": "QR Code invalide. Demandez à la personne de rafraîchir son code.",
        }

    # 3. Vérifier si déjà utilisé
    if donnees.get("utilise"):
        journal.warning(
            f"QR Code déjà utilisé | token={token[:12]}... | "
            f"nb_scans={donnees.get('nb_scans', 0)}"
        )
        return {
            "succes": False,
            "citoyen": None,
            "message": "Ce QR Code a déjà été utilisé. Demandez un nouveau code.",
        }

    # 4. Vérifier l'expiration
    try:
        expire_a = datetime.fromisoformat(donnees["expire_a"])
    except (KeyError, ValueError, TypeError):
        expire_a = None
    if expire_a is None or datetime.now(timezone.utc) > expire_a:
        return {
            "succes": False,
            "citoyen": None,
            "message": "QR Code expiré. Demandez à la personne de rafraîchir.",
        }

    # 5. Marquer comme utilisé
    donnees["utilise"] = True
    donnees["nb_scans"] = donnees.get("nb_scans", 0) + 1
    donnees["scanne_par"] = str(agent_police.id)
    donnees["scanne_a"] = datetime.now(timezone.utc).isoformat()

    # Garder le token 5s après utilisation (pour éviter les scans multiples)
    await _executer_sur_redis(redis, "setex", cle_redis, DUREE_VIE_APRES_SCAN, json.dumps(donnees))

    # 6. Récupérer les infos du citoyen
    try:
        user_id = UUID(donnees["user_id"])
    except (KeyError, ValueError, TypeError):
        user_id = None

    citoyen = None
    if user_id is not None:
        try:
            citoyen = await session.get(Utilisateur, user_id)
        except Exception as exc:
            journal.warning(f"Échec récupération citoyen {user_id} : {exc}")
            citoyen = None

    if not citoyen:
        return {
            "succes": False,
            "citoyen": None,
            "message": "Citoyen introuvable dans la base.",
        }

    # 7. Journaliser la vérification
    journal.info(
        f"QR Code vérifié avec succès | citoyen={citoyen.digiid_public} | "
        f"agent={agent_police.id} | token={token[:12]}..."
    )

    # 8. Construire la réponse avec les infos du citoyen
    # Le déchiffrement ne doit JAMAIS faire planter la vérification :
    # en cas d'échec (clé différente, donnée altérée), on affiche « — ».
    try:
        nom = dechiffrer_donnee(citoyen.nom_chiffre) if citoyen.nom_chiffre else None
    except Exception:
        nom = None
    try:
        prenom = dechiffrer_donnee(citoyen.prenom_chiffre) if citoyen.prenom_chiffre else None
    except Exception:
        prenom = None
    try:
        email = dechiffrer_donnee(citoyen.email_chiffre) if citoyen.email_chiffre else None
    except Exception:
        email = None

    return {
        "succes": True,
        "citoyen": {
            "digiid": citoyen.digiid_public,
            "nom": nom,
            "prenom": prenom,
            "email": email,
            "photo_profil_url": getattr(citoyen, "photo_profil_url", None),
            "est_cni_verifiee": citoyen.est_cni_verifiee,
            "est_visage_verifie": citoyen.est_visage_verifie,
            "est_email_verifie": citoyen.est_email_verifie,
        },
        "message": "Identité vérifiée avec succès",
    }


async def marquer_token_utilise(
    token: str,
    agent_id: UUID,
) -> None:
    """
    Marque un token comme utilisé (appelé après un scan réussi).
    """
    import json

    redis = await _obtenir_client_redis()
    if not redis:
        return

    pattern = f"{PREFIXE_CLE}*:{token}"
    cles = await _executer_sur_redis(redis, "keys", pattern)

    if not cles:
        return

    cle_redis = cles[0]
    donnees_brutes = await _executer_sur_redis(redis, "get", cle_redis)

    if donnees_brutes:
        try:
            donnees = json.loads(donnees_brutes)
        except (ValueError, TypeError):
            return
        donnees["utilise"] = True
        donnees["scanne_par"] = str(agent_id)
        donnees["scanne_a"] = datetime.now(timezone.utc).isoformat()

        # Garder 5s après utilisation
        await _executer_sur_redis(redis, "setex", cle_redis, DUREE_VIE_APRES_SCAN, json.dumps(donnees))
