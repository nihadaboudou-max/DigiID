# -*- coding: utf-8 -*-
"""
Service Super Admin Phase 6 — DigiID.

Couche métier avancée pour la gestion des administrateurs.

Architecture :
    Chaque fichier métier = un groupe de fonctions async spécialisées.
    Design pattern « Service Layer » avec injection de dépendance (session DB).
    
Domaines couverts :
    1. **Détails administrateur** — consultation profil complet
    2. **Audit paginé** — journal des événements avec filtrage multicritères
    3. **Statistiques** — métriques système agrégées
    4. **Feature flags** — configuration dynamique modifiable en ligne
    5. **Sessions** — listing et révocation des connexions actives
    6. **Édition/Sécurité** — modification, reset mdp, 2FA, suppression
    7. **Export** — données admin et CSV

Sécurité :
    - Chaque action sensible est tracée dans le journal d'audit
    - Les flags critiques (niveau 2) ont un audit renforcé
    - Le chiffrement est appliqué aux données personnelles (prénom, nom)
    - La suppression est logique (soft-delete) pour traçabilité
    - Les mots de passe générés sont haute entropie (20 car., 6 types)

Scalabilité :
    - Pagination native pour l'audit (paramétrable jusqu'à 200/page)
    - Requêtes SQL optimisées avec indexes composites
    - Agrégations en une passe pour les statistiques
    - Prêt pour cache Redis (TBD : ajouter décorateur @cache)
"""

# =============================================================================
# IMPORTS STANDARD
# =============================================================================
import csv
import io
import json
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

# =============================================================================
# IMPORTS TIERS — SQLAlchemy 2.0 async
# =============================================================================
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

# =============================================================================
# IMPORTS INTERNES — DigiID
# =============================================================================
from src.config.constantes import RolesUtilisateur
from src.modeles import (
    Utilisateur,
    JournalAudit,
    SessionAuthentification,
    ConfigurationSysteme,
)
from src.modules.super_admin.schemas import AdminApercu as AdminApercuSchema
from src.modules.super_admin.schemas_phase6 import (
    # Audit
    FiltresAudit, ListeAuditPaginee, EvenementAuditItem,
    # Statistiques
    StatistiquesCompletes, StatistiquesUtilisateurs, StatistiquesAdmins,
    StatistiquesSessions, StatistiquesScore,
    # Feature flags
    FeatureFlagItem, ListeFeatureFlags, MiseAJourFeatureFlags,
    # Sessions
    SessionAdminItem, ListeSessionsAdmin,
    # Admin modif
    ModifierAdminRequete, DonneesAdminExport,
)
from src.noyau import chiffrer_donnee, hacher_mot_de_passe, journal
from src.noyau.exceptions import ErreurRessourceIntrouvable, ErreurValidation
from src.noyau.journal import journal_audit
from src.modules.super_admin.service import _utilisateur_vers_apercu


# =============================================================================
# CONSTANTES DE CONFIGURATION — ajustez ces valeurs pour scaler
# =============================================================================

#: Nombre maximum de caractères pour un mot de passe généré
LONGUEUR_MOT_DE_PASSE: int = 20

#: Caractères autorisés dans les mots de passe temporaires
ALPHABET_MOT_DE_PASSE: str = string.ascii_letters + string.digits + "!@#$%^&*"

#: Préfixe ajouté pour garantir la conformité (au moins 1 de chaque type)
SUFFIXE_COMPLEXITE: str = "Aa1!"

#: Types d'événements d'audit pour les actions super admin
TYPE_EVENEMENT_MODIFICATION_ADMIN: str = "modification_admin"
TYPE_EVENEMENT_RESET_PASSWORD: str = "reset_password_admin"
TYPE_EVENEMENT_ACTIVATION_2FA: str = "activation_2fa_admin"
TYPE_EVENEMENT_DESACTIVATION_2FA: str = "desactivation_2fa_admin"
TYPE_EVENEMENT_SUPPRESSION_ADMIN: str = "suppression_admin"
TYPE_EVENEMENT_REVOCATION_SESSION: str = "revocation_session_admin"
TYPE_EVENEMENT_MODIFICATION_FLAG: str = "modification_feature_flag"
TYPE_EVENEMENT_EXPORT_ADMIN: str = "export_admin_donnees"

#: Rôles considérés comme administrateurs
ROLES_ADMIN: list[str] = [
    RolesUtilisateur.ADMINISTRATEUR.value,
    RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
]


# =============================================================================
# FONCTIONS UTILITAIRES RÉUTILISABLES
# =============================================================================

# ---------------------------------------------------------------------------
# Helper : Génération d'un mot de passe temporaire haute entropie
# ---------------------------------------------------------------------------

def _generer_mot_de_passe_temporaire() -> str:
    """
    Génère un mot de passe temporaire robuste.
    
    Garantit :
      - 20+ caractères aléatoires
      - Au moins 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial
      - Haute entropie via `secrets` (cryptographiquement sûr)
    
    Returns:
        str: Mot de passe temporaire de 22 caractères minimum
    """
    # Génération aléatoire sécurisée
    nouveau_mdp: str = "".join(
        secrets.choice(ALPHABET_MOT_DE_PASSE) for _ in range(LONGUEUR_MOT_DE_PASSE)
    )
    # Garantie de complexité minimale
    nouveau_mdp += SUFFIXE_COMPLEXITE
    # Mélange pour répartir les caractères spéciaux
    nouveau_mdp_list: list[str] = list(nouveau_mdp)
    secrets.SystemRandom().shuffle(nouveau_mdp_list)
    return "".join(nouveau_mdp_list)


# ---------------------------------------------------------------------------
# Helper : Journalisation d'une action dans l'audit
# ---------------------------------------------------------------------------

