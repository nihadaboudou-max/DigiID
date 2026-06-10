# -*- coding: utf-8 -*-
"""
Service Super Admin — gestion des administrateurs.
Seul le super administrateur peut créer, lister, suspendre ou réactiver des admins.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.constantes import RolesUtilisateur, TypesEvenementAudit
from src.modeles import JournalAudit, Utilisateur
from src.modules.authentification import service as service_auth
from src.modules.super_admin.schemas import AdminApercu, CreerAdminRequete, ListeAdmins
from src.noyau import dechiffrer_donnee, journal
from src.noyau.exceptions import ErreurRessourceIntrouvable
from src.noyau.journal import journal_audit


def _utilisateur_vers_apercu(u: Utilisateur) -> AdminApercu:
    """Convertit un objet ORM en réponse API, en déchiffrant les champs."""
    return AdminApercu(
        id=u.id,
        email=dechiffrer_donnee(u.email_chiffre),
        prenom=dechiffrer_donnee(u.prenom_chiffre) if u.prenom_chiffre else None,
        nom=dechiffrer_donnee(u.nom_chiffre) if u.nom_chiffre else None,
        role=u.role,
        est_actif=u.est_actif,
        deux_fa_active=u.deux_fa_active,
        est_email_verifie=u.est_email_verifie,
        date_creation=u.cree_le,
        date_derniere_connexion=u.date_derniere_connexion,
    )


async def creer_administrateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    donnees: CreerAdminRequete,
    adresse_ip: Optional[str] = None,
) -> AdminApercu:
    """
    Crée un nouveau compte administrateur.

    Sécurité :
      - Réutilise le service d'inscription qui chiffre/hash tout proprement
      - Force le rôle « administrateur »
      - Marque l'email comme vérifié (puisque c'est le super admin qui l'ajoute)
      - Trace l'action dans le journal d'audit avec l'ID du super admin
    """
    # On délègue la création à la fonction d'inscription standard.
    # Avantage : tous les contrôles (email unique, hash mot de passe, etc.) sont réutilisés.
    nouveau = await service_auth.inscrire_utilisateur(
        session=session,
        email=donnees.email,
        mot_de_passe=donnees.mot_de_passe,
        prenom=donnees.prenom,
        nom=donnees.nom,
        ville=donnees.ville,
        role=RolesUtilisateur.ADMINISTRATEUR.value,
        adresse_ip=adresse_ip,
    )

    # On marque l'email comme vérifié car c'est le super admin qui a invité l'admin
    # (pas besoin du double opt-in habituel)
    nouveau.est_email_verifie = True

    # Audit explicite de la création d'admin (action sensible)
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="creation_admin",
        description=f"Super admin a créé un nouvel administrateur (id={nouveau.id})",
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "admin_cree_id": str(nouveau.id),
            "email_hash_prefix": nouveau.email_hash[:8],
        },
    )
    session.add(entree)
    journal_audit(f"creation_admin | par={super_admin.id} | cree={nouveau.id}")

    await session.commit()
    journal.info(f"Nouvel administrateur créé : id={nouveau.id} par super_admin={super_admin.id}")
    return _utilisateur_vers_apercu(nouveau)


async def lister_administrateurs(
    session: AsyncSession,
) -> ListeAdmins:
    """Liste tous les administrateurs (admin + super admin) non supprimés."""
    resultat = await session.execute(
        select(Utilisateur).where(
            or_(
                Utilisateur.role == RolesUtilisateur.ADMINISTRATEUR.value,
                Utilisateur.role == RolesUtilisateur.SUPER_ADMINISTRATEUR.value,
            ),
            Utilisateur.est_supprime == False,
        )
        .order_by(Utilisateur.cree_le.desc())
    )
    admins = resultat.scalars().all()
    return ListeAdmins(
        administrateurs=[_utilisateur_vers_apercu(a) for a in admins],
        total=len(admins),
    )


async def basculer_actif_admin(
    session: AsyncSession,
    super_admin: Utilisateur,
    admin_id: UUID,
    activer: bool,
    adresse_ip: Optional[str] = None,
) -> AdminApercu:
    """
    Active ou suspend un administrateur.
    On ne peut pas suspendre le super administrateur, ni se suspendre soi-même.
    """
    resultat = await session.execute(
        select(Utilisateur).where(
            Utilisateur.id == admin_id,
            Utilisateur.role == RolesUtilisateur.ADMINISTRATEUR.value,  # Pas un super admin
        )
    )
    admin = resultat.scalar_one_or_none()
    if admin is None:
        raise ErreurRessourceIntrouvable(
            f"Admin {admin_id} introuvable",
            message_utilisateur="Administrateur introuvable. Tu ne peux modifier que les comptes administrateur normaux.",
        )

    admin.est_actif = activer
    if not activer:
        # On verrouille aussi pour empêcher toute reconnexion via session existante
        admin.est_verrouille = True
        admin.date_verrouillage = datetime.now(timezone.utc)
    else:
        admin.est_verrouille = False
        admin.tentatives_connexion_echouees = 0

    # Audit
    type_evt = "reactivation_admin" if activer else "suspension_admin"
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement=type_evt,
        description=(
            f"Super admin a {'réactivé' if activer else 'suspendu'} "
            f"l'administrateur {admin.id}"
        ),
        adresse_ip=adresse_ip,
        donnees_supplementaires={"admin_cible_id": str(admin.id)},
    )
    session.add(entree)
    journal_audit(f"{type_evt} | par={super_admin.id} | cible={admin.id}")

    await session.commit()
    journal.info(f"Admin {'activé' if activer else 'suspendu'} : id={admin.id}")
    return _utilisateur_vers_apercu(admin)
