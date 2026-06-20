# -*- coding: utf-8 -*-
"""
Routes API de l'espace administrateur.

Préfixe : /api/v1/admin

Tous les endpoints exigent le rôle 'administrateur' OU 'super_administrateur'.
Ce qui distingue le super admin de l'admin :
  - L'admin voit les utilisateurs et les alertes
  - L'admin ne voit JAMAIS les données personnelles brutes (chiffrées)
  - L'admin ne peut pas créer d'autres admins
"""
from datetime import datetime, timezone, timedelta
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from src.base_donnees.session import obtenir_session
from src.config.constantes import PREFIXE_API_ADMIN, RolesUtilisateur
from src.modeles import Utilisateur, JournalAudit, FraudeIncident, Notification, SessionAuthentification, VerificationVisuelle
from src.modules.super_admin.service_phase6 import consulter_audit_pagine
from src.modeles.enrolement import Enrolement
from src.modules.authentification.dependances import admin_courant, obtenir_ip_client
from src.modules.super_admin import monitoring_temps_reel as service_monitoring
from src.noyau import dechiffrer_donnee
from src.noyau.notification import envoyer_email


# ---------------------------------------------------------------------------
# Schémas Pydantic pour les droits RBAC
# ---------------------------------------------------------------------------


class TechnologieDroit(BaseModel):
    """Technologie avec les rôles autorisés à y accéder."""
    id: str
    nom: str
    description: str
    icone: str
    roles_autorises: list[str]
    niveau_acces: str  # "critique" | "sensible" | "standard"


class RolePermission(BaseModel):
    """Rôle avec ses permissions."""
    role: str
    libelle: str
    description: str
    niveau: int
    permissions: list[str]


routeur_admin = APIRouter(
    prefix=PREFIXE_API_ADMIN,
    tags=["Espace Administrateur"],
    dependencies=[Depends(admin_courant)],
)


# ---------------------------------------------------------------------------
# Données statiques de la matrice RBAC
# ---------------------------------------------------------------------------

_TECHNOLOGIES: list[dict] = [
    {"id": "profil", "nom": "Mon profil", "description": "Gestion du profil utilisateur", "icone": "profil", "roles_autorises": ["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"], "niveau_acces": "standard"},
    {"id": "cnin", "nom": "Vérification CNI", "description": "Scan et OCR de la Carte Nationale d'Identité", "icone": "cnin", "roles_autorises": ["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"], "niveau_acces": "standard"},
    {"id": "faciale", "nom": "Reconnaissance faciale", "description": "Vérification visuelle, liveness, matching", "icone": "faciale", "roles_autorises": ["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"], "niveau_acces": "sensible"},
    {"id": "score", "nom": "Score de confiance", "description": "Calcul et historique du score d'identité", "icone": "score", "roles_autorises": ["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"], "niveau_acces": "standard"},
    {"id": "consentements", "nom": "Consentements", "description": "Gestion des consentements RGPD/CDP", "icone": "consentements", "roles_autorises": ["citoyen", "medecin", "ong", "super_administrateur"], "niveau_acces": "sensible"},
    {"id": "chatbot", "nom": "Assistant DigiID", "description": "Chatbot intelligent avec RAG", "icone": "chatbot", "roles_autorises": ["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"], "niveau_acces": "standard"},
    {"id": "admin_users", "nom": "Gestion des utilisateurs", "description": "Liste, recherche, suspension de comptes", "icone": "admin_users", "roles_autorises": ["administrateur", "super_administrateur"], "niveau_acces": "sensible"},
    {"id": "admin_droits", "nom": "Gestion des droits RBAC", "description": "Matrice des permissions et rôles", "icone": "admin_droits", "roles_autorises": ["administrateur", "super_administrateur"], "niveau_acces": "critique"},
    {"id": "admin_admins", "nom": "Gestion des administrateurs", "description": "Création, suspension, réactivation", "icone": "admin_admins", "roles_autorises": ["super_administrateur"], "niveau_acces": "critique"},
    {"id": "audit", "nom": "Journal d'audit", "description": "Traçabilité immuable des événements", "icone": "audit", "roles_autorises": ["administrateur", "super_administrateur"], "niveau_acces": "sensible"},
    {"id": "configuration", "nom": "Configuration système", "description": "Feature flags et paramètres globaux", "icone": "configuration", "roles_autorises": ["super_administrateur"], "niveau_acces": "critique"},
    {"id": "alertes", "nom": "Alertes sécurité", "description": "Détection de fraudes et incidents", "icone": "alertes", "roles_autorises": ["administrateur", "super_administrateur"], "niveau_acces": "sensible"},
]

_ROLES: list[dict] = [
    {"role": "citoyen", "libelle": "Citoyen", "description": "Utilisateur standard DigiID", "niveau": 1, "permissions": ["Consulter mon profil", "Gérer mes consentements", "Voir mon score", "Scanner ma CNI", "Vérification faciale"]},
    {"role": "agent", "libelle": "Agent administratif", "description": "Agent d'une administration publique", "niveau": 2, "permissions": ["Vérifier l'identité d'un citoyen", "Consulter les données publiques", "Lancer une vérification"]},
    {"role": "medecin", "libelle": "Médecin", "description": "Professionnel de santé habilité", "niveau": 3, "permissions": ["Accès au dossier médical", "Vérifier l'identité d'un patient", "Associer des documents médicaux"]},
    {"role": "police", "libelle": "Forces de l'ordre", "description": "Agent des forces de sécurité intérieure", "niveau": 3, "permissions": ["Vérifier l'identité d'une personne", "Consulter l'historique des vérifications", "Lancer une alerte"]},
    {"role": "ong", "libelle": "ONG", "description": "Organisation non gouvernementale partenaire", "niveau": 2, "permissions": ["Vérifier l'identité des bénéficiaires", "Consulter les données autorisées", "Générer des rapports"]},
    {"role": "administrateur", "libelle": "Administrateur", "description": "Gestion du système et des utilisateurs", "niveau": 4, "permissions": ["Gérer les utilisateurs", "Consulter les statistiques", "Gérer les alertes", "Voir les logs", "Gérer les droits RBAC"]},
    {"role": "super_administrateur", "libelle": "Super administrateur", "description": "Accès complet et illimité au système", "niveau": 5, "permissions": ["Accès total au système", "Gérer les administrateurs", "Configurer le système", "Consulter l'audit", "Gérer les droits", "Accès à toutes les technologies"]},
]


