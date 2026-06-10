# -*- coding: utf-8 -*-
"""
Service Consentements — logique métier de gestion des autorisations.

Règles :
  - Un consentement obligatoire ne peut jamais être retiré
  - Quand un consentement est retiré, l'enregistrement reste en base
    (preuve historique), seule la date_retrait est mise à jour
  - Un consentement retiré peut être ré-accordé : on crée alors un
    nouvel enregistrement pour garder la trace exacte
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.constantes import TypesEvenementAudit
from src.modeles import Consentement, Utilisateur, JournalAudit
from src.modules.consentements.categories import (
    CATALOGUE, lister_categories_obligatoires, obtenir_definition,
)
from src.modules.consentements.schemas import (
    ConsentementDetail, ConsentementTexteLegalDetail, ListeConsentements,
)
from src.modules.gamification import service_badges, service_tracking
from src.noyau import journal
from src.noyau.exceptions import (
    ErreurAutorisation, ErreurRessourceIntrouvable, ErreurValidation,
)
from src.noyau.journal import journal_audit


def _construire_detail(
    categorie: str,
    consentement_db: Optional[Consentement],
    inclure_texte: bool = False,
):
    """Combine la définition statique et l'état dynamique en un seul objet."""
    definition = obtenir_definition(categorie)

    if consentement_db is None:
        est_accorde = False
        date_accord = None
        date_retrait = None
    else:
        est_accorde = (
            consentement_db.est_accorde
            and consentement_db.date_retrait is None
        )
        date_accord = consentement_db.date_accord
        date_retrait = consentement_db.date_retrait

    donnees = dict(
        categorie=definition.categorie,
        titre=definition.titre,
        description=definition.description,
        obligatoire=definition.obligatoire,
        version=definition.version,
        est_accorde=est_accorde,
        date_accord=date_accord,
        date_retrait=date_retrait,
    )

    if inclure_texte:
        donnees["texte_legal"] = definition.texte_legal
        return ConsentementTexteLegalDetail(**donnees)
    return ConsentementDetail(**donnees)


