#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os, sys, traceback

def test_imports():
    modules = ["fastapi","sqlalchemy","jose","argon2","loguru","slowapi","pydantic","pydantic_settings","asyncpg","cryptography","pyotp","qrcode"]
    print('\n=== TEST DES IMPORTS ===')
    for mod in modules:
        try:
            __import__(mod)
            print(f'  OK {mod}')
        except Exception as e:
            print(f'  FAIL {mod}: {e}')

def test_config():
    print('\n=== TEST DE LA CONFIGURATION ===')
    try:
        if '/app' not in sys.path: sys.path.insert(0, '/app')
        from src.config import parametres
        print(f'OK: env={parametres.environnement}')
        print(f'DB: {parametres.postgres_utilisateur}@{parametres.postgres_host}:{parametres.postgres_port}')
        print(f'JWT: {len(parametres.cle_secrete_jwt)} car.')
        print(f'CHIFFREMENT: {len(parametres.cle_chiffrement_donnees)} car.')
    except Exception as e:
        print(f'FAIL: {e}')
        traceback.print_exc()

def test_env_vars():
    print('\n=== VARIABLES D ENVIRONNEMENT ===')
    for var in ['ENVIRONNEMENT','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_UTILISATEUR','POSTGRES_NOM_BASE']:
        v = os.getenv(var, 'NON DEFINI')
        print(f'  {var} = {v}')

if __name__ == '__main__':
    print('='*50)
    print('DIAGNOSTIC DIGIID')
    print('='*50)
    print(f'Python: {sys.version}')
    test_env_vars()
    test_imports()
    test_config()
    print()
    print('Copie ce resultat et colle-le ici.')