# ---------------------------------------------------------------------------
# ENDPOINTS — Matrice RBAC (technologies et rôles)
# ---------------------------------------------------------------------------


@routeur_admin.get(
    "/droits/technologies",
    response_model=list[TechnologieDroit],
    summary="Lister les technologies avec leurs droits d'accès",
    description=(
        "Retourne la liste des technologies / fonctionnalités du système "
        "avec les rôles autorisés à y accéder. "
        "Utilisé par l'admin et le super admin pour visualiser la matrice RBAC."
    ),
)
async def lister_technologies_droits():
    """
    Retourne la liste des technologies avec les rôles qui y ont accès.
    
    Chaque technologie contient :
      - **id** : identifiant unique
      - **nom** : nom affichable
      - **description** : description fonctionnelle
      - **icone** : emoji représentatif
      - **roles_autorises** : liste des rôles ayant accès
      - **niveau_acces** : standard, sensible ou critique
    """
    return _TECHNOLOGIES


@routeur_admin.get(
    "/droits/roles",
    response_model=list[RolePermission],
    summary="Lister les rôles avec leurs permissions",
    description=(
        "Retourne la liste des rôles système avec leurs permissions associées. "
        "Chaque rôle a un niveau hiérarchique qui détermine ses privilèges."
    ),
)
async def lister_roles_permissions():
    """
    Retourne la liste des rôles avec leurs permissions.
    
    Chaque rôle contient :
      - **role** : identifiant unique du rôle (snake_case)
      - **libelle** : nom affichable
      - **description** : description du rôle
      - **niveau** : niveau hiérarchique (1-100)
      - **permissions** : liste des actions autorisées
    """
    return _ROLES


@routeur_admin.get(
    "/tableau-de-bord",
    summary="Tableau de bord administrateur",
)
async def tableau_de_bord_admin(
    admin: Annotated[Utilisateur, Depends(admin_courant)],
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """Vue agrégée du système — chiffres clés pour les admins."""

    # Nombre total d'utilisateurs actifs (tous rôles confondus)
    total_utilisateurs = await session.scalar(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.est_actif == True,
            Utilisateur.est_supprime == False,
        )
    )

    # Nombre d'utilisateurs verrouillés
    total_verrouilles = await session.scalar(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.est_verrouille == True,
        )
    )

    # Nombre d'événements d'audit aujourd'hui
    debut_jour = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
    total_evenements_jour = await session.scalar(
        select(func.count(JournalAudit.id)).where(
            JournalAudit.date_evenement >= debut_jour,
        )
    )

    return {
        "message": "Tableau de bord administrateur",
        "statistiques": {
            "utilisateurs_actifs": total_utilisateurs or 0,
            "comptes_verrouilles": total_verrouilles or 0,
            "evenements_aujourdhui": total_evenements_jour or 0,
        },
        "actions_disponibles": [
            "lister_utilisateurs",
            "consulter_alertes",
            "voir_statistiques",
            "exporter_rapport",
        ],
    }


class UtilisateurApercuAdmin(BaseModel):
    id: str
    prenom_initiale: Optional[str]
    nom_initiale: Optional[str]
    email_masque: str
    ville: Optional[str]
    score_actuel: Optional[int]
    est_verrouille: bool
    date_inscription: Optional[str]


def masquer_email(email: str) -> str:
    if "@" not in email:
        return email

    local, domaine = email.split("@", 1)
    if len(local) <= 2:
        local_masque = local[0] + "*" * max(0, len(local) - 1)
    else:
        local_masque = local[0] + "*" * max(0, len(local) - 2) + local[-1]

    return f"{local_masque}@{domaine}"


def initiale(nom: Optional[str], prenom: Optional[str]) -> Optional[str]:
    if prenom:
        return prenom[0].upper() + "."
    if nom:
        return nom[0].upper() + "."
    return None


# ---------------------------------------------------------------------------
# Schémas Pydantic pour les statistiques et alertes
# ---------------------------------------------------------------------------


class StatsAdmin(BaseModel):
    """Statistiques agrégées pour le dashboard admin."""
    total_utilisateurs: int
    actifs_7_jours: int
    comptes_verrouilles: int
    score_moyen: float
    repartition_par_ville: list[dict]
    inscriptions_par_jour: list[dict]


class AlerteAdminItem(BaseModel):
    """Alerte de sécurité visible par les admins."""
    id: str
    niveau: str
    type_action: str
    description: str
    utilisateur_id: str | None
    adresse_ip: str | None
    date_evenement: str
    resolue: bool = False


