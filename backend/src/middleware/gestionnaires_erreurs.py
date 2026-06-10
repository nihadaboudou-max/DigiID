# -*- coding: utf-8 -*-
"""
Gestionnaires d'erreurs FastAPI.

Convertit les exceptions en réponses HTTP propres au format ReponseErreur,
pour que le frontend puisse afficher des messages clairs aux utilisateurs.

Les erreurs non gérées sont automatiquement tracées dans le journal d'audit
(JOURNAL_AUDIT) pour que le super administrateur puisse les consulter
depuis son espace d'audit.
"""
from datetime import datetime, timezone

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.modeles import JournalAudit
from src.noyau import journal
from src.noyau.exceptions import ErreurDigiID
from src.schemas.reponse_erreur import ReponseErreur


def enregistrer_gestionnaires_erreurs(application: FastAPI) -> None:
    """Enregistre tous les handlers d'exceptions sur l'application FastAPI."""

    @application.exception_handler(ErreurDigiID)
    async def gestionnaire_erreur_digiid(requete: Request, erreur: ErreurDigiID):
        """Toutes les exceptions métier DigiID passent par ici."""
        request_id = getattr(requete.state, "request_id", None)

        journal.warning(
            f"ErreurDigiID : {type(erreur).__name__} -- {erreur.message_technique}",
            code_erreur=erreur.code_erreur,
            code_http=erreur.code_http,
            request_id=request_id,
        )

        return JSONResponse(
            status_code=erreur.code_http,
            content=ReponseErreur(
                code_erreur=erreur.code_erreur,
                message=erreur.message_utilisateur,
                details=erreur.donnees_supplementaires or None,
                request_id=request_id,
            ).model_dump(),
        )

    @application.exception_handler(RequestValidationError)
    async def gestionnaire_erreur_validation(requete: Request, erreur: RequestValidationError):
        """
        Transforme les erreurs de validation Pydantic (422) en messages clairs.

        Sans ce handler, FastAPI renvoie un format `{detail: [...]}` que le
        frontend ne sait pas afficher (d'où le message générique « Erreur inconnue »).
        On reformate au format ReponseErreur standard, avec des messages francisés.
        """
        request_id = getattr(requete.state, "request_id", None)
        erreurs_brutes = erreur.errors()

        # Traduction sommaire des messages Pydantic en français
        # (pour les cas les plus fréquents — le reste passe en l'état)
        TRADUCTIONS = {
            "value is not a valid email address": "n'est pas une adresse email valide",
            "field required": "ce champ est obligatoire",
            "Input should be a valid string": "ce champ doit être une chaîne de caractères",
            "Input should be a valid integer": "ce champ doit être un nombre entier",
            "String should have at least": "doit contenir au moins",
            "String should have at most": "doit contenir au plus",
        }

        # On construit la liste de messages clairs
        morceaux: list[str] = []
        details_par_champ: dict[str, list[str]] = {}
        for err in erreurs_brutes:
            # 'loc' est une liste : ['body', 'mot_de_passe'] par exemple
            # On retire les éléments techniques pour ne garder que le nom du champ
            chemin = ".".join(
                str(p) for p in err.get("loc", [])
                if p not in ("body", "query", "path")
            )
            message = err.get("msg", "valeur invalide")
            # Pydantic v2 préfixe parfois par "Value error, " — on l'enlève
            if message.startswith("Value error, "):
                message = message[len("Value error, "):]
            # Traduction sommaire (best-effort)
            for source, cible in TRADUCTIONS.items():
                if source in message:
                    message = message.replace(source, cible)
                    break

            etiquette_champ = chemin or "champ"
            morceaux.append(f"{etiquette_champ} : {message}")
            details_par_champ.setdefault(etiquette_champ, []).append(message)

        message_complet = " · ".join(morceaux) if morceaux else "Données invalides."

        journal.warning(
            f"Erreur validation : {len(erreurs_brutes)} erreur(s) — {message_complet}",
            request_id=request_id,
        )

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ReponseErreur(
                code_erreur="VALIDATION",
                message=message_complet,
                details={"par_champ": details_par_champ},
                request_id=request_id,
            ).model_dump(),
        )

    @application.exception_handler(Exception)
    async def gestionnaire_exception_generique(requete: Request, erreur: Exception):
        """
        Garde-fou ultime — exception non prévue.

        En plus de logger l'erreur, on crée une entrée dans le journal d'audit
        (JournalAudit) pour que le super administrateur puisse voir l'erreur
        depuis son interface d'audit. Cela remplace le simple log fichier
        qui n'était pas visible par les super admins.
        """
        request_id = getattr(requete.state, "request_id", None)

        # Utiliser str() pour éviter que Loguru n'interprète les {} 
        # contenus dans le message d'erreur (ex: SQL avec paramètres)
        message_erreur = str(erreur)
        type_erreur = type(erreur).__name__
        journal.exception(
            f"Exception non gérée : {type_erreur} -- {message_erreur}",
            request_id=request_id,
        )

        # Tracer l'erreur dans le journal d'audit pour le super admin
        try:
            from src.base_donnees.session import FabriqueSession
            async with FabriqueSession() as session_audit:
                utilisateur_id = None
                role_acteur = None
                try:
                    if hasattr(requete.state, "utilisateur"):
                        utilisateur_id = requete.state.utilisateur.id
                        role_acteur = requete.state.utilisateur.role
                except Exception:
                    pass

                entree_audit = JournalAudit(
                    date_evenement=datetime.now(timezone.utc),
                    utilisateur_id=utilisateur_id,
                    role_acteur=role_acteur,
                    type_evenement="erreur_interne",
                    description=(
                        f"Exception non gérée : {type_erreur} — "
                        f"{message_erreur[:500]}"  # Limiter à 500 car
                    ),
                    adresse_ip=requete.client.host if requete.client else None,
                    request_id=request_id,
                    donnees_supplementaires={
                        "type_erreur": type_erreur,
                        "message_technique": message_erreur[:1000],
                        "chemin": str(requete.url.path),
                        "methode": requete.method,
                    },
                )
                session_audit.add(entree_audit)
                await session_audit.commit()
        except Exception as e_audit:
            # En cas d'échec de l'audit, on ne fait que logger (pas de boucle infinie)
            journal.warning(
                f"Impossible d'enregistrer l'erreur dans l'audit : {e_audit}",
                request_id=request_id,
            )

        return JSONResponse(
            status_code=500,
            content=ReponseErreur(
                code_erreur="ERREUR_INTERNE",
                message=( 
                    "Une erreur interne est survenue. "
                    "L'événement a été enregistré dans le journal d'audit "
                    "que vous pouvez consulter depuis votre espace super admin."
                ),
                request_id=request_id,
            ).model_dump(),
        )
