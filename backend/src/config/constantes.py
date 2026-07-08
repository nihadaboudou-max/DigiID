# -*- coding: utf-8 -*-
"""
Constantes métier de DigiID.
Tout ce qui ne change jamais en cours d'exécution se trouve ici :
énumérations de rôles, niveaux de risque, codes d'événements, etc.
"""
from enum import Enum


class RolesUtilisateur(str, Enum):
    """
    Les rôles du système DigiID (RBAC étendu).

    Chaque rôle a son propre espace, ses permissions, ses routes.
    L'enum est `str` pour faciliter la sérialisation JSON.

    Hiérarchie (ordre croissant de privilèges) :
        citoyen < ong < medecin < agent < police < chef_* < administrateur < super_administrateur
    """
    CITOYEN = "citoyen"
    ONG = "ong"
    MEDECIN = "medecin"
    AGENT = "agent"
    POLICE = "police"
    CHEF_POLICE = "chef_police"
    CHEF_MEDICAL = "chef_medical"
    CHEF_ONG = "chef_ong"
    CHEF_AGENT = "chef_agent"
    ADMINISTRATEUR = "administrateur"
    SUPER_ADMINISTRATEUR = "super_administrateur"

    @classmethod
    def hierarchie(cls) -> dict:
        """
        Niveau hiérarchique de chaque rôle.
        Plus le chiffre est élevé, plus le rôle a de pouvoirs.
        
        Note : Les chefs de département sont des rôles fonctionnels
        (supervision au sein d'un domaine), pas des rôles administratifs.
        """
        return {
            cls.CITOYEN: 1,
            cls.ONG: 2,
            cls.MEDECIN: 3,
            cls.AGENT: 4,
            cls.POLICE: 5,
            cls.CHEF_POLICE: 6,
            cls.CHEF_MEDICAL: 6,
            cls.CHEF_ONG: 6,
            cls.CHEF_AGENT: 6,
            cls.ADMINISTRATEUR: 10,
            cls.SUPER_ADMINISTRATEUR: 100,
        }
        
    @classmethod
    def hierachie(cls) -> dict:
        """Alias de hierarchie (compatibilité avec le code existant)."""
        return cls.hierarchie()    

    @classmethod
    def roles_administratifs(cls) -> list[str]:
        """Retourne les rôles considérés comme administrateurs système."""
        return [cls.ADMINISTRATEUR.value, cls.SUPER_ADMINISTRATEUR.value]

    @classmethod
    def roles_chefs(cls) -> list[str]:
        """Retourne les rôles de chefs de département."""
        return [
            cls.CHEF_POLICE.value,
            cls.CHEF_MEDICAL.value,
            cls.CHEF_ONG.value,
            cls.CHEF_AGENT.value,
        ]

    @classmethod
    def roles_institutionnels(cls) -> list[str]:
        """Retourne les rôles liés à des institutions (hors citoyen et admins)."""
        return [
            cls.AGENT.value,
            cls.MEDECIN.value,
            cls.POLICE.value,
            cls.ONG.value,
            cls.CHEF_POLICE.value,
            cls.CHEF_MEDICAL.value,
            cls.CHEF_ONG.value,
            cls.CHEF_AGENT.value,
        ]

    @classmethod
    def roles_verifies(cls) -> list[str]:
        """
        Rôles qui nécessitent une vérification d'identité renforcée
        (reconnaissance faciale, documents officiels).
        """
        return [
            cls.MEDECIN.value,
            cls.POLICE.value,
            cls.ONG.value,
            cls.CHEF_POLICE.value,
            cls.CHEF_MEDICAL.value,
            cls.CHEF_ONG.value,
            cls.AGENT.value,
            cls.CHEF_AGENT.value,
            cls.ADMINISTRATEUR.value,
            cls.SUPER_ADMINISTRATEUR.value,
        ]