@routeur_admin.get(
    "/statistiques",
    response_model=StatsAdmin,
    summary="Statistiques agrégées pour les administrateurs",
)
async def statistiques_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    """
    Retourne les statistiques clés du système sans données personnelles.
    
    Domaines :
      - total_utilisateurs : utilisateurs actifs non supprimés
      - actifs_7_jours : utilisateurs actifs dans les 7 derniers jours
      - comptes_verrouilles : utilisateurs verrouillés
      - score_moyen : score de confiance moyen
      - répartition par ville (top 5)
      - inscriptions par jour (7 derniers jours)
    """
    # Total utilisateurs actifs (tous rôles confondus)
    total = await session.scalar(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.est_actif == True,
            Utilisateur.est_supprime == False,
        )
    )

    # Verrouillés
    verrouilles = await session.scalar(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.est_verrouille == True,
            Utilisateur.est_supprime == False,
        )
    )

    # Score moyen
    score_moyen = await session.scalar(
        select(func.avg(Utilisateur.score_actuel)).where(
            Utilisateur.est_actif == True,
            Utilisateur.est_supprime == False,
            Utilisateur.score_actuel.isnot(None),
        )
    )

    # Actifs 7 derniers jours
    seuil_7j = datetime.now(timezone.utc) - timedelta(days=7)
    actifs_7j = await session.scalar(
        select(func.count(func.distinct(JournalAudit.utilisateur_id))).where(
            JournalAudit.date_evenement >= seuil_7j,
        )
    )

    # Répartition par ville (top 5)
    resultat_villes = await session.execute(
        select(Utilisateur.ville, func.count(Utilisateur.id))
        .where(
            Utilisateur.est_actif == True,
            Utilisateur.est_supprime == False,
            Utilisateur.ville.isnot(None),
            Utilisateur.ville != "",
        )
        .group_by(Utilisateur.ville)
        .order_by(func.count(Utilisateur.id).desc())
        .limit(5)
    )
    repartition_villes = [
        {"ville": ville, "nombre": nb}
        for ville, nb in resultat_villes.all()
    ]

    # Inscriptions par jour (7 derniers jours)
    inscriptions_par_jour = []
    for i in range(6, -1, -1):
        jour = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0) - timedelta(days=i)
        jour_suivant = jour + timedelta(days=1)
        nb = await session.scalar(
            select(func.count(Utilisateur.id)).where(
                Utilisateur.cree_le >= jour,
                Utilisateur.cree_le < jour_suivant,
            )
        )
        inscriptions_par_jour.append({
            "date": jour.strftime("%Y-%m-%d"),
            "nombre": nb or 0,
        })

    return StatsAdmin(
        total_utilisateurs=total or 0,
        actifs_7_jours=actifs_7j or 0,
        comptes_verrouilles=verrouilles or 0,
        score_moyen=round(score_moyen, 1) if score_moyen else 0.0,
        repartition_par_ville=repartition_villes,
        inscriptions_par_jour=inscriptions_par_jour,
    )


@routeur_admin.get(
    "/alertes",
    response_model=List[AlerteAdminItem],
    summary="Alertes de sécurité pour les administrateurs",
)
async def alertes_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    resolues: bool = Query(default=False, description="Inclure les alertes déjà résolues ?"),
    limite: int = Query(default=50, ge=1, le=200, description="Nombre max d'alertes"),
):
    """
    Retourne les alertes de sécurité détectées par le moteur de fraude.
    
    Les alertes sont les incidents FraudeIncident, triés par date
    (plus récentes en premier).
    
    Paramètres :
      - resolues : False = seulement non résolues (défaut)
      - limite : nombre d'alertes retournées (max 200)
    """
    requete = select(FraudeIncident).order_by(FraudeIncident.cree_le.desc())

    if not resolues:
        # Les incidents récents (moins de 72h) sont considérés "non résolus"
        seuil = datetime.now(timezone.utc) - timedelta(hours=72)
        requete = requete.where(FraudeIncident.cree_le >= seuil)

    requete = requete.limit(limite)
    incidents = (await session.scalars(requete)).all()

    alertes = []
    for inc in incidents:
        niveau = inc.niveau or "modere"
        resolue = (datetime.now(timezone.utc) - inc.cree_le) > timedelta(hours=72)
        alertes.append(
            AlerteAdminItem(
                id=str(inc.id),
                niveau=niveau.lower(),
                type_action=inc.type_action.replace("_", " ").capitalize(),
                description=inc.description,
                utilisateur_id=str(inc.utilisateur_id) if inc.utilisateur_id else None,
                adresse_ip=inc.adresse_ip,
                date_evenement=inc.cree_le.strftime("%Y-%m-%d %H:%M:%S"),
                resolue=resolue,
            )
        )

    return alertes


@routeur_admin.get(
    "/utilisateurs",
    response_model=List[UtilisateurApercuAdmin],
    summary="Liste pseudonymisée des utilisateurs pour les admins",
)
async def lister_utilisateurs_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
):
    utilisateurs = (await session.scalars(
        select(Utilisateur)
        .where(
            Utilisateur.est_actif == True,
            Utilisateur.est_supprime == False,
            Utilisateur.role == RolesUtilisateur.CITOYEN.value,
        )
        .order_by(Utilisateur.cree_le.desc())
    )).all()

    apercus = []
    for utilisateur in utilisateurs:
        email = dechiffrer_donnee(utilisateur.email_chiffre)
        prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else None
        nom = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else None

        apercus.append(
            UtilisateurApercuAdmin(
                id=str(utilisateur.id),
                prenom_initiale=initiale(prenom, nom),
                nom_initiale=initiale(nom, prenom),
                email_masque=masquer_email(email),
                ville=utilisateur.ville,
                score_actuel=utilisateur.score_actuel,
                est_verrouille=utilisateur.est_verrouille,
                date_inscription=utilisateur.cree_le.strftime("%Y-%m-%d") if utilisateur.cree_le else None,
            )
        )

    return apercus


# ---------------------------------------------------------------------------
# DÉTAIL D'UN UTILISATEUR POUR L'ADMIN
# ---------------------------------------------------------------------------


class DetailUtilisateurPourAdmin(BaseModel):
    """Détail complet d'un utilisateur, déchiffré pour l'administrateur."""
    id: str
    email: str
    prenom: str | None
    nom: str | None
    telephone: str | None
    ville: str | None
    role: str
    est_actif: bool
    est_verrouille: bool
    est_supprime: bool
    est_email_verifie: bool
    deux_fa_active: bool
    score_actuel: int | None
    digiid_public: str | None
    date_creation: str
    date_derniere_connexion: str | None
    est_visage_verifie: bool
    date_verification_visage: str | None
    score_liveness: float | None
    est_cni_verifiee: bool
    date_verification_cni: str | None
    niveau_verification: str
    progres_verifications: int
    motif_suspension: str | None


