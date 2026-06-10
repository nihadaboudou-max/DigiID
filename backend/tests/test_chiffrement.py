# -*- coding: utf-8 -*-
"""Tests unitaires du module chiffrement."""
import pytest

from src.noyau.chiffrement import (
    hacher_mot_de_passe,
    verifier_mot_de_passe,
    chiffrer_donnee,
    dechiffrer_donnee,
    generer_token_aleatoire,
)


class TestHachageMotDePasse:
    """Vérifie qu'on peut hacher puis vérifier un mot de passe."""

    def test_hash_different_chaque_fois(self):
        """Deux hashs du même mot de passe doivent différer (sels différents)."""
        h1 = hacher_mot_de_passe("MonMotDePasse123!")
        h2 = hacher_mot_de_passe("MonMotDePasse123!")
        assert h1 != h2

    def test_verification_correcte(self):
        """La vérification doit réussir avec le bon mot de passe."""
        h = hacher_mot_de_passe("MonMotDePasse123!")
        assert verifier_mot_de_passe("MonMotDePasse123!", h) is True

    def test_verification_incorrecte(self):
        """La vérification doit échouer avec un mauvais mot de passe."""
        h = hacher_mot_de_passe("MonMotDePasse123!")
        assert verifier_mot_de_passe("MauvaisMotDePasse", h) is False

    def test_verification_hash_invalide(self):
        """La vérification doit échouer proprement avec un hash invalide."""
        assert verifier_mot_de_passe("test", "hash_corrompu") is False


class TestChiffrementSymetrique:
    """Vérifie le chiffrement et déchiffrement AES-256-GCM."""

    def test_aller_retour_simple(self):
        """Une donnée chiffrée puis déchiffrée doit être identique."""
        original = "amadou.diop@digiid.africa"
        chiffre = chiffrer_donnee(original)
        dechiffre = dechiffrer_donnee(chiffre)
        assert dechiffre == original

    def test_chiffrement_donne_resultat_different(self):
        """Deux chiffrements de la même donnée doivent différer (nonce aléatoire)."""
        original = "donnee sensible"
        c1 = chiffrer_donnee(original)
        c2 = chiffrer_donnee(original)
        assert c1 != c2

    def test_chiffrement_chaine_vide(self):
        """Une chaîne vide en entrée doit renvoyer une chaîne vide."""
        assert chiffrer_donnee("") == ""
        assert dechiffrer_donnee("") == ""

    def test_dechiffrement_alteration_detecte(self):
        """Une donnée altérée doit lever une erreur (GCM tag check)."""
        chiffre = chiffrer_donnee("important")
        # Altérer un caractère
        altere = chiffre[:-2] + "XX"
        with pytest.raises(ValueError):
            dechiffrer_donnee(altere)


class TestGenerationToken:
    """Vérifie la génération de tokens aléatoires."""

    def test_token_unique(self):
        """Deux tokens consécutifs doivent différer."""
        assert generer_token_aleatoire() != generer_token_aleatoire()

    def test_longueur_minimale(self):
        """Le token doit avoir une longueur raisonnable."""
        assert len(generer_token_aleatoire()) >= 32