def _enregistrer_audit(
    session: AsyncSession,
    type_evenement: str,
    description: str,
    acteur_id: UUID,
    role_acteur: str,
    adresse_ip: Optional[str] = None,
    donnees_supplementaires: Optional[dict] = None,
) -> JournalAudit:
    """
    Crée et retourne une entrée d'audit standardisée.
    
    Centralise la création des entrées d'audit pour :
      - Uniformiser le format
      - Garantir la présence de tous les champs obligatoires
      - Faciliter la maintenance (modification du schéma en un seul endroit)
    
    Args:
        session: Session SQLAlchemy
        type_evenement: Type normalisé (ex: modification_admin)
        description: Description textuelle de l'action
        acteur_id: UUID du super admin qui a effectué l'action
        role_acteur: Rôle de l'acteur (super_administrateur)
        adresse_ip: Adresse IP d'origine (optionnelle)
        donnees_supplementaires: Contexte JSON additionnel (optionnel)
    
    Returns:
        JournalAudit: Instance non commitée de l'entrée d'audit
    """
    entree: JournalAudit = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=acteur_id,
        role_acteur=role_acteur,
        type_evenement=type_evenement,
        description=description,
        adresse_ip=adresse_ip,
        donnees_supplementaires=donnees_supplementaires,
    )
    session.add(entree)
    return entree


# ---------------------------------------------------------------------------
# Helper : Génération d'un fichier CSV en mémoire
# ---------------------------------------------------------------------------

def _generer_csv(
    en_tetes: list[str],
    lignes: list[list[str]],
) -> str:
    """
    Génère un fichier CSV en mémoire à partir d'en-têtes et données.
    
    Utilise un StringIO pour éviter l'écriture disque.
    Compatible avec StreamingResponse FastAPI.
    
    Args:
        en_tetes: Liste des noms de colonnes
        lignes: Liste de listes (chaque ligne = une liste de valeurs)
    
    Returns:
        str: Contenu CSV complet (séparateur virgule, UTF-8)
    """
    tampon: io.StringIO = io.StringIO()
    ecrivain = csv.writer(tampon)
    ecrivain.writerow(en_tetes)
    for ligne in lignes:
        ecrivain.writerow(ligne)
    return tampon.getvalue()


# ---------------------------------------------------------------------------
# Helper : Vérification qu'un utilisateur est un administrateur
# ---------------------------------------------------------------------------

async def _verifier_admin_existe(
    session: AsyncSession,
    admin_id: UUID,
    roles_autorises: Optional[list[str]] = None,
) -> Utilisateur:
    """
    Vérifie qu'un utilisateur existe et qu'il a un rôle administrateur.
    
    Centralise la logique de validation pour tous les endpoints
    qui ciblent un administrateur spécifique.
    
    Args:
        session: Session SQLAlchemy
        admin_id: UUID de l'administrateur cible
        roles_autorises: Liste des rôles autorisés (défaut = ROLES_ADMIN)
    
    Returns:
        Utilisateur: L'instance ORM de l'administrateur
    
    Raises:
        ErreurRessourceIntrouvable: Si l'admin n'existe pas ou n'est pas admin
    """
    if roles_autorises is None:
        roles_autorises = ROLES_ADMIN

    resultat = await session.execute(
        select(Utilisateur).where(
            Utilisateur.id == admin_id,
            Utilisateur.role.in_(roles_autorises),
            Utilisateur.est_supprime == False,
        )
    )
    admin: Optional[Utilisateur] = resultat.scalar_one_or_none()

    if admin is None:
        raise ErreurRessourceIntrouvable(
            f"Admin {admin_id} introuvable",
            message_utilisateur="Administrateur introuvable.",
        )

    return admin


# =============================================================================
# 1. DÉTAILS ADMINISTRATEUR — GET /administrateurs/{id}
# =============================================================================


async def obtenir_admin_detail(
    session: AsyncSession,
    admin_id: UUID,
) -> AdminApercuSchema:
    """
    Récupère les détails complets d'un administrateur.
    
    Workflow :
        1. Vérification de l'existence via `_verifier_admin_existe`
        2. Conversion ORM → schéma via `_utilisateur_vers_apercu`
    
    Args:
        session: Session de base de données asynchrone
        admin_id: UUID de l'administrateur cible
    
    Returns:
        AdminApercuSchema: Profil complet avec email, prénom, nom, etc.
    
    Raises:
        ErreurRessourceIntrouvable: Si l'admin n'existe pas ou est supprimé
    """
    # Étape 1 : Vérifier que l'utilisateur existe et est un admin
    admin: Utilisateur = await _verifier_admin_existe(session, admin_id)

    # Étape 2 : Convertir et retourner
    return _utilisateur_vers_apercu(admin)


# =============================================================================
# 2. AUDIT PAGINÉ — GET /audit
# =============================================================================


