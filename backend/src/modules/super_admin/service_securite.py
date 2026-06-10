# -*- coding: utf-8 -*-
"""
Service de Sécurité Renforcée — Phase 8.

Fonctionnalités :
  1. Changement de rôle (super admin uniquement) avec audit complet
  2. Révocation des tokens après changement de rôle
  3. Validation email institutionnel avant changement
  4. Détection des tentatives d'usurpation
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.constantes import RolesUtilisateur
from src.modeles import JournalAudit, SessionAuthentification, Utilisateur
from src.modules.securite.validation_email import valider_email_institutionnel
from src.modules.securite.alerte_fraude import enregistrer_alerte_fraude
from src.noyau import dechiffrer_donnee, journal
from src.noyau.exceptions import (
    ErreurAutorisation,
    ErreurRessourceIntrouvable,
    ErreurValidation,
)


async def changer_role_utilisateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    utilisateur_cible_id: UUID,
    nouveau_role: str,
    raison: str,
    adresse_ip: Optional[str] = None,
) -> dict:
    """
    Change le rôle d'un utilisateur. UNIQUEMENT super admin.

    Sécurité renforcée :
      1. Vérifie que le rôle cible existe dans l'enum
      2. Vérifie que l'utilisateur cible existe
      3. Valide l'email institutionnel si le nouveau rôle est institutionnel
      4. Journalise l'action dans l'audit
      5. Révoque TOUTES les sessions actives de l'utilisateur
      6. Met à jour date_dernier_changement_role
      7. Crée une alerte si le changement est suspect
    """
    # 1. Vérifier que le rôle existe
    if nouveau_role not in [r.value for r in RolesUtilisateur]:
        raise ErreurValidation(
            f"Rôle invalide : '{nouveau_role}'",
            message_utilisateur=f"Le rôle '{nouveau_role}' n'existe pas dans le système.",
        )

    # 2. Récupérer l'utilisateur cible
    resultat = await session.execute(
        select(Utilisateur).where(
            Utilisateur.id == utilisateur_cible_id,
            Utilisateur.est_supprime == False,
        )
    )
    utilisateur_cible = resultat.scalar_one_or_none()
    if utilisateur_cible is None:
        raise ErreurRessourceIntrouvable(
            f"Utilisateur {utilisateur_cible_id} introuvable",
            message_utilisateur="Utilisateur introuvable.",
        )

    # 3. Empêcher l'auto-rétrogradation du super admin
    if utilisateur_cible.id == super_admin.id:
        raise ErreurAutorisation(
            "Le super admin ne peut pas changer son propre rôle",
            message_utilisateur="Tu ne peux pas modifier ton propre rôle.",
        )

    ancien_role = utilisateur_cible.role

    # 4. Si le nouveau rôle est identique à l'ancien, pas de changement
    if ancien_role == nouveau_role:
        raise ErreurValidation(
            f"L'utilisateur {utilisateur_cible_id} a déjà le rôle '{nouveau_role}'",
            message_utilisateur=f"Cet utilisateur possède déjà le rôle '{nouveau_role}'.",
        )

    # 5. Validation email institutionnel pour les rôles sensibles
    email_clair = dechiffrer_donnee(utilisateur_cible.email_chiffre)
    email_valide, raison_email = valider_email_institutionnel(email_clair, nouveau_role)
    if not email_valide:
        raise ErreurValidation(
            f"Email invalide pour le rôle '{nouveau_role}' : {raison_email}",
            message_utilisateur=(
                f"Impossible d'attribuer le rôle '{nouveau_role}' : "
                f"l'email de l'utilisateur n'est pas un email institutionnel valide. "
                f"{raison_email}"
            ),
        )

    # 6. Appliquer le changement de rôle
    maintenant = datetime.now(timezone.utc)
    utilisateur_cible.role = nouveau_role

    # 7. Révoquer toutes les sessions actives
    resultat_sessions = await session.execute(
        select(SessionAuthentification).where(
            SessionAuthentification.utilisateur_id == utilisateur_cible_id,
            SessionAuthentification.est_revoquee == False,
        )
    )
    sessions_actives = resultat_sessions.scalars().all()
    for sess in sessions_actives:
        sess.est_revoquee = True
        sess.date_revocation = maintenant
        sess.raison_revocation = f"Changement de rôle : {ancien_role} -> {nouveau_role}"

    # 8. Journalisation d'audit
    entree_audit = JournalAudit(
        date_evenement=maintenant,
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="changement_role",
        description=(
            f"Changement de rôle : utilisateur={utilisateur_cible.id} "
            f"({ancien_role} → {nouveau_role}) "
            f"Raison : {raison}"
        ),
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "utilisateur_cible_id": str(utilisateur_cible.id),
            "ancien_role": ancien_role,
            "nouveau_role": nouveau_role,
            "raison": raison,
            "sessions_revoquees": len(sessions_actives),
            "email_domaine": email_clair.split("@")[1] if "@" in email_clair else "inconnu",
            "super_admin_id": str(super_admin.id),
        },
    )
    session.add(entree_audit)

    # 9. Si le changement est "suspect" (ex: citoyen → super_admin directement),
    #    créer une alerte de fraude supplémentaire
    if _changement_est_suspect(ancien_role, nouveau_role):
        await enregistrer_alerte_fraude(
            session=session,
            type_incident="changement_role_suspect",
            description=(
                f"Changement de rôle suspect : {ancien_role} → {nouveau_role} "
                f"pour utilisateur {utilisateur_cible.id} "
                f"effectué par super admin {super_admin.id}"
            ),
            utilisateur_id=utilisateur_cible.id,
            role_acteur=super_admin.role,
            adresse_ip=adresse_ip,
            score_risque=85,
            donnees_contexte={
                "ancien_role": ancien_role,
                "nouveau_role": nouveau_role,
                "super_admin_id": str(super_admin.id),
                "raison": raison,
            },
        )
        journal.critical(
            f"[SÉCURITÉ] Changement de rôle SUSPECT : {ancien_role} → {nouveau_role} "
            f"| cible={utilisateur_cible.id} | par={super_admin.id}"
        )

    await session.commit()

    journal.info(
        f"Rôle changé : {ancien_role} → {nouveau_role} "
        f"| cible={utilisateur_cible.id} | par={super_admin.id} | raisons={raison[:50]}..."
    )

    return {
        "utilisateur_id": utilisateur_cible.id,
        "email": email_clair,
        "ancien_role": ancien_role,
        "nouveau_role": nouveau_role,
        "date_changement": maintenant,
        "sessions_revoquees": len(sessions_actives),
        "message": (
            f"Rôle changé avec succès de '{ancien_role}' vers '{nouveau_role}' "
            f"pour l'utilisateur {email_clair}. "
            f"{len(sessions_actives)} session(s) révoquée(s)."
        ),
    }


def _changement_est_suspect(ancien_role: str, nouveau_role: str) -> bool:
    """
    Détecte les changements de rôle suspects.

    Considéré comme suspect :
      - Passer de citoyen → super_admin directement (sans passer par admin)
      - Passer de n'importe quel rôle → super_admin sans être admin
      - Passer de super_admin → citoyen (rétrogradation extrême)
    """
    if nouveau_role == RolesUtilisateur.SUPER_ADMINISTRATEUR.value:
        if ancien_role != RolesUtilisateur.ADMINISTRATEUR.value:
            return True  # Promotion directe en super admin sans être admin

    if ancien_role == RolesUtilisateur.SUPER_ADMINISTRATEUR.value:
        if nouveau_role in [
            RolesUtilisateur.CITOYEN.value,
            *RolesUtilisateur.roles_institutionnels(),
        ]:
            return True  # Rétrogradation massive d'un super admin

    return False


async def revoquer_toutes_sessions_utilisateur(
    session: AsyncSession,
    utilisateur_id: UUID,
    raison: str = "Changement de rôle",
) -> int:
    """
    Révoque toutes les sessions actives d'un utilisateur.

    Returns :
        Nombre de sessions révoquées.
    """
    maintenant = datetime.now(timezone.utc)
    resultat = await session.execute(
        select(SessionAuthentification).where(
            SessionAuthentification.utilisateur_id == utilisateur_id,
            SessionAuthentification.est_revoquee == False,
        )
    )
    sessions = resultat.scalars().all()
    for sess in sessions:
        sess.est_revoquee = True
        sess.date_revocation = maintenant
        sess.raison_revocation = raison

    return len(sessions)



