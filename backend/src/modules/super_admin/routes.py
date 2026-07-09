# -*- coding: utf-8 -*-
"""
Routes du module Super Admin — DigiID.

Assemble et expose les endpoints de la Phase 5, Phase 6 et Phase 8.

Liste complète : voir la docstring de chaque endpoint.

Sécurité :
    - Tous les endpoints requièrent le rôle `super_administrateur`
    - Vérification via la dépendance `super_admin_courant()`
    - L'adresse IP est systématiquement extraite pour l'audit
"""
from datetime import datetime
from http.client import HTTPException
from typing import Annotated, List
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.modules.authentification.dependances import (
    obtenir_ip_client,
    super_admin_courant,
)
from src.modeles import Utilisateur
from src.noyau import dechiffrer_donnee

from src.modules.super_admin import service as service_super_admin
from src.modules.super_admin import service_phase6 as service_super_admin_v2
from src.modules.super_admin.schemas import AdminApercu, CreerAdminRequete, ListeAdmins
from src.modules.super_admin.schemas_phase6 import (
    DonneesAdminExport,
    FiltresAudit,
    LIMITE_MAX_AUDIT,
    LIMITE_PAR_DEFAUT,
    ListeAuditPaginee,
    ListeFeatureFlags,
    ListeSessionsAdmin,
    MiseAJourFeatureFlags,
    Modifier2FARequete,
    ModifierAdminRequete,
    ResetMotDePasseReponse,
    StatistiquesCompletes,
)
from src.modules.super_admin.schemas_securite import (
    ChangerRoleReponse,
    ChangerRoleRequete,
)
from src.modules.super_admin.schemas_utilisateurs import (
    CreerProfilRequete,
    ListeUtilisateurs,
    NombreUtilisateurs,
    UtilisateurApercu,
    ModifierUtilisateurRequete,
)
from src.modules.super_admin import service_utilisateurs as service_utilisateurs
from src.modules.super_admin import monitoring_temps_reel as service_monitoring


# =============================================================================
# CONSTANTES DE CONFIGURATION
# =============================================================================

#: Nom de fichier par défaut pour les exports CSV d'audit
FICHIER_AUDIT_CSV: str = "audit_digiid.csv"

#: Nom de fichier par défaut pour les exports CSV d'admins
FICHIER_ADMINS_CSV: str = "administrateurs_digiid.csv"


# =============================================================================
# CRÉATION DU ROUTEUR
# =============================================================================

routeur_super_admin = APIRouter(
    prefix="/api/v1/super-admin",
    tags=["Super Admin"],
)


# =============================================================================
# PHASE 5 — GESTION DES ADMINISTRATEURS (fondations)
# =============================================================================