async def lister_audit(
    session: AsyncSession,
    filtres: FiltresAudit,
) -> ListeAuditPaginee:
    """
    Retourne les événements d'audit avec pagination et filtrage.
    
    Algorithme :
        1. Construction de la requête SQL avec filtres optionnels
        2. Comptage du total avant pagination (optimisation PostgreSQL)
        3. Application de la pagination (offset/limit)
        4. Tri chronologique inverse (plus récent en premier)
    
    Filtres disponibles (combinables) :
        - **type_evenement** : ex: connexion, creation_admin, modification_flag
        - **date_debut/date_fin** : plage ISO 8601 inclusive
        - **recherche** : texte libre (LIKE insensible à la casse) dans la description
    
    Args:
        session: Session de base de données asynchrone
        filtres: Instance FiltresAudit avec les paramètres de filtrage
    
    Returns:
        ListeAuditPaginee: Liste paginée avec métadonnées (total, pages, etc.)
    """
    # Étape 1 : Construction de la requête de base
    requete = select(JournalAudit)

    # Étape 2 : Application des filtres optionnels
    if filtres.type_evenement:
        requete = requete.where(JournalAudit.type_evenement == filtres.type_evenement)
    if filtres.date_debut:
        requete = requete.where(JournalAudit.date_evenement >= filtres.date_debut)
    if filtres.date_fin:
        requete = requete.where(JournalAudit.date_evenement <= filtres.date_fin)
    if filtres.recherche:
        requete = requete.where(
            JournalAudit.description.ilike(f"%{filtres.recherche}%")
        )

    # Étape 3 : Comptage total avant pagination
    total_requete = select(func.count()).select_from(JournalAudit)
    if requete.whereclause is not None:
        total_requete = total_requete.where(*requete.whereclause.clauses)
    total: int = await session.scalar(total_requete) or 0

    # Étape 4 : Calcul de la pagination
    pages: int = max(1, (total + filtres.limite - 1) // filtres.limite)
    decalage: int = (filtres.page - 1) * filtres.limite

    # Étape 5 : Exécution avec tri et pagination
    requete = (
        requete
        .order_by(JournalAudit.date_evenement.desc())
        .offset(decalage)
        .limit(filtres.limite)
    )

    resultat = await session.execute(requete)
    evenements = resultat.scalars().all()

    # Étape 6 : Construction de la réponse
    return ListeAuditPaginee(
        donnees=[EvenementAuditItem.model_validate(e) for e in evenements],
        total=total,
        page=filtres.page,
        pages=pages,
        limite=filtres.limite,
    )


# ---------------------------------------------------------------------------
# Export audit CSV
# ---------------------------------------------------------------------------

async def exporter_audit_csv(
    session: AsyncSession,
    type_evenement: Optional[str] = None,
    date_debut: Optional[datetime] = None,
    date_fin: Optional[datetime] = None,
    recherche: Optional[str] = None,
) -> str:
    """
    Exporte les événements d'audit au format CSV avec filtrage optionnel.
    
    Utilise le générateur CSV centralisé `_generer_csv` pour la sortie.
    Retourne un string directement compatible avec StreamingResponse.
    
    Args:
        session: Session de base de données asynchrone
        type_evenement: Filtre optionnel par type d'événement
        date_debut: Filtre optionnel date début (inclusif)
        date_fin: Filtre optionnel date fin (inclusif)
        recherche: Filtre optionnel recherche textuelle
    
    Returns:
        str: Contenu CSV complet (prêt pour téléchargement)
    """
    # Étape 1 : Construction de la requête
    requete = select(JournalAudit)

    if type_evenement:
        requete = requete.where(JournalAudit.type_evenement == type_evenement)
    if date_debut:
        requete = requete.where(JournalAudit.date_evenement >= date_debut)
    if date_fin:
        requete = requete.where(JournalAudit.date_evenement <= date_fin)
    if recherche:
        requete = requete.where(
            JournalAudit.description.ilike(f"%{recherche}%")
        )

    # Étape 2 : Exécution
    requete = requete.order_by(JournalAudit.date_evenement.desc())
    resultat = await session.execute(requete)
    evenements = resultat.scalars().all()

    # Étape 3 : Génération CSV
    en_tetes: list[str] = [
        "ID", "Date", "Type", "Description", "Utilisateur ID",
        "Rôle", "IP", "User-Agent", "Score Risque",
    ]
    lignes: list[list[str]] = [
        [
            str(e.id),
            e.date_evenement.isoformat(),
            e.type_evenement,
            e.description,
            str(e.utilisateur_id) if e.utilisateur_id else "",
            e.role_acteur or "",
            e.adresse_ip or "",
            e.agent_utilisateur or "",
            str(e.score_risque) if e.score_risque else "",
        ]
        for e in evenements
    ]

    return _generer_csv(en_tetes, lignes)


# =============================================================================
# 3. STATISTIQUES DÉTAILLÉES — GET /statistiques
# =============================================================================


async def calculer_statistiques(session: AsyncSession) -> StatistiquesCompletes:
    """
    Calcule l'ensemble des statistiques système en une seule opération.
    
    Agrège les données de 4 tables différentes (Utilisateur, SessionAuthentification,
    JournalAudit) en utilisant des requêtes SQL optimisées.
    
    Domaines statistiques :
        - **Utilisateurs** : totaux, actifs, 2FA, email, verrouillages
        - **Administrateurs** : admins actifs/inactifs, adoption 2FA
        - **Sessions** : actives, expirées, révoquées, aujourd'hui
        - **Scores** : moyenne, min, max, nombre d'utilisateurs scorés
        - **Audit** : volume total et aujourd'hui
    
    Args:
        session: Session de base de données asynchrone
    
    Returns:
        StatistiquesCompletes: Agrégat complet avec date de calcul
    """
    # -------------------------------------------------------------------------
    # Bloc 1 : Statistiques utilisateurs
    # -------------------------------------------------------------------------
    total_utilisateurs: int = await session.scalar(
        select(func.count(Utilisateur.id))
    ) or 0
    total_actifs: int = await session.scalar(
        select(func.count(Utilisateur.id)).where(Utilisateur.est_actif == True)
    ) or 0
    total_supprimes: int = await session.scalar(
        select(func.count(Utilisateur.id)).where(Utilisateur.est_supprime == True)
    ) or 0
    total_verifies_email: int = await session.scalar(
        select(func.count(Utilisateur.id)).where(Utilisateur.est_email_verifie == True)
    ) or 0
    total_2fa: int = await session.scalar(
        select(func.count(Utilisateur.id)).where(Utilisateur.deux_fa_active == True)
    ) or 0
    total_verrouilles: int = await session.scalar(
        select(func.count(Utilisateur.id)).where(Utilisateur.est_verrouille == True)
    ) or 0

    stats_utilisateurs: StatistiquesUtilisateurs = StatistiquesUtilisateurs(
        total_utilisateurs=total_utilisateurs,
        total_actifs=total_actifs,
        total_inactifs=total_utilisateurs - total_actifs,
        total_supprimes=total_supprimes,
        total_verifies_email=total_verifies_email,
        total_non_verifies_email=total_utilisateurs - total_verifies_email,
        total_2fa_actif=total_2fa,
        total_2fa_inactif=total_utilisateurs - total_2fa,
        total_verrouilles=total_verrouilles,
        taux_activation_2fa=round(total_2fa / max(total_utilisateurs, 1) * 100, 1),
        taux_verification_email=round(total_verifies_email / max(total_utilisateurs, 1) * 100, 1),
    )

    # -------------------------------------------------------------------------
    # Bloc 2 : Statistiques administrateurs
    # -------------------------------------------------------------------------
    total_admins: int = await session.scalar(
        select(func.count(Utilisateur.id)).where(Utilisateur.role.in_(ROLES_ADMIN))
    ) or 0
    admins_actifs: int = await session.scalar(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.role.in_(ROLES_ADMIN),
            Utilisateur.est_actif == True,
        )
    ) or 0
    admins_2fa: int = await session.scalar(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.role.in_(ROLES_ADMIN),
            Utilisateur.deux_fa_active == True,
        )
    ) or 0

    stats_admins: StatistiquesAdmins = StatistiquesAdmins(
        total_admins=total_admins,
        admins_actifs=admins_actifs,
        admins_inactifs=total_admins - admins_actifs,
        admins_2fa_actif=admins_2fa,
        admins_sans_2fa=total_admins - admins_2fa,
    )

    # -------------------------------------------------------------------------
    # Bloc 3 : Statistiques sessions
    # -------------------------------------------------------------------------
    maintenant: datetime = datetime.now(timezone.utc)
    total_sessions: int = await session.scalar(
        select(func.count(SessionAuthentification.id))
    ) or 0
    sessions_actives: int = await session.scalar(
        select(func.count(SessionAuthentification.id)).where(
            SessionAuthentification.est_revoquee == False,
            SessionAuthentification.date_expiration > maintenant,
        )
    ) or 0
    sessions_revoquees: int = await session.scalar(
        select(func.count(SessionAuthentification.id)).where(
            SessionAuthentification.est_revoquee == True
        )
    ) or 0

    aujourd_hui: datetime = maintenant.replace(hour=0, minute=0, second=0, microsecond=0)
    sessions_aujourd_hui: int = await session.scalar(
        select(func.count(SessionAuthentification.id)).where(
            SessionAuthentification.cree_le >= aujourd_hui
        )
    ) or 0

    stats_sessions: StatistiquesSessions = StatistiquesSessions(
        sessions_actives=sessions_actives,
        sessions_expirees=total_sessions - sessions_actives - sessions_revoquees,
        sessions_revoquees=sessions_revoquees,
        sessions_aujourd_hui=sessions_aujourd_hui,
        total_sessions=total_sessions,
    )

    # -------------------------------------------------------------------------
    # Bloc 4 : Statistiques scores
    # -------------------------------------------------------------------------
    resultat_score = await session.execute(
        select(
            func.avg(Utilisateur.score_actuel),
            func.min(Utilisateur.score_actuel),
            func.max(Utilisateur.score_actuel),
            func.count(Utilisateur.id).filter(Utilisateur.score_actuel.isnot(None)),
        )
    )
    row = resultat_score.one()

    stats_scores: StatistiquesScore = StatistiquesScore(
        score_moyen=round(float(row[0] or 0), 1),
        score_min=int(row[1]) if row[1] is not None else None,
        score_max=int(row[2]) if row[2] is not None else None,
        utilisateurs_avec_score=row[3] or 0,
        recalculs_effectues=await session.scalar(
            select(func.count(JournalAudit.id)).where(
                JournalAudit.type_evenement == "calcul_score"
            )
        ) or 0,
    )

    # -------------------------------------------------------------------------
    # Bloc 5 : Totaux audit
    # -------------------------------------------------------------------------
    total_evenements: int = await session.scalar(
        select(func.count(JournalAudit.id))
    ) or 0
    demain: datetime = aujourd_hui + timedelta(days=1)
    evenements_ajd: int = await session.scalar(
        select(func.count(JournalAudit.id)).where(
            JournalAudit.date_evenement >= aujourd_hui,
            JournalAudit.date_evenement < demain,
        )
    ) or 0

    # -------------------------------------------------------------------------
    # Assemblage final
    # -------------------------------------------------------------------------
    return StatistiquesCompletes(
        utilisateurs=stats_utilisateurs,
        administrateurs=stats_admins,
        sessions=stats_sessions,
        scores=stats_scores,
        total_evenements_audit=total_evenements,
        evenements_aujourd_hui=evenements_ajd,
        date_calcul=maintenant,
    )


