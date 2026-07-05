# -*- coding: utf-8 -*-
"""
Service métier pour le module Chefs.
Gère la création d'agents par les chefs de département selon leur type.
"""
import secrets
import string
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.noyau import dechiffrer_donnee, chiffrer_donnee, journal
from src.noyau.constantes_roles import (
    RoleUtilisateur,
    ROLES_CHEF,
    obtenir_type_departement_depuis_role,
)
from src.noyau.exceptions import ErreurValidation, ErreurAutorisation


# =============================================================================
# Fonctions utilitaires
# =============================================================================

def _generer_digiid() -> str:
    """Génère un DigiID public unique de 16 caractères."""
    caracteres = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(caracteres) for _ in range(16))


def _generer_mot_de_passe_temporaire() -> str:
    """Génère un mot de passe temporaire de 12 caractères."""
    caracteres = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(caracteres) for _ in range(12))


async def _verifier_chef_peut_creer(chef: Utilisateur, role_cible: str) -> bool:
    """
    Vérifie si un chef peut créer un agent avec le rôle cible.
    
    Règles :
    - chef_police peut créer agent_police
    - chef_medical peut créer agent_medical
    - chef_ong peut créer agent_ong
    - chef_agent peut créer agent_terrain
    """
    if chef.role == RoleUtilisateur.CHEF_POLICE:
        return role_cible == RoleUtilisateur.AGENT_POLICE
    elif chef.role == RoleUtilisateur.CHEF_MEDICAL:
        return role_cible == RoleUtilisateur.AGENT_MEDICAL
    elif chef.role == RoleUtilisateur.CHEF_ONG:
        return role_cible == RoleUtilisateur.AGENT_ONG
    elif chef.role == RoleUtilisateur.CHEF_AGENT:
        return role_cible == RoleUtilisateur.AGENT_TERRAIN
    return False


async def _email_existe_deja(session: AsyncSession, email: str) -> bool:
    """Vérifie si un email est déjà utilisé."""
    from src.config.constantes import hasher_email
    email_hash = hasher_email(email)
    
    result = await session.execute(
        select(Utilisateur).where(
            Utilisateur.email_hash == email_hash,
            Utilisateur.est_supprime == False
        )
    )
    return result.scalar_one_or_none() is not None


# =============================================================================
# Création d'agents
# =============================================================================

async def creer_agent_police(
    session: AsyncSession,
    chef: Utilisateur,
    data: dict,
) -> Utilisateur:
    """
    Crée un agent police par un chef police.
    L'agent est automatiquement assigné au département du chef.
    """
    # Vérifier les permissions
    if not await _verifier_chef_peut_creer(chef, RoleUtilisateur.AGENT_POLICE):
        raise ErreurAutorisation(
            "Vous n'avez pas l'autorisation de créer des agents police.",
            message_utilisateur="Seuls les chefs police peuvent créer des agents police."
        )
    
    # Vérifier que l'email n'existe pas déjà
    if await _email_existe_deja(session, data["email"]):
        raise ErreurValidation(
            f"L'email {data['email']} est déjà utilisé.",
            message_utilisateur="Cet email est déjà associé à un compte."
        )
    
    # Générer les identifiants
    digiid = _generer_digiid()
    mot_de_passe = _generer_mot_de_passe_temporaire()
    
    # Créer l'utilisateur
    from src.config.constantes import hasher_mdp, hasher_email
    from src.modeles.utilisateur import Utilisateur
    
    agent = Utilisateur(
        digiid_public=digiid,
        email_chiffre=chiffrer_donnee(data["email"]),
        email_hash=hasher_email(data["email"]),
        mot_de_passe_hash=hasher_mdp(mot_de_passe),
        prenom_chiffre=chiffrer_donnee(data["prenom"]),
        nom_chiffre=chiffrer_donnee(data["nom"]),
        telephone_chiffre=chiffrer_donnee(data.get("telephone", "")),
        ville=data.get("ville"),
        pays=data.get("pays", "Sénégal"),
        role=RoleUtilisateur.AGENT_POLICE,
        domaine_id=chef.domaine_id,
        departement_id=chef.departement_id,
        superieur_id=chef.id,
        est_actif=True,
        est_email_verifie=False,
        est_visage_verifie=False,
        est_cni_verifiee=False,
    )
    
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    
    journal.info(
        f"Agent police créé | chef={chef.id} | agent={agent.id} | "
        f"digiid={digiid} | email={data['email']}"
    )
    
    # TODO: Envoyer email d'invitation avec mot de passe temporaire
    
    return agent


