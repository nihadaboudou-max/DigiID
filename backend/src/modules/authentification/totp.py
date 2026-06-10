# -*- coding: utf-8 -*-
"""Génération et vérification TOTP (2FA) via pyotp."""
import base64
import io

import pyotp
import qrcode

from src.config import parametres
from src.noyau.chiffrement import chiffrer_donnee, dechiffrer_donnee


def generer_secret_totp() -> str:
    """Génère un secret base32 compatible Google Authenticator."""
    return pyotp.random_base32()


def construire_uri_provisioning(email: str, secret: str) -> str:
    """URI otpauth:// pour scanner le QR code."""
    return pyotp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name=parametres.nom_application,
    )


def generer_qr_code_base64(uri_provisioning: str) -> str:
    """Encode le QR code en PNG base64 (sans préfixe data:)."""
    image = qrcode.make(uri_provisioning)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def verifier_code_totp(secret_2fa_chiffre: str, code: str) -> bool:
    """
    Vérifie un code TOTP à 6 chiffres contre le secret chiffré en base.

    valid_window=2 accepte le créneau précédent/suivant (±60 s) afin de
    tolérer une légère dérive d'horloge entre le téléphone et le serveur.
    """
    secret = dechiffrer_donnee(secret_2fa_chiffre)
    return pyotp.TOTP(secret).verify(code, valid_window=2)


def chiffrer_secret_totp(secret: str) -> str:
    """Chiffre le secret TOTP avant stockage en base."""
    return chiffrer_donnee(secret)