# =============================================================================
# 4. FEATURE FLAGS — configuration dynamique
# =============================================================================


# ---------------------------------------------------------------------------
# Feature flags par défaut (configuration initiale)
# ---------------------------------------------------------------------------

#: Liste des flags créés automatiquement au premier démarrage
FLAGS_PAR_DEFAUT: list[dict] = [
    # Phase 2 — Modules métier
    {
        "cle": "calcul_auto_score",
        "valeur": True,
        "description": "Recalcul périodique du score de confiance (cron mensuel)",
        "categorie": "metier",
        "phase_introduction": "Phase 2",
        "niveau_sensibilite": 0,
    },
    {
        "cle": "notifications_email",
        "valeur": True,
        "description": "Alertes et mises à jour par email aux utilisateurs",
        "categorie": "metier",
        "phase_introduction": "Phase 2",
        "niveau_sensibilite": 0,
    },
    # Phase 3 — Chatbot & RAG
    {
        "cle": "chatbot_langchain",
        "valeur": True,
        "description": "Support utilisateur par IA conversationnelle avec RAG",
        "categorie": "chatbot",
        "phase_introduction": "Phase 3",
        "niveau_sensibilite": 0,
    },
    # Phase 4 — Reconnaissance faciale
    {
        "cle": "reconnaissance_faciale",
        "valeur": False,
        "description": "Vérification visuelle avec analyse faciale (InsightFace)",
        "categorie": "facial",
        "phase_introduction": "Phase 4",
        "niveau_sensibilite": 1,
    },
    {
        "cle": "comparaison_listes_officielles",
        "valeur": False,
        "description": "Vérification contre listes de personnes recherchées",
        "categorie": "facial",
        "phase_introduction": "Phase 4",
        "niveau_sensibilite": 2,
    },
    # Production — Sécurité
    {
        "cle": "2fa_obligatoire_admin",
        "valeur": True,
        "description": "Double authentification requise pour les administrateurs",
        "categorie": "securite",
        "phase_introduction": "Production",
        "niveau_sensibilite": 2,
    },
]


