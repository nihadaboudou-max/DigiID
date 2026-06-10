# -*- coding: utf-8 -*-
"""
Script utilitaire — génère les clés secrètes pour le fichier .env.

Usage :
    python scripts/generer_cles.py

Affiche les deux clés à copier dans .env :
    - CLE_SECRETE_JWT (pour signer les JWT)
    - CLE_CHIFFREMENT_DONNEES (pour chiffrer les données en base)

À exécuter UNE SEULE FOIS, lors de la première installation.
Ne JAMAIS partager ces clés.
"""
import base64
import os
import secrets


def generer_cles():
    cle_jwt = secrets.token_urlsafe(64)
    cle_chiffrement = base64.b64encode(os.urandom(32)).decode("ascii")

    print("=" * 70)
    print("Clés générées pour DigiID")
    print("=" * 70)
    print()
    print("⚠️  Copier ces valeurs dans le fichier backend/.env :")
    print()
    print(f"CLE_SECRETE_JWT={cle_jwt}")
    print()
    print(f"CLE_CHIFFREMENT_DONNEES={cle_chiffrement}")
    print()
    print("=" * 70)
    print("Ne JAMAIS commiter ces clés dans Git.")
    print("Si compromises : les régénérer + ré-encrypter toutes les données.")
    print("=" * 70)


if __name__ == "__main__":
    generer_cles()