@routeur_admin.get(
    "/utilisateurs/{utilisateur_id}/detail",
    response_model=DetailUtilisateurPourAdmin,
    summary="Détail complet d'un utilisateur pour l'administrateur",
    description=(
        "Retourne les informations complètes (déchiffrées) d'un utilisateur. "
        "Accessible aux administrateurs et super admins."
    ),
)
async def detail_utilisateur_admin(
    utilisateur_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    admin: Annotated[Utilisateur, Depends(admin_courant)],
):
    """
    Retourne le détail complet d'un utilisateur (données déchiffrées).

    L'administrateur peut consulter :
      - Identité (email, prénom, nom, téléphone, ville)
      - Statut du compte (actif, verrouillé, 2FA)
      - Vérifications (faciale, CNI, score liveness)
      - Score de confiance
      - Niveau de vérification
    """
    utilisateur = (await session.scalars(
        select(Utilisateur).where(
            Utilisateur.id == utilisateur_id,
            Utilisateur.est_supprime == False,
        )
    )).first()

    if utilisateur is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable.",
        )

    # Dechiffrer les donnees personnelles
    email = dechiffrer_donnee(utilisateur.email_chiffre)
    prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else None
    nom = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else None
    telephone = dechiffrer_donnee(utilisateur.telephone_chiffre) if utilisateur.telephone_chiffre else None

    # Score liveness depuis la derniere verification visuelle
    score_liveness = None
    derniere_verif = (await session.scalars(
        select(VerificationVisuelle)
        .where(
            VerificationVisuelle.utilisateur_id == utilisateur_id,
            VerificationVisuelle.est_supprime == False,
        )
        .order_by(VerificationVisuelle.cree_le.desc())
        .limit(1)
    )).first()
    if derniere_verif:
        score_liveness = derniere_verif.score_liveness

    # Niveau de verification
    verifs = sum([
        1 if utilisateur.est_visage_verifie else 0,
        1 if utilisateur.est_cni_verifiee else 0,
    ])
    niveau_map = {"aucune": 0, "partielle": 1, "renforcee": 2, "complete": 3}
    if verifs == 0:
        niveau_verification = "aucune"
    elif verifs == 1:
        niveau_verification = "partielle"
    elif verifs == 2:
        niveau_verification = "complete"
    else:
        niveau_verification = "aucune"
    progres = min(int(verifs / 2 * 100), 100)

    return DetailUtilisateurPourAdmin(
        id=str(utilisateur.id),
        email=email,
        prenom=prenom,
        nom=nom,
        telephone=telephone,
        ville=utilisateur.ville,
        role=utilisateur.role or "citoyen",
        est_actif=utilisateur.est_actif,
        est_verrouille=utilisateur.est_verrouille,
        est_supprime=utilisateur.est_supprime,
        est_email_verifie=utilisateur.est_email_verifie,
        deux_fa_active=utilisateur.deux_fa_active,
        score_actuel=utilisateur.score_actuel,
        digiid_public=utilisateur.digiid_public,
        date_creation=utilisateur.cree_le.strftime("%Y-%m-%dT%H:%M:%S") if utilisateur.cree_le else "",
        date_derniere_connexion=utilisateur.date_derniere_connexion.strftime("%Y-%m-%dT%H:%M:%S") if utilisateur.date_derniere_connexion else None,
        est_visage_verifie=utilisateur.est_visage_verifie,
        date_verification_visage=utilisateur.date_verification_visage.strftime("%Y-%m-%dT%H:%M:%S") if utilisateur.date_verification_visage else None,
        score_liveness=score_liveness,
        est_cni_verifiee=utilisateur.est_cni_verifiee,
        date_verification_cni=utilisateur.date_verification_cni.strftime("%Y-%m-%dT%H:%M:%S") if utilisateur.date_verification_cni else None,
        niveau_verification=niveau_verification,
        progres_verifications=progres,
        motif_suspension=utilisateur.motif_suspension if hasattr(utilisateur, 'motif_suspension') else None,
    )


# ---------------------------------------------------------------------------
# SUPPRESSION D'UN UTILISATEUR PAR UN ADMIN
# ---------------------------------------------------------------------------


class ReponseSuppressionUtilisateur(BaseModel):
    """Réponse après suppression d'un compte utilisateur par un admin."""
    succes: bool
    message: str
    utilisateur_id: str


async def _notifier_super_admins(
    session: AsyncSession,
    admin: Utilisateur,
    utilisateur_email_masque: str,
    utilisateur_id: UUID,
    raison: str = "",
) -> None:
    """
    Crée une notification in-app + email pour tous les super admins
    quand un administrateur supprime un compte utilisateur.
    """
    # Récupérer tous les super admins actifs
    super_admins = (await session.scalars(
        select(Utilisateur).where(
            Utilisateur.role == RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
            Utilisateur.est_actif == True,
            Utilisateur.est_supprime == False,
        )
    )).all()

    nom_admin = dechiffrer_donnee(admin.prenom_chiffre) if admin.prenom_chiffre else "Admin"
    email_admin = dechiffrer_donnee(admin.email_chiffre)

    for super_admin in super_admins:
        # 1. Notification in-app
        notification = Notification(
            utilisateur_id=super_admin.id,
            type_notification="alerte",
            categorie="securite",
            titre="Suppression de compte utilisateur par un administrateur",
            message=(
                f"L'administrateur {nom_admin} ({email_admin}) a supprimé "
                f"le compte utilisateur {utilisateur_email_masque} (ID: {utilisateur_id})."
                + (f" Raison : {raison}" if raison else "")
            ),
            lien_action="/super-admin/audit",
        )
        session.add(notification)

        # 2. Email au super admin
        email_super = dechiffrer_donnee(super_admin.email_chiffre)
        envoyer_email(
            destinataire=email_super,
            sujet="[DigiID - Alerte] Suppression de compte par un administrateur",
            corps_texte=(
                f"Bonjour,\n\n"
                f"L'administrateur {nom_admin} ({email_admin}) a supprimé le compte "
                f"utilisateur {utilisateur_email_masque} (ID: {utilisateur_id}).\n\n"
                + (f"Raison fournie : {raison}\n\n" if raison else "\n")
                + "Connecte-toi au panneau Super Admin pour plus de détails.\n\n"
                + "L'équipe DigiID"
            ),
        )

    await session.flush()