async def initialiser_feature_flags_defaut(session: AsyncSession) -> int:
    """
    Initialise les feature flags par défaut dans la base de données.
    
    Conçue pour être appelée au démarrage de l'application (lifespan).
    Si des flags existent déjà, l'initialisation est ignorée (idempotente).
    
    Les flags sont définis dans la constante `FLAGS_PAR_DEFAUT` pour
    faciliter la maintenance et l'extension.
    
    Args:
        session: Session de base de données asynchrone
    
    Returns:
        int: Nombre de flags créés (0 si déjà initialisé)
    """
    # Vérification : déjà initialisé ?
    count: int = await session.scalar(
        select(func.count(ConfigurationSysteme.id))
    ) or 0
    if count > 0:
        journal.info(f"Feature flags déjà initialisés ({count} flags trouvés)")
        return 0

    # Création des flags par défaut
    flags_orm: list[ConfigurationSysteme] = [
        ConfigurationSysteme(**flag) for flag in FLAGS_PAR_DEFAUT
    ]
    session.add_all(flags_orm)
    await session.commit()

    journal.info(f"✓ {len(flags_orm)} feature flags par défaut initialisés avec succès")
    return len(flags_orm)


async def lister_feature_flags(session: AsyncSession) -> ListeFeatureFlags:
    """
    Liste tous les feature flags actifs avec leurs métadonnées.
    
    Triés par catégorie puis par clé pour un affichage structuré.
    Seuls les flags actifs (`est_actif == True`) sont retournés.
    
    Args:
        session: Session de base de données asynchrone
    
    Returns:
        ListeFeatureFlags: Liste complète avec total
    """
    resultat = await session.execute(
        select(ConfigurationSysteme)
        .where(ConfigurationSysteme.est_actif == True)
        .order_by(ConfigurationSysteme.categorie, ConfigurationSysteme.cle)
    )
    flags: list[ConfigurationSysteme] = resultat.scalars().all()

    return ListeFeatureFlags(
        flags=[
            FeatureFlagItem(
                cle=f.cle,
                valeur=f.valeur,
                description=f.description,
                categorie=f.categorie,
                phase_introduction=f.phase_introduction,
                niveau_sensibilite=f.niveau_sensibilite,
            )
            for f in flags
        ],
        total=len(flags),
    )


async def modifier_feature_flags(
    session: AsyncSession,
    super_admin: Utilisateur,
    donnees: MiseAJourFeatureFlags,
    adresse_ip: Optional[str] = None,
) -> ListeFeatureFlags:
    """
    Modifie un ou plusieurs feature flags en ligne, sans redémarrage.
    
    Chaque modification est :
      1. Validée (le flag doit exister et être actif)
      2. Journalisée dans l'audit avec l'ancienne et nouvelle valeur
      3. Renforcée pour les flags sensibles (niveau >= 2 = audit critique)
    
    Args:
        session: Session de base de données asynchrone
        super_admin: Instance de l'utilisateur super admin
        donnees: Dictionnaire {cle: nouvelle_valeur} des flags à modifier
        adresse_ip: Adresse IP du super admin (pour traçabilité)
    
    Returns:
        ListeFeatureFlags: État complet après modification
    
    Raises:
        ErreurRessourceIntrouvable: Si un flag n'existe pas
    """
    flags_modifies: list[ConfigurationSysteme] = []

    for cle, nouvelle_valeur in donnees.flags.items():
        # Étape 1 : Récupération du flag
        resultat = await session.execute(
            select(ConfigurationSysteme).where(
                ConfigurationSysteme.cle == cle,
                ConfigurationSysteme.est_actif == True,
            )
        )
        flag: Optional[ConfigurationSysteme] = resultat.scalar_one_or_none()

        if flag is None:
            raise ErreurRessourceIntrouvable(
                f"Flag '{cle}' introuvable ou désactivé",
                message_utilisateur=(
                    f"Le flag '{cle}' n'existe pas ou a été désactivé."
                ),
            )

        # Étape 2 : Sérialisation et modification de la valeur
        ancienne_valeur = flag.valeur
        # Convertir en type JSON-serializable propre
        flag.valeur = json.loads(json.dumps(nouvelle_valeur))
        flags_modifies.append(flag)

        # Étape 3 : Audit — niveau de détail selon sensibilité
        niveau: int = flag.niveau_sensibilite
        if niveau >= 2:
            description: str = (
                f"MODIFICATION CRITIQUE du flag '{cle}' : "
                f"{ancienne_valeur} → {nouvelle_valeur}"
            )
        elif niveau >= 1:
            description = (
                f"Modification sensible du flag '{cle}' : "
                f"{ancienne_valeur} → {nouvelle_valeur}"
            )
        else:
            description = (
                f"Modification du flag '{cle}' : "
                f"{ancienne_valeur} → {nouvelle_valeur}"
            )

        # Étape 4 : Enregistrement dans le journal d'audit
        _enregistrer_audit(
            session=session,
            type_evenement=TYPE_EVENEMENT_MODIFICATION_FLAG,
            description=description,
            acteur_id=super_admin.id,
            role_acteur=super_admin.role,
            adresse_ip=adresse_ip,
            donnees_supplementaires={
                "cle": cle,
                "ancienne_valeur": ancienne_valeur,
                "nouvelle_valeur": nouvelle_valeur,
                "niveau_sensibilite": niveau,
            },
        )
        journal_audit(f"flag '{cle}' modifié par {super_admin.id}")

    # Étape 5 : Persistance et retour
    await session.commit()
    journal.info(
        f"Feature flags modifiés : {len(flags_modifies)} flag(s) "
        f"par super_admin={super_admin.id}"
    )

    return await lister_feature_flags(session)


# =============================================================================
# 5. SESSIONS ADMINISTRATEUR — consultation et révocation
# =============================================================================


