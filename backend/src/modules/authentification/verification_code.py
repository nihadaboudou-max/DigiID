# -*- coding: utf-8 -*-
"""
Service de vérification par code — email, SMS ou appel vocal.

Fonctions :
  - generer_et_envoyer_code   : génère un code, le stocke, et l'envoie
  - verifier_code             : vérifie le code saisi par l'utilisateur
  - renvoyer_code             : invalide l'ancien code et en génère/envoye un nouveau

NOUVEAU FLUX D'INSCRIPTION :
  1. L'utilisateur remplit le formulaire d'inscription
  2. On crée l'utilisateur en base avec est_actif=False, est_email_verifie=False
  3. On lui envoie un code de vérification
  4. Tant qu'il n'a pas vérifié son email, il peut se reconnecter (email+mdp)
     MAIS sera redirigé vers la page de vérification (ne peut pas accéder au tableau de bord)
  5. Une fois le code vérifié → est_actif=True, est_email_verifie=True
  6. S'il ferme la page sans vérifier, il peut revenir et se connecter
     pour finaliser la vérification
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur, CodeVerification
from src.noyau.exceptions import ErreurValidation
from src.noyau.notification import (
    generer_code_verification,
    envoyer_email_verification,
    envoyer_sms_verification,
    passer_appel_verification,
)
from src.noyau import journal, dechiffrer_donnee

# Durée de validité d'un code (10 minutes)
DUREE_VALIDITE_CODE_MINUTES = 10

# Nombre maximum de tentatives avant invalidation
MAX_TENTATIVES = 5

# Types de canaux supportés
CANAL_EMAIL = "email"
CANAL_SMS = "sms"
CANAL_APPEL = "appel"

# Durée minimale avant renvoi (30 secondes)
DELAI_RENVOI_SECONDES = 30


async def generer_et_envoyer_code(
    session: AsyncSession,
    utilisateur: Utilisateur,
    email: str,
    telephone: Optional[str] = None,
    canal: str = CANAL_EMAIL,
    type_verification: str = "inscription",
) -> dict:
    """
    Génère un code de vérification, le sauvegarde en base et l'envoie
    à l'utilisateur via le canal choisi.

    Args:
        session: Session SQLAlchemy
        utilisateur: L'utilisateur à vérifier
        email: Adresse email en clair
        telephone: Numéro de téléphone (pour SMS/appel)
        canal: "email", "sms" ou "appel"
        type_verification: "inscription", "connexion", "changement_email", "changement_telephone"

    Returns:
        dict avec les infos de l'envoi (destination masquée)

    Lève:
        ErreurValidation si le canal n'est pas supporté
    """
    if canal not in (CANAL_EMAIL, CANAL_SMS, CANAL_APPEL):
        raise ErreurValidation(
            f"Canal de vérification non supporté : {canal}",
            message_utilisateur="Le canal de vérification choisi n'est pas valide.",
        )

    # 1. Définir la destination selon le canal
    if canal == CANAL_EMAIL:
        destination = email
    elif canal in (CANAL_SMS, CANAL_APPEL):
        if not telephone:
            raise ErreurValidation(
                "Téléphone requis pour SMS/appel",
                message_utilisateur="Aucun numéro de téléphone associé à ce compte.",
            )
        destination = telephone
    else:
        raise ErreurValidation(f"Canal inconnu : {canal}")

    # 2. Invalider tout code existant non utilisé (un seul code actif à la fois)
    resultat_anciens = await session.execute(
        select(CodeVerification).where(
            CodeVerification.utilisateur_id == utilisateur.id,
            CodeVerification.canal == canal,
            CodeVerification.est_utilise == False,
            CodeVerification.type_verification == type_verification,
            CodeVerification.date_expiration > datetime.now(timezone.utc),
        )
    )
    for ancien_code in resultat_anciens.scalars().all():
        ancien_code.est_utilise = True

    # 3. Générer le code
    code = generer_code_verification(6)

    # 4. Sauvegarder en base
    nouveau_code = CodeVerification(
        utilisateur_id=utilisateur.id,
        canal=canal,
        code=code,
        destination=destination,
        tentative=0,
        est_utilise=False,
        date_expiration=datetime.now(timezone.utc) + timedelta(minutes=DUREE_VALIDITE_CODE_MINUTES),
        type_verification=type_verification,
    )
    session.add(nouveau_code)
    await session.flush()

    # 5. Envoyer via le canal choisi
    succes = False
    if canal == CANAL_EMAIL:
        # Déchiffrer le prénom pour un email plus personnalisé
        prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else None
        succes = envoyer_email_verification(destination, code, prenom)
    elif canal == CANAL_SMS:
        succes = envoyer_sms_verification(destination, code)
    elif canal == CANAL_APPEL:
        succes = passer_appel_verification(destination, code)

    if not succes:
        journal.warning(
            f"Échec d'envoi du code de vérification : "
            f"utilisateur={utilisateur.id} canal={canal}"
        )
    else:
        journal.info(
            f"Code de vérification envoyé : utilisateur={utilisateur.id} "
            f"canal={canal} destination_masquee={_masquer_destination(destination)}"
        )

    await session.commit()

    return {
        "canal": canal,
        "destination_masquee": _masquer_destination(destination),
        "duree_validite_minutes": DUREE_VALIDITE_CODE_MINUTES,
        "code_id": str(nouveau_code.id),
    }


async def verifier_code(
    session: AsyncSession,
    utilisateur_id: UUID,
    code_saisi: str,
    canal: str = CANAL_EMAIL,
    type_verification: str = "inscription",
    activer_compte: bool = True,
) -> dict:
    """
    Vérifie un code de vérification saisi par l'utilisateur.

    Args:
        session: Session SQLAlchemy
        utilisateur_id: ID de l'utilisateur
        code_saisi: Le code à 6 chiffres saisi
        canal: Le canal utilisé ("email", "sms", "appel")
        type_verification: "inscription", "connexion", etc.
        activer_compte: Si True, active le compte et marque email vérifié

    Returns:
        dict avec les infos : {"succes": True, "est_email_verifie": True/False, ...}

    Lève:
        ErreurValidation si le code est invalide, expiré, ou trop de tentatives
    """
    # Chercher le code non utilisé le plus récent pour cet utilisateur/canal
    resultat = await session.execute(
        select(CodeVerification)
        .where(
            CodeVerification.utilisateur_id == utilisateur_id,
            CodeVerification.canal == canal,
            CodeVerification.est_utilise == False,
            CodeVerification.type_verification == type_verification,
            CodeVerification.date_expiration > datetime.now(timezone.utc),
        )
        .order_by(CodeVerification.cree_le.desc())
        .limit(1)
    )
    code_verification = resultat.scalar_one_or_none()

    if code_verification is None:
        raise ErreurValidation(
            "Aucun code de vérification actif",
            message_utilisateur="Aucun code en attente. Demande un nouveau code.",
        )

    # Vérifier le nombre de tentatives
    if code_verification.tentative >= MAX_TENTATIVES:
        code_verification.est_utilise = True  # Invalider après trop de tentatives
        await session.commit()
        raise ErreurValidation(
            "Trop de tentatives échouées",
            message_utilisateur="Trop de tentatives. Demande un nouveau code.",
        )

    # Incrémenter les tentatives
    code_verification.tentative += 1

    # Vérifier le code
    if code_verification.code != code_saisi.strip():
        await session.commit()
        tentatives_restantes = MAX_TENTATIVES - code_verification.tentative
        raise ErreurValidation(
            "Code incorrect",
            message_utilisateur=f"Code incorrect. Il te reste {tentatives_restantes} tentative(s).",
        )

    # ✅ Code valide — marquer comme utilisé
    code_verification.est_utilise = True

    # Marquer l'email comme vérifié et activer le compte
    utilisateur_resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.id == utilisateur_id)
    )
    utilisateur = utilisateur_resultat.scalar_one_or_none()

    resultat_verification = {
        "succes": True,
        "est_email_verifie": False,
        "est_actif": False,
    }

    if utilisateur:
        if canal == CANAL_EMAIL:
            if not utilisateur.est_email_verifie:
                utilisateur.est_email_verifie = True
                resultat_verification["est_email_verifie"] = True
                journal.info(f"Email vérifié avec succès : utilisateur={utilisateur.id}")

            # Activer le compte si c'était une inscription
            if activer_compte and type_verification == "inscription" and not utilisateur.est_actif:
                utilisateur.est_actif = True
                resultat_verification["est_actif"] = True
                journal.info(f"Compte activé après vérification email : utilisateur={utilisateur.id}")

    await session.commit()
    return resultat_verification


async def renvoyer_code(
    session: AsyncSession,
    utilisateur: Utilisateur,
    email: str,
    telephone: Optional[str] = None,
    canal: str = CANAL_EMAIL,
    type_verification: str = "inscription",
) -> dict:
    """
    Invalide les codes existants et en génère un nouveau.

    Vérifie aussi qu'on n'a pas renvoyé de code trop récemment
    (protection anti-spam, délai minimum de 30 secondes).
    """
    # Vérifier le délai depuis le dernier code
    resultat = await session.execute(
        select(CodeVerification)
        .where(
            CodeVerification.utilisateur_id == utilisateur.id,
            CodeVerification.canal == canal,
            CodeVerification.est_utilise == False,
            CodeVerification.type_verification == type_verification,
        )
        .order_by(CodeVerification.cree_le.desc())
        .limit(1)
    )
    dernier_code = resultat.scalar_one_or_none()

    if dernier_code:
        temps_depuis_dernier = (datetime.now(timezone.utc) - dernier_code.cree_le).total_seconds()
        if temps_depuis_dernier < DELAI_RENVOI_SECONDES:
            reste = int(DELAI_RENVOI_SECONDES - temps_depuis_dernier)
            raise ErreurValidation(
                "Renvoi trop rapide",
                message_utilisateur=f"Patientez encore {reste} seconde(s) avant de renvoyer un code.",
            )

        # Invalider l'ancien code
        dernier_code.est_utilise = True

    # Générer et envoyer un nouveau code
    return await generer_et_envoyer_code(
        session=session,
        utilisateur=utilisateur,
        email=email,
        telephone=telephone,
        canal=canal,
        type_verification=type_verification,
    )


async def obtenir_statut_verification(
    session: AsyncSession,
    utilisateur_id: UUID,
) -> dict:
    """
    Retourne le statut actuel de vérification de l'utilisateur.
    Utile après connexion pour savoir si l'utilisateur doit encore vérifier.
    """
    resultat = await session.execute(
        select(Utilisateur).where(Utilisateur.id == utilisateur_id)
    )
    utilisateur = resultat.scalar_one_or_none()

    if not utilisateur:
        return {
            "existe": False,
            "est_email_verifie": False,
            "est_actif": False,
        }

    return {
        "existe": True,
        "est_email_verifie": utilisateur.est_email_verifie,
        "est_actif": utilisateur.est_actif,
    }


def _masquer_destination(destination: str) -> str:
    """Masque partiellement une destination pour l'afficher à l'utilisateur.
    Ex : "a***@example.com" ou "+221*****67"
    """
    if "@" in destination:
        local, domaine = destination.split("@", 1)
        if len(local) <= 2:
            masque = local[0] + "***"
        else:
            masque = local[0] + "***" + local[-1]
        return f"{masque}@{domaine}"
    else:
        if len(destination) >= 4:
            return destination[:4] + "****" + destination[-2:]
        return destination