@routeur_admin.delete(
    "/utilisateurs/{utilisateur_id}",
    response_model=ReponseSuppressionUtilisateur,
    summary="Supprimer le compte d'un utilisateur (soft-delete)",
    description=(
        "Supprime logiquement (soft-delete) un compte utilisateur. "
        "Une notification in-app + email est envoyée à tous les super admins. "
        "L'action est tracée dans le journal d'audit."
    ),
)
async def supprimer_utilisateur_admin(
    requete: Request,
    utilisateur_id: UUID,
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    admin: Annotated[Utilisateur, Depends(admin_courant)],
    confirmation: bool = Query(
        default=True,
        description="Confirmation explicite (true pour supprimer)",
    ),
    raison: str = Query(
        default="",
        description="Motif de la suppression (recommandé pour l'audit)",
    ),
):
    """
    Supprime logiquement (soft-delete) un compte utilisateur.

    Seuls les administrateurs et super admins peuvent supprimer un compte.
    Quand un admin (non super admin) supprime un compte, une notification
    est envoyée à tous les super admins.

    Paramètres :
      - **confirmation** : true pour confirmer la suppression (obligatoire)
      - **raison** : motif de la suppression (recommandé)

    Lève 404 si l'utilisateur n'existe pas ou a déjà été supprimé.
    Lève 422 si la confirmation n'est pas donnée.
    """
    if not confirmation:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La confirmation est obligatoire pour supprimer un compte.",
        )

    # Chercher l'utilisateur cible
    cible = (await session.scalars(
        select(Utilisateur).where(
            Utilisateur.id == utilisateur_id,
            Utilisateur.est_supprime == False,
            Utilisateur.role == RolesUtilisateur.CITOYEN.value,
        )
    )).first()

    if cible is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable ou déjà supprimé.",
        )

    # Soft-delete
    cible.est_supprime = True
    cible.est_actif = False
    cible.date_suppression = datetime.now(timezone.utc)
    # Modifier le hash email pour permettre la réinscription avec le même email
    # (la contrainte UNIQUE sur email_hash au niveau DB bloquerait sinon)
    # On tronque car le champ email_hash est limité à 64 caractères
    ancien_hash = cible.email_hash
    hash_prefixe = f"DEL_{cible.id}"[:16]
    cible.email_hash = f"{hash_prefixe}_{ancien_hash}"[:64]

    # Révoquer toutes ses sessions
    sessions = (await session.scalars(
        select(SessionAuthentification).where(
            SessionAuthentification.utilisateur_id == utilisateur_id,
            SessionAuthentification.est_revoquee == False,
        )
    )).all()
    for session_auth in sessions:
        session_auth.est_revoquee = True
        session_auth.raison_revocation = "compte_supprime_par_admin"

    # Masquer l'email pour la notification
    email_cible = dechiffrer_donnee(cible.email_chiffre)
    email_masque = masquer_email(email_cible)

    # Journal d'audit
    est_super_admin = admin.role == RolesUtilisateur.SUPER_ADMINISTRATEUR.value
    entree_audit = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=admin.id,
        role_acteur=admin.role,
        type_evenement="suppression_utilisateur",
        description=(
            f"{('Super admin' if est_super_admin else 'Admin')} "
            f"{admin.id} a supprimé l'utilisateur {utilisateur_id} "
            f"({email_masque})" + (f" — Raison : {raison}" if raison else "")
        ),
        adresse_ip=obtenir_ip_client(requete),
        donnees_supplementaires={
            "cible_id": str(utilisateur_id),
            "cible_email_masque": email_masque,
            "raison": raison,
            "acteur_role": admin.role,
        },
    )
    session.add(entree_audit)

    # Si c'est un admin (pas super admin), notifier tous les super admins
    if not est_super_admin:
        await _notifier_super_admins(
            session=session,
            admin=admin,
            utilisateur_email_masque=email_masque,
            utilisateur_id=utilisateur_id,
            raison=raison,
        )

    await session.commit()

    return ReponseSuppressionUtilisateur(
        succes=True,
        message=f"Compte {email_masque} supprimé avec succès."
                + (" Une notification a été envoyée aux super admins." if not est_super_admin else ""),
        utilisateur_id=str(utilisateur_id),
    )


# ---------------------------------------------------------------------------
# ENRÔLEMENTS — Liste de tous les enrôlements (admin + super admin)
# ---------------------------------------------------------------------------


class AdminEnrolementItem(BaseModel):
    """Enrôlement vu par l'admin."""
    id: str
    agent_id: str
    agent_nom: str = ""
    citoyen_nom: str
    citoyen_prenom: str
    citoyen_digiid: str | None = None
    citoyen_telephone: str | None = None
    citoyen_email: str | None = None
    statut: str
    notes: str | None = None
    scan_cni: bool = False
    capture_biometrique: bool = False
    date_enrolement: str
    date_validation: str | None = None


@routeur_admin.get(
    "/enrolements",
    response_model=list[AdminEnrolementItem],
    summary="Lister tous les enrôlements (admin)",
    description=(
        "Liste complète des enrôlements avec le nom de l'agent "
        "qui a effectué l'enrôlement."
    ),
)
async def lister_enrolements_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    statut: str = Query("tous", description="Filtrer par statut"),
    agent_id: str | None = Query(None, description="Filtrer par agent"),
    limite: int = Query(50, ge=1, le=500),
):
    query = select(Enrolement)
    if statut and statut != "tous":
        query = query.where(Enrolement.statut == statut)
    if agent_id:
        query = query.where(Enrolement.agent_id == UUID(agent_id))
    query = query.order_by(Enrolement.date_enrolement.desc()).limit(limite)
    enrolements = (await session.scalars(query)).all()

    resultats = []
    for e in enrolements:
        agent_nom = ""
        agent = await session.get(Utilisateur, e.agent_id)
        if agent:
            prenom = dechiffrer_donnee(agent.prenom_chiffre) if agent.prenom_chiffre else ""
            nom = dechiffrer_donnee(agent.nom_chiffre) if agent.nom_chiffre else ""
            agent_nom = f"{prenom} {nom}".strip()

        resultats.append(AdminEnrolementItem(
            id=str(e.id),
            agent_id=str(e.agent_id),
            agent_nom=agent_nom,
            citoyen_nom=e.citoyen_nom,
            citoyen_prenom=e.citoyen_prenom,
            citoyen_digiid=e.citoyen_digiid,
            citoyen_telephone=e.citoyen_telephone,
            citoyen_email=e.citoyen_email,
            statut=e.statut,
            notes=e.notes,
            scan_cni=e.scan_cni,
            capture_biometrique=e.capture_biometrique,
            date_enrolement=e.date_enrolement.strftime("%Y-%m-%dT%H:%M:%S"),
            date_validation=e.date_validation.strftime("%Y-%m-%dT%H:%M:%S") if e.date_validation else None,
        ))
    return resultats


