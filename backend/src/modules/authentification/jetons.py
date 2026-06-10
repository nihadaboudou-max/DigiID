# -*- coding: utf-8 -*-
"""
Génération et vérification des jetons JWT.

Deux types de jetons :
  - Token d'accès : courte durée (15 min), envoyé à chaque requête, contient le rôle
  - Token de rafraîchissement : longue durée (7 jours), permet d'obtenir un nouveau token d'accès

Sécurité :
  - Algorithme HS256 (HMAC SHA-256)
  - Claim 'jti' (identifiant unique) pour pouvoir révoquer un token spécifique
  - Claim 'iat' (issued at) et 'exp' (expiration)
  - Claim 'type' pour distinguer accès et rafraîchissement
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from pydantic import BaseModel

from src.config import parametres
from src.config.constantes import RolesUtilisateur
from src.noyau.exceptions import ErreurTokenExpire, ErreurTokenInvalide


class ContenuJeton(BaseModel):
    """Données encodées dans un JWT DigiID."""
    sub: str               # Subject : identifiant utilisateur (UUID)
    role: str              # Rôle de l'utilisateur
    type: str              # 'acces' ou 'rafraichissement'
    jti: str               # Identifiant unique du jeton
    iat: int               # Issued at (timestamp)
    exp: int               # Expiration (timestamp)


def _creer_jeton(
    sujet: str,
    role: str,
    type_jeton: str,
    duree: timedelta,
) -> str:
    """Fonction interne — crée un JWT signé."""
    maintenant = datetime.now(timezone.utc)
    contenu = {
        "sub": sujet,
        "role": role,
        "type": type_jeton,
        "jti": str(uuid.uuid4()),
        "iat": int(maintenant.timestamp()),
        "exp": int((maintenant + duree).timestamp()),
    }
    return jwt.encode(
        contenu,
        parametres.cle_secrete_jwt,
        algorithm=parametres.algorithme_jwt,
    )


def creer_token_acces(utilisateur_id: str, role: str) -> str:
    """
    Crée un token d'accès courte durée (15 min par défaut).
    À envoyer dans le header Authorization: Bearer ... à chaque requête.
    """
    return _creer_jeton(
        sujet=utilisateur_id,
        role=role,
        type_jeton="acces",
        duree=timedelta(minutes=parametres.duree_token_acces_minutes),
    )


def creer_token_rafraichissement(utilisateur_id: str, role: str) -> str:
    """
    Crée un token de rafraîchissement longue durée (7 jours).
    Stocké côté serveur (hash) pour pouvoir être révoqué.
    """
    return _creer_jeton(
        sujet=utilisateur_id,
        role=role,
        type_jeton="rafraichissement",
        duree=timedelta(days=parametres.duree_token_rafraichissement_jours),
    )


def decoder_jeton(jeton: str, type_attendu: Optional[str] = None) -> ContenuJeton:
    """
    Décode et vérifie un JWT.

    Arguments :
        jeton : la chaîne JWT à valider.
        type_attendu : si fourni, vérifie que le type correspond ('acces' ou 'rafraichissement').

    Retour :
        Le contenu validé du jeton.

    Lève :
        ErreurTokenExpire si le jeton a expiré.
        ErreurTokenInvalide si la signature est invalide ou si le type ne correspond pas.
    """
    try:
        donnees = jwt.decode(
            jeton,
            parametres.cle_secrete_jwt,
            algorithms=[parametres.algorithme_jwt],
        )
    except jwt.ExpiredSignatureError as erreur:
        raise ErreurTokenExpire("Token expiré") from erreur
    except JWTError as erreur:
        raise ErreurTokenInvalide(f"Token invalide : {erreur}") from erreur

    contenu = ContenuJeton(**donnees)

    if type_attendu is not None and contenu.type != type_attendu:
        raise ErreurTokenInvalide(
            f"Type de jeton invalide : attendu '{type_attendu}', reçu '{contenu.type}'"
        )

    return contenu