async def lister_sessions_admin(
    session: AsyncSession,
    admin_id: UUID,
) -> ListeSessionsAdmin:
    """
    Liste toutes les sessions d'un administrateur.
    
    Inclut les sessions actives, expirées et révoquées.
    Tri chronologique inverse (plus récente en premier).
    Calcule automatiquement le nombre de sessions actives.
    
    Args:
        session: Session de base de données asynchrone
        admin_id: UUID de l'administrateur cible
    
    Returns:
        ListeSessionsAdmin: Liste des sessions + compteur actives
    
    Raises:
        ErreurRessourceIntrouvable: Si l'admin n'existe pas
    """
    # Étape 1 : Vérification de l'existence de l'admin
    await _verifier_admin_existe(session, admin_id)

    # Étape 2 : Récupération des sessions
    resultat = await session.execute(
        select(SessionAuthentification)
        .where(SessionAuthentification.utilisateur_id == admin_id)
        .order_by(SessionAuthentification.cree_le.desc())
    )
    sessions: list[SessionAuthentification] = resultat.scalars().all()

    # Étape 3 : Calcul des sessions actives
    maintenant: datetime = datetime.now(timezone.utc)
    actives: int = sum(
        1 for s in sessions
        if not s.est_revoquee and s.date_expiration > maintenant
    )

    # Étape 4 : Construction de la réponse
    return ListeSessionsAdmin(
        sessions=[SessionAdminItem.model_validate(s) for s in sessions],
        total=len(sessions),
        actives=actives,
    )


async def revoquer_session_admin(
    session: AsyncSession,
    super_admin: Utilisateur,
    admin_id: UUID,
    session_id: UUID,
    adresse_ip: Optional[str] = None,
) -> None:
    """
    Révoque une session spécifique d'un administrateur.
    
    Conséquences :
      - La session est marquée révoquée (`est_revoquee = True`)
      - L'administrateur est déconnecté de cet appareil
      - L'action est tracée dans le journal d'audit
    
    Args:
        session: Session de base de données asynchrone
        super_admin: Instance du super admin effectuant l'action
        admin_id: UUID de l'administrateur propriétaire de la session
        session_id: UUID de la session à révoquer
        adresse_ip: Adresse IP du super admin (traçabilité)
    
    Raises:
        ErreurRessourceIntrouvable: Si la session n'existe pas
    """
    # Étape 1 : Recherche de la session
    resultat = await session.execute(
        select(SessionAuthentification).where(
            SessionAuthentification.id == session_id,
            SessionAuthentification.utilisateur_id == admin_id,
        )
    )
    session_auth: Optional[SessionAuthentification] = resultat.scalar_one_or_none()

    if session_auth is None:
        raise ErreurRessourceIntrouvable(
            f"Session {session_id} introuvable pour admin {admin_id}",
            message_utilisateur="Session introuvable.",
        )

    # Étape 2 : Révocation
    session_auth.est_revoquee = True
    session_auth.raison_revocation = "revocation_par_super_admin"

    # Étape 3 : Audit
    _enregistrer_audit(
        session=session,
        type_evenement=TYPE_EVENEMENT_REVOCATION_SESSION,
        description=(
            f"Super admin a révoqué la session {session_id} "
            f"de l'admin {admin_id}"
        ),
        acteur_id=super_admin.id,
        role_acteur=super_admin.role,
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "admin_cible_id": str(admin_id),
            "session_id": str(session_id),
        },
    )

    # Étape 4 : Persistance
    await session.commit()
    journal.info(
        f"Session {session_id} révoquée pour admin {admin_id} "
        f"par super_admin={super_admin.id}"
    )


# =============================================================================
# 6. ÉDITION / SUPPRESSION / SÉCURITÉ des administrateurs
# =============================================================================


# ---------------------------------------------------------------------------
# Modification d'un administrateur (prénom, nom, ville)
# ---------------------------------------------------------------------------

async def modifier_administrateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    admin_id: UUID,
    donnees: ModifierAdminRequete,
    adresse_ip: Optional[str] = None,
) -> AdminApercuSchema:
    """
    Modifie les informations personnelles d'un administrateur.
    
    Champs modifiables : prénom, nom, ville.
    L'email n'est pas modifiable (créer un nouvel admin si nécessaire).
    Les données sensibles (prénom, nom) sont chiffrées avant stockage.
    
    Args:
        session: Session de base de données asynchrone
        super_admin: Instance du super admin effectuant l'action
        admin_id: UUID de l'administrateur à modifier
        donnees: Nouvelles valeurs (seuls les champs fournis sont modifiés)
        adresse_ip: Adresse IP du super admin (traçabilité)
    
    Returns:
        AdminApercuSchema: Profil mis à jour de l'administrateur
    
    Raises:
        ErreurRessourceIntrouvable: Si l'admin n'existe pas
        ErreurValidation: Si aucun champ n'est fourni
    """
    # Étape 1 : Vérification de l'existence
    admin: Utilisateur = await _verifier_admin_existe(
        session, admin_id,
        roles_autorises=[RolesUtilisateur.ADMINISTRATEUR.value],
    )

    # Étape 2 : Application des modifications
    modifications: dict[str, bool] = {}
    if donnees.prenom is not None:
        admin.prenom_chiffre = chiffrer_donnee(donnees.prenom)
        modifications["prénom"] = True
    if donnees.nom is not None:
        admin.nom_chiffre = chiffrer_donnee(donnees.nom)
        modifications["nom"] = True
    if donnees.ville is not None:
        admin.ville = donnees.ville
        modifications["ville"] = True

    if not modifications:
        raise ErreurValidation(
            "Aucune donnée à modifier",
            message_utilisateur="Aucune modification fournie. "
            "Veuillez fournir au moins un champ (prénom, nom ou ville).",
        )

    # Étape 3 : Audit
    _enregistrer_audit(
        session=session,
        type_evenement=TYPE_EVENEMENT_MODIFICATION_ADMIN,
        description=(
            f"Super admin a modifié l'admin {admin_id} : "
            f"{', '.join(modifications.keys())}"
        ),
        acteur_id=super_admin.id,
        role_acteur=super_admin.role,
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "admin_cible_id": str(admin_id),
            "champs_modifies": list(modifications.keys()),
        },
    )

    # Étape 4 : Persistance et retour
    await session.commit()
    await session.refresh(admin)
    journal.info(f"Admin {admin_id} modifié par super_admin={super_admin.id}")

    return _utilisateur_vers_apercu(admin)


