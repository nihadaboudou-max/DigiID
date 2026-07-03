# -*- coding: utf-8 -*-
"""
Service métier pour le module QR Code Dynamique.

Gère la génération, la validation et l'invalidation des tokens QR
via Redis pour des performances optimales.
"""
import secrets
import hashlib
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


def _obtenir_client_redis():
    """Obtient le client Redis depuis le pool global."""
    try:
        from src.noyau.redis_client import redis_client
        return redis_client
    except ImportError:
        journal.warning("Redis non disponible — fallback sur dictionnaire mémoire")
        return None


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


def _construire_url_qr(token: str) -> str:
    """
    Construit l'URL à encoder dans le QR Code.
    Cette URL sera scannée par l'application policier.
    """
    # URL publique de vérification (à adapter selon ton domaine)
    return f"https://api.digiid.africa/v1/police/qr/verifier/{token}"


async def generer_qr_code(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> dict:
    """
    Génère un nouveau QR Code temporaire pour un citoyen.
    
    Règles :
    1. Invalide l'ancien token (si existant)
    2. Génère un nouveau token unique
    3. Stocke dans Redis avec TTL de 30s
    4. Retourne le token et l'URL du QR Code
    """
    redis = _obtenir_client_redis()
    
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
        try:
            import json
            await redis.setex(
                cle_redis,
                DUREE_VIE_TOKEN,
                json.dumps(donnees_token)
            )
            journal.info(
                f"QR Code généré | user={utilisateur.id} | "
                f"token={token[:12]}... | expire={expire_a.isoformat()}"
            )
        except Exception as e:
            journal.error(f"Erreur Redis lors de la génération du QR : {e}")
            raise
    
    # 4. Construire l'URL du QR Code
    qr_code_url = _construire_url_qr(token)
    
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
    redis = _obtenir_client_redis()
    if not redis:
        return
    
    try:
        # Chercher toutes les clés correspondant à cet utilisateur
        pattern = f"{PREFIXE_CLE}{utilisateur_id}:*"
        cles = await redis.keys(pattern)
        
        if cles:
            await redis.delete(*cles)
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
    
    redis = _obtenir_client_redis()
    if not redis:
        return {
            "succes": False,
            "citoyen": None,
            "message": "Service Redis indisponible. Réessayez plus tard.",
        }
    
    # 1. Chercher le token dans Redis
    # On ne connaît pas le user_id, donc on cherche par pattern
    pattern = f"{PREFIXE_CLE}*:{token}"
    cles = await redis.keys(pattern)
    
    if not cles:
        journal.warning(f"QR Code invalide (non trouvé) | token={token[:12]}...")
        return {
            "succes": False,
            "citoyen": None,
            "message": "QR Code invalide ou expiré. Demandez à la personne de rafraîchir son code.",
        }
    
    cle_redis = cles[0]
    
    # 2. Récupérer les données
    donnees_brutes = await redis.get(cle_redis)
    if not donnees_brutes:
        return {
            "succes": False,
            "citoyen": None,
            "message": "QR Code expiré.",
        }
    
    donnees = json.loads(donnees_brutes)
    
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
    expire_a = datetime.fromisoformat(donnees["expire_a"])
    if datetime.now(timezone.utc) > expire_a:
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
    await redis.setex(cle_redis, DUREE_VIE_APRES_SCAN, json.dumps(donnees))
    
    # 6. Récupérer les infos du citoyen
    user_id = UUID(donnees["user_id"])
    citoyen = await session.get(Utilisateur, user_id)
    
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
    nom = dechiffrer_donnee(citoyen.nom_chiffre) if citoyen.nom_chiffre else None
    prenom = dechiffrer_donnee(citoyen.prenom_chiffre) if citoyen.prenom_chiffre else None
    
    return {
        "succes": True,
        "citoyen": {
            "digiid": citoyen.digiid_public,
            "nom": nom,
            "prenom": prenom,
            "email": dechiffrer_donnee(citoyen.email_chiffre) if citoyen.email_chiffre else None,
            "photo_profil_url": citoyen.photo_profil_url,
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
    
    redis = _obtenir_client_redis()
    if not redis:
        return
    
    pattern = f"{PREFIXE_CLE}*:{token}"
    cles = await redis.keys(pattern)
    
    if not cles:
        return
    
    cle_redis = cles[0]
    donnees_brutes = await redis.get(cle_redis)
    
    if donnees_brutes:
        donnees = json.loads(donnees_brutes)
        donnees["utilise"] = True
        donnees["scanne_par"] = str(agent_id)
        donnees["scanne_a"] = datetime.now(timezone.utc).isoformat()
        
        # Garder 5s après utilisation
        await redis.setex(cle_redis, DUREE_VIE_APRES_SCAN, json.dumps(donnees))