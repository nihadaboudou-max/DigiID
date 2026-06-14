# -*- coding: utf-8 -*-
"""
Script d'initialisation des données DigiID — seed des rôles RBAC et super admin.

Usage :
    docker compose exec backend python -m src.base_donnees.seed

Étapes :
    1. Semer les 7 rôles RBAC dans la table `role` (idempotent)
    2. Créer le super administrateur initial si aucun n'existe

Variables d'environnement :
    SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_MOT_DE_PASSE
"""
import asyncio
import os
import sys
from getpass import getpass

from sqlalchemy import select

from src.base_donnees.session import FabriqueSession
from src.config.constantes import RolesUtilisateur
from src.modeles import Role, Utilisateur
from src.modules.authentification import service
from src.noyau import journal
from src.noyau.journal import configurer_journal


# ==============================================================================
# Données des rôles : description + nom d'affichage
# ==============================================================================

DONNEES_ROLES: list[dict] = [
    {
        "nom_technique": RolesUtilisateur.CITOYEN.value,
        "nom_affichage": "Citoyen",
        "description": (
            "Utilisateur standard de DigiID. Peut créer un compte, gérer son profil, "
            "son score, ses consentements, et partager son identité numérique. "
            "Rôle de base par défaut."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierachie()[RolesUtilisateur.CITOYEN],
    },
    {
        "nom_technique": RolesUtilisateur.ONG.value,
        "nom_affichage": "ONG",
        "description": (
            "Membre d'une organisation non gouvernementale partenaire. "
            "Peut consulter les profils DigiID des citoyens ayant donné leur consentement "
            "dans le cadre de programmes d'aide sociale."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierachie()[RolesUtilisateur.ONG],
    },
    {
        "nom_technique": RolesUtilisateur.MEDECIN.value,
        "nom_affichage": "Médecin",
        "description": (
            "Professionnel de santé habilité. Peut consulter le dossier médical "
            "d'un citoyen via son DigiID en contexte de soin (urgences, suivi). "
            "Nécessite vérification d'identité renforcée."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierachie()[RolesUtilisateur.MEDECIN],
    },
    {
        "nom_technique": RolesUtilisateur.AGENT.value,
        "nom_affichage": "Agent",
        "description": (
            "Agent d'une administration publique partenaire (état civil, impôts, "
            "prestations sociales). Peut vérifier l'identité d'un citoyen dans le cadre "
            "de démarches administratives."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierachie()[RolesUtilisateur.AGENT],
    },
    {
        "nom_technique": RolesUtilisateur.POLICE.value,
        "nom_affichage": "Police",
        "description": (
            "Agent des forces de l'ordre. Accès aux données d'identité dans le cadre "
            "de contrôles légaux. Nécessite vérification d'identité renforcée "
            "et journalisation stricte."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierachie()[RolesUtilisateur.POLICE],
    },
    {
        "nom_technique": RolesUtilisateur.ADMINISTRATEUR.value,
        "nom_affichage": "Administrateur",
        "description": (
            "Administrateur système DigiID. Gère les utilisateurs, consulte les "
            "statistiques agrégées, les alertes de sécurité. Ne voit jamais les "
            "données personnelles brutes (pseudonymisées)."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierachie()[RolesUtilisateur.ADMINISTRATEUR],
    },
    {
        "nom_technique": RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
        "nom_affichage": "Super Administrateur",
        "description": (
            "Super administrateur technique. Accès complet au système : configuration, "
            "gestion des administrateurs, journal d'audit, statistiques avancées. "
            "Accès conditionnel aux données personnelles (sur motif légal)."
        ),
        "niveau_hierarchie": RolesUtilisateur.hierachie()[RolesUtilisateur.SUPER_ADMINISTRATEUR],
    },
]


# ==============================================================================
# Fonctions de seed
# ==============================================================================


async def semer_roles() -> None:
    """
    Insère les 7 rôles RBAC dans la table `role`.

    Idempotent : si un rôle existe déjà (nom_technique), on ne le duplique pas.
    Synchronise le niveau hiérarchique au cas où il aurait changé dans le code.
    """
    configurer_journal()
    journal.info("=== Seed des rôles RBAC ===")

    async with FabriqueSession() as session:
        roles_existants = (await session.scalars(
            select(Role)
        )).all()
        existants_par_technique: dict[str, Role] = {
            r.nom_technique: r for r in roles_existants
        }

        inseres = 0
        synchronises = 0

        for donnees in DONNEES_ROLES:
            technique = donnees["nom_technique"]

            if technique in existants_par_technique:
                # Mettre à jour le niveau hiérarchique si différent
                role_existant = existants_par_technique[technique]
                if role_existant.niveau_hierarchie != donnees["niveau_hierarchie"]:
                    role_existant.niveau_hierarchie = donnees["niveau_hierarchie"]
                    synchronises += 1
                    journal.info(
                        f"Rôle '{technique}' synchronisé : "
                        f"niveau_hierarchie = {donnees['niveau_hierarchie']}"
                    )
            else:
                # Créer le rôle
                nouveau_role = Role(
                    nom_technique=technique,
                    nom_affichage=donnees["nom_affichage"],
                    description=donnees["description"],
                    niveau_hierarchie=donnees["niveau_hierarchie"],
                )
                session.add(nouveau_role)
                inseres += 1
                journal.info(
                    f"Rôle '{technique}' créé : "
                    f"niveau_hierarchie = {donnees['niveau_hierarchie']}"
                )

        await session.commit()

        total = len(roles_existants) + inseres
        print(f"\n✅ Rôles RBAC : {total}/7 présents")
        if inseres > 0:
            print(f"   • {inseres} nouveau(x) rôle(s) inséré(s)")
        if synchronises > 0:
            print(f"   • {synchronises} rôle(s) synchronisé(s) (niveau hiérarchique mis à jour)")
        if inseres == 0 and synchronises == 0:
            print(f"   • Aucune modification nécessaire")


async def creer_super_admin_initial():
    """Crée le super administrateur initial si aucun n'existe."""

    configurer_journal()
    journal.info("=== Création du super administrateur initial ===")

    # D'abord, s'assurer que les rôles existent en base
    await semer_roles()

    async with FabriqueSession() as session:
        # Vérifier qu'aucun super admin n'existe
        resultat = await session.execute(
            select(Utilisateur).where(
                Utilisateur.role == RolesUtilisateur.SUPER_ADMINISTRATEUR.value
            )
        )
        super_admin_existant = resultat.scalar_one_or_none()

        if super_admin_existant:
            journal.info(f"Un super admin existe déjà : id={super_admin_existant.id}")
            # ✅ Déverrouiller, reset mot de passe et désactiver 2FA
            from src.noyau import hacher_mot_de_passe
            super_admin_existant.est_verrouille = False
            super_admin_existant.date_verrouillage = None
            super_admin_existant.tentatives_connexion_echouees = 0
            super_admin_existant.est_actif = True
            super_admin_existant.deux_fa_active = False
            super_admin_existant.secret_2fa_chiffre = None
            
            # Mettre à jour le mot de passe si les variables sont présentes
            mot_de_passe_update = os.getenv("SEED_SUPER_ADMIN_MOT_DE_PASSE", "Admin@DigiID2025!")
            super_admin_existant.mot_de_passe_hash = hacher_mot_de_passe(mot_de_passe_update)
            await session.commit()
            
            journal.info(f"Super admin déverrouillé et mot de passe réinitialisé : id={super_admin_existant.id}")
            print(f"\n✅ Super administrateur déjà existant — déverrouillé et mot de passe réinitialisé.")
            print(f"   Connecte-toi avec admin@digiid.africa / Admin@DigiID2025!")
            return

        # Récupérer les identifiants
        email = os.getenv("SEED_SUPER_ADMIN_EMAIL")
        mot_de_passe = os.getenv("SEED_SUPER_ADMIN_MOT_DE_PASSE")

        if not email or not mot_de_passe:
            # ⚠️ Fallback : identifiants par défaut si variables non définies
            # Ceci permet à Render de fonctionner même sans variable manuelle
            email = email or "admin@digiid.africa"
            mot_de_passe = mot_de_passe or "Admin@DigiID2025!"
            journal.warning(
                f"SEED_SUPER_ADMIN_EMAIL/MOT_DE_PASSE non définis — "
                f"utilisation des identifiants par défaut : {email}"
            )
            print("\n⚠️  Variables SEED_SUPER_ADMIN_EMAIL/MOT_DE_PASSE non définies.")
            print(f"   Utilisation des identifiants par défaut : {email} / (mot de passe défini dans le code)")

        prenom = os.getenv("SEED_SUPER_ADMIN_PRENOM", "Super")
        nom = os.getenv("SEED_SUPER_ADMIN_NOM", "Admin")

        # Créer le super admin
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
            # Marquer l'email comme vérifié (pas d'email à envoyer)
            super_admin.est_email_verifie = True
            # 2FA : LAISSER À False — l'utilisateur l'active depuis son profil
            # (via POST /api/v1/utilisateur/profil/2fa/preparation + /activer)
            super_admin.deux_fa_active = False
            await session.commit()

            journal.info(f"Super administrateur créé : id={super_admin.id}")
            print(f"\n✅ Super administrateur créé avec succès")
            print(f"   ID         : {super_admin.id}")
            print(f"   Email      : {email}")
            print(f"   DigiID pub : {super_admin.digiid_public}")
            print(f"\nConnexion : POST /api/v1/auth/connexion")

        except Exception as erreur:
            journal.error(f"Échec création super admin : {erreur}")
            print(f"\n❌ Échec : {erreur}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(creer_super_admin_initial())
