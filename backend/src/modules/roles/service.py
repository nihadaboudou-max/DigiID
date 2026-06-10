# -*- coding: utf-8 -*-
"""
Service Roles — Logique métier de gestion des rôles RBAC.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.constantes import RolesUtilisateur, TypesEvenementAudit
from src.modeles import Utilisateur, JournalAudit
from src.modules.roles.schemas import DemandeRoleReponse
from src.noyau import journal
from src.noyau.exceptions import ErreurAutorisation, ErreurValidation


async def demander_changement_role(
    session: AsyncSession,
    utilisateur: Utilisateur,
    role_demande: str,
    adresse_ip: Optional[str] = None,
) -> DemandeRoleReponse:
    """
    Traite une demande de changement de rôle.

    Règles :
      - Un citoyen peut demander n'importe quel rôle (soumis à vérification)
      - Les rôles supérieurs nécessitent des vérifications d'identité
      - La demande est enregistrée pour approbation admin
    """
    # Vérifier que le rôle existe
    roles_valides = [r.value for r in RolesUtilisateur]
    if role_demande not in roles_valides:
        raise ErreurValidation(
            f"Rôle invalide : {role_demande}",
            message_utilisateur=f"Le rôle '{role_demande}' n'existe pas.",
        )

    # Vérifier que ce n'est pas le même rôle
    if role_demande == utilisateur.role:
        raise ErreurValidation(
            "Même rôle demandé",
            message_utilisateur=f"Tu es déjà {utilisateur.role}. Impossible de demander le même rôle.",
        )

    # Vérifier les prérequis pour les rôles institutionnels
    if role_demande in ("agent", "medecin", "police", "ong"):
        if not utilisateur.est_visage_verifie:
            raise ErreurValidation(
                "Visage non vérifié",
                message_utilisateur="Tu dois d'abord vérifier ton visage (reconnaissance faciale) avant de demander ce rôle.",
            )
        if not utilisateur.est_cni_verifiee:
            raise ErreurValidation(
                "CNI non vérifiée",
                message_utilisateur="Tu dois d'abord scanner ta CNI avant de demander ce rôle.",
            )

    # Vérifier les prérequis pour les rôles admin
    if role_demande in ("administrateur", "super_administrateur"):
        if not utilisateur.deux_fa_active:
            raise ErreurValidation(
                "2FA requise",
                message_utilisateur="La double authentification (2FA) est obligatoire pour les rôles administrateur.",
            )

    # Enregistrer la demande dans le journal d'audit
    entree_audit = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement=TypesEvenementAudit.MODIFICATION_PROFIL.value,
        description=f"Demande de changement de rôle : {utilisateur.role} → {role_demande}",
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "type": "demande_role",
            "role_actuel": utilisateur.role,
            "role_demande": role_demande,
            "verifications": {
                "email": utilisateur.est_email_verifie,
                "visage": utilisateur.est_visage_verifie,
                "cni": utilisateur.est_cni_verifiee,
                "2fa": utilisateur.deux_fa_active,
            },
        },
    )
    session.add(entree_audit)
    await session.commit()

    journal.info(
        f"Demande de rôle : utilisateur={utilisateur.id} "
        f"de={utilisateur.role} vers={role_demande}"
    )

    return DemandeRoleReponse(
        message=f"Demande de passage au rôle '{role_demande}' envoyée. Un administrateur va la traiter.",
        role_actuel=utilisateur.role,
        role_demande=role_demande,
        statut="en_attente",
        date_demande=datetime.now(timezone.utc),
    )


async def approuver_changement_role(
    session: AsyncSession,
    administrateur: Utilisateur,
    utilisateur_id: UUID,
    nouveau_role: str,
    raison: Optional[str] = None,
) -> dict:
    """
    Approuve un changement de rôle (réservé aux administrateurs).
    """
    # Vérifier que l'acteur est admin ou super admin
    if administrateur.role not in ("administrateur", "super_administrateur"):
        raise ErreurAutorisation(
            "Permission refusée",
            message_utilisateur="Seuls les administrateurs peuvent approuver des changements de rôle.",
        )

    # Récupérer l'utilisateur cible
    resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.id == utilisateur_id)
    )
    utilisateur_cible = resultat.scalar_one_or_none()

    if utilisateur_cible is None:
        raise ErreurValidation(
            "Utilisateur introuvable",
            message_utilisateur="Cet utilisateur n'existe pas.",
        )

    # Vérifier que le rôle cible existe
    roles_valides = [r.value for r in RolesUtilisateur]
    if nouveau_role not in roles_valides:
        raise ErreurValidation(f"Rôle invalide : {nouveau_role}")

    ancien_role = utilisateur_cible.role
    utilisateur_cible.role = nouveau_role

    # Audit
    entree_audit = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=utilisateur_cible.id,
        role_acteur=administrateur.role,
        type_evenement=TypesEvenementAudit.MODIFICATION_PROFIL.value,
        description=f"Changement de rôle approuvé : {ancien_role} → {nouveau_role}",
        donnees_supplementaires={
            "type": "approbation_role",
            "approuve_par": str(administrateur.id),
            "ancien_role": ancien_role,
            "nouveau_role": nouveau_role,
            "raison": raison,
        },
    )
    session.add(entree_audit)
    await session.commit()

    journal.info(
        f"Rôle changé : utilisateur={utilisateur_cible.id} "
        f"{ancien_role} → {nouveau_role} par admin={administrateur.id}"
    )

    return {
        "message": f"Rôle de l'utilisateur mis à jour : {ancien_role} → {nouveau_role}",
        "utilisateur_id": str(utilisateur_cible.id),
        "ancien_role": ancien_role,
        "nouveau_role": nouveau_role,
        "approuve_par": str(administrateur.id),
    }