async def creer_medecin(
    session: AsyncSession,
    chef: Utilisateur,
    data: dict,
) -> Utilisateur:
    """Crée un médecin par un chef médical."""
    if not await _verifier_chef_peut_creer(chef, RoleUtilisateur.AGENT_MEDICAL):
        raise ErreurAutorisation(
            "Vous n'avez pas l'autorisation de créer des médecins.",
            message_utilisateur="Seuls les chefs médicaux peuvent créer des médecins."
        )
    
    if await _email_existe_deja(session, data["email"]):
        raise ErreurValidation(
            f"L'email {data['email']} est déjà utilisé.",
            message_utilisateur="Cet email est déjà associé à un compte."
        )
    
    digiid = _generer_digiid()
    mot_de_passe = _generer_mot_de_passe_temporaire()
    
    from src.config.constantes import hasher_mdp, hasher_email
    
    agent = Utilisateur(
        digiid_public=digiid,
        email_chiffre=chiffrer_donnee(data["email"]),
        email_hash=hasher_email(data["email"]),
        mot_de_passe_hash=hasher_mdp(mot_de_passe),
        prenom_chiffre=chiffrer_donnee(data["prenom"]),
        nom_chiffre=chiffrer_donnee(data["nom"]),
        telephone_chiffre=chiffrer_donnee(data.get("telephone", "")),
        ville=data.get("ville"),
        pays=data.get("pays", "Sénégal"),
        role=RoleUtilisateur.AGENT_MEDICAL,
        domaine_id=chef.domaine_id,
        departement_id=chef.departement_id,
        superieur_id=chef.id,
        est_actif=True,
        est_email_verifie=False,
        est_visage_verifie=False,
        est_cni_verifiee=False,
    )
    
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    
    journal.info(
        f"Médecin créé | chef={chef.id} | agent={agent.id} | "
        f"digiid={digiid} | email={data['email']}"
    )
    
    return agent


async def creer_agent_ong(
    session: AsyncSession,
    chef: Utilisateur,
    data: dict,
) -> Utilisateur:
    """Crée un agent ONG par un chef ONG."""
    if not await _verifier_chef_peut_creer(chef, RoleUtilisateur.AGENT_ONG):
        raise ErreurAutorisation(
            "Vous n'avez pas l'autorisation de créer des agents ONG.",
            message_utilisateur="Seuls les chefs ONG peuvent créer des agents ONG."
        )
    
    if await _email_existe_deja(session, data["email"]):
        raise ErreurValidation(
            f"L'email {data['email']} est déjà utilisé.",
            message_utilisateur="Cet email est déjà associé à un compte."
        )
    
    digiid = _generer_digiid()
    mot_de_passe = _generer_mot_de_passe_temporaire()
    
    from src.config.constantes import hasher_mdp, hasher_email
    
    agent = Utilisateur(
        digiid_public=digiid,
        email_chiffre=chiffrer_donnee(data["email"]),
        email_hash=hasher_email(data["email"]),
        mot_de_passe_hash=hasher_mdp(mot_de_passe),
        prenom_chiffre=chiffrer_donnee(data["prenom"]),
        nom_chiffre=chiffrer_donnee(data["nom"]),
        telephone_chiffre=chiffrer_donnee(data.get("telephone", "")),
        ville=data.get("ville"),
        pays=data.get("pays", "Sénégal"),
        role=RoleUtilisateur.AGENT_ONG,
        domaine_id=chef.domaine_id,
        departement_id=chef.departement_id,
        superieur_id=chef.id,
        est_actif=True,
        est_email_verifie=False,
        est_visage_verifie=False,
        est_cni_verifiee=False,
    )
    
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    
    journal.info(
        f"Agent ONG créé | chef={chef.id} | agent={agent.id} | "
        f"digiid={digiid} | email={data['email']}"
    )
    
    return agent


