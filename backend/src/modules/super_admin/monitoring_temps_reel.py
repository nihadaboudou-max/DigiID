# -*- coding: utf-8 -*-
"""
Service de Monitoring Temps Réel — Super Admin & Admin.

Permet le contrôle en temps réel des utilisateurs connectés,
la supervision des sessions actives et la détection d'anomalies.

Fonctionnalités :
  1. Tableau de bord temps réel : utilisateurs connectés, sessions actives
  2. Liste des utilisateurs actuellement connectés (avec détails)
  3. Forcer la déconnexion d'un utilisateur en temps réel
  4. Détection de connexions suspectes (IP inhabituelles, multi-sessions)
  5. Historique des activités en temps réel (push via polling)
  6. Géolocalisation estimée des connexions
  7. Alertes de sécurité instantanées

Sécurité :
  - Tous les endpoints nécessitent le rôle super_admin
  - Les actions sont tracées dans le journal d'audit
  - Détection de fraudes automatique
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.constantes import RolesUtilisateur
from src.modeles import (
    Utilisateur,
    SessionAuthentification,
    JournalAudit,
    FraudeIncident,
)
from src.noyau import dechiffrer_donnee, journal
from src.noyau.exceptions import ErreurRessourceIntrouvable, ErreurValidation


# =============================================================================
# CONSTANTES
# =============================================================================

#: Seuil de sessions simultanées pour déclencher une alerte
SEUIL_SESSIONS_SIMULTANEES: int = 5

#: Période de vérification des connexions suspectes (minutes)
PERIODE_SUSPICION_MINUTES: int = 30

#: Nombre maximum de localisations IP différentes avant alerte
SEUIL_IP_DIFFERENTES: int = 3

#: Durée de validité d'une session "active" (30 minutes sans activité = inactif)
DUREE_SESSION_ACTIVE_MINUTES: int = 30


# =============================================================================
# SCHÉMAS INTERNES (sortie API)
# =============================================================================

from pydantic import BaseModel, ConfigDict
from typing import Optional as Opt


class UtilisateurConnecte(BaseModel):
    """
    Représentation d'un utilisateur connecté en temps réel.
    """
    model_config = ConfigDict(from_attributes=True)

    utilisateur_id: str
    email: str
    prenom: Optional[str] = None
    nom: Optional[str] = None
    role: str
    session_id: str
    adresse_ip: str
    agent_utilisateur: Optional[str] = None
    ville_estimee: Optional[str] = None
    pays_estime: Optional[str] = None
    connexion_le: str  # ISO format
    derniere_activite: str  # ISO format
    expire_le: str  # ISO format
    est_active: bool
    nb_sessions_actives: int = 1


class ResumeTempsReel(BaseModel):
    """
    Résumé du tableau de bord temps réel.
    """
    utilisateurs_connectes: int
    sessions_actives: int
    connexions_aujourd_hui: int
    administrateurs_connectes: int
    utilisateurs_avec_sessions_multiples: int
    alerts_recents: int
    timestamp: str


class ActiviteRecente(BaseModel):
    """
    Activité récente d'un utilisateur dans le système.
    """
    id: str
    type_evenement: str
    description: str
    utilisateur_id: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    adresse_ip: Optional[str] = None
    date_evenement: str


class AlerteSecuriteItem(BaseModel):
    """
    Alerte de sécurité en temps réel.
    """
    id: str
    type_incident: str
    niveau: str
    description: str
    utilisateur_id: Optional[str] = None
    email: Optional[str] = None
    adresse_ip: Optional[str] = None
    score_risque: int
    date_detection: str
    resolue: bool = False


class ResumeMonitoring(BaseModel):
    """
    Résumé complet du monitoring en temps réel.
    """
    resume: ResumeTempsReel
    utilisateurs_connectes: list[UtilisateurConnecte]
    activites_recentes: list[ActiviteRecente]
    alertes: list[AlerteSecuriteItem]


# =============================================================================
# FONCTIONS SERVICE
# =============================================================================


async def obtenir_resume_temps_reel(
    session: AsyncSession,
    minutes_activite: int = DUREE_SESSION_ACTIVE_MINUTES,
) -> ResumeTempsReel:
    """
    Retourne un résumé instantané de l'activité du système.
    
    Utile pour le dashboard admin/super admin. Calculate :
      - Nombre d'utilisateurs connectés actuellement
      - Nombre total de sessions actives
      - Connexions aujourd'hui
      - Admins connectés
      - Utilisateurs avec sessions multiples (suspicion)
      - Alertes récentes non résolues
    
    Args:
        session: Session SQLAlchemy asynchrone
        minutes_activite: Durée considérée comme "actif" (défaut: 30 min)
    
    Returns:
        ResumeTempsReel: Résumé instantané
    """
    maintenant = datetime.now(timezone.utc)
    seuil_actif = maintenant - timedelta(minutes=minutes_activite)
    debut_jour = maintenant.replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Sessions actives (non révoquées, non expirées)
    sessions_actives = await session.scalar(
        select(func.count(SessionAuthentification.id)).where(
            SessionAuthentification.est_revoquee == False,
            SessionAuthentification.date_expiration > maintenant,
        )
    ) or 0

    # 2. Sessions avec activité récente (dernière utilisation < 30 min)
    sessions_actives_recentes = await session.scalar(
        select(func.count(SessionAuthentification.id)).where(
            SessionAuthentification.est_revoquee == False,
            SessionAuthentification.date_expiration > maintenant,
            SessionAuthentification.date_derniere_utilisation >= seuil_actif,
        )
    ) or 0

    # 3. Connexions aujourd'hui
    connexions_aujourd_hui = await session.scalar(
        select(func.count(JournalAudit.id)).where(
            JournalAudit.type_evenement.ilike("%connexion%"),
            JournalAudit.date_evenement >= debut_jour,
            JournalAudit.date_evenement < maintenant,
        )
    ) or 0

    # 4. Admins connectés (sessions actives avec rôle admin/super admin)
    admins_connectes = await session.scalar(
        select(func.count(func.distinct(SessionAuthentification.utilisateur_id)))
        .join(Utilisateur, SessionAuthentification.utilisateur_id == Utilisateur.id)
        .where(
            SessionAuthentification.est_revoquee == False,
            SessionAuthentification.date_expiration > maintenant,
            Utilisateur.role.in_([
                RolesUtilisateur.ADMINISTRATEUR.value,
                RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
            ]),
        )
    ) or 0

    # 5. Utilisateurs avec sessions multiples (détection partage compte)
    # Compter les utilisateurs ayant >= SEUIL sessions actives
    sous_requete = (
        select(SessionAuthentification.utilisateur_id)
        .where(
            SessionAuthentification.est_revoquee == False,
            SessionAuthentification.date_expiration > maintenant,
        )
        .group_by(SessionAuthentification.utilisateur_id)
        .having(func.count(SessionAuthentification.id) >= SEUIL_SESSIONS_SIMULTANEES)
    ).subquery()
    
    resultat = await session.execute(
        select(func.count()).select_from(sous_requete)
    )
    sessions_multiples = resultat.scalar() or 0

    # 6. Alertes récentes non résolues (< 72h)
    seuil_alerte = maintenant - timedelta(hours=72)
    alertes_recents = await session.scalar(
        select(func.count(FraudeIncident.id)).where(
            FraudeIncident.cree_le >= seuil_alerte,
        )
    ) or 0

    return ResumeTempsReel(
        utilisateurs_connectes=sessions_actives_recentes,
        sessions_actives=sessions_actives,
        connexions_aujourd_hui=connexions_aujourd_hui,
        administrateurs_connectes=admins_connectes,
        utilisateurs_avec_sessions_multiples=sessions_multiples,
        alerts_recents=alertes_recents,
        timestamp=maintenant.isoformat(),
    )


async def obtenir_utilisateurs_connectes(
    session: AsyncSession,
    limite: int = 50,
    filtre_role: Optional[str] = None,
    recherche: Optional[str] = None,
) -> list[UtilisateurConnecte]:
    """
    Liste en temps réel des utilisateurs actuellement connectés.
    
    Inclut les sessions non révoquées avec activité < 30 min.
    Déchiffre les emails pour l'affichage admin.
    
    Args:
        session: Session SQLAlchemy asynchrone
        limite: Nombre maximum d'utilisateurs à retourner
        filtre_role: Filtrer par rôle (optionnel)
        recherche: Recherche textuelle sur email/nom (optionnel)
    
    Returns:
        list[UtilisateurConnecte]: Liste des utilisateurs connectés
    """
    maintenant = datetime.now(timezone.utc)
    seuil_actif = maintenant - timedelta(minutes=DUREE_SESSION_ACTIVE_MINUTES)

    # Requête de base : sessions actives avec utilisateurs
    requete = (
        select(SessionAuthentification, Utilisateur)
        .join(Utilisateur, SessionAuthentification.utilisateur_id == Utilisateur.id)
        .where(
            SessionAuthentification.est_revoquee == False,
            SessionAuthentification.date_expiration > maintenant,
        )
        .order_by(SessionAuthentification.date_derniere_utilisation.desc())
    )

    # Filtres optionnels
    if filtre_role:
        requete = requete.where(Utilisateur.role == filtre_role)
    
    if recherche:
        requete = requete.where(
            Utilisateur.email_hash.ilike(f"%{recherche}%")
        )

    requete = requete.limit(limite)
    resultat = await session.execute(requete)
    lignes = resultat.all()

    # Compter le nombre de sessions par utilisateur
    utilisateurs_connectes = []
    compteur_sessions: dict[UUID, int] = {}

    # Premier passage : compter sessions
    for session_auth, utilisateur in lignes:
        uid = utilisateur.id
        compteur_sessions[uid] = compteur_sessions.get(uid, 0) + 1

    # Deuxième passage : construire la liste
    deja_vus: set[UUID] = set()
    for session_auth, utilisateur in lignes:
        uid = utilisateur.id
        if uid in deja_vus:
            continue
        deja_vus.add(uid)

        email = dechiffrer_donnee(utilisateur.email_chiffre)
        prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else None
        nom = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else None

        est_active = session_auth.date_derniere_utilisation >= seuil_actif

        utilisateurs_connectes.append(
            UtilisateurConnecte(
                utilisateur_id=str(uid),
                email=email,
                prenom=prenom,
                nom=nom,
                role=utilisateur.role,
                session_id=str(session_auth.id),
                adresse_ip=session_auth.adresse_ip,
                agent_utilisateur=session_auth.agent_utilisateur,
                ville_estimee=session_auth.ville_estimee,
                pays_estime=session_auth.pays_estime,
                connexion_le=session_auth.cree_le.isoformat(),
                derniere_activite=session_auth.date_derniere_utilisation.isoformat(),
                expire_le=session_auth.date_expiration.isoformat(),
                est_active=est_active,
                nb_sessions_actives=compteur_sessions.get(uid, 1),
            )
        )

    return utilisateurs_connectes


async def forcer_deconnexion_utilisateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    utilisateur_id: UUID,
    raison: str = "Déconnexion forcée par super admin",
    adresse_ip: Optional[str] = None,
) -> dict:
    """
    Déconnecte immédiatement un utilisateur de TOUTES ses sessions.
    
    Action en temps réel :
      1. Révoque toutes les sessions actives de l'utilisateur
      2. Trace l'action dans le journal d'audit
      3. Retourne le nombre de sessions révoquées
    
    Args:
        session: Session SQLAlchemy asynchrone
        super_admin: Instance du super admin effectuant l'action
        utilisateur_id: UUID de l'utilisateur à déconnecter
        raison: Motif de la déconnexion forcée
        adresse_ip: Adresse IP du super admin (traçabilité)
    
    Returns:
        dict: Résultat avec nombre de sessions révoquées
    
    Raises:
        ErreurRessourceIntrouvable: Si l'utilisateur n'existe pas
    """
    # Vérifier que l'utilisateur existe
    resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.id == utilisateur_id)
    )
    utilisateur = resultat.scalar_one_or_none()
    if utilisateur is None:
        raise ErreurRessourceIntrouvable(
            f"Utilisateur {utilisateur_id} introuvable",
            message_utilisateur="Utilisateur introuvable.",
        )

    # Révoquer toutes les sessions actives
    maintenant = datetime.now(timezone.utc)
    resultat_sessions = await session.execute(
        select(SessionAuthentification).where(
            SessionAuthentification.utilisateur_id == utilisateur_id,
            SessionAuthentification.est_revoquee == False,
        )
    )
    sessions_actives = resultat_sessions.scalars().all()
    nb_revoquees = len(sessions_actives)

    for sess in sessions_actives:
        sess.est_revoquee = True
        sess.date_revocation = maintenant
        sess.raison_revocation = raison

    # Audit
    email = dechiffrer_donnee(utilisateur.email_chiffre)
    entree_audit = JournalAudit(
        date_evenement=maintenant,
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="deconnexion_forcee",
        description=(
            f"Déconnexion forcée de l'utilisateur {utilisateur_id} ({email}). "
            f"{nb_revoquees} session(s) révoquée(s). Raison : {raison}"
        ),
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "utilisateur_cible_id": str(utilisateur_id),
            "email": email,
            "sessions_revoquees": nb_revoquees,
            "raison": raison,
            "super_admin_id": str(super_admin.id),
        },
    )
    session.add(entree_audit)

    await session.commit()

    journal.info(
        f"Déconnexion forcée : {email} ({utilisateur_id}) "
        f"| {nb_revoquees} sessions | par {super_admin.id}"
    )

    return {
        "succes": True,
        "message": f"{nb_revoquees} session(s) révoquée(s) pour {email}",
        "utilisateur_id": str(utilisateur_id),
        "email": email,
        "sessions_revoquees": nb_revoquees,
        "raison": raison,
    }


async def obtenir_activites_recentes(
    session: AsyncSession,
    limite: int = 20,
    type_evenement: Optional[str] = None,
) -> list[ActiviteRecente]:
    """
    Retourne les activités récentes (audit) pour le flux temps réel.
    
    Args:
        session: Session SQLAlchemy asynchrone
        limite: Nombre d'activités à retourner
        type_evenement: Filtrer par type (optionnel)
    
    Returns:
        list[ActiviteRecente]: Liste des activités récentes
    """
    maintenant = datetime.now(timezone.utc)
    seuil = maintenant - timedelta(hours=24)  # Dernières 24h

    requete = (
        select(JournalAudit)
        .where(JournalAudit.date_evenement >= seuil)
        .order_by(JournalAudit.date_evenement.desc())
    )

    if type_evenement:
        requete = requete.where(JournalAudit.type_evenement == type_evenement)

    requete = requete.limit(limite)
    resultat = await session.execute(requete)
    evenements = resultat.scalars().all()

    activites = []
    for evt in evenements:
        email = None
        role = None
        if evt.utilisateur_id:
            # Essayer de récupérer l'email de l'utilisateur
            user_result = await session.execute(
                select(Utilisateur).where(Utilisateur.id == evt.utilisateur_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                email = dechiffrer_donnee(user.email_chiffre)
                role = user.role

        activites.append(
            ActiviteRecente(
                id=str(evt.id),
                type_evenement=evt.type_evenement,
                description=evt.description,
                utilisateur_id=str(evt.utilisateur_id) if evt.utilisateur_id else None,
                email=email,
                role=role,
                adresse_ip=evt.adresse_ip,
                date_evenement=evt.date_evenement.isoformat(),
            )
        )

    return activites


async def obtenir_alertes_securite(
    session: AsyncSession,
    limite: int = 20,
    non_resolues_seulement: bool = True,
) -> list[AlerteSecuriteItem]:
    """
    Retourne les alertes de sécurité pour le monitoring temps réel.
    
    Args:
        session: Session SQLAlchemy asynchrone
        limite: Nombre d'alertes à retourner
        non_resolues_seulement: Si True, seulement les alertes récentes (< 72h)
    
    Returns:
        list[AlerteSecuriteItem]: Liste des alertes
    """
    maintenant = datetime.now(timezone.utc)
    
    requete = (
        select(FraudeIncident)
        .order_by(FraudeIncident.cree_le.desc())
    )

    if non_resolues_seulement:
        seuil = maintenant - timedelta(hours=72)
        requete = requete.where(FraudeIncident.cree_le >= seuil)

    requete = requete.limit(limite)
    resultat = await session.execute(requete)
    incidents = resultat.scalars().all()

    alertes = []
    for inc in incidents:
        email = None
        if inc.utilisateur_id:
            user_result = await session.execute(
                select(Utilisateur).where(Utilisateur.id == inc.utilisateur_id)
            )
            user = user_result.scalar_one_or_none()
            if user:
                email = dechiffrer_donnee(user.email_chiffre)

        resolue = (maintenant - inc.cree_le) > timedelta(hours=72)

        alertes.append(
            AlerteSecuriteItem(
                id=str(inc.id),
                type_incident=inc.type_action or "inconnu",
                niveau=inc.niveau or "modere",
                description=inc.description,
                utilisateur_id=str(inc.utilisateur_id) if inc.utilisateur_id else None,
                email=email,
                adresse_ip=inc.adresse_ip,
                score_risque=inc.score_risque or 0,
                date_detection=inc.cree_le.isoformat(),
                resolue=resolue,
            )
        )

    return alertes


async def obtenir_monitoring_complet(
    session: AsyncSession,
) -> ResumeMonitoring:
    """
    Agrège toutes les données de monitoring en une seule réponse.
    
    Utilisé par le dashboard temps réel pour éviter 
    plusieurs appels API consécutifs.
    
    Args:
        session: Session SQLAlchemy asynchrone
    
    Returns:
        ResumeMonitoring: Données complètes de monitoring
    """
    resume = await obtenir_resume_temps_reel(session)
    utilisateurs_connectes = await obtenir_utilisateurs_connectes(session, limite=20)
    activites = await obtenir_activites_recentes(session, limite=10)
    alertes = await obtenir_alertes_securite(session, limite=10)

    return ResumeMonitoring(
        resume=resume,
        utilisateurs_connectes=utilisateurs_connectes,
        activites_recentes=activites,
        alertes=alertes,
    )