# ---------------------------------------------------------------------------
# AUDIT LOGS POUR ADMIN — Même journal que le super admin
# ---------------------------------------------------------------------------


class AuditEvenementAdminItem(BaseModel):
    """Événement d'audit vu par l'admin."""
    id: str
    date_evenement: str
    utilisateur_id: str | None = None
    role_acteur: str | None = None
    type_evenement: str
    description: str
    adresse_ip: str | None = None
    donnees_supplementaires: dict | None = None


class ListeAuditAdminReponse(BaseModel):
    """Liste paginée des événements d'audit."""
    donnees: list[AuditEvenementAdminItem]
    total: int
    page: int


@routeur_admin.get(
    "/audit",
    response_model=ListeAuditAdminReponse,
    summary="Journal d'audit pour les administrateurs",
    description=(
        "Retourne le journal d'audit complet, paginé et filtrable. "
        "Accessible aux administrateurs et super admins."
    ),
)
async def lister_audit_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    page: int = Query(1, ge=1, description="Numéro de page"),
    limite: int = Query(50, ge=1, le=200, description="Éléments par page"),
    type_evenement: str | None = Query(None, description="Filtrer par type d'événement"),
    recherche: str | None = Query(None, description="Recherche textuelle"),
    date_debut: str | None = Query(None, description="Date début (ISO 8601)"),
    date_fin: str | None = Query(None, description="Date fin (ISO 8601)"),
):
    """
    Journal d'audit paginé et filtrable pour les administrateurs.
    
    Paramètres :
      - **page** : numéro de page (défaut: 1)
      - **limite** : éléments par page (défaut: 50, max: 200)
      - **type_evenement** : filtrer par type d'événement
      - **recherche** : recherche dans la description
      - **date_debut** : date début (ex: 2024-01-01)
      - **date_fin** : date fin (ex: 2024-12-31)
    """
    from datetime import datetime
    
    # Simuler les filtres pour consulter_audit_pagine
    filtres = lambda: None
    filtres.type_evenement = type_evenement
    filtres.recherche = recherche
    filtres.date_debut = datetime.fromisoformat(date_debut) if date_debut else None
    filtres.date_fin = datetime.fromisoformat(date_fin) if date_fin else None
    filtres.limite = limite
    
    evenements, total = await consulter_audit_pagine(
        session=session,
        filtres=filtres,
        page=page,
    )
    
    return ListeAuditAdminReponse(
        donnees=[
            AuditEvenementAdminItem(
                id=str(e.id),
                date_evenement=e.date_evenement.strftime("%Y-%m-%dT%H:%M:%S"),
                utilisateur_id=str(e.utilisateur_id) if e.utilisateur_id else None,
                role_acteur=e.role_acteur,
                type_evenement=e.type_evenement,
                description=e.description,
                adresse_ip=e.adresse_ip,
                donnees_supplementaires=e.donnees_supplementaires,
            )
            for e in evenements
        ],
        total=total,
        page=page,
    )


# ---------------------------------------------------------------------------
# MONITORING TEMPS RÉEL POUR ADMIN — Version en lecture seule avec masquage
# ---------------------------------------------------------------------------


class UtilisateurConnecteAdmin(BaseModel):
    """Utilisateur connecté vu par l'admin (données masquées)."""
    utilisateur_id: str
    email_masque: str
    role: str
    session_id: str
    adresse_ip: str
    ville_estimee: Optional[str] = None
    derniere_activite: str
    est_active: bool
    nb_sessions_actives: int = 1


# ---------------------------------------------------------------------------
# ACTIVITÉS MÉDICALES (admin) — dossiers médicaux, consultations, ordonnances
# ---------------------------------------------------------------------------


class AdminDossierMedicalItem(BaseModel):
    """Dossier médical vu par l'admin."""
    id: str
    medecin_id: str
    medecin_nom: str = ""
    patient_nom: str
    patient_digiid: str | None = None
    motif: str | None = None
    diagnostic: str | None = None
    statut: str
    consultations_count: int = 0
    ordonnances_count: int = 0
    date_creation: str
    date_modification: str | None = None


@routeur_admin.get(
    "/medical/dossiers",
    response_model=list[AdminDossierMedicalItem],
    summary="Lister tous les dossiers médicaux (admin)",
    description="Liste complète des dossiers médicaux avec le médecin traitant.",
)
async def lister_dossiers_medicaux_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    statut: str = Query("tous"),
    medecin_id: str | None = Query(None),
    limite: int = Query(50, ge=1, le=200),
):
    from src.modeles.dossier_medical import DossierMedical
    query = select(DossierMedical).order_by(DossierMedical.date_creation.desc())
    if statut and statut != "tous":
        query = query.where(DossierMedical.statut == statut)
    if medecin_id:
        query = query.where(DossierMedical.medecin_id == UUID(medecin_id))
    query = query.limit(limite)
    dossiers = (await session.scalars(query)).all()

    # Charger les medecins
    med_ids = list(set(str(d.medecin_id) for d in dossiers))
    medecins = {}
    if med_ids:
        result = await session.execute(
            select(Utilisateur).where(Utilisateur.id.in_([UUID(m) for m in med_ids]))
        )
        for m in result.scalars().all():
            prenom = dechiffrer_donnee(m.prenom_chiffre) if m.prenom_chiffre else ""
            nom = dechiffrer_donnee(m.nom_chiffre) if m.nom_chiffre else ""
            medecins[str(m.id)] = f"{prenom} {nom}".strip() or "Medecin"

    resultat = []
    for d in dossiers:
        resultat.append(AdminDossierMedicalItem(
            id=str(d.id),
            medecin_id=str(d.medecin_id),
            medecin_nom=medecins.get(str(d.medecin_id), ""),
            patient_nom=d.patient_nom,
            patient_digiid=d.patient_digiid,
            motif=d.motif,
            diagnostic=d.diagnostic,
            statut=d.statut,
            consultations_count=getattr(d, 'consultations_count', 0) or 0,
            ordonnances_count=getattr(d, 'ordonnances_count', 0) or 0,
            date_creation=d.date_creation.strftime("%Y-%m-%dT%H:%M:%S") if d.date_creation else "",
            date_modification=d.date_modification.strftime("%Y-%m-%dT%H:%M:%S") if d.date_modification else None,
        ))
    return resultat


