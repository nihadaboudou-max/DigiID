# -*- coding: utf-8 -*-
"""
Module de chiffrement et de gestion des secrets DigiID.

Fonctions exposées :
  - Hachage de mots de passe (Argon2id, résistant aux GPU/ASIC)
  - Vérification de mots de passe
  - Chiffrement symétrique de données sensibles (AES-256-GCM)
  - Déchiffrement
  - Génération de jetons aléatoires sécurisés

Sécurité :
  - Argon2id est l'algorithme recommandé par l'OWASP en 2024
  - AES-256-GCM fournit confidentialité ET intégrité (authenticated encryption)
  - Les clés sont lues depuis l'environnement, jamais codées en dur
"""
import base64
import os
import secrets
from typing import Tuple

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

from src.config import parametres


# -----------------------------------------------------------------------------
# Hachage de mots de passe — Argon2id
# -----------------------------------------------------------------------------

# Paramètres Argon2id recommandés par OWASP (2024) :
#   - time_cost = 3 (3 itérations)
#   - memory_cost = 64 Mo
#   - parallelism = 4
# Ces paramètres prennent ~50 ms par hash sur un serveur moderne,
# ce qui rend les attaques par force brute prohibitives.
_hacheur = PasswordHasher(
    time_cost=3,
    memory_cost=65536,   # 64 Mo en kibioctets
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hacher_mot_de_passe(mot_de_passe_clair: str) -> str:
    """
    Hache un mot de passe en clair pour stockage en base.

    Arguments :
        mot_de_passe_clair : le mot de passe tel que tapé par l'utilisateur.

    Retour :
        Le hash Argon2id sous forme de chaîne — inclut sel et paramètres.
    """
    return _hacheur.hash(mot_de_passe_clair)


def verifier_mot_de_passe(mot_de_passe_clair: str, hash_stocke: str) -> bool:
    """
    Vérifie qu'un mot de passe en clair correspond bien à un hash stocké.

    Arguments :
        mot_de_passe_clair : le mot de passe que l'utilisateur vient de taper.
        hash_stocke : le hash récupéré en base de données.

    Retour :
        True si le mot de passe est correct, False sinon.

    Note :
        Cette fonction prend ~50 ms même en cas d'échec — c'est volontaire,
        ça protège contre les attaques par timing.
    """
    try:
        _hacheur.verify(hash_stocke, mot_de_passe_clair)
        return True
    except (VerifyMismatchError, InvalidHashError):
        return False


def hash_necessite_mise_a_jour(hash_stocke: str) -> bool:
    """
    Indique si un hash a été créé avec des paramètres obsolètes et
    doit être recalculé. À appeler après chaque vérification réussie
    pour mettre à jour les vieux hashs à la prochaine connexion.
    """
    return _hacheur.check_needs_rehash(hash_stocke)


# -----------------------------------------------------------------------------
# Chiffrement symétrique de données sensibles — AES-256-GCM
# -----------------------------------------------------------------------------

def _obtenir_cle_chiffrement() -> bytes:
    """
    Récupère la clé maître de chiffrement depuis la configuration.

    La clé peut être :
    1. Une chaîne base64 représentant 32 octets (format recommandé)
    2. N'importe quelle chaîne de caractères (convertie via HKDF en 32 octets)

    Cette flexibilité évite les erreurs 500 lorsque Render génère
    automatiquement une clé via `generateValue: true` (qui n'est pas du base64 valide).
    """
    cle_brute = parametres.cle_chiffrement_donnees

    if not cle_brute:
        raise ValueError(
            "CLE_CHIFFREMENT_DONNEES est vide. "
            "Générer une clé : python -c \"import os, base64; print(base64.b64encode(os.urandom(32)).decode())\""
        )

    # Essayer d'abord en base64 (format natif optimal)
    try:
        cle = base64.b64decode(cle_brute)
        if len(cle) == 32:
            return cle
    except Exception:
        pass  # Ce n'est pas du base64, on utilise HKDF

    # Fallback : dériver une clé de 32 octets via HKDF-SHA256
    # Cela permet d'utiliser n'importe quelle chaîne (même `generateValue: true` de Render)
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"digiid-encryption-key-v1",
    )
    return hkdf.derive(cle_brute.encode("utf-8"))


def chiffrer_donnee(donnee_claire: str) -> str:
    """
    Chiffre une chaîne de caractères avec AES-256-GCM.

    Arguments :
        donnee_claire : la donnée à protéger (ex : numéro de téléphone, donnée bancaire).

    Retour :
        Chaîne base64 contenant [nonce 12 octets || donnée chiffrée || tag d'authentification].
        Cette chaîne peut être stockée directement en base.

    Note :
        Chaque chiffrement utilise un nonce aléatoire — la même donnée chiffrée
        deux fois produit deux résultats différents, ce qui empêche les attaques
        par analyse de fréquence.
    """
    if not donnee_claire:
        return ""

    cle = _obtenir_cle_chiffrement()
    aes = AESGCM(cle)
    nonce = os.urandom(12)  # 96 bits, taille recommandée pour GCM
    donnee_chiffree = aes.encrypt(nonce, donnee_claire.encode("utf-8"), None)
    enveloppe = nonce + donnee_chiffree
    return base64.b64encode(enveloppe).decode("ascii")


def dechiffrer_donnee(donnee_chiffree_base64: str) -> str:
    """
    Déchiffre une donnée préalablement chiffrée par `chiffrer_donnee`.

    Arguments :
        donnee_chiffree_base64 : la chaîne base64 récupérée depuis la base.

    Retour :
        La donnée originale en clair.

    Lève :
        ValueError si la donnée a été altérée (vérification GCM échoue).
    """
    if not donnee_chiffree_base64:
        return ""

    cle = _obtenir_cle_chiffrement()
    aes = AESGCM(cle)
    enveloppe = base64.b64decode(donnee_chiffree_base64)
    nonce, donnee_chiffree = enveloppe[:12], enveloppe[12:]

    try:
        donnee_claire = aes.decrypt(nonce, donnee_chiffree, None)
        return donnee_claire.decode("utf-8")
    except Exception as erreur:
        raise ValueError("Impossible de déchiffrer : la donnée a été altérée ou la clé est invalide.") from erreur


# -----------------------------------------------------------------------------
# Génération de jetons aléatoires
# -----------------------------------------------------------------------------

def generer_token_aleatoire(longueur_octets: int = 32) -> str:
    """
    Génère un jeton aléatoire cryptographiquement sûr, encodé en URL-safe.

    Utilisé pour :
      - Jetons de réinitialisation de mot de passe
      - Jetons de vérification d'email
      - Identifiants de session
      - Codes d'invitation
    """
    return secrets.token_urlsafe(longueur_octets)


def generer_paire_cles_test() -> Tuple[str, str]:
    """
    Utilitaire — génère une paire (clé JWT, clé chiffrement) pour les tests
    ou la configuration initiale. À utiliser une fois, à mettre dans .env.
    """
    cle_jwt = secrets.token_urlsafe(64)
    cle_chiffrement = base64.b64encode(os.urandom(32)).decode("ascii")
    return cle_jwt, cle_chiffrement