async def lister_pour_utilisateur(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> ListeConsentements:
    """Retourne tous les consentements (état dynamique + définition)."""
    # Récupérer les derniers enregistrements pour chaque catégorie
    resultat = await session.execute(
        select(Consentement)
        .where(Consentement.utilisateur_id == utilisateur.id)
        .order_by(Consentement.cree_le.desc())
    )
    enregistrements = resultat.scalars().all()

    # Indexer par catégorie : on garde le plus récent (le premier ordre desc)
    par_categorie: dict[str, Consentement] = {}
    for e in enregistrements:
        if e.categorie not in par_categorie:
            par_categorie[e.categorie] = e

    consentements = [
        _construire_detail(cat, par_categorie.get(cat))
        for cat in CATALOGUE.keys()
    ]
    accordes = sum(1 for c in consentements if c.est_accorde)
    return ListeConsentements(
        consentements=consentements,
        total=len(consentements),
        accordes=accordes,
    )


async def obtenir_avec_texte(
    session: AsyncSession,
    utilisateur: Utilisateur,
    categorie: str,
) -> ConsentementTexteLegalDetail:
    """Retourne un consentement avec son texte légal complet."""
    if categorie not in CATALOGUE:
        raise ErreurRessourceIntrouvable(
            f"Catégorie inconnue : {categorie}",
            message_utilisateur="Cette catégorie de consentement n'existe pas.",
        )

    resultat = await session.execute(
        select(Consentement)
        .where(
            Consentement.utilisateur_id == utilisateur.id,
            Consentement.categorie == categorie,
        )
        .order_by(Consentement.cree_le.desc())
        .limit(1)
    )
    consentement_db = resultat.scalar_one_or_none()
    return _construire_detail(categorie, consentement_db, inclure_texte=True)


async def basculer_consentement(
    session: AsyncSession,
    utilisateur: Utilisateur,
    categorie: str,
    accorder: bool,
    adresse_ip: Optional[str] = None,
) -> ConsentementDetail:
    """Accorde ou retire un consentement."""
    if categorie not in CATALOGUE:
        raise ErreurRessourceIntrouvable(
            f"Catégorie inconnue : {categorie}",
            message_utilisateur="Cette catégorie de consentement n'existe pas.",
        )

    definition = obtenir_definition(categorie)

    # Un obligatoire ne peut pas être retiré
    if definition.obligatoire and not accorder:
        raise ErreurValidation(
            f"Tentative de retrait d'un consentement obligatoire : {categorie}",
            message_utilisateur=(
                f"Le consentement « {definition.titre} » est obligatoire pour utiliser "
                "DigiID et ne peut pas être retiré. Pour ne plus utiliser le service, "
                "tu peux supprimer ton compte depuis tes paramètres."
            ),
        )

    # Récupérer le dernier enregistrement de cette catégorie
    resultat = await session.execute(
        select(Consentement)
        .where(
            Consentement.utilisateur_id == utilisateur.id,
            Consentement.categorie == categorie,
        )
        .order_by(Consentement.cree_le.desc())
        .limit(1)
    )
    dernier = resultat.scalar_one_or_none()

    maintenant = datetime.now(timezone.utc)

    if accorder:
        # Si déjà accordé et non retiré : pas d'action
        if dernier and dernier.est_accorde and dernier.date_retrait is None:
            return _construire_detail(categorie, dernier)

        # Sinon créer un nouvel enregistrement d'accord
        nouveau = Consentement(
            utilisateur_id=utilisateur.id,
            categorie=categorie,
            version_texte=definition.version,
            texte_accepte=definition.texte_legal,
            est_accorde=True,
            date_accord=maintenant,
            adresse_ip_accord=adresse_ip,
        )
        session.add(nouveau)
        await session.flush()
        journal.info(f"Consentement accordé : utilisateur={utilisateur.id} categorie={categorie}")
        message_audit = f"Consentement accordé : {categorie} (v{definition.version})"
        consentement_final = nouveau
    else:
        # Retrait : marquer le dernier comme retiré
        if dernier is None or not dernier.est_accorde or dernier.date_retrait is not None:
            # Rien à retirer — pas d'erreur, on retourne l'état courant
            return _construire_detail(categorie, dernier)

        dernier.date_retrait = maintenant
        journal.info(f"Consentement retiré : utilisateur={utilisateur.id} categorie={categorie}")
        message_audit = f"Consentement retiré : {categorie}"
        consentement_final = dernier

    # Audit
    entree = JournalAudit(
        date_evenement=maintenant,
        utilisateur_id=utilisateur.id,
        role_acteur=utilisateur.role,
        type_evenement="modification_consentement",
        description=message_audit,
        adresse_ip=adresse_ip,
        donnees_supplementaires={"categorie": categorie, "accorder": accorder},
    )
    session.add(entree)
    journal_audit(message_audit + f" | utilisateur={utilisateur.id}")

    await service_tracking.tracker_action(session, utilisateur, "consentement")
    await service_badges.verifier_et_debloquer_badges(session, utilisateur)
    await session.commit()
    return _construire_detail(categorie, consentement_final)


async def initialiser_consentements_obligatoires(
    session: AsyncSession,
    utilisateur: Utilisateur,
    adresse_ip: Optional[str] = None,
) -> None:
    """
    À appeler après l'inscription : crée les enregistrements
    pour les consentements obligatoires acceptés implicitement (CGU, etc.).
    Doit être commit par l'appelant.
    """
    maintenant = datetime.now(timezone.utc)
    for cat in lister_categories_obligatoires():
        definition = obtenir_definition(cat)
        consentement = Consentement(
            utilisateur_id=utilisateur.id,
            categorie=cat,
            version_texte=definition.version,
            texte_accepte=definition.texte_legal,
            est_accorde=True,
            date_accord=maintenant,
            adresse_ip_accord=adresse_ip,
        )
        session.add(consentement)
    journal.info(f"Consentements obligatoires initialisés pour utilisateur={utilisateur.id}")