# ---------------------------------------------------------------------------
# ACTIVITÉS POLICE (admin) — vérifications et signalements
# ---------------------------------------------------------------------------


class AdminVerificationPoliceItem(BaseModel):
    """Vérification police vue par l'admin."""
    id: str
    officier_id: str
    officier_nom: str = ""
    personne_digiid: str | None = None
    personne_nom: str | None = None
    type_verification: str
    resultat: str
    notes: str | None = None
    est_signalement_fraude: bool = False
    date_verification: str


@routeur_admin.get(
    "/police/verifications",
    response_model=list[AdminVerificationPoliceItem],
    summary="Lister toutes les vérifications police (admin)",
)
async def lister_verifications_police_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    limite: int = Query(50, ge=1, le=200),
):
    from src.modeles.verification_police import VerificationPolice
    query = select(VerificationPolice).order_by(VerificationPolice.date_verification.desc()).limit(limite)
    verifications = (await session.scalars(query)).all()

    off_ids = list(set(str(v.officier_id) for v in verifications))
    officiers = {}
    if off_ids:
        result = await session.execute(
            select(Utilisateur).where(Utilisateur.id.in_([UUID(o) for o in off_ids]))
        )
        for o in result.scalars().all():
            prenom = dechiffrer_donnee(o.prenom_chiffre) if o.prenom_chiffre else ""
            nom = dechiffrer_donnee(o.nom_chiffre) if o.nom_chiffre else ""
            officiers[str(o.id)] = f"{prenom} {nom}".strip() or "Officier"

    return [AdminVerificationPoliceItem(
        id=str(v.id), officier_id=str(v.officier_id),
        officier_nom=officiers.get(str(v.officier_id), ""),
        personne_digiid=v.personne_digiid, personne_nom=v.personne_nom,
        type_verification=v.type_verification, resultat=v.resultat,
        notes=v.notes, est_signalement_fraude=v.est_signalement_fraude,
        date_verification=v.date_verification.strftime("%Y-%m-%dT%H:%M:%S") if v.date_verification else "",
    ) for v in verifications]


class AdminSignalementItem(BaseModel):
    """Signalement de fraude vu par l'admin."""
    id: str
    officier_id: str
    officier_nom: str = ""
    personne_digiid: str | None = None
    motif: str
    description: str | None = None
    statut: str
    date_signalement: str
    date_traitement: str | None = None


@routeur_admin.get(
    "/police/signalements",
    response_model=list[AdminSignalementItem],
    summary="Lister tous les signalements police (admin)",
)
async def lister_signalements_police_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    limite: int = Query(50, ge=1, le=200),
):
    from src.modeles.signalement_fraude import SignalementFraude
    query = select(SignalementFraude).order_by(SignalementFraude.date_signalement.desc()).limit(limite)
    signalements = (await session.scalars(query)).all()

    off_ids = list(set(str(s.officier_id) for s in signalements))
    officiers = {}
    if off_ids:
        result = await session.execute(
            select(Utilisateur).where(Utilisateur.id.in_([UUID(o) for o in off_ids]))
        )
        for o in result.scalars().all():
            prenom = dechiffrer_donnee(o.prenom_chiffre) if o.prenom_chiffre else ""
            nom = dechiffrer_donnee(o.nom_chiffre) if o.nom_chiffre else ""
            officiers[str(o.id)] = f"{prenom} {nom}".strip() or "Officier"

    return [AdminSignalementItem(
        id=str(s.id), officier_id=str(s.officier_id),
        officier_nom=officiers.get(str(s.officier_id), ""),
        personne_digiid=s.personne_digiid, motif=s.motif,
        description=s.description, statut=s.statut,
        date_signalement=s.date_signalement.strftime("%Y-%m-%dT%H:%M:%S") if s.date_signalement else "",
        date_traitement=s.date_traitement.strftime("%Y-%m-%dT%H:%M:%S") if s.date_traitement else None,
    ) for s in signalements]


# ---------------------------------------------------------------------------
# ACTIVITÉS ONG (admin) — bénéficiaires, programmes, missions
# ---------------------------------------------------------------------------


class AdminBeneficiaireItem(BaseModel):
    """Bénéficiaire ONG vu par l'admin."""
    id: str
    ong_id: str
    ong_nom: str = ""
    nom: str
    digiid: str | None = None
    programme: str | None = None
    zone: str | None = None
    statut: str
    date_inscription: str


@routeur_admin.get(
    "/ong/beneficiaires",
    response_model=list[AdminBeneficiaireItem],
    summary="Lister tous les bénéficiaires ONG (admin)",
)
async def lister_beneficiaires_ong_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    limite: int = Query(50, ge=1, le=200),
):
    from src.modeles.beneficiaire_ong import BeneficiaireONG
    query = select(BeneficiaireONG).order_by(BeneficiaireONG.date_inscription.desc()).limit(limite)
    beneficiaires = (await session.scalars(query)).all()

    ong_ids = list(set(str(b.ong_id) for b in beneficiaires))
    ongs = {}
    if ong_ids:
        result = await session.execute(
            select(Utilisateur).where(Utilisateur.id.in_([UUID(o) for o in ong_ids]))
        )
        for o in result.scalars().all():
            prenom = dechiffrer_donnee(o.prenom_chiffre) if o.prenom_chiffre else ""
            nom = dechiffrer_donnee(o.nom_chiffre) if o.nom_chiffre else ""
            ongs[str(o.id)] = f"{prenom} {nom}".strip() or "ONG"

    return [AdminBeneficiaireItem(
        id=str(b.id), ong_id=str(b.ong_id),
        ong_nom=ongs.get(str(b.ong_id), ""),
        nom=b.nom, digiid=b.digiid,
        programme=b.programme, zone=b.zone,
        statut=b.statut,
        date_inscription=b.date_inscription.strftime("%Y-%m-%dT%H:%M:%S") if b.date_inscription else "",
    ) for b in beneficiaires]


