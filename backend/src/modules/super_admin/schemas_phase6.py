# -*- coding: utf-8 -*-
"""
Schémas Pydantic Phase 6 du module Super Admin — DigiID.

Définit toutes les structures de données pour les endpoints avancés :
  - Audit paginé avec filtrage multicritères
  - Statistiques détaillées du système
  - Feature flags (lecture et modification dynamique)
  - Sessions administrateur (consultation et révocation)
  - Édition, suppression, reset mot de passe et gestion 2FA
  - Export de données administrateur

Chaque classe = un contrat API clair avec validation intégrée.
Architecture : héritage de BaseModel (Pydantic v2) pour validation native.
"""
# =============================================================================
# Imports standards
# =============================================================================
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, EmailStr


# =============================================================================
# CONSTANTES DE CONFIGURATION — modifiables pour scaler
# =============================================================================

#: Nombre maximum d'éléments par page dans l'audit (limite haute)
LIMITE_MAX_AUDIT: int = 200

#: Nombre par défaut d'éléments par page
LIMITE_PAR_DEFAUT: int = 50

#: Longueur minimale/maximale des champs texte
LONGUEUR_MIN_CHAMP: int = 2
LONGUEUR_MAX_CHAMP: int = 50
LONGUEUR_MAX_VILLE: int = 100

#: Formats d'export supportés
FORMATS_EXPORT_VALIDES: list[str] = ["csv", "json"]


# =============================================================================
# 1. AUDIT PAGINÉ — requête, item, réponse paginée
# =============================================================================


class FiltresAudit(BaseModel):
    """
    Paramètres de filtrage pour la consultation du journal d'audit.
    
    Tous les filtres sont optionnels. Combinables entre eux.
    Exemple : page=2, limite=25, type_evenement="connexion", 
              date_debut="2024-01-01T00:00:00Z", recherche="admin"
    """
    #: Numéro de page (commence à 1)
    page: int = Field(default=1, ge=1, description="Numéro de page (1-indexé)")
    #: Éléments par page (max {LIMITE_MAX_AUDIT})
    limite: int = Field(
        default=LIMITE_PAR_DEFAUT, ge=1, le=LIMITE_MAX_AUDIT,
        description=f"Éléments par page (max {LIMITE_MAX_AUDIT})",
    )
    #: Filtre par type d'événement (ex: connexion, modification_admin)
    type_evenement: Optional[str] = Field(
        default=None, description="Filtrer par type d'événement (ex: connexion, modification_admin)",
    )
    #: Date de début de la plage (inclusif, format ISO 8601)
    date_debut: Optional[datetime] = Field(
        default=None, description="Date début (inclusif) — format ISO 8601",
    )
    #: Date de fin de la plage (inclusif, format ISO 8601)
    date_fin: Optional[datetime] = Field(
        default=None, description="Date fin (inclusif) — format ISO 8601",
    )
    #: Recherche textuelle libre (insensible à la casse) dans la description
    recherche: Optional[str] = Field(
        default=None, description="Recherche textuelle libre (insensible à la casse) dans la description",
    )


class EvenementAuditItem(BaseModel):
    """
    Représentation d'un événement d'audit individuel.
    
    Correspond à une ligne de la table `journal_audit`.
    Utilise `from_attributes=True` pour la sérialisation directe depuis l'ORM.
    """
    model_config = ConfigDict(from_attributes=True)

    #: Identifiant unique de l'événement
    id: UUID
    #: Date/heure exacte de l'événement (timezone UTC)
    date_evenement: datetime
    #: Type d'événement normalisé (ex: connexion, echec_connexion, creation_admin)
    type_evenement: str
    #: Description textuelle de l'événement
    description: str
    #: ID de l'utilisateur concerné (None pour actions anonymes)
    utilisateur_id: Optional[UUID] = None
    #: Rôle de l'acteur au moment de l'action
    role_acteur: Optional[str] = None
    #: Adresse IP d'origine
    adresse_ip: Optional[str] = None
    #: User-Agent du navigateur/appareil
    agent_utilisateur: Optional[str] = None
    #: Données contextuelles additionnelles (JSON libre)
    donnees_supplementaires: Optional[dict] = None
    #: Score de risque associé (0-100, si évalué)
    score_risque: Optional[int] = None