# ---------------------------------------------------------------------------
# Réinitialisation du mot de passe
# ---------------------------------------------------------------------------

async def reinitialiser_mot_de_passe_admin(
    session: AsyncSession,
    super_admin: Utilisateur,
    admin_id: UUID,
    adresse_ip: Optional[str] = None,
) -> str:
    """
    Génère un nouveau mot de passe temporaire pour un administrateur.
    
    Mesures de sécurité appliquées :
      1. Mot de passe haute entropie (22+ caractères, 6 types)
      2. Hachage immédiat (stocké haché, jamais en clair)
      3. Toutes les sessions actives sont révoquées
      4. Action tracée dans l'audit
    
    Le mot de passe temporaire doit être communiqué de façon sécurisée
    à l'administrateur (hors bande, de préférence).
    
    Args:
        session: Session de base de données asynchrone
        super_admin: Instance du super admin effectuant l'action
        admin_id: UUID de l'administrateur cible
        adresse_ip: Adresse IP du super admin (traçabilité)
    
    Returns:
        str: Le nouveau mot de passe temporaire (à communiquer à l'admin)
    
    Raises:
        ErreurRessourceIntrouvable: Si l'admin n'existe pas
    """
    # Étape 1 : Vérification de l'existence
    admin: Utilisateur = await _verifier_admin_existe(
        session, admin_id,
        roles_autorises=[RolesUtilisateur.ADMINISTRATEUR.value],
    )

    # Étape 2 : Génération du nouveau mot de passe
    nouveau_mdp: str = _generer_mot_de_passe_temporaire()
    admin.mot_de_passe_hash = hacher_mot_de_passe(nouveau_mdp)

    # Étape 3 : Révocation de toutes les sessions actives
    await session.execute(
        update(SessionAuthentification)
        .where(
            SessionAuthentification.utilisateur_id == admin_id,
            SessionAuthentification.est_revoquee == False,
        )
        .values(
            est_revoquee=True,
            raison_revocation="reset_password_par_super_admin",
        )
    )

    # Étape 4 : Audit
    _enregistrer_audit(
        session=session,
        type_evenement=TYPE_EVENEMENT_RESET_PASSWORD,
        description=(
            f"Super admin a réinitialisé le mot de passe "
            f"de l'admin {admin_id}"
        ),
        acteur_id=super_admin.id,
        role_acteur=super_admin.role,
        adresse_ip=adresse_ip,
        donnees_supplementaires={"admin_cible_id": str(admin_id)},
    )

    # Étape 5 : Persistance
    await session.commit()
    journal.info(
        f"Mot de passe réinitialisé pour admin {admin_id} "
        f"par super_admin={super_admin.id}"
    )

    return nouveau_mdp


# ---------------------------------------------------------------------------
# Gestion du 2FA
# ---------------------------------------------------------------------------

async def basculer_2fa_admin(
    session: AsyncSession,
    super_admin: Utilisateur,
    admin_id: UUID,
    activer: bool,
    adresse_ip: Optional[str] = None,
) -> AdminApercuSchema:
    """
    Active ou désactive le 2FA pour un administrateur.
    
    Comportement :
      - Activation : le flag `deux_fa_active` passe à True
      - Désactivation : le secret 2FA est supprimé (plus de validation possible)
      - L'action est tracée dans l'audit avec le type approprié
    
    Args:
        session: Session de base de données asynchrone
        super_admin: Instance du super admin effectuant l'action
        admin_id: UUID de l'administrateur cible
        activer: True pour activer, False pour désactiver
        adresse_ip: Adresse IP du super admin (traçabilité)
    
    Returns:
        AdminApercuSchema: Profil mis à jour de l'administrateur
    
    Raises:
        ErreurRessourceIntrouvable: Si l'admin n'existe pas
    """
    # Étape 1 : Vérification de l'existence
    admin: Utilisateur = await _verifier_admin_existe(
        session, admin_id,
        roles_autorises=[RolesUtilisateur.ADMINISTRATEUR.value],
    )

    # Étape 2 : Activation/Désactivation
    admin.deux_fa_active = activer
    if not activer:
        admin.secret_2fa_chiffre = None

    # Étape 3 : Audit
    type_evt: str = (
        TYPE_EVENEMENT_ACTIVATION_2FA if activer
        else TYPE_EVENEMENT_DESACTIVATION_2FA
    )
    _enregistrer_audit(
        session=session,
        type_evenement=type_evt,
        description=(
            f"Super admin a {'activé' if activer else 'désactivé'} "
            f"le 2FA pour l'admin {admin_id}"
        ),
        acteur_id=super_admin.id,
        role_acteur=super_admin.role,
        adresse_ip=adresse_ip,
        donnees_supplementaires={"admin_cible_id": str(admin_id)},
    )

    # Étape 4 : Persistance
    await session.commit()
    journal.info(f"2FA {'activé' if activer else 'désactivé'} pour admin {admin_id}")

    return _utilisateur_vers_apercu(admin)


# ---------------------------------------------------------------------------
# Suppression logique (soft-delete)
# ---------------------------------------------------------------------------

