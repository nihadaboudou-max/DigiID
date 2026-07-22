# -*- coding: utf-8 -*-
"""
Middleware et dépendance de vérification des permissions UI.

Permet de vérifier si un utilisateur connecté a accès à un module UI
spécifique, en se basant sur :
  1. Les permissions de son rôle (table ui_module_permissions)
  2. Ses overrides individuels (colonne modules_overrides)

Utilisation dans les routes frontend Next.js ou API :
  from src.middleware.verification_ui import verifier_acces_module

  @routeur.get("/mon-dossier")
  async def voir_dossier(utilisateur=Depends(utilisateur_courant)):
      verifier_acces_module(utilisateur, "creation_dossier")
      ...
"""
from typing import Optional

from fastapi import HTTPException, status

from src.config.constantes import RolesUtilisateur
from src.modeles import Utilisateur


# Modules accessibles par défaut pour les super admins (ont tout)
MODULES_SUPER_ADMIN = {"*"}  # Wildcard — tout est accessible

# Mapping des rôles vers modules de base (fallback si table non dispo)
FALLBACK_MODULES: dict[str, set[str]] = {
    "super_administrateur": {"*"},
    "administrateur": {
        "gestion_utilisateurs_admin", "matrice_droits", "audit_logs_admin",
        "statistiques_admin", "alertes_securite", "mon_profil_admin",
    },
    "citoyen": {
        "mon_profil", "mes_attestations", "mon_score", "mes_documents",
        "historique_acces", "verification_cni", "verification_faciale",
        "consentements", "chatbot", "badges", "parrainage",
    },
    "agent_terrain": {
        "enrolement_citoyen", "scan_ocr_cni", "capture_biometrique",
        "liste_enrollements", "recherche_citoyen", "stats_enrolement",
        "mon_profil_agent",
    },
    # Alias legacy
    "agent": {
        "enrolement_citoyen", "scan_ocr_cni", "capture_biometrique",
        "liste_enrollements", "recherche_citoyen", "stats_enrolement",
        "mon_profil_agent",
    },
    "agent_medical": {
        "creation_dossier", "suivi_dossier", "recherche_patient",
        "attestations_medicales", "historique_consultations",
        "ordonnances", "calendrier_rendezvous", "mon_profil_agent",
    },
    "medecin": {
        "creation_dossier", "suivi_dossier", "recherche_patient",
        "attestations_medicales", "historique_consultations",
        "ordonnances", "calendrier_rendezvous", "mon_profil_agent",
    },
    "agent_police": {
        "verification_identite", "consultation_score", "recherche_personne",
        "audit_acces_police", "signalement_fraude", "mon_profil_agent",
    },
    "police": {
        "verification_identite", "consultation_score", "recherche_personne",
        "audit_acces_police", "signalement_fraude", "mon_profil_agent",
    },
    "agent_ong": {
        "consultation_beneficiaires", "attestations_communautaires",
        "rapports_terrain", "gestion_programme", "mon_profil_agent",
        "statistiques_ong", "calendrier_missions",
    },
    "ong": {
        "consultation_beneficiaires", "attestations_communautaires",
        "rapports_terrain", "gestion_programme", "mon_profil_agent",
        "statistiques_ong", "calendrier_missions",
    },
    "chef_police": {
        "gestion_equipe", "statistiques_chef", "audit_equipe",
        "gestion_missions", "invitations", "rapports_chef",
        "recherche_chef", "mon_profil_chef", "programmes",
    },
    "chef_medical": {
        "gestion_equipe", "statistiques_chef", "audit_equipe",
        "gestion_missions", "invitations", "rapports_chef",
        "recherche_chef", "mon_profil_chef",
    },
    "chef_ong": {
        "gestion_equipe", "statistiques_chef", "audit_equipe",
        "gestion_missions", "invitations", "rapports_chef",
        "recherche_chef", "mon_profil_chef", "programmes",
    },
    "chef_agent": {
        "gestion_equipe", "statistiques_chef", "audit_equipe",
        "invitations", "rapports_chef",
        "recherche_chef", "mon_profil_chef",
    },
}


def verifier_acces_module(
    utilisateur: Utilisateur,
    module_key: str,
) -> bool:
    """
    Vérifie si un utilisateur a accès à un module UI spécifique.

    Args:
        utilisateur: L'utilisateur connecté (avec son rôle et overrides)
        module_key: La clé du module à vérifier (ex: 'creation_dossier')

    Returns:
        True si l'accès est autorisé

    Raises:
        HTTPException 403 si l'accès est refusé
    """
    role = utilisateur.role

    # Super admin a accès à tout
    if role == RolesUtilisateur.SUPER_ADMINISTRATEUR.value:
        return True

    # Vérifier les overrides individuels
    overrides = getattr(utilisateur, 'modules_overrides', None) or {}
    if module_key in overrides:
        override = overrides[module_key]
        if override.get("is_enabled") is True:
            return True
        if override.get("is_enabled") is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé au module '{module_key}'. Contacte le super administrateur.",
            )

    # Vérifier dans les modules de base du rôle
    modules_role = FALLBACK_MODULES.get(role, set())
    if "*" in modules_role or module_key in modules_role:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Le module '{module_key}' n'est pas accessible pour ton rôle ({role}).",
    )


async def verifier_acces_module_db(
    utilisateur: Utilisateur,
    module_key: str,
    modules_permissions: Optional[list[dict]] = None,
) -> bool:
    """
    Version avec vérification par la base de données (utilise les données
    déjà chargées de ui_module_permissions).

    Args:
        utilisateur: L'utilisateur connecté
        module_key: La clé du module à vérifier
        modules_permissions: Liste des permissions pré-chargées (optionnel)

    Returns:
        True si l'accès est autorisé

    Raises:
        HTTPException 403 si l'accès est refusé
    """
    role = utilisateur.role

    # Super admin a toujours accès
    if role == RolesUtilisateur.SUPER_ADMINISTRATEUR.value:
        return True

    # Vérifier les overrides individuels
    overrides = getattr(utilisateur, 'modules_overrides', None) or {}
    if module_key in overrides:
        override = overrides[module_key]
        if override.get("is_enabled") is True:
            return True
        if override.get("is_enabled") is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Accès refusé au module '{module_key}'.",
            )

    # Vérifier dans les permissions chargées
    if modules_permissions:
        for mod in modules_permissions:
            if mod.get("module_key") == module_key and mod.get("is_enabled"):
                return True

    # Fallback sur le dictionnaire statique
    return verifier_acces_module(utilisateur, module_key)


class VerificateurModuleUI:
    """
    Classe utilitaire pour vérifier les accès modules UI.
    Peut être utilisée comme dépendance FastAPI.

    Usage:
        @routeur.get("/dossiers")
        async def lister_dossiers(
            utilisateur: Utilisateur = Depends(utilisateur_courant),
            _: bool = Depends(VerificateurModuleUI("suivi_dossier")),
        ):
            ...
    """

    def __init__(self, module_key: str):
        self.module_key = module_key

    async def __call__(self, utilisateur: Utilisateur = None) -> bool:
        """
        Dépendance FastAPI : vérifie l'accès au module.
        À utiliser avec la dépendance utilisateur_courant.
        """
        if utilisateur is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentification requise.",
            )
        return verifier_acces_module(utilisateur, self.module_key)