class ListeAuditPaginee(BaseModel):
    """
    Réponse paginée pour la consultation du journal d'audit.
    
    Inclut les métadonnées de pagination pour la navigation.
    """
    #: Liste des événements d'audit pour la page courante
    donnees: list[EvenementAuditItem]
    #: Nombre total d'événements correspondant aux filtres
    total: int
    #: Page courante
    page: int
    #: Nombre total de pages
    pages: int
    #: Éléments par page
    limite: int


class ExportAuditRequete(BaseModel):
    """
    Paramètres pour l'export du journal d'audit.
    
    Supporte les formats CSV et JSON.
    Les filtres sont optionnels — sans filtre, tout l'audit est exporté.
    """
    #: Format d'export (csv ou json)
    format: str = Field(
        default="csv", pattern="^(csv|json)$",
        description="Format d'export (csv ou json)",
    )
    #: Filtre optionnel par type d'événement
    type_evenement: Optional[str] = None
    #: Date de début de la plage (inclusif)
    date_debut: Optional[datetime] = None
    #: Date de fin de la plage (inclusif)
    date_fin: Optional[datetime] = None
    #: Recherche textuelle optionnelle
    recherche: Optional[str] = None


# =============================================================================
# 2. STATISTIQUES DÉTAILLÉES — différents niveaux d'agrégation
# =============================================================================


class StatistiquesUtilisateurs(BaseModel):
    """
    Statistiques complètes sur les utilisateurs du système.
    
    Inclut les totaux et les taux (2FA, vérification email) 
    exprimés en pourcentage (0.0 - 100.0).
    """
    #: Nombre total d'utilisateurs (non supprimés)
    total_utilisateurs: int
    #: Nombre d'utilisateurs actifs (compte activé)
    total_actifs: int
    #: Nombre d'utilisateurs inactifs (compte désactivé)
    total_inactifs: int
    #: Nombre d'utilisateurs supprimés logiquement
    total_supprimes: int
    #: Nombre d'utilisateurs avec email vérifié
    total_verifies_email: int
    #: Nombre d'utilisateurs sans vérification email
    total_non_verifies_email: int
    #: Nombre d'utilisateurs avec 2FA activé
    total_2fa_actif: int
    #: Nombre d'utilisateurs sans 2FA
    total_2fa_inactif: int
    #: Nombre d'utilisateurs verrouillés (trop de tentatives échouées)
    total_verrouilles: int
    #: Taux d'activation du 2FA (0.0 - 100.0 %)
    taux_activation_2fa: float
    #: Taux de vérification email (0.0 - 100.0 %)
    taux_verification_email: float


class StatistiquesAdmins(BaseModel):
    """
    Statistiques spécifiques aux administrateurs.
    
    Inclut admin + super admin. Sépare les stats 2FA.
    """
    #: Nombre total d'administrateurs
    total_admins: int
    #: Administrateurs actifs
    admins_actifs: int
    #: Administrateurs inactifs/suspendus
    admins_inactifs: int
    #: Administrateurs avec 2FA activé
    admins_2fa_actif: int
    #: Administrateurs sans 2FA (vulnérabilité potentielle)
    admins_sans_2fa: int


class StatistiquesSessions(BaseModel):
    """
    Statistiques sur les sessions d'authentification.
    
    Triées par état : actives, expirées, révoquées.
    Inclut les sessions créées aujourd'hui (activité récente).
    """
    #: Sessions actuellement actives
    sessions_actives: int
    #: Sessions expirées naturellement
    sessions_expirees: int
    #: Sessions révoquées manuellement
    sessions_revoquees: int
    #: Sessions créées aujourd'hui
    sessions_aujourd_hui: int
    #: Total de toutes les sessions
    total_sessions: int