@routeur_super_admin.post(
    "/administrateurs",
    response_model=AdminApercu,
    summary="Créer un nouvel administrateur",
    description=(
        "Crée un nouvel administrateur avec email, prénom, nom et mot de passe. "
        "Le rôle est automatiquement 'administrateur'. Traçabilité complète dans l'audit."
    ),
)
async def creer_admin(
    requete: Request,
    donnees: CreerAdminRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Crée un nouvel administrateur dans le système.

    - **email** : obligatoire, unique, format email valide
    - **prenom** : obligatoire, 2-50 caractères
    - **nom** : obligatoire, 2-50 caractères
    - **mot_de_passe** : optionnel, généré automatiquement si absent
    - **ville** : optionnelle

    Les données personnelles (prénom, nom) sont chiffrées avant stockage.
    L'action est tracée dans le journal d'audit.
    """
    return await service_super_admin.creer_administrateur(
        session=session,
        super_admin=super_admin,
        donnees=donnees,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_super_admin.get(
    "/administrateurs/export/csv",
    summary="Export de la liste des administrateurs en CSV",
    description="Exporte tous les administrateurs au format CSV téléchargeable.",
)
async def exporter_liste_admins_csv(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Exporte la liste complète des administrateurs au format CSV.

    Colonnes du fichier :
      ID, Email, Prénom, Nom, Rôle, Actif, 2FA, Email vérifié, Création, Dernière connexion

    Le fichier est retourné en téléchargement direct.
    """
    csv_content: str = await service_super_admin_v2.exporter_liste_admins_csv(session)

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={FICHIER_ADMINS_CSV}",
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


@routeur_super_admin.get(
    "/administrateurs",
    response_model=ListeAdmins,
    summary="Lister tous les administrateurs",
    description="Retourne la liste de tous les administrateurs actifs (non supprimés).",
)
async def lister_admins(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Liste tous les administrateurs actifs du système.

    Exclut les comptes supprimés (soft-delete).
    Inclut administrateurs et super administrateurs.
    """
    return await service_super_admin.lister_administrateurs(session)


@routeur_super_admin.patch(
    "/administrateurs/{admin_id}/suspendre",
    response_model=AdminApercu,
    summary="Suspendre un administrateur",
    description="Désactive le compte d'un administrateur. Celui-ci ne peut plus se connecter.",
)
async def suspendre_admin(
    requete: Request,
    admin_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Suspend un administrateur en désactivant son compte.

    - L'admin ne peut plus se connecter
    - Ses sessions actives sont révoquées
    - L'action est tracée dans l'audit
    """
    return await service_super_admin.basculer_actif_admin(
        session=session,
        super_admin=super_admin,
        admin_id=admin_id,
        activer=False,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_super_admin.patch(
    "/administrateurs/{admin_id}/reactiver",
    response_model=AdminApercu,
    summary="Réactiver un administrateur précédemment suspendu",
    description="Réactive le compte d'un administrateur suspendu. Il peut à nouveau se connecter.",
)
async def reactiver_admin(
    requete: Request,
    admin_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Réactive un administrateur précédemment suspendu.

    - Le compte est réactivé
    - L'admin peut à nouveau se connecter
    - L'action est tracée dans l'audit
    """
    return await service_super_admin.basculer_actif_admin(
        session=session,
        super_admin=super_admin,
        admin_id=admin_id,
        activer=True,
        adresse_ip=obtenir_ip_client(requete),
    )


# =============================================================================
# PHASE 6 — ENDPOINTS AVANCÉS
# =============================================================================


# ---------------------------------------------------------------------------
# 6.1 — Détails administrateur : GET /administrateurs/{id}
# ---------------------------------------------------------------------------


@routeur_super_admin.get(
    "/administrateurs/{admin_id}",
    response_model=AdminApercu,
    summary="Obtenir les détails d'un administrateur",
    description=(
        "Retourne les informations complètes d'un administrateur "
        "(id, email, prénom, nom, rôle, statut, 2FA, dates)."
    ),
)
async def obtenir_admin_detail(
    admin_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Récupère les détails complets d'un administrateur spécifique.

    Champs retournés :
      - **id** : UUID unique
      - **email** : adresse email
      - **prenom** : prénom (déchiffré)
      - **nom** : nom de famille (déchiffré)
      - **role** : 'administrateur' ou 'super_administrateur'
      - **est_actif** : compte actif ou suspendu
      - **deux_fa_active** : 2FA activé ou non
      - **est_email_verifie** : email vérifié ou non
      - **date_creation** : date de création du compte
      - **date_derniere_connexion** : dernière connexion (si disponible)

    Lève une erreur 404 si l'admin n'existe pas ou a été supprimé.
    """
    return await service_super_admin_v2.obtenir_admin_detail(
        session=session,
        admin_id=admin_id,
    )


# ---------------------------------------------------------------------------
# 6.2 — Audit paginé : GET /audit
# ---------------------------------------------------------------------------


@routeur_super_admin.get(
    "/audit",
    response_model=ListeAuditPaginee,
    summary="Journal d'audit complet avec pagination et filtrage",
    description=(
        "Consulte le journal d'audit avec pagination (50/page par défaut, max 200). "
        "Filtres disponibles : type d'événement, plage de dates, recherche textuelle."
    ),
)
async def lister_audit(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
    page: int = Query(default=1, ge=1, description="Numéro de page (1-indexé)"),
    limite: int = Query(default=LIMITE_PAR_DEFAUT, ge=1, le=LIMITE_MAX_AUDIT, description="Éléments par page"),
    type_evenement: str | None = Query(
        default=None, description="Filtrer par type d'événement (ex: connexion)",
    ),
    date_debut: str | None = Query(
        default=None, description="Date début (format ISO 8601, ex: 2024-01-01T00:00:00Z)",
    ),
    date_fin: str | None = Query(
        default=None, description="Date fin (format ISO 8601, ex: 2024-12-31T23:59:59Z)",
    ),
    recherche: str | None = Query(
        default=None, description="Recherche textuelle libre dans la description",
    ),
):
    """
    Retourne les événements d'audit du système avec pagination et filtrage.

    Paramètres de filtrage (optionnels, combinables) :
      - **type_evenement** : filtrer par type (ex: connexion, creation_admin)
      - **date_debut / date_fin** : plage ISO 8601 (ex: 2024-01-01T00:00:00Z)
      - **recherche** : texte libre (LIKE insensible à la casse) dans la description

    La réponse inclut les métadonnées de pagination (total, pages, page courante).
    """
    filtres = FiltresAudit(
        page=page,
        limite=limite,
        type_evenement=type_evenement,
        date_debut=datetime.fromisoformat(date_debut) if date_debut else None,
        date_fin=datetime.fromisoformat(date_fin) if date_fin else None,
        recherche=recherche,
    )
    return await service_super_admin_v2.lister_audit(session, filtres)


@routeur_super_admin.get(
    "/audit/export/csv",
    summary="Export du journal d'audit au format CSV",
    description="Exporte les événements d'audit (filtrés ou non) dans un fichier CSV téléchargeable.",
)
async def exporter_audit_csv(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
    type_evenement: str | None = Query(
        default=None, description="Filtrer par type d'événement",
    ),
    date_debut: str | None = Query(
        default=None, description="Date début (ISO 8601)",
    ),
    date_fin: str | None = Query(
        default=None, description="Date fin (ISO 8601)",
    ),
    recherche: str | None = Query(
        default=None, description="Recherche textuelle",
    ),
):
    """
    Exporte les événements d'audit au format CSV.

    Les mêmes filtres que GET /audit sont disponibles.
    Le fichier est retourné en téléchargement direct.
    Colonnes : ID, Date, Type, Description, Utilisateur ID, Rôle, IP, User-Agent, Score Risque
    """
    csv_content: str = await service_super_admin_v2.exporter_audit_csv(
        session=session,
        type_evenement=type_evenement,
        date_debut=datetime.fromisoformat(date_debut) if date_debut else None,
        date_fin=datetime.fromisoformat(date_fin) if date_fin else None,
        recherche=recherche,
    )

    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={FICHIER_AUDIT_CSV}",
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


# ---------------------------------------------------------------------------
# 6.3 — Statistiques : GET /statistiques
# ---------------------------------------------------------------------------


@routeur_super_admin.get(
    "/statistiques",
    response_model=StatistiquesCompletes,
    summary="Statistiques détaillées du système (dashboard)",
    description=(
        "Retourne les métriques clés pour le dashboard super admin : "
        "utilisateurs, administrateurs, sessions, scores, audit."
    ),
)
async def obtenir_statistiques(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Agrège les statistiques complètes du système en une seule requête.

    Domaines couverts :
      - **Utilisateurs** : total, actifs, inactifs, supprimés, 2FA, email vérifié, verrouillés
        + taux 2FA et taux vérification email
      - **Administrateurs** : total, actifs, inactifs, 2FA actif, sans 2FA
      - **Sessions** : actives, expirées, révoquées, créées aujourd'hui, total
      - **Scores** : moyen, min, max, utilisateurs scorés, recalculs
      - **Audit** : total événements, événements aujourd'hui
    """
    return await service_super_admin_v2.calculer_statistiques(session)


# ---------------------------------------------------------------------------
# 6.4 — Feature flags : GET & PATCH /configuration/feature-flags
# ---------------------------------------------------------------------------


@routeur_super_admin.get(
    "/configuration/feature-flags",
    response_model=ListeFeatureFlags,
    summary="Lister tous les feature flags",
    description="Liste tous les feature flags actifs avec leurs métadonnées (catégorie, phase, sensibilité).",
)
async def lister_feature_flags(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Liste tous les feature flags actifs du système.

    Chaque flag inclut :
      - **cle** : identifiant unique (snake_case)
      - **valeur** : valeur courante (bool, str, int, etc.)
      - **description** : texte explicatif
      - **categorie** : groupe d'appartenance (securite, metier, chatbot, facial)
      - **phase_introduction** : phase du projet
      - **niveau_sensibilite** : 0=standard, 1=sensible, 2=critique

    Triés par catégorie puis par clé.
    """
    return await service_super_admin_v2.lister_feature_flags(session)


@routeur_super_admin.patch(
    "/configuration/feature-flags",
    response_model=ListeFeatureFlags,
    summary="Modifier un ou plusieurs feature flags",
    description=(
        "Modifie les feature flags en ligne, sans redémarrage. "
        "Chaque modification est tracée dans l'audit. "
        "Les flags de sensibilité critique (niveau 2) ont un audit renforcé."
    ),
)
async def modifier_feature_flags(
    requete: Request,
    donnees: MiseAJourFeatureFlags,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Modifie un ou plusieurs feature flags en une seule requête.

    Corps attendu :
    ```json
    {
      "flags": {
        "2fa_obligatoire_admin": false,
        "calcul_auto_score": true,
        "reconnaissance_faciale": true
      }
    }
    ```

    Règles :
      - Chaque flag modifié est tracé dans le journal d'audit
      - Les flags de niveau 2 (critiques) ont un audit renforcé
      - Impossible de modifier un flag inexistant ou désactivé
      - Au moins 1 flag requis dans la requête
    """
    return await service_super_admin_v2.modifier_feature_flags(
        session=session,
        super_admin=super_admin,
        donnees=donnees,
        adresse_ip=obtenir_ip_client(requete),
    )


# ---------------------------------------------------------------------------
# 6.5 — Sessions administrateur : GET sessions & POST revoquer
# ---------------------------------------------------------------------------


@routeur_super_admin.get(
    "/administrateurs/{admin_id}/sessions",
    response_model=ListeSessionsAdmin,
    summary="Lister les sessions d'un administrateur",
    description="Liste toutes les sessions (actives, expirées, révoquées) d'un administrateur.",
)
async def lister_sessions_admin(
    admin_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Liste toutes les sessions associées à un administrateur.

    Informations par session :
      - ID, utilisateur, adresse IP, user-agent
      - dates de création, dernière utilisation, expiration
      - statut : révoquée ou non, raison de révocation

    Retourne également le nombre de sessions actives.
    """
    return await service_super_admin_v2.lister_sessions_admin(session, admin_id)


@routeur_super_admin.post(
    "/administrateurs/{admin_id}/sessions/{session_id}/revoquer",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Révoquer une session d'un administrateur",
    description="Déconnecte immédiatement un administrateur d'une session spécifique.",
)
async def revoquer_session_admin(
    requete: Request,
    admin_id: UUID,
    session_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Révoque une session spécifique d'un administrateur.

    - La session est marquée 'révoquée' immédiatement
    - L'administrateur est déconnecté de cet appareil
    - L'action est tracée dans le journal d'audit
    - Lève 404 si la session n'existe pas
    """
    await service_super_admin_v2.revoquer_session_admin(
        session=session,
        super_admin=super_admin,
        admin_id=admin_id,
        session_id=session_id,
        adresse_ip=obtenir_ip_client(requete),
    )


# ---------------------------------------------------------------------------
# 6.6 — Édition, Sécurité et Suppression d'administrateur
# ---------------------------------------------------------------------------


@routeur_super_admin.patch(
    "/administrateurs/{admin_id}",
    response_model=AdminApercu,
    summary="Modifier les informations d'un administrateur",
    description="Modifie le prénom, nom et/ou ville d'un administrateur (champs optionnels).",
)
async def modifier_admin(
    requete: Request,
    admin_id: UUID,
    donnees: ModifierAdminRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Modifie les informations personnelles d'un administrateur.

    Champs modifiables (optionnels, au moins un requis) :
      - **prenom** : 2-50 caractères
      - **nom** : 2-50 caractères
      - **ville** : max 100 caractères

    Les données sensibles (prénom, nom) sont chiffrées avant stockage.
    """
    return await service_super_admin_v2.modifier_administrateur(
        session=session,
        super_admin=super_admin,
        admin_id=admin_id,
        donnees=donnees,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_super_admin.post(
    "/administrateurs/{admin_id}/reset-password",
    response_model=ResetMotDePasseReponse,
    summary="Réinitialiser le mot de passe d'un administrateur",
    description=(
        "Génère un mot de passe temporaire haute entropie pour un administrateur. "
        "Toutes ses sessions sont révoquées."
    ),
)
async def reset_password_admin(
    requete: Request,
    admin_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Réinitialise le mot de passe d'un administrateur.

    Mesures de sécurité :
      1. Mot de passe temporaire de 22+ caractères (haute entropie)
      2. Hashé immédiatement — jamais stocké en clair
      3. Toutes les sessions actives sont révoquées
      4. Action tracée dans l'audit

    **Le mot de passe temporaire doit être communiqué de façon sécurisée**
    à l'administrateur concerné (hors bande, de préférence).
    """
    nouveau_mdp: str = await service_super_admin_v2.reinitialiser_mot_de_passe_admin(
        session=session,
        super_admin=super_admin,
        admin_id=admin_id,
        adresse_ip=obtenir_ip_client(requete),
    )
    return ResetMotDePasseReponse(
        nouveau_mot_de_passe=nouveau_mdp,
        message=(
            "Mot de passe réinitialisé. Communiquez-le de façon sécurisée "
            "à l'administrateur. Toutes ses sessions ont été révoquées."
        ),
    )


@routeur_super_admin.patch(
    "/administrateurs/{admin_id}/2fa",
    response_model=AdminApercu,
    summary="Activer/désactiver le 2FA pour un administrateur",
    description=(
        "Active ou désactive la double authentification (2FA) pour un administrateur. "
        "La désactivation supprime le secret 2FA stocké."
    ),
)
async def gerer_2fa_admin(
    requete: Request,
    admin_id: UUID,
    donnees: Modifier2FARequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Active ou désactive le 2FA pour un administrateur.

    - **deux_fa_active=true** : active le 2FA
    - **deux_fa_active=false** : désactive le 2FA et supprime le secret

    Action sensible tracée dans le journal d'audit.
    """
    return await service_super_admin_v2.basculer_2fa_admin(
        session=session,
        super_admin=super_admin,
        admin_id=admin_id,
        activer=donnees.deux_fa_active,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_super_admin.delete(
    "/administrateurs/{admin_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer un administrateur (soft-delete)",
    description=(
        "Supprime logiquement un administrateur. "
        "Le compte est marqué supprimé mais conservé pour l'audit. "
        "Toutes ses sessions sont révoquées. La confirmation est obligatoire."
    ),
)
async def supprimer_admin(
    requete: Request,
    admin_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
    confirmation: bool = Query(
        default=True, description="Confirmation explicite (true pour supprimer)",
    ),
    raison: str = Query(
        default="", description="Motif de la suppression (optionnel mais recommandé)",
    ),
):
    """
    Supprime logiquement (soft-delete) un administrateur.

    Principes :
      - **Soft-delete** : marque est_supprime=True (pas de perte de données)
      - **Confirmation** : `confirmation=true` obligatoire (sécurité)
      - **Révocation** : toutes les sessions sont révoquées
      - **Audit** : l'action est tracée avec la raison fournie
      - **Droit à l'oubli** : les données sont conservées pour conformité
    """
    await service_super_admin_v2.supprimer_administrateur(
        session=session,
        super_admin=super_admin,
        admin_id=admin_id,
        confirmation=confirmation,
        raison=raison,
        adresse_ip=obtenir_ip_client(requete),
    )


# ---------------------------------------------------------------------------
# 6.7 — Export : administrateur individuel & liste CSV
# ---------------------------------------------------------------------------


@routeur_super_admin.get(
    "/administrateurs/{admin_id}/export",
    response_model=DonneesAdminExport,
    summary="Exporter les données d'un administrateur",
    description="Exporte les données complètes d'un administrateur (profil, sessions, audit).",
)
async def exporter_admin(
    requete: Request,
    admin_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Exporte les données complètes d'un administrateur au format structuré.

    Données incluses :
      - Profil (id, email, prénom, nom, rôle)
      - Statuts (actif, 2FA, email vérifié)
      - Dates (création, dernière connexion)
      - Sessions actives
      - Volume d'audit

    L'action est tracée dans le journal d'audit.
    """
    return await service_super_admin_v2.exporter_admin_donnees(
        session=session,
        super_admin=super_admin,
        admin_id=admin_id,
        adresse_ip=obtenir_ip_client(requete),
    )


# =============================================================================
# PHASE 8 — SÉCURITÉ RENFORCÉE : changement de rôle, validation email, etc.
# =============================================================================


@routeur_super_admin.post(
    "/utilisateurs/{utilisateur_id}/changer-role",
    response_model=ChangerRoleReponse,
    summary="Changer le rôle d'un utilisateur",
    description=(
        "Change le rôle d'un utilisateur. Actions de sécurité :\n"
        "1. Validation du rôle cible dans l'énumération\n"
        "2. Validation de l'email institutionnel si nécessaire\n"
        "3. Révocation de toutes les sessions actives\n"
        "4. Journalisation complète dans l'audit\n"
        "5. Alerte si le changement est suspect (ex: citoyen → super_admin)"
    ),
)
async def changer_role_utilisateur(
    requete: Request,
    utilisateur_id: UUID,
    donnees: ChangerRoleRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Change le rôle d'un utilisateur. Action ultra-sensible.

    **Pré-requis :**
      - Être super administrateur
      - Fournir un rôle valide parmi les 7 rôles système
      - Confirmer que l'identité de l'utilisateur cible a été vérifiée
      - Expliquer la raison du changement (10-500 caractères)

    **Sécurités appliquées :**
      1. Le rôle cible est validé dans `RolesUtilisateur`
      2. Si le rôle cible est institutionnel (medecin, police, agent, ong),
         l'email de l'utilisateur doit correspondre à un domaine autorisé
      3. Toutes les sessions actives de l'utilisateur sont révoquées
      4. L'action est tracée dans le journal d'audit avec tous les détails
      5. Les tokens JWT émis avant ce changement seront rejetés
      6. Un changement suspect déclenche une alerte de fraude supplémentaire

    **Corps de la requête :**
    ```json
    {
      "nouveau_role": "administrateur",
      "raison": "Promotion suite à l'obtention du diplôme de l'ENAM",
      "confirmer_verification_identite": true
    }
    ```
    """
    from src.modules.super_admin.service_securite import changer_role_utilisateur as service_changer_role

    resultat = await service_changer_role(
        session=session,
        super_admin=super_admin,
        utilisateur_cible_id=utilisateur_id,
        nouveau_role=donnees.nouveau_role,
        raison=donnees.raison,
        adresse_ip=obtenir_ip_client(requete),
    )
    return ChangerRoleReponse(**resultat)


# =============================================================================
# UTILISATEURS — Gestion complète de tous les utilisateurs
# =============================================================================


@routeur_super_admin.post(
    "/utilisateurs/profils",
    response_model=UtilisateurApercu,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un profil utilisateur (hors citoyen)",
    description=(
        "Crée un nouveau compte avec un rôle spécifique. "
        "Rôles disponibles : ong, medecin, agent, police, administrateur, super_administrateur. "
        "Le citoyen ne peut pas être créé ici (inscription libre)."
    ),
)
async def creer_profil_utilisateur(
    requete: Request,
    donnees: CreerProfilRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Crée un profil utilisateur avec un rôle spécifique (sauf citoyen).

    - **email** : obligatoire, unique
    - **prenom / nom** : obligatoires, 2-50 caractères
    - **mot_de_passe** : 12+ caractères avec maj, min, chiffre, spécial
    - **role** : ong, medecin, agent, police, administrateur, super_administrateur
    - **ville** : optionnelle

    Les données personnelles sont chiffrées avant stockage.
    L'action est tracée dans le journal d'audit.
    """
    return await service_utilisateurs.creer_utilisateur(
        session=session,
        super_admin=super_admin,
        donnees=donnees,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_super_admin.get(
    "/utilisateurs",
    response_model=ListeUtilisateurs,
    summary="Lister tous les utilisateurs",
    description=(
        "Liste tous les utilisateurs avec pagination, recherche et filtres. "
        "Inclut tous les rôles (citoyen, agent, medecin, police, ong, admin, super admin)."
    ),
)
async def lister_tous_utilisateurs(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
    page: int = Query(default=1, ge=1, description="Numéro de page"),
    limite: int = Query(default=20, ge=1, le=100, description="Éléments par page"),
    recherche: str | None = Query(default=None, description="Recherche par email, nom, ville"),
    role: str | None = Query(default=None, description="Filtrer par rôle exact"),
    est_actif: bool | None = Query(default=None, description="Filtrer par compte actif"),
    est_verrouille: bool | None = Query(default=None, description="Filtrer par compte verrouillé"),
    est_supprime: bool | None = Query(default=None, description="Filtrer par compte supprimé"),
    deux_fa_active: bool | None = Query(default=None, description="Filtrer par 2FA"),
    ville: str | None = Query(default=None, description="Filtrer par ville"),
    tri: str = Query(default="cree_le", description="Colonne de tri"),
    ordre: str = Query(default="desc", description="Ordre asc/desc"),
):
    """
    Liste tous les utilisateurs du système avec pagination et filtres.

    Retourne une liste paginée avec les métadonnées (total, pages, page courante).
    """
    return await service_utilisateurs.lister_utilisateurs(
        session=session,
        page=page,
        limite=limite,
        recherche=recherche,
        role=role,
        est_actif=est_actif,
        est_verrouille=est_verrouille,
        est_supprime=est_supprime,
        deux_fa_active=deux_fa_active,
        ville=ville,
        tri=tri,
        ordre=ordre,
    )


@routeur_super_admin.get(
    "/utilisateurs/compter",
    response_model=NombreUtilisateurs,
    summary="Compter les utilisateurs par statut",
    description="Retourne les compteurs globaux : total, actifs, verrouillés, supprimés, 2FA.",
)
async def compter_utilisateurs(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """Retourne les compteurs globaux des utilisateurs pour le dashboard."""
    return await service_utilisateurs.compter_utilisateurs(session)


@routeur_super_admin.get(
    "/utilisateurs/{utilisateur_id}",
    response_model=UtilisateurApercu,
    summary="Obtenir les détails d'un utilisateur",
    description="Retourne les informations complètes d'un utilisateur (id, email, rôle, statuts, dates).",
)
async def obtenir_utilisateur_detail(
    utilisateur_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Récupère les détails complets d'un utilisateur spécifique.
    
    Inclut : email, prénom, nom, rôle, statuts, 2FA, score, sessions actives, dates.
    """
    return await service_utilisateurs.obtenir_utilisateur_detail(
        session=session,
        utilisateur_id=utilisateur_id,
    )


@routeur_super_admin.patch(
    "/utilisateurs/{utilisateur_id}",
    response_model=UtilisateurApercu,
    summary="Modifier un utilisateur",
    description="Modifie le prénom, nom et/ou ville d'un utilisateur.",
)
async def modifier_utilisateur(
    requete: Request,
    utilisateur_id: UUID,
    donnees: ModifierUtilisateurRequete,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Modifie les informations personnelles d'un utilisateur.

    Champs modifiables :
      - **prenom** : optionnel
      - **nom** : optionnel
      - **ville** : optionnelle

    Au moins un champ doit être fourni.
    """
    return await service_utilisateurs.modifier_utilisateur(
        session=session,
        super_admin=super_admin,
        utilisateur_id=utilisateur_id,
        prenom=donnees.prenom,
        nom=donnees.nom,
        ville=donnees.ville,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_super_admin.patch(
    "/utilisateurs/{utilisateur_id}/suspendre",
    response_model=UtilisateurApercu,
    summary="Suspendre un utilisateur",
    description="Désactive le compte d'un utilisateur. Il ne peut plus se connecter.",
)
async def suspendre_utilisateur(
    requete: Request,
    utilisateur_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
    motif: str | None = Query(default=None, description="Motif de la suspension (query)"),
    motif_corps: str | None = Body(default=None, description="Motif de la suspension (body JSON)"),
):
    """
    Suspend un utilisateur.

    - Le compte est désactivé et verrouillé
    - Toutes les sessions actives sont révoquées
    - L'action est tracée dans le journal d'audit
    """
    # Utiliser le motif du body JSON si présent, sinon du query param
    motif_final = motif_corps if motif_corps is not None else motif
    
    return await service_utilisateurs.suspendre_utilisateur(
        session=session,
        super_admin=super_admin,
        utilisateur_id=utilisateur_id,
        motif=motif_final,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_super_admin.patch(
    "/utilisateurs/{utilisateur_id}/reactiver",
    response_model=UtilisateurApercu,
    summary="Réactiver un utilisateur suspendu",
    description="Réactive le compte d'un utilisateur précédemment suspendu.",
)
async def reactiver_utilisateur(
    requete: Request,
    utilisateur_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Réactive un utilisateur suspendu.

    - Le compte est réactivé et déverrouillé
    - Le compteur de tentatives échouées est remis à zéro
    - L'action est tracée dans le journal d'audit
    """
    return await service_utilisateurs.reactiver_utilisateur(
        session=session,
        super_admin=super_admin,
        utilisateur_id=utilisateur_id,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_super_admin.delete(
    "/utilisateurs/{utilisateur_id}",
    status_code=status.HTTP_200_OK,
    summary="Supprimer un utilisateur (soft-delete)",
    description=(
        "Supprime logiquement un utilisateur. "
        "Le compte est marqué supprimé mais conservé pour l'audit."
    ),
)
async def supprimer_utilisateur(
    requete: Request,
    utilisateur_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
    raison: str = Query(default="", description="Raison de la suppression"),
):
    """
    Supprime logiquement un utilisateur.

    - Marquage est_supprime=True
    - Sessions révoquées
    - Email hash modifié pour permettre la réinscription
    """
    await service_utilisateurs.supprimer_utilisateur(
        session=session,
        super_admin=super_admin,
        utilisateur_id=utilisateur_id,
        raison=raison if raison else None,
        adresse_ip=obtenir_ip_client(requete),
    )
    return {"succes": True, "message": "Utilisateur supprimé avec succès", "utilisateur_id": str(utilisateur_id)}


@routeur_super_admin.delete(
    "/utilisateurs/{utilisateur_id}/definitif",
    status_code=status.HTTP_200_OK,
    summary="Supprimer définitivement un utilisateur (hard-delete)",
    description=(
        "Supprime définitivement un utilisateur de la base de données. "
        "Action irréversible. Tracée dans l'audit."
    ),
)
async def supprimer_definitivement_utilisateur(
    requete: Request,
    utilisateur_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Supprime définitivement un utilisateur (hard-delete).

    ⚠️ Action irréversible : l'utilisateur est effacé de la base.
    Les données sont perdues. Utiliser avec précaution.
    """
    await service_utilisateurs.supprimer_definitivement_utilisateur(
        session=session,
        super_admin=super_admin,
        utilisateur_id=utilisateur_id,
        adresse_ip=obtenir_ip_client(requete),
    )
    return {"succes": True, "message": "Utilisateur supprimé définitivement"}


# Alias pour compatibilité : PATCH .../role = changement de rôle
class ChangerRoleRequeteFrontend(BaseModel):
    """Version simplifiée pour compatibilité frontend."""
    role: str
    motif: str
    forcer: bool = False


@routeur_super_admin.patch(
    "/utilisateurs/{utilisateur_id}/role",
    response_model=ChangerRoleReponse,
    summary="Changer le rôle d'un utilisateur (via PATCH)",
    description="Change le rôle d'un utilisateur. Alias PATCH pour compatibilité frontend.",
)
async def changer_role_utilisateur_patch(
    requete: Request,
    utilisateur_id: UUID,
    donnees: ChangerRoleRequeteFrontend,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Change le rôle d'un utilisateur (alias PATCH pour compatibilité frontend).

    Délègue au même service que POST .../changer-role.
    """
    from src.modules.super_admin.service_securite import changer_role_utilisateur as service_changer_role

    resultat = await service_changer_role(
        session=session,
        super_admin=super_admin,
        utilisateur_cible_id=utilisateur_id,
        nouveau_role=donnees.role,
        raison=donnees.motif or "Changement via super admin",
        adresse_ip=obtenir_ip_client(requete),
        forcer=donnees.forcer,
    )
    return ChangerRoleReponse(**resultat)


# =============================================================================
# MONITORING TEMPS RÉEL — Supervision en direct des utilisateurs
# =============================================================================


@routeur_super_admin.get(
    "/monitoring/resume",
    response_model=service_monitoring.ResumeTempsReel,
    summary="Résumé du monitoring en temps réel",
    description=(
        "Retourne un résumé instantané de l'activité du système : "
        "utilisateurs connectés, sessions actives, connexions aujourd'hui, "
        "admins connectés, sessions multiples, alertes récentes."
    ),
)
async def resume_monitoring(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """Résumé temps réel de l'activité du système."""
    return await service_monitoring.obtenir_resume_temps_reel(session)


@routeur_super_admin.get(
    "/monitoring/utilisateurs-connectes",
    response_model=list[service_monitoring.UtilisateurConnecte],
    summary="Liste des utilisateurs connectés en temps réel",
    description=(
        "Liste détaillée des utilisateurs actuellement connectés "
        "(sessions actives avec activité < 30 min)."
    ),
)
async def utilisateurs_connectes(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
    limite: int = Query(default=50, ge=1, le=200, description="Nombre max d'utilisateurs"),
    filtre_role: str | None = Query(default=None, description="Filtrer par rôle"),
    recherche: str | None = Query(default=None, description="Recherche textuelle"),
):
    """Retourne la liste des utilisateurs connectés en temps réel."""
    return await service_monitoring.obtenir_utilisateurs_connectes(
        session=session, limite=limite, filtre_role=filtre_role, recherche=recherche,
    )


@routeur_super_admin.post(
    "/monitoring/utilisateurs/{utilisateur_id}/deconnecter",
    summary="Forcer la déconnexion immédiate d'un utilisateur",
    description="Déconnecte immédiatement un utilisateur de toutes ses sessions actives.",
)
async def forcer_deconnexion(
    requete: Request,
    utilisateur_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
    raison: str = Query(default="Déconnexion forcée par super admin"),
):
    """Force la déconnexion d'un utilisateur en temps réel."""
    return await service_monitoring.forcer_deconnexion_utilisateur(
        session=session, super_admin=super_admin,
        utilisateur_id=utilisateur_id, raison=raison,
        adresse_ip=obtenir_ip_client(requete),
    )


@routeur_super_admin.get(
    "/monitoring/activites-recentes",
    response_model=list[service_monitoring.ActiviteRecente],
    summary="Flux des activités récentes",
    description="Retourne les dernières activités du système.",
)
async def activites_recentes(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
    limite: int = Query(default=20, ge=1, le=100),
    type_evenement: str | None = Query(default=None),
):
    """Flux des activités récentes (dernières 24h)."""
    return await service_monitoring.obtenir_activites_recentes(
        session=session, limite=limite, type_evenement=type_evenement,
    )


@routeur_super_admin.get(
    "/monitoring/alertes",
    response_model=list[service_monitoring.AlerteSecuriteItem],
    summary="Alertes de sécurité en temps réel",
    description="Retourne les alertes de sécurité actives.",
)
async def alertes_monitoring(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
    limite: int = Query(default=20, ge=1, le=100),
    toutes: bool = Query(default=False),
):
    """Alertes de sécurité temps réel."""
    return await service_monitoring.obtenir_alertes_securite(
        session=session, limite=limite, non_resolues_seulement=not toutes,
    )


@routeur_super_admin.get(
    "/monitoring/complet",
    response_model=service_monitoring.ResumeMonitoring,
    summary="Monitoring complet en une seule requête",
    description="Agrège toutes les données de monitoring en une réponse unique.",
)
async def monitoring_complet(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """Point d'entrée unique pour le dashboard temps réel."""
    return await service_monitoring.obtenir_monitoring_complet(session)


# =============================================================================
# ADMIN DISPONIBLES — Pour assignation aux domaines
# =============================================================================


class AdminDisponibleResponse(BaseModel):
    """Réponse pour un admin disponible à assigner à un domaine."""
    id: str
    nom: str
    email: str
    role: str


@routeur_super_admin.get(
    "/admins-disponibles",
    response_model=List[AdminDisponibleResponse],
    summary="Lister les admins disponibles pour assignation",
    description=(
        "Retourne la liste des administrateurs actifs pouvant être assignés à un domaine. "
        "Inclut les rôles 'admin_domaine' et 'administrateur'."
    ),
)
async def lister_admins_disponibles(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """
    Liste tous les administrateurs actifs qui peuvent être assignés à un domaine.

    Filtre les utilisateurs ayant les rôles :
      - admin_domaine
      - administrateur
    
    Exclut les comptes supprimés ou inactifs.
    """
    # Requête pour récupérer les admins actifs
    query = select(Utilisateur).where(
        Utilisateur.role.in_(["admin_domaine", "administrateur"]),
        Utilisateur.est_actif == True,
        Utilisateur.est_supprime == False,
    ).order_by(Utilisateur.cree_le.desc())
    
    result = await session.execute(query)
    admins = result.scalars().all()
    
    # Formater la réponse avec déchiffrement
    resultats = []
    for admin in admins:
        prenom = dechiffrer_donnee(admin.prenom_chiffre) if admin.prenom_chiffre else ""
        nom = dechiffrer_donnee(admin.nom_chiffre) if admin.nom_chiffre else ""
        email = dechiffrer_donnee(admin.email_chiffre) if admin.email_chiffre else ""
        
        resultats.append(
            AdminDisponibleResponse(
                id=str(admin.id),
                nom=f"{prenom} {nom}".strip() or email,
                email=email,
                role=admin.role,
            )
        )
    
    return resultats

# =============================================================================
# ATTESTATIONS COMMUNAUTAIRES — Gestion complète
# =============================================================================
# ⚠️ Cohérence avec le modèle AttestationCommunautaire :
#   - Statuts : EN_ATTENTE | APPROUVEE | REFUSEE | EXPIREE (MAJUSCULES)
#   - Types   : identite | competence | moralite | residence | activite | personnalise
#   - Table   : attestations_communautaires
#   - FK      : utilisateur.id (SINGULIER, cohérent avec Utilisateur.__tablename__)

from src.modeles import AttestationCommunautaire
from sqlalchemy import func, and_, or_
from fastapi import HTTPException


@routeur_super_admin.get(
    "/attestations",
    summary="Lister toutes les attestations communautaires",
    description="Liste paginée avec filtres (statut, type, recherche).",
)
async def lister_attestations(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
    page: int = Query(default=1, ge=1),
    par_page: int = Query(default=50, ge=1, le=200),
    statut: str | None = Query(default=None),
    type_attestation: str | None = Query(default=None),
    recherche: str | None = Query(default=None),
):
    """Liste toutes les attestations avec pagination et filtres."""
    conditions = []

    # Filtre statut (MAJUSCULES)
    if statut and statut != "tous":
        conditions.append(AttestationCommunautaire.statut == statut)

    # Filtre type
    if type_attestation and type_attestation != "tous":
        conditions.append(AttestationCommunautaire.type_attestation == type_attestation)

    # Recherche textuelle
    if recherche:
        recherche_lower = f"%{recherche.lower()}%"
        conditions.append(
            or_(
                AttestationCommunautaire.titre.ilike(recherche_lower),
            )
        )

    # Requête principale
    stmt = select(AttestationCommunautaire)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(AttestationCommunautaire.date_soumission.desc())
    stmt = stmt.offset((page - 1) * par_page).limit(par_page)

    result = await session.execute(stmt)
    attestations = result.scalars().all()

    # Comptage total
    stmt_count = select(func.count(AttestationCommunautaire.id))
    if conditions:
        stmt_count = stmt_count.where(and_(*conditions))
    total = (await session.execute(stmt_count)).scalar() or 0

    # Formatage
    attestations_data = []
    for att in attestations:
        atteste_nom = ""
        attestant_nom = ""
        atteste_email = ""
        attestant_email = ""

        if att.atteste:
            atteste_nom = (
                f"{dechiffrer_donnee(att.atteste.prenom_chiffre) if att.atteste.prenom_chiffre else ''} "
                f"{dechiffrer_donnee(att.atteste.nom_chiffre) if att.atteste.nom_chiffre else ''}"
            ).strip()
            atteste_email = (
                dechiffrer_donnee(att.atteste.email_chiffre) if att.atteste.email_chiffre else ""
            )

        if att.attestant:
            attestant_nom = (
                f"{dechiffrer_donnee(att.attestant.prenom_chiffre) if att.attestant.prenom_chiffre else ''} "
                f"{dechiffrer_donnee(att.attestant.nom_chiffre) if att.attestant.nom_chiffre else ''}"
            ).strip()
            attestant_email = (
                dechiffrer_donnee(att.attestant.email_chiffre) if att.attestant.email_chiffre else ""
            )

        attestations_data.append({
            "id": str(att.id),
            "type_attestation": att.type_attestation,
            "titre": att.titre,
            "statut": att.statut,
            "atteste_id": str(att.atteste_id) if att.atteste_id else "",
            "atteste_nom": atteste_nom,
            "atteste_email": atteste_email,
            "attestant_id": str(att.attestant_id) if att.attestant_id else "",
            "attestant_nom": attestant_nom,
            "attestant_email": attestant_email,
            "lien_nature": att.lien_nature or "",
            "lien_connu_depuis": att.lien_connu_depuis or "",
            "forces": att.forces or "",
            "poids_score": att.poids_score or 0,
            "est_active": att.est_active,
            "date_soumission": att.date_soumission.isoformat(),
            "date_expiration": att.date_expiration.isoformat() if att.date_expiration else None,
            "date_validation": att.date_decision.isoformat() if att.date_decision else None,
            "valide_par": None,
            "motif_refus": att.motif_refus or "",
        })

    return {
        "attestations": attestations_data,
        "total": total,
        "page": page,
        "par_page": par_page,
    }


@routeur_super_admin.get(
    "/attestations/statistiques",
    summary="Statistiques des attestations",
    description="Retourne les compteurs par statut.",
)
async def statistiques_attestations(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """Statistiques complètes sur les attestations (valeurs MAJUSCULES)."""
    total = (
        await session.execute(select(func.count(AttestationCommunautaire.id)))
    ).scalar() or 0
    en_attente = (
        await session.execute(
            select(func.count(AttestationCommunautaire.id)).where(
                AttestationCommunautaire.statut == "EN_ATTENTE"
            )
        )
    ).scalar() or 0
    validees = (
        await session.execute(
            select(func.count(AttestationCommunautaire.id)).where(
                AttestationCommunautaire.statut == "APPROUVEE"
            )
        )
    ).scalar() or 0
    refusees = (
        await session.execute(
            select(func.count(AttestationCommunautaire.id)).where(
                AttestationCommunautaire.statut == "REFUSEE"
            )
        )
    ).scalar() or 0
    expirees = (
        await session.execute(
            select(func.count(AttestationCommunautaire.id)).where(
                AttestationCommunautaire.statut == "EXPIREE"
            )
        )
    ).scalar() or 0
    actives = (
        await session.execute(
            select(func.count(AttestationCommunautaire.id)).where(
                and_(
                    AttestationCommunautaire.statut == "APPROUVEE",
                    AttestationCommunautaire.est_active == True,
                )
            )
        )
    ).scalar() or 0

    return {
        "statistiques": {
            "total": total,
            "en_attente": en_attente,
            "validees": validees,
            "refusees": refusees,
            "expirees": expirees,
            "actives": actives,
        }
    }


@routeur_super_admin.post(
    "/attestations/{attestation_id}/valider",
    summary="Valider (approuver) une attestation",
)
async def valider_attestation(
    attestation_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """Approuve une attestation EN_ATTENTE."""
    result = await session.execute(
        select(AttestationCommunautaire).where(
            AttestationCommunautaire.id == attestation_id
        )
    )
    attestation = result.scalar_one_or_none()

    if not attestation:
        raise HTTPException(status_code=404, detail="Attestation introuvable")

    if attestation.statut != "EN_ATTENTE":
        raise HTTPException(
            status_code=400,
            detail=f"Impossible de valider une attestation au statut '{attestation.statut}'",
        )

    # Utilise la méthode du modèle
    attestation.approuver()
    await session.commit()

    return {"message": "Attestation validée avec succès"}


@routeur_super_admin.post(
    "/attestations/{attestation_id}/refuser",
    summary="Refuser une attestation",
)
async def refuser_attestation(
    attestation_id: UUID,
    donnees: dict,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """Refuse une attestation EN_ATTENTE avec un motif obligatoire."""
    motif = (donnees.get("motif") or "").strip()
    if not motif:
        raise HTTPException(status_code=400, detail="Le motif de refus est obligatoire")

    result = await session.execute(
        select(AttestationCommunautaire).where(
            AttestationCommunautaire.id == attestation_id
        )
    )
    attestation = result.scalar_one_or_none()

    if not attestation:
        raise HTTPException(status_code=404, detail="Attestation introuvable")

    if attestation.statut != "EN_ATTENTE":
        raise HTTPException(
            status_code=400,
            detail=f"Impossible de refuser une attestation au statut '{attestation.statut}'",
        )

    attestation.refuser(motif)
    await session.commit()

    return {"message": "Attestation refusée"}


@routeur_super_admin.post(
    "/attestations/{attestation_id}/suspendre",
    summary="Suspendre une attestation approuvée",
)
async def suspendre_attestation(
    attestation_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """Désactive une attestation APPROUVEE (sans changer son statut)."""
    result = await session.execute(
        select(AttestationCommunautaire).where(
            AttestationCommunautaire.id == attestation_id
        )
    )
    attestation = result.scalar_one_or_none()

    if not attestation:
        raise HTTPException(status_code=404, detail="Attestation introuvable")

    if attestation.statut != "APPROUVEE":
        raise HTTPException(
            status_code=400,
            detail="Seules les attestations approuvées peuvent être suspendues",
        )

    attestation.desactiver()
    await session.commit()

    return {"message": "Attestation suspendue"}


@routeur_super_admin.post(
    "/attestations/{attestation_id}/reactiver",
    summary="Réactiver une attestation suspendue",
)
async def reactiver_attestation(
    attestation_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    super_admin: Annotated[Utilisateur, Depends(super_admin_courant)],
):
    """Réactive une attestation APPROUVEE précédemment suspendue."""
    result = await session.execute(
        select(AttestationCommunautaire).where(
            AttestationCommunautaire.id == attestation_id
        )
    )
    attestation = result.scalar_one_or_none()

    if not attestation:
        raise HTTPException(status_code=404, detail="Attestation introuvable")

    if attestation.statut != "APPROUVEE":
        raise HTTPException(
            status_code=400,
            detail="Seules les attestations approuvées peuvent être réactivées",
        )

    attestation.est_active = True
    await session.commit()

    return {"message": "Attestation réactivée"}