@routeur_admin.get(
    "/ong/programmes",
    response_model=list,
    summary="Lister tous les programmes ONG (admin)",
)
async def lister_programmes_ong_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    limite: int = Query(50, ge=1, le=200),
):
    from src.modeles.programme_ong import ProgrammeONG
    query = select(ProgrammeONG).order_by(ProgrammeONG.date_debut.desc()).limit(limite)
    programmes = (await session.scalars(query)).all()

    ong_ids = list(set(str(p.ong_id) for p in programmes))
    ongs = {}
    if ong_ids:
        result = await session.execute(
            select(Utilisateur).where(Utilisateur.id.in_([UUID(o) for o in ong_ids]))
        )
        for o in result.scalars().all():
            prenom = dechiffrer_donnee(o.prenom_chiffre) if o.prenom_chiffre else ""
            nom = dechiffrer_donnee(o.nom_chiffre) if o.nom_chiffre else ""
            ongs[str(o.id)] = f"{prenom} {nom}".strip() or "ONG"

    return [{
        "id": str(p.id), "ong_id": str(p.ong_id),
        "ong_nom": ongs.get(str(p.ong_id), ""),
        "nom": p.nom, "zone": p.zone, "statut": p.statut,
        "date_debut": p.date_debut.strftime("%Y-%m-%d") if p.date_debut else "",
    } for p in programmes]


@routeur_admin.get(
    "/ong/missions",
    response_model=list,
    summary="Lister toutes les missions ONG (admin)",
)
async def lister_missions_ong_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    limite: int = Query(50, ge=1, le=200),
):
    from src.modeles.mission_ong import MissionONG
    query = select(MissionONG).order_by(MissionONG.date_depart.desc()).limit(limite)
    missions = (await session.scalars(query)).all()

    ong_ids = list(set(str(m.ong_id) for m in missions))
    ongs = {}
    if ong_ids:
        result = await session.execute(
            select(Utilisateur).where(Utilisateur.id.in_([UUID(o) for o in ong_ids]))
        )
        for o in result.scalars().all():
            prenom = dechiffrer_donnee(o.prenom_chiffre) if o.prenom_chiffre else ""
            nom = dechiffrer_donnee(o.nom_chiffre) if o.nom_chiffre else ""
            ongs[str(o.id)] = f"{prenom} {nom}".strip() or "ONG"

    return [{
        "id": str(m.id), "ong_id": str(m.ong_id),
        "ong_nom": ongs.get(str(m.ong_id), ""),
        "titre": m.titre, "zone": m.zone, "statut": m.statut,
        "date_depart": m.date_depart.strftime("%Y-%m-%d") if m.date_depart else "",
    } for m in missions]


@routeur_admin.get(
    "/monitoring/resume",
    response_model=service_monitoring.ResumeTempsReel,
    summary="Résumé monitoring temps réel (admin)",
    description="Résumé instantané de l'activité du système pour l'administrateur.",
)
async def resume_monitoring_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
):
    """Résumé temps réel (lecture seule)."""
    return await service_monitoring.obtenir_resume_temps_reel(session)


@routeur_admin.get(
    "/monitoring/utilisateurs-connectes",
    response_model=list[UtilisateurConnecteAdmin],
    summary="Liste des utilisateurs connectés (admin)",
    description="Liste des utilisateurs connectés avec emails masqués.",
)
async def utilisateurs_connectes_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    limite: int = Query(default=50, ge=1, le=200),
    filtre_role: str | None = Query(default=None),
):
    """
    Liste les utilisateurs connectés avec données masquées.
    L'admin voit les emails masqués, pas les données brutes.
    """
    utilisateurs = await service_monitoring.obtenir_utilisateurs_connectes(
        session=session, limite=limite, filtre_role=filtre_role,
    )
    resultat = []
    for u in utilisateurs:
        email_masque = u.email[:1] + "***" + u.email[u.email.index("@"):] if "@" in u.email else u.email
        resultat.append(
            UtilisateurConnecteAdmin(
                utilisateur_id=u.utilisateur_id,
                email_masque=email_masque,
                role=u.role,
                session_id=u.session_id,
                adresse_ip=u.adresse_ip,
                ville_estimee=u.ville_estimee,
                derniere_activite=u.derniere_activite,
                est_active=u.est_active,
                nb_sessions_actives=u.nb_sessions_actives,
            )
        )
    return resultat


@routeur_admin.get(
    "/monitoring/activites",
    response_model=list[service_monitoring.ActiviteRecente],
    summary="Activités récentes (admin)",
    description="Flux des dernières activités du système.",
)
async def activites_recentes_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    limite: int = Query(default=20, ge=1, le=100),
):
    """Activités récentes pour l'admin."""
    return await service_monitoring.obtenir_activites_recentes(
        session=session, limite=limite,
    )


@routeur_admin.get(
    "/monitoring/alertes",
    response_model=list[service_monitoring.AlerteSecuriteItem],
    summary="Alertes sécurité (admin)",
    description="Alertes de sécurité actives.",
)
async def alertes_monitoring_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
    limite: int = Query(default=20, ge=1, le=100),
):
    """Alertes sécurité pour l'admin."""
    return await service_monitoring.obtenir_alertes_securite(
        session=session, limite=limite, non_resolues_seulement=True,
    )


@routeur_admin.get(
    "/monitoring/complet",
    response_model=service_monitoring.ResumeMonitoring,
    summary="Monitoring complet (admin)",
    description="Agrège toutes les données de monitoring en une réponse unique.",
)
async def monitoring_complet_admin(
    session: Annotated[AsyncSession, Depends(obtenir_session)],
    _: Annotated[Utilisateur, Depends(admin_courant)],
):
    """Point d'entrée unique pour le dashboard admin temps réel."""
    resultat = await service_monitoring.obtenir_monitoring_complet(session)
    # Masquer les emails pour l'admin
    for u in resultat.utilisateurs_connectes:
        if "@" in u.email:
            u.email = u.email[:1] + "***" + u.email[u.email.index("@"):]
    for a in resultat.activites_recentes:
        if a.email and "@" in a.email:
            a.email = a.email[:1] + "***" + a.email[a.email.index("@"):]
    for a in resultat.alertes:
        if a.email and "@" in a.email:
            a.email = a.email[:1] + "***" + a.email[a.email.index("@"):]
    return resultat