class StatistiquesScore(BaseModel):
    """
    Statistiques sur les scores de confiance DigiID.
    
    Score sur 100 (moyenne, min, max).
    Inclut le nombre de recalculs effectués.
    """
    #: Score moyen de tous les utilisateurs
    score_moyen: float
    #: Score minimum observé
    score_min: Optional[int] = None
    #: Score maximum observé
    score_max: Optional[int] = None
    #: Nombre d'utilisateurs avec un score calculé
    utilisateurs_avec_score: int
    #: Nombre total de recalculs de score effectués
    recalculs_effectues: int


class StatistiquesCompletes(BaseModel):
    """
    Agrégation complète de toutes les statistiques système.
    
    Point d'entrée unique pour le dashboard super admin.
    Inclut la date de calcul pour traçabilité.
    """
    #: Statistiques utilisateurs
    utilisateurs: StatistiquesUtilisateurs
    #: Statistiques administrateurs
    administrateurs: StatistiquesAdmins
    #: Statistiques sessions
    sessions: StatistiquesSessions
    #: Statistiques scores
    scores: StatistiquesScore
    #: Nombre total d'événements d'audit
    total_evenements_audit: int
    #: Événements d'audit créés aujourd'hui
    evenements_aujourd_hui: int
    #: Date et heure du calcul des statistiques
    date_calcul: datetime


# =============================================================================
# 3. FEATURE FLAGS — configuration dynamique modifiable en ligne
# =============================================================================


class FeatureFlagItem(BaseModel):
    """
    Un feature flag avec ses métadonnées.
    
    Représente une ligne de la table `configuration_systeme`.
    Supporte les types JSON : bool, str, int, float, list, dict.
    """
    #: Identifiant unique du flag (snake_case)
    cle: str
    #: Valeur courante du flag
    valeur: str | bool | int | float | list | dict
    #: Description lisible du flag (affiché dans l'UI)
    description: Optional[str] = None
    #: Catégorie d'affichage (securite, metier, chatbot, facial)
    categorie: Optional[str] = None
    #: Phase d'introduction du flag (ex: Phase 2, Phase 3)
    phase_introduction: Optional[str] = None
    #: Niveau de sensibilité (0=standard, 1=sensible, 2=critique)
    niveau_sensibilite: int = 0


class ListeFeatureFlags(BaseModel):
    """
    Liste paginable de tous les feature flags actifs.
    """
    #: Liste des flags
    flags: list[FeatureFlagItem]
    #: Nombre total de flags
    total: int


class MiseAJourFeatureFlags(BaseModel):
    """
    Requête de modification d'un ou plusieurs feature flags.
    
    Corps attendu : {"flags": {"cle1": valeur1, "cle2": valeur2}}
    Toutes les modifications sont atomiques (tout ou rien).
    Chaque modification est tracée dans le journal d'audit.
    """
    #: Dictionnaire des flags à modifier {cle: nouvelle_valeur}
    flags: dict[str, str | bool | int | float | list | dict] = Field(
        ...,
        description="Dict des flags à modifier : {cle: nouvelle_valeur} (min 1 flag)",
        min_length=1,
    )


# =============================================================================
# 4. SESSIONS ADMINISTRATEUR — consultation et révocation
# =============================================================================


class SessionAdminItem(BaseModel):
    """
    Représentation d'une session d'authentification.
    
    Utilisé pour la liste des sessions d'un administrateur.
    Inclut l'état (active/révoquée) et les métadonnées de connexion.
    """
    model_config = ConfigDict(from_attributes=True)

    #: Identifiant unique de la session
    id: UUID
    #: ID de l'utilisateur propriétaire
    utilisateur_id: UUID
    #: Adresse IP de connexion
    adresse_ip: str
    #: User-Agent du navigateur/appareil
    agent_utilisateur: Optional[str] = None
    #: Date de création de la session (mappé sur `cree_le` dans le modèle ORM)
    cree_le: datetime
    #: Date de dernière utilisation
    date_derniere_utilisation: datetime
    #: Date d'expiration automatique
    date_expiration: datetime
    #: Indique si la session a été révoquée
    est_revoquee: bool
    #: Raison de la révocation (le cas échéant)
    raison_revocation: Optional[str] = None