class NiveauxRisque(str, Enum):
    """
    Niveaux de risque associés à une action ou un utilisateur.
    Calculés par le moteur de détection de fraude.
    """
    FAIBLE = "faible"          # 0 - 30
    MODERE = "modere"          # 31 - 60
    ELEVE = "eleve"            # 61 - 80
    CRITIQUE = "critique"      # 81 - 100

    @staticmethod
    def depuis_score(score: int) -> "NiveauxRisque":
        """Convertit un score numérique 0-100 en niveau."""
        if score <= 30: return NiveauxRisque.FAIBLE
        if score <= 60: return NiveauxRisque.MODERE
        if score <= 80: return NiveauxRisque.ELEVE
        return NiveauxRisque.CRITIQUE


class TypesEvenementAudit(str, Enum):
    """
    Catalogue des événements traçables dans le journal d'audit.
    Chaque action sensible doit produire un événement de ce catalogue.
    """
    # Authentification
    CONNEXION_REUSSIE = "connexion_reussie"
    CONNEXION_ECHOUEE = "connexion_echouee"
    DECONNEXION = "deconnexion"
    INSCRIPTION = "inscription"
    CHANGEMENT_MOT_DE_PASSE = "changement_mot_de_passe"
    ACTIVATION_2FA = "activation_2fa"
    VERIFICATION_2FA_ECHOUEE = "verification_2fa_echouee"

    # Données personnelles
    CONSULTATION_PROFIL = "consultation_profil"
    MODIFICATION_PROFIL = "modification_profil"
    SUPPRESSION_PROFIL = "suppression_profil"
    EXPORT_DONNEES = "export_donnees"

    # Scoring
    CALCUL_SCORE = "calcul_score"
    CONSULTATION_SCORE = "consultation_score"
    PARTAGE_DIGIID = "partage_digiid"

    # Administration
    ACCES_ADMINISTRATION = "acces_administration"
    SUSPENSION_UTILISATEUR = "suspension_utilisateur"
    REACTIVATION_UTILISATEUR = "reactivation_utilisateur"

    # Sécurité
    TENTATIVE_INTRUSION = "tentative_intrusion"
    ALERTE_FRAUDE = "alerte_fraude"
    BLOCAGE_AUTOMATIQUE = "blocage_automatique"


class CodesErreur(str, Enum):
    """Codes d'erreur métier exposés à l'API."""
    AUTH_IDENTIFIANTS_INVALIDES = "AUTH_001"
    AUTH_COMPTE_VERROUILLE = "AUTH_002"
    AUTH_COMPTE_NON_VERIFIE = "AUTH_003"
    AUTH_2FA_REQUIS = "AUTH_004"
    AUTH_2FA_INVALIDE = "AUTH_005"
    AUTH_TOKEN_EXPIRE = "AUTH_006"
    AUTH_TOKEN_INVALIDE = "AUTH_007"
    AUTH_PERMISSION_REFUSEE = "AUTH_008"

    UTILISATEUR_EMAIL_DEJA_UTILISE = "USR_001"
    UTILISATEUR_INTROUVABLE = "USR_002"
    UTILISATEUR_DESACTIVE = "USR_003"

    VALIDATION_DONNEES_INVALIDES = "VAL_001"

    SECURITE_LIMITE_REQUETES = "SEC_001"
    SECURITE_FRAUDE_DETECTEE = "SEC_002"

    SYSTEME_BASE_DONNEES_INDISPONIBLE = "SYS_001"
    SYSTEME_LLM_INDISPONIBLE = "SYS_002"


# Préfixes de routes par rôle — un seul endroit pour les changer si besoin
PREFIXE_API_UTILISATEUR = "/api/v1/utilisateur"
PREFIXE_API_ADMIN = "/api/v1/admin"
PREFIXE_API_SUPER_ADMIN = "/api/v1/super-admin"
PREFIXE_API_PUBLIC = "/api/v1/public"

import hashlib

def hasher_email(email: str) -> str:
    """Hash SHA-256 de l'email pour la recherche en base."""
    return hashlib.sha256(email.lower().strip().encode("utf-8")).hexdigest()