async def creer_agent_enrolement(
    session: AsyncSession,
    chef: Utilisateur,
    data: dict,
) -> Utilisateur:
    """Crée un agent enrôlement par un chef enrôlement."""
    if not await _verifier_chef_peut_creer(chef, RoleUtilisateur.AGENT_TERRAIN):
        raise ErreurAutorisation(
            "Vous n'avez pas l'autorisation de créer des agents enrôlement.",
            message_utilisateur="Seuls les chefs enrôlement peuvent créer des agents enrôlement."
        )
    
    if await _email_existe_deja(session, data["email"]):
        raise ErreurValidation(
            f"L'email {data['email']} est déjà utilisé.",
            message_utilisateur="Cet email est déjà associé à un compte."
        )
    
    digiid = _generer_digiid()
    mot_de_passe = _generer_mot_de_passe_temporaire()
    
    from src.config.constantes import hasher_mdp, hasher_email
    
    agent = Utilisateur(
        digiid_public=digiid,
        email_chiffre=chiffrer_donnee(data["email"]),
        email_hash=hasher_email(data["email"]),
        mot_de_passe_hash=hasher_mdp(mot_de_passe),
        prenom_chiffre=chiffrer_donnee(data["prenom"]),
        nom_chiffre=chiffrer_donnee(data["nom"]),
        telephone_chiffre=chiffrer_donnee(data.get("telephone", "")),
        ville=data.get("ville"),
        pays=data.get("pays", "Sénégal"),
        role=RoleUtilisateur.AGENT_TERRAIN,
        domaine_id=chef.domaine_id,
        departement_id=chef.departement_id,
        superieur_id=chef.id,
        est_actif=True,
        est_email_verifie=False,
        est_visage_verifie=False,
        est_cni_verifiee=False,
    )
    
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    
    journal.info(
        f"Agent enrôlement créé | chef={chef.id} | agent={agent.id} | "
        f"digiid={digiid} | email={data['email']}"
    )
    
    return agent


# =============================================================================
# Liste des agents
# =============================================================================

async def lister_agents_chef(
    session: AsyncSession,
    chef: Utilisateur,
    page: int = 1,
    par_page: int = 20,
) -> tuple[list[Utilisateur], int]:
    """Liste les agents créés par un chef."""
    query = select(Utilisateur).where(
        Utilisateur.superieur_id == chef.id,
        Utilisateur.est_supprime == False
    )
    
    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0
    
    # Pagination
    offset = (page - 1) * par_page
    query = query.offset(offset).limit(par_page)
    query = query.order_by(Utilisateur.cree_le.desc())
    
    result = await session.execute(query)
    agents = result.scalars().all()
    
    return list(agents), total


# =============================================================================
# Statistiques
# =============================================================================

async def obtenir_statistiques_chef(
    session: AsyncSession,
    chef: Utilisateur,
) -> dict:
    """Obtient les statistiques pour le dashboard d'un chef."""
    # Total agents
    result = await session.execute(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.superieur_id == chef.id,
            Utilisateur.est_supprime == False
        )
    )
    total_agents = result.scalar() or 0
    
    # Agents actifs
    result = await session.execute(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.superieur_id == chef.id,
            Utilisateur.est_supprime == False,
            Utilisateur.est_actif == True
        )
    )
    agents_actifs = result.scalar() or 0
    
    # Agents inactifs
    agents_inactifs = total_agents - agents_actifs
    
    # Agents créés aujourd'hui
    aujourdhui = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await session.execute(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.superieur_id == chef.id,
            Utilisateur.est_supprime == False,
            Utilisateur.cree_le >= aujourdhui
        )
    )
    agents_aujourdhui = result.scalar() or 0
    
    # Agents créés ce mois
    debut_mois = aujourdhui.replace(day=1)
    result = await session.execute(
        select(func.count(Utilisateur.id)).where(
            Utilisateur.superieur_id == chef.id,
            Utilisateur.est_supprime == False,
            Utilisateur.cree_le >= debut_mois
        )
    )
    agents_ce_mois = result.scalar() or 0
    
    # Dernier agent créé
    result = await session.execute(
        select(Utilisateur).where(
            Utilisateur.superieur_id == chef.id,
            Utilisateur.est_supprime == False
        ).order_by(Utilisateur.cree_le.desc()).limit(1)
    )
    dernier_agent = result.scalar_one_or_none()
    
    return {
        "total_agents": total_agents,
        "agents_actifs": agents_actifs,
        "agents_inactifs": agents_inactifs,
        "agents_crees_aujourdhui": agents_aujourdhui,
        "agents_crees_ce_mois": agents_ce_mois,
        "dernier_agent_cree": dernier_agent,
    }