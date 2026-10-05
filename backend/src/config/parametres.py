# -*- coding: utf-8 -*-
"""
Paramètres centralisés de l'application DigiID.

Tous les paramètres sont lus depuis les variables d'environnement (.env)
via Pydantic Settings. L'objet `parametres` est exposé comme singleton
et utilisé partout dans l'application.

Avantage : aucune variable d'environnement n'est lue ailleurs dans le code.
On modifie le .env, on relance l'app, c'est tout.
"""
import os
import urllib.parse
from functools import lru_cache
from typing import List, Literal

from pydantic import AliasChoices, Field, field_validator
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

    # --- Stockage local des photos (visage / documents) ---
    dossier_medias: str = "media"

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

    # --- Vision / Extraction de documents (VLM) ---
    # Modèle stabilisé chez Groq (prod) ; Ollama (dev) utilise un petit modèle local.
    groq_modele_vision: str = "llama-3.2-11b-vision-preview"
    ollama_modele_vision: str = "qwen2.5vl:3b"
    # False = reprise en OCR classique seul (mode « conformité stable »)
    activer_extraction_vlm: bool = True

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
    origines_autorisees: str = "http://localhost:3000"
    url_frontend: str = os.getenv("URL_FRONTEND", "http://localhost:3000")

    # --- Limitations de débit ---
    limite_requetes_par_minute_anonyme: int = 20
    limite_requetes_par_minute_authentifie: int = 120
    limite_requetes_par_minute_admin: int = 300

    # --- Détection de fraude ---
    seuil_score_risque_blocage: int = 80
    seuil_tentatives_connexion_echec: int = 5

    # --- Paiement & frais de service colis (Plan B — S6) ---
    # Le CLIENT paie un **frais de service par colis**, calculé désormais selon le
    # **nombre d'articles** contenus dans ce colis (et non plus selon un décompte
    # mensuel cumulatif de colis suivis). Le prix de transport du colis reste une
    # information **facultative** du guichet : il n'est jamais encaissé par DigiID
    # (on évite ainsi de donner l'impression de surveiller les revenus du
    # transporteur).
    #
    # Barème par paliers d'articles : « min-max:frais:commission » par palier,
    # séparés par des virgules. Une borne max vide (ou suffixée « + ») désigne un
    # palier **ouvert** (« plus de 10 articles »).
    #   « 1-3:100:25,4-6:200:50,7-10:350:80,11+:500:150 »
    # = 100 F (commission 25 F) pour 1-3 articles, 200 F (50 F) pour 4-6,
    #   350 F (80 F) pour 7-10, et 500 F (150 F) au-delà de 10 articles.
    bareme_frais_service_colis: str = (
        "1-3:100:25,4-6:200:50,7-10:350:80,11+:500:150"
    )
    # Compte prépayé de l'agent : montant débité **automatiquement** du compte
    # de l'agent à chaque scan d'un colis réglé en espèces (0 pour désactiver).
    frais_scan_agent_fcfa: int = 100
    # Tarification **fixe** du service de traçabilité et de suivi familial :
    # strictement 100 FCFA par passager/enfant, **quel que soit** le nombre de
    # bagages transportés (le nombre de sacs sert à la traçabilité et à la
    # vérification anti-fraude à l'arrivée, il n'impacte jamais le prix).
    frais_service_passager_fcfa: int = 100
    # Opérateur mobile money activé (mode mock en développement) : "wave".
    operateur_mobile_money: str = "wave"

                    # --- 2FA ---
    activer_2fa_obligatoire_admin: bool = True
    duree_validite_code_2fa_secondes: int = 300

    # --- Email (Resend) ---
    resend_api_key: str = ""
    email_expediteur: str = "DigiID <bigdataism2024@gmail.com>"

    # --- Email (SMTP Gmail - utilise le mot de passe d'application) ---
    # ⚠️ AUCUN secret en dur dans le code : le mot de passe d'application Gmail
    #    doit venir du .env (SMTP_MOT_DE_PASSE). Sans lui, l'application passe
    #    en « mode mock » (les emails ne partent pas) et le signale au démarrage.
    #
    # ⚠️ IMPORTANT (noms de variables) : les fichiers .env / docker-compose.yml
    #    et services/email.py utilisent les noms ANGLAIS (SMTP_HOST, SMTP_USER,
    #    SMTP_PORT) alors que ces champs sont en français. On accepte LES DEUX
    #    via AliasChoices pour que la configuration soit réellement lue
    #    (sinon SMTP_HOST/SMTP_USER étaient silencieusement ignorés).
    smtp_serveur: str = Field(
        default="smtp.gmail.com",
        validation_alias=AliasChoices(
            "SMTP_SERVEUR", "SMTP_HOST", "smtp_serveur", "smtp_host"
        ),
    )
    smtp_port: int = Field(
        default=587,
        validation_alias=AliasChoices("SMTP_PORT", "smtp_port"),
    )
    smtp_utilisateur: str = Field(
        default="bigdataism2024@gmail.com",
        validation_alias=AliasChoices(
            "SMTP_UTILISATEUR", "SMTP_USER", "smtp_utilisateur", "smtp_user"
        ),
    )
    smtp_mot_de_passe: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_MOT_DE_PASSE", "smtp_mot_de_passe"),
    )

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
    def paliers_frais_service_colis(
        self,
    ) -> tuple[tuple[int, int | None, int, int], ...]:
        """
        Barème : ``((nb_articles_min, nb_articles_max | None, frais, commission), …)``.

        ``nb_articles_max`` vaut ``None`` pour le palier ouvert (« plus de N »).

        Tolérant à une saisie invalide dans le ``.env`` : on ignore les entrées
        mal formées et on retombe sur le barème par défaut (jamais de barème vide,
        jamais d'exception au démarrage).
        """
        defauts: tuple[tuple[int, int | None, int, int], ...] = (
            (1, 3, 100, 25),
            (4, 6, 200, 50),
            (7, 10, 350, 80),
            (11, None, 500, 150),
        )
        paliers: list[tuple[int, int | None, int, int]] = []
        for morceau in (self.bareme_frais_service_colis or "").split(","):
            morceau = morceau.strip()
            if not morceau or ":" not in morceau:
                continue
            morceaux = morceau.split(":")
            bornes = morceaux[0].strip()
            try:
                if "+" in bornes:
                    mini: int = int(bornes.replace("+", "").strip())
                    maxi: int | None = None
                elif "-" in bornes:
                    mini_brut, maxi_brut = bornes.split("-", 1)
                    mini = int(mini_brut.strip())
                    maxi = int(maxi_brut.strip())
                else:
                    mini = int(bornes)
                    maxi = None
                frais = int(morceaux[1].strip())
                commission = int(morceaux[2].strip()) if len(morceaux) > 2 else 0
            except ValueError:
                continue
            if mini >= 1 and frais >= 0 and commission >= 0:
                paliers.append((mini, maxi, frais, commission))
        if not paliers:
            paliers = list(defauts)
        return tuple(sorted(paliers, key=lambda palier: palier[0]))

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
        """
        Convertit la chaîne CSV en liste pour FastAPI CORS.
        Inclut toujours le frontend Render pour que l'upload direct fonctionne.
        """
        origines = [o.strip() for o in self.origines_autorisees.split(",") if o.strip()]
        # Toujours ajouter le frontend Render (meme si ENVIRONNEMENT != production)
        if "https://digiid-frontend.onrender.com" not in origines:
            origines.append("https://digiid-frontend.onrender.com")
        return origines

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
