# -*- coding: utf-8 -*-
"""
Service de verification — envoi et validation de codes pour
confirmer l'email et le telephone d'un utilisateur.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.constantes import TypesEvenementAudit
from src.modeles import Utilisateur, JournalAudit
from src.modeles.code_verification import CodeVerification
from src.noyau import dechiffrer_donnee, journal
from src.noyau.notification import (
    generer_code_verification,
    envoyer_email_verification,
    envoyer_email_changement,
    envoyer_sms_verification,
    passer_appel_verification,
)
from src.noyau.exceptions import ErreurValidation


DUREE_EXPIRATION_MINUTES = 10
MAX_TENTATIVES = 5


async def envoyer_code_email(
    session: AsyncSession,
    utilisateur: Utilisateur,
    nouveau_email: Optional[str] = None,
) -> str:
    """
    Genere et envoie un code de verification par email.

    Si `nouveau_email` est fourni, on verifie ce nouvel email
    (changement d'email). Sinon, on verifie l'email actuel.
    """
    email = nouveau_email or dechiffrer_donnee(utilisateur.email_chiffre)
    code = generer_code_verification()

    code_verif = CodeVerification(
        utilisateur_id=utilisateur.id,
        canal=CodeVerification.CANAL_EMAIL,
        code=code,
        destination=email,
        date_expiration=datetime.now(timezone.utc) + timedelta(minutes=DUREE_EXPIRATION_MINUTES),
        type_verification="changement_email" if nouveau_email else "inscription",
    )
    session.add(code_verif)
    await session.commit()

    prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else None

    if nouveau_email:
        envoyer_email_changement(email, code)
    else:
        envoyer_email_verification(email, code, prenom)

    journal.info(
        f"[CODE DEV] {code} — code de verification envoye par email a {email} "
        f"(user={utilisateur.id})"
    )
    return code


async def envoyer_code_telephone(
    session: AsyncSession,
    utilisateur: Utilisateur,
    canal: str = "sms",
) -> str:
    """
    Genere et envoie un code de verification par SMS ou appel.
    """
    telephone = dechiffrer_donnee(utilisateur.telephone_chiffre)
    if not telephone:
        raise ErreurValidation("Aucun numero de telephone enregistre.")

    code = generer_code_verification()

    code_verif = CodeVerification(
        utilisateur_id=utilisateur.id,
        canal=canal,
        code=code,
        destination=telephone,
        date_expiration=datetime.now(timezone.utc) + timedelta(minutes=DUREE_EXPIRATION_MINUTES),
        type_verification="inscription",
    )
    session.add(code_verif)
    await session.commit()

    if canal == "sms":
        envoyer_sms_verification(telephone, code)
    elif canal == "appel":
        passer_appel_verification(telephone, code)

    journal.info(
        f"[CODE DEV] {code} — code de verification envoye par {canal} au {telephone[:4]}... "
        f"(user={utilisateur.id})"
    )
    return code


async def verifier_code(
    session: AsyncSession,
    utilisateur_id: UUID,
    code: str,
    type_verification: str = "inscription",
) -> bool:
    """
    Verifie un code de validation.

    - Verifie que le code existe, n'a pas expire, n'est pas deja utilise
    - Limite a 5 tentatives
    - Si OK : marque le code comme utilise
    """
    maintenant = datetime.now(timezone.utc)

    resultat = await session.execute(
        select(CodeVerification).where(
            CodeVerification.utilisateur_id == utilisateur_id,
            CodeVerification.code == code,
            CodeVerification.est_utilise == False,
            CodeVerification.date_expiration > maintenant,
            CodeVerification.type_verification == type_verification,
        ).order_by(CodeVerification.cree_le.desc())
    )
    code_verif = resultat.scalar_one_or_none()

    if code_verif is None:
        # Peut-etre le code a expire ou n'existe pas
        journal.warning(f"Code invalide pour user={utilisateur_id}")
        return False

    # Verifier le nombre de tentatives
    if code_verif.tentative >= MAX_TENTATIVES:
        journal.warning(f"Trop de tentatives pour code_verif={code_verif.id}")
        return False

    code_verif.tentative += 1
    await session.flush()

    if code_verif.code != code:
        await session.commit()
        return False

    # Succes
    code_verif.est_utilise = True

    # Marquer l'email ou telephone comme verifie selon le type
    if type_verification == "inscription":
        if code_verif.canal == CodeVerification.CANAL_EMAIL:
            utilisateur = await session.get(Utilisateur, utilisateur_id)
            if utilisateur:
                utilisateur.est_email_verifie = True
        # Pour le telephone, on pourrait ajouter un champ est_telephone_verifie

    await _enregistrer_audit(
        session,
        utilisateur_id=utilisateur_id,
        type_evenement="verification_reussie",
        description=f"Code verifie via {code_verif.canal} pour {type_verification}",
    )
    await session.commit()

    journal.info(f"Code verifie avec succes pour user={utilisateur_id}")
    return True


async def _enregistrer_audit(
    session: AsyncSession,
    type_evenement: str,
    description: str,
    utilisateur_id: Optional[UUID] = None,
) -> None:
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=utilisateur_id,
        type_evenement=type_evenement,
        description=description,
    )
    session.add(entree)