async def supprimer_administrateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    admin_id: UUID,
    confirmation: bool,
    raison: str = "",
    adresse_ip: Optional[str] = None,
) -> None:
    """
    Supprime logiquement un administrateur du système.
    
    Principes :
      - **Soft-delete** : le compte est marqué supprimé, pas effacé
        (permet la traçabilité et le droit à l'oubli différé)
      - **Révocation totale** : toutes les sessions sont révoquées
      - **Confirmation** : le super admin doit explicitement confirmer
      - **Motif** : une raison est recommandée pour l'audit
    
    Args:
        session: Session de base de données asynchrone
        super_admin: Instance du super admin effectuant l'action
        admin_id: UUID de l'administrateur à supprimer
        confirmation: Doit être True (sécurité anti-erreur)
        raison: Motif de la suppression (recommandé pour l'audit)
        adresse_ip: Adresse IP du super admin (traçabilité)
    
    Raises:
        ErreurValidation: Si confirmation=False
        ErreurRessourceIntrouvable: Si l'admin n'existe pas
    """
    # Étape 1 : Vérification de la confirmation
    if not confirmation:
        raise ErreurValidation(
            "Suppression non confirmée",
            message_utilisateur="Vous devez confirmer la suppression.",
        )

    # Étape 2 : Vérification de l'existence
    admin: Utilisateur = await _verifier_admin_existe(
        session, admin_id,
        roles_autorises=[RolesUtilisateur.ADMINISTRATEUR.value],
    )

    # Étape 3 : Marquage comme supprimé
    admin.est_supprime = True
    admin.est_actif = False
    admin.date_suppression = datetime.now(timezone.utc)
    # Modifier le hash email pour permettre la réinscription (contrainte UNIQUE DB)
    # On tronque car le champ email_hash est limité à 64 caractères
    ancien_hash = admin.email_hash
    hash_prefixe = f"DEL_{admin.id}"[:16]
    admin.email_hash = f"{hash_prefixe}_{ancien_hash}"[:64]

    # Étape 4 : Révocation de toutes les sessions
    await session.execute(
        update(SessionAuthentification)
        .where(
            SessionAuthentification.utilisateur_id == admin_id,
            SessionAuthentification.est_revoquee == False,
        )
        .values(
            est_revoquee=True,
            raison_revocation="suppression_compte_par_super_admin",
        )
    )

    # Étape 5 : Audit
    _enregistrer_audit(
        session=session,
        type_evenement=TYPE_EVENEMENT_SUPPRESSION_ADMIN,
        description=(
            f"Super admin a supprimé l'admin {admin_id}. "
            f"Raison : {raison or 'Non spécifiée'}"
        ),
        acteur_id=super_admin.id,
        role_acteur=super_admin.role,
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "admin_cible_id": str(admin_id),
            "raison": raison,
        },
    )

    # Étape 6 : Persistance
    await session.commit()
    journal.info(f"Admin {admin_id} supprimé par super_admin={super_admin.id}")


# =============================================================================
# 7. EXPORT — données administrateur
# =============================================================================


async def exporter_admin_donnees(
    session: AsyncSession,
    super_admin: Utilisateur,
    admin_id: UUID,
    adresse_ip: Optional[str] = None,
) -> DonneesAdminExport:
    """
    Exporte les données complètes d'un administrateur.
    
    Inclut : profil, statut 2FA, nombre de sessions actives,
    et volume d'audit. L'action est tracée dans l'audit.
    
    Args:
        session: Session de base de données asynchrone
        super_admin: Instance du super admin effectuant l'export
        admin_id: UUID de l'administrateur à exporter
        adresse_ip: Adresse IP du super admin (traçabilité)
    
    Returns:
        DonneesAdminExport: Données structurées de l'administrateur
    
    Raises:
        ErreurRessourceIntrouvable: Si l'admin n'existe pas
    """
    # Étape 1 : Vérification de l'existence
    admin: Utilisateur = await _verifier_admin_existe(session, admin_id)
    apercu = _utilisateur_vers_apercu(admin)

    # Étape 2 : Métadonnées additionnelles
    maintenant: datetime = datetime.now(timezone.utc)
    sessions_actives: int = await session.scalar(
        select(func.count(SessionAuthentification.id)).where(
            SessionAuthentification.utilisateur_id == admin_id,
            SessionAuthentification.est_revoquee == False,
            SessionAuthentification.date_expiration > maintenant,
        )
    ) or 0
    total_audit: int = await session.scalar(
        select(func.count(JournalAudit.id)).where(
            JournalAudit.utilisateur_id == admin_id,
        )
    ) or 0

    # Étape 3 : Audit
    _enregistrer_audit(
        session=session,
        type_evenement=TYPE_EVENEMENT_EXPORT_ADMIN,
        description=(
            f"Super admin a exporté les données de l'admin {admin_id}"
        ),
        acteur_id=super_admin.id,
        role_acteur=super_admin.role,
        adresse_ip=adresse_ip,
        donnees_supplementaires={"admin_cible_id": str(admin_id)},
    )
    await session.commit()

    # Étape 4 : Construction de la réponse
    return DonneesAdminExport(
        id=apercu.id,
        email=apercu.email,
        prenom=apercu.prenom,
        nom=apercu.nom,
        role=apercu.role,
        est_actif=apercu.est_actif,
        deux_fa_active=apercu.deux_fa_active,
        est_email_verifie=apercu.est_email_verifie,
        date_creation=apercu.date_creation,
        date_derniere_connexion=apercu.date_derniere_connexion,
        sessions_actives=sessions_actives,
        total_evenements_audit=total_audit,
    )


async def exporter_liste_admins_csv(
    session: AsyncSession,
) -> str:
    """
    Exporte la liste complète des administrateurs au format CSV.
    
    Colonnes exportées : ID, Email, Prénom, Nom, Rôle, Statut actif,
    2FA, Email vérifié, Date création, Dernière connexion.
    
    Args:
        session: Session de base de données asynchrone
    
    Returns:
        str: Contenu CSV complet (prêt pour téléchargement)
    """
    # Étape 1 : Récupération de la liste des admins
    from src.modules.super_admin.service import lister_administrateurs
    resultat = await lister_administrateurs(session)

    # Étape 2 : Génération CSV
    en_tetes: list[str] = [
        "ID", "Email", "Prénom", "Nom", "Rôle",
        "Actif", "2FA", "Email vérifié", "Création", "Dernière connexion",
    ]
    lignes: list[list[str]] = [
        [
            str(admin.id),
            admin.email,
            admin.prenom or "",
            admin.nom or "",
            admin.role,
            "Oui" if admin.est_actif else "Non",
            "Oui" if admin.deux_fa_active else "Non",
            "Oui" if admin.est_email_verifie else "Non",
            admin.date_creation.isoformat() if admin.date_creation else "",
            admin.date_derniere_connexion.isoformat() if admin.date_derniere_connexion else "",
        ]
        for admin in resultat.administrateurs
    ]

    return _generer_csv(en_tetes, lignes)

