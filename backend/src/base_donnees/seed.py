# -*- coding: utf-8 -*-
"""
Script d'initialisation des données DigiID — seed des rôles RBAC et super admin.

Usage :
    docker compose exec backend python -m src.base_donnees.seed

Étapes :
    1. Semer les rôles RBAC dans la table `role` (idempotent)
    2. Créer le super administrateur initial si aucun n'existe

Variables d'environnement :
    SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_MOT_DE_PASSE
"""
import asyncio
import os
import sys

from sqlalchemy import select

from src.base_donnees.session import FabriqueSession
from src.config.constantes import RolesUtilisateur
from src.modeles import Role, Utilisateur
from src.modules.authentification import service
from src.noyau import journal
from src.noyau.journal import configurer_journal


# ==============================================================================
# Données des rôles : description + nom d'affichage (MIS À JOUR)
# ==============================================================================

DONNEES_ROLES: list[dict] = [
    {
        "nom_technique": RolesUtilisateur.CITOYEN.value,
        "nom_affichage": "Citoyen",
        "description": (
            "Utilisateur standard de DigiID. Peut créer un compte, gérer son profil, "
            "son score, ses consentements, et partager son identité numérique."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.CITOYEN],
    },
    {
        "nom_technique": RolesUtilisateur.AGENT_POLICE.value,
        "nom_affichage": "Agent Police",
        "description": (
            "Agent des forces de l'ordre. Accès aux données d'identité dans le cadre "
            "de contrôles légaux. Nécessite vérification d'identité renforcée."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.AGENT_POLICE],
    },
    {
        "nom_technique": RolesUtilisateur.CHEF_POLICE.value,
        "nom_affichage": "Chef Police",
        "description": (
            "Chef de département police. Supervise les agents police, gère les missions "
            "et les rapports de son département."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.CHEF_POLICE],
    },
    {
        "nom_technique": RolesUtilisateur.AGENT_MEDICAL.value,
        "nom_affichage": "Agent Médical / Médecin",
        "description": (
            "Professionnel de santé habilité. Peut consulter le dossier médical "
            "d'un citoyen via son DigiID en contexte de soin."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.AGENT_MEDICAL],
    },
    {
        "nom_technique": RolesUtilisateur.CHEF_MEDICAL.value,
        "nom_affichage": "Chef Médical",
        "description": (
            "Chef de département médical. Supervise les agents médicaux et gère les "
            "activités de son département."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.CHEF_MEDICAL],
    },
    {
        "nom_technique": RolesUtilisateur.AGENT_TERRAIN.value,
        "nom_affichage": "Agent Terrain / Enrôlement",
        "description": (
            "Agent d'enrôlement sur le terrain. Collecte les données et vérifie les "
            "identités des citoyens."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.AGENT_TERRAIN],
    },
    {
        "nom_technique": RolesUtilisateur.CHEF_AGENT.value,
        "nom_affichage": "Chef Agent / Enrôlement",
        "description": (
            "Chef de département d'enrôlement. Supervise les agents terrain et gère "
            "les opérations d'enrôlement."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.CHEF_AGENT],
    },
    {
        "nom_technique": RolesUtilisateur.AGENT_ONG.value,
        "nom_affichage": "Agent ONG",
        "description": (
            "Membre d'une organisation non gouvernementale partenaire. Peut consulter "
            "les profils DigiID des citoyens ayant donné leur consentement."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.AGENT_ONG],
    },
    {
        "nom_technique": RolesUtilisateur.CHEF_ONG.value,
        "nom_affichage": "Chef ONG",
        "description": (
            "Chef de département ONG. Supervise les agents ONG, gère les programmes "
            "et les missions."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.CHEF_ONG],
    },
    {
        "nom_technique": RolesUtilisateur.ADMIN_DOMAINE.value,
        "nom_affichage": "Admin Domaine",
        "description": (
            "Administrateur d'un domaine géographique ou fonctionnel. Gère les "
            "départements et les chefs de son domaine."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.ADMIN_DOMAINE],
    },
    {
        "nom_technique": RolesUtilisateur.ADMINISTRATEUR.value,
        "nom_affichage": "Administrateur",
        "description": (
            "Administrateur système DigiID. Gère les utilisateurs, consulte les "
            "statistiques agrégées et les alertes de sécurité."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.ADMINISTRATEUR],
    },
    {
        "nom_technique": RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
        "nom_affichage": "Super Administrateur",
        "description": (
            "Super administrateur technique. Accès complet au système : configuration, "
            "gestion des administrateurs, journal d'audit."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierarchie()[RolesUtilisateur.SUPER_ADMINISTRATEUR],
    },
]


# ==============================================================================
# Fonctions de seed
# ==============================================================================


async def semer_roles() -> None:
    """
    Insère les rôles RBAC dans la table `role`.
    Idempotent : si un rôle existe déjà, on ne le duplique pas.
    """
    configurer_journal()
    journal.info("=== Seed des rôles RBAC ===")

    async with FabriqueSession() as session:
        roles_existants = (await session.scalars(select(Role))).all()
        existants_par_technique: dict[str, Role] = {
            r.nom_technique: r for r in roles_existants
        }

        inseres = 0
        synchronises = 0

        for donnees in DONNEES_ROLES:
            technique = donnees["nom_technique"]

            if technique in existants_par_technique:
                role_existant = existants_par_technique[technique]
                if role_existant.niveau_hierarchie != donnees["niveau_hierarchie"]:
                    role_existant.niveau_hierarchie = donnees["niveau_hierarchie"]
                    synchronises += 1
                    journal.info(f"Rôle '{technique}' synchronisé : niveau_hierarchie = {donnees['niveau_hierarchie']}")
            else:
                nouveau_role = Role(
                    nom_technique=technique,
                    nom_affichage=donnees["nom_affichage"],
                    description=donnees["description"],
                    niveau_hierarchie=donnees["niveau_hierarchie"],
                )
                session.add(nouveau_role)
                inseres += 1
                journal.info(f"Rôle '{technique}' créé : niveau_hierarchie = {donnees['niveau_hierarchie']}")

        await session.commit()

        total = len(roles_existants) + inseres
        print(f"\n✅ Rôles RBAC : {total} présents en base")
        if inseres > 0:
            print(f"   • {inseres} nouveau(x) rôle(s) inséré(s)")
        if synchronises > 0:
            print(f"   • {synchronises} rôle(s) synchronisé(s)")


async def creer_super_admin_initial():
    """Crée le super administrateur initial si aucun n'existe."""
    configurer_journal()
    journal.info("=== Création du super administrateur initial ===")

    await semer_roles()

    async with FabriqueSession() as session:
        resultat = await session.execute(
            select(Utilisateur).where(
                Utilisateur.role == RolesUtilisateur.SUPER_ADMINISTRATEUR.value
            )
        )
        super_admin_existant = resultat.scalar_one_or_none()

        if super_admin_existant:
            from src.noyau import hacher_mot_de_passe
            super_admin_existant.est_verrouille = False
            super_admin_existant.date_verrouillage = None
            super_admin_existant.tentatives_connexion_echouees = 0
            super_admin_existant.est_actif = True
            super_admin_existant.deux_fa_active = False
            super_admin_existant.secret_2fa_chiffre = None
            
            mot_de_passe_update = os.getenv("SEED_SUPER_ADMIN_MOT_DE_PASSE", "Admin@DigiID2025!")
            super_admin_existant.mot_de_passe_hash = hacher_mot_de_passe(mot_de_passe_update)
            await session.commit()
            
            journal.info(f"Super admin déverrouillé et mot de passe réinitialisé : id={super_admin_existant.id}")
            print(f"\n✅ Super administrateur déjà existant — déverrouillé et mot de passe réinitialisé.")
            print(f"   Connecte-toi avec admin@digiid.africa / Admin@DigiID2025!")
            return

        email = os.getenv("SEED_SUPER_ADMIN_EMAIL") or "admin@digiid.africa"
        mot_de_passe = os.getenv("SEED_SUPER_ADMIN_MOT_DE_PASSE") or "Admin@DigiID2025!"
        prenom = os.getenv("SEED_SUPER_ADMIN_PRENOM", "Super")
        nom = os.getenv("SEED_SUPER_ADMIN_NOM", "Admin")

        try:
            super_admin = await service.inscrire_utilisateur(
                session=session,
                email=email,
                mot_de_passe=mot_de_passe,
                prenom=prenom,
                nom=nom,
                role=RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
                adresse_ip="127.0.0.1",
            )
            super_admin.est_email_verifie = True
            super_admin.deux_fa_active = False
            await session.commit()

            journal.info(f"Super administrateur créé : id={super_admin.id}")
            print(f"\n✅ Super administrateur créé avec succès")
            print(f"   Email      : {email}")
            print(f"   DigiID pub : {super_admin.digiid_public}")

        except Exception as erreur:
            journal.error(f"Échec création super admin : {erreur}")
            print(f"\n❌ Échec : {erreur}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(creer_super_admin_initial())