class ListeSessionsAdmin(BaseModel):
    """
    Liste des sessions d'un administrateur.
    
    Inclut le décompte des sessions actives pour affichage rapide.
    """
    #: Liste des sessions
    sessions: list[SessionAdminItem]
    #: Nombre total de sessions
    total: int
    #: Nombre de sessions actives (non révoquées et non expirées)
    actives: int


# =============================================================================
# 5. ÉDITION / SUPPRESSION / SÉCURITÉ des administrateurs
# =============================================================================


class ModifierAdminRequete(BaseModel):
    """
    Données modifiables d'un administrateur par le super admin.
    
    Tous les champs sont optionnels — seuls ceux fournis seront modifiés.
    L'email n'est pas modifiable (créer un nouvel admin si nécessaire).
    """
    #: Nouveau prénom (2-50 caractères)
    prenom: Optional[str] = Field(default=None, min_length=2, max_length=50)
    #: Nouveau nom (2-50 caractères)
    nom: Optional[str] = Field(default=None, min_length=2, max_length=50)
    #: Nouvelle ville (max 100 caractères)
    ville: Optional[str] = Field(default=None, max_length=100)


class SupprimerAdminRequete(BaseModel):
    """
    Confirmation de suppression d'un administrateur.
    
    Mesure de sécurité : le super admin doit explicitement confirmer.
    La suppression est logique (soft-delete), pas physique.
    """
    #: Confirmation explicite (true pour supprimer)
    confirmation: bool = Field(
        ..., description="Confirmation explicite de la suppression (true pour supprimer)",
    )
    #: Motif de la suppression (optionnel mais recommandé pour l'audit)
    raison: str = Field(
        default="", description="Motif de la suppression (optionnel mais recommandé pour l'audit)",
    )


class ResetMotDePasseReponse(BaseModel):
    """
    Réponse après réinitialisation du mot de passe.
    
    Contient le mot de passe temporaire à communiquer 
    de façon sécurisée à l'administrateur concerné.
    """
    #: Mot de passe temporaire généré (20 caractères, haute entropie)
    nouveau_mot_de_passe: str = Field(
        ..., description="Mot de passe temporaire généré (20 caractères, haute entropie)",
    )
    #: Message d'information
    message: str = Field(
        default=(
            "Mot de passe réinitialisé. Communiquez-le de façon sécurisée "
            "à l'administrateur. Toutes ses sessions ont été révoquées."
        ),
    )


class Modifier2FARequete(BaseModel):
    """
    Activation ou désactivation du 2FA pour un administrateur.
    
    Action sensible tracée dans le journal d'audit.
    La désactivation supprime le secret 2FA stocké.
    """
    #: Activer (true) ou désactiver (false) le 2FA
    deux_fa_active: bool = Field(..., description="Activer (true) ou désactiver (false) le 2FA")


# =============================================================================
# 6. EXPORT — données structurées d'un administrateur
# =============================================================================


class DonneesAdminExport(BaseModel):
    """
    Données complètes d'un administrateur pour export.
    
    Inclut les métadonnées de sécurité (2FA, sessions actives)
    et le nombre total d'événements d'audit pour cet admin.
    """
    #: Identifiant unique
    id: UUID
    #: Email (déchiffré pour l'export)
    email: str
    #: Prénom (déchiffré)
    prenom: Optional[str] = None
    #: Nom (déchiffré)
    nom: Optional[str] = None
    #: Rôle (administrateur ou super_administrateur)
    role: str
    #: Compte actif ou suspendu
    est_actif: bool
    #: 2FA activé ou non
    deux_fa_active: bool
    #: Email vérifié ou non
    est_email_verifie: bool
    #: Date de création du compte
    date_creation: datetime
    #: Date de dernière connexion
    date_derniere_connexion: Optional[datetime] = None
    #: Nombre de sessions actives
    sessions_actives: int
    #: Nombre total d'événements d'audit pour cet admin
    total_evenements_audit: int

