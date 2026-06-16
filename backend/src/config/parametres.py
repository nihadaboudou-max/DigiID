# -*- coding: utf-8 -*-
"""
Paramètres centralisés de l'application DigiID.

Tous les paramètres sont lus depuis les variables d'environnement (.env)
via Pydantic Settings. L'objet `parametres` est exposé comme singleton
et utilisé partout dans l'application.

Avantage : aucune variable d'environnement n'est lue ailleurs dans le code.
On modifie le .env, on relance l'app, c'est tout.
"""
import urllib.parse
from functools import lru_cache
from typing import List, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ParametresApplication(BaseSettings):
    """
    Toutes les variables d'environnement de DigiID, typées et validées.

    Pydantic se charge automatiquement de :
      - lire les variables depuis .env
      - convertir les types (str -> int, str -> bool, etc.)
      - valider les valeurs (et lever une erreur claire si invalide)
    """

    # --- Application ---
    environnement: Literal["developpement", "test", "production"] = "developpement"
    nom_application: str = "DigiID"
    version_api: str = "v1"
    activer_debug: bool = False

    # --- Sécurité ---
    cle_secrete_jwt: str = Field(..., min_length=32,
                                  description="Clé pour signer les JWT — minimum 32 caractères")
    cle_chiffrement_donnees: str = Field(..., min_length=16,
                                          description="Clé maître pour le chiffrement AES — 32 octets en base64 (ou chaîne dérivée via HKDF)")
    algorithme_jwt: str = "HS256"
    duree_token_acces_minutes: int = 15
    duree_token_rafraichissement_jours: int = 7

    # --- Base de données PostgreSQL ---
    postgres_host: str = "base_donnees"
    postgres_port: int = 5432
    postgres_utilisateur: str
    postgres_mot_de_passe: str
    postgres_nom_base: str = "digiid"

    # --- Redis (cache + sessions + Celery) ---
    redis_host: str = "cache"
    redis_port: int = 6379
    redis_mot_de_passe: str = ""

    # --- LLM (chatbot) ---
    fournisseur_llm: Literal["ollama", "groq", "openrouter"] = "ollama"
    ollama_url: str = "http://ollama:11434"
    ollama_modele: str = "mistral:7b-instruct"
    groq_api_key: str = ""
    groq_modele: str = "llama-3.3-70b-versatile"
    openrouter_api_key: str = ""
    openrouter_modele: str = "meta-llama/llama-3.3-70b-instruct:free"

    # --- Vector store (RAG chatbot) ---
    chromadb_host: str = "base_vectorielle"
    chromadb_port: int = 8000

    # --- Reconnaissance faciale ---
    modele_face_recognition: Literal["insightface", "dlib"] = "insightface"
    seuil_similarite_visage: float = 0.6
    activer_liste_personnes_recherchees: bool = False

    # --- Monitoring ---
    niveau_journal: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    sentry_dsn: str = ""
    activer_metriques_prometheus: bool = True

    # --- CORS ---
    origines_autorisees: str = "http://localhost:3000,https://digiid-frontend.onrender.com"
    url_frontend: str = "https://digiid-frontend.onrender.com"

    # --- Limitations de débit ---
    limite_requetes_par_minute_anonyme: int = 20
    limite_requetes_par_minute_authentifie: int = 120
    limite_requetes_par_minute_admin: int = 300

    # --- Détection de fraude ---
    seuil_score_risque_blocage: int = 80
    seuil_tentatives_connexion_echec: int = 5

                    # --- 2FA ---
    activer_2fa_obligatoire_admin: bool = True
    duree_validite_code_2fa_secondes: int = 300

    # --- Email (Resend) ---
    resend_api_key: str = ""
    email_expediteur: str = "DigiID <bigdataism2024@gmail.com>"

    # --- Email (SMTP Gmail - utilise le mot de passe d'application) ---
    smtp_serveur: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_utilisateur: str = "bigdataism2024@gmail.com"
    smtp_mot_de_passe: str = ""

    # --- Email (SendGrid - API HTTP, fonctionne sur Render) ---
    sendgrid_api_key: str = ""

    # --- Configuration Pydantic ---
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Validations et propriétés calculées ---

    @field_validator("cle_chiffrement_donnees")
    @classmethod
    def valider_cle_chiffrement(cls, valeur: str) -> str:
        """Vérifie que la clé de chiffrement est utilisable (base64 + 32 octets ou n'importe quelle chaîne)."""
        if not valeur or len(valeur) < 16:
            raise ValueError(
                "CLE_CHIFFREMENT_DONNEES est trop courte (minimum 16 caractères). "
                "Générer une clé : python -c \"import os, base64; print(base64.b64encode(os.urandom(32)).decode())\""
            )
        # Vérifier si c'est du base64 valide
        try:
            import base64
            cle = base64.b64decode(valeur)
            if len(cle) != 32:
                # Pas 32 octets en base64 — pas grave, HKDF va dériver
                pass
        except Exception:
            # Pas du base64 — pas grave, HKDF va dériver la clé
            pass
        return valeur

    @field_validator("cle_secrete_jwt")
    @classmethod
    def valider_cle_jwt(cls, valeur: str) -> str:
        """Empêche d'utiliser la valeur par défaut en production."""
        if "changer_cette_cle" in valeur:
            raise ValueError(
                "CLE_SECRETE_JWT contient encore la valeur par défaut. "
                "Générer une vraie clé : python -c \"import secrets; print(secrets.token_urlsafe(64))\""
            )
        return valeur

    @property
    def url_base_donnees(self) -> str:
        """URL SQLAlchemy async pour PostgreSQL."""
        mot_de_passe_encode = urllib.parse.quote(self.postgres_mot_de_passe, safe='')
        return (
            f"postgresql+asyncpg://{self.postgres_utilisateur}:"
            f"{mot_de_passe_encode}@{self.postgres_host}:"
            f"{self.postgres_port}/{self.postgres_nom_base}"
        )

    @property
    def url_base_donnees_sync(self) -> str:
        """URL SQLAlchemy synchrone pour Alembic et scripts."""
        mot_de_passe_encode = urllib.parse.quote(self.postgres_mot_de_passe, safe='')
        return (
            f"postgresql+psycopg2://{self.postgres_utilisateur}:"
            f"{mot_de_passe_encode}@{self.postgres_host}:"
            f"{self.postgres_port}/{self.postgres_nom_base}"
        )

    @property
    def url_redis(self) -> str:
        """URL Redis complète."""
        mot_de_passe = f":{self.redis_mot_de_passe}@" if self.redis_mot_de_passe else ""
        return f"redis://{mot_de_passe}{self.redis_host}:{self.redis_port}/0"

    @property
    def liste_origines_autorisees(self) -> List[str]:
        """Convertit la chaîne CSV en liste pour FastAPI CORS."""
        return [origine.strip() for origine in self.origines_autorisees.split(",") if origine.strip()]

    @property
    def est_production(self) -> bool:
        return self.environnement == "production"

    @property
    def est_developpement(self) -> bool:
        return self.environnement == "developpement"


@lru_cache
def charger_parametres() -> ParametresApplication:
    """
    Charge les paramètres une seule fois (cache LRU).
    Toutes les parties de l'application réutilisent cette instance.
    """
    return ParametresApplication()


# Singleton accessible partout : `from src.config import parametres`
parametres = charger_parametres()
