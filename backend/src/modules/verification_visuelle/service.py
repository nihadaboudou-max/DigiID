# -*- coding: utf-8 -*-
"""Service de vérification visuelle — upload, comparaison, statut."""
from datetime import datetime, timezone
from io import BytesIO
from typing import Any

from fastapi import UploadFile
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.parametres import parametres
from src.modeles import Utilisateur, VerificationVisuelle
from src.modules.verification_visuelle import (
    anti_spoofing,
    comparaison,
    detection_visage,
    embedding_facial,
    listes_recherchees,
)
from src.modules.verification_visuelle.schemas import (
    ListeVerificationVisuelle,
    SuppressionVerification,
    RestaurationVerification,
    VerificationVisuelleDetail,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurValidation


async def _lire_image(fichier: UploadFile) -> bytes:
    contenu = await fichier.read()
    if not contenu:
        raise ErreurValidation(
            "Fichier vide reçu pour la vérification visuelle.",
            message_utilisateur="Le fichier uploadé est vide. Merci de réessayer."
        )
    return contenu


async def _chercher_doublons(
    session: AsyncSession,
    embedding: list[float],
    utilisateur_id: Any,
) -> list[dict]:
    resultat = await session.execute(
        select(VerificationVisuelle)
        .where(VerificationVisuelle.utilisateur_id != utilisateur_id)
        .order_by(desc(VerificationVisuelle.cree_le))
    )
    enregistrements = resultat.scalars().all()
    historique = [
        (str(record.utilisateur_id), record.embedding or [])
        for record in enregistrements
        if record.embedding is not None
    ]
    return comparaison.comparer_embeddings(embedding, historique, seuil=parametres.seuil_similarite_visage)


async def traiter_upload_photo(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
    adresse_ip: str | None = None,
    user_agent: str | None = None,
) -> VerificationVisuelle:
    """Traite l'upload de photo et enregistre un résultat de vérification."""
    contenu = await _lire_image(fichier)

    visage_detecte, _ = detection_visage.detecter_visage(contenu)
    if not visage_detecte:
        raise ErreurValidation(
            "Aucun visage détecté dans la photo de vérification.",
            message_utilisateur=(
                "Impossible de détecter un visage sur la photo. "
                "Assure-toi de télécharger une photo nette de ton visage."
            ),
        )

    score_liveness, verdict = anti_spoofing.evaluer_anti_spoofing(contenu)
    embedding = embedding_facial.generer_embedding(contenu)
    doublons = await _chercher_doublons(session, embedding, utilisateur.id)

    statut = "en_attente"
    raison = "Photo reçue, vérification en cours."
    score_similarite = None
    if verdict != "vivant":
        statut = "rejete"
        raison = "Photo suspecte d'usurpation ou de faible qualité."
    elif doublons:
        statut = "rejete"
        raison = "Un visage similaire existe déjà dans la base DigiID."
        score_similarite = doublons[0]["similarite"]
    elif score_liveness < 0.3:
        statut = "rejete"
        raison = "La qualité du visage est insuffisante pour vérifier l'identité."

    resultat_listes = listes_recherchees.verifier_listes_officielles(None, None)
    if resultat_listes:
        raison = "Correspondance détectée avec une liste de personnes recherchées."
        statut = "rejete"

    verification = VerificationVisuelle(
        utilisateur_id=utilisateur.id,
        nom_fichier=fichier.filename or "photo_visage",
        type_mime=fichier.content_type or "application/octet-stream",
        taille_octets=len(contenu),
        statut=statut,
        raison=raison,
        score_liveness=score_liveness,
        score_similarite=score_similarite,
        embedding=embedding,
        doublons=doublons,
        details={
            "user_agent": user_agent,
            "adresse_ip": adresse_ip,
            "verdict_anti_spoofing": verdict,
        },
            )
    session.add(verification)
    await session.commit()
    await session.refresh(verification)

    # --- Mettre à jour le statut de l'utilisateur si approuvé ---
    if statut == "approuve":
        utilisateur.est_visage_verifie = True
        utilisateur.date_verification_visage = datetime.now(timezone.utc)
        utilisateur.date_derniere_mise_a_jour_verifications = datetime.now(timezone.utc)
        await session.commit()

    journal.info(
        f"Vérification visuelle enregistrée : utilisateur={utilisateur.id} statut={statut}"
    )
    return verification


async def obtenir_statut_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> VerificationVisuelleDetail:
    resultat = await session.execute(
        select(VerificationVisuelle)
        .where(VerificationVisuelle.utilisateur_id == utilisateur.id)
        .order_by(desc(VerificationVisuelle.cree_le))
        .limit(1)
    )
    verification = resultat.scalar_one_or_none()
    if verification is None:
        raise ErreurValidation(
            "Aucun upload de vérification visuelle trouvé.",
            message_utilisateur="Tu n'as pas encore uploadé de photo pour vérification."
        )

    return VerificationVisuelleDetail(
        id=verification.id,
        statut=verification.statut,
        raison=verification.raison,
        score_liveness=verification.score_liveness,
        score_similarite=verification.score_similarite,
        date_upload=verification.cree_le,
        date_verification=verification.date_verification,
        est_supprime=verification.est_supprime,
        date_suppression=verification.date_suppression,
        details=verification.details,
    )


async def obtenir_historique_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 10,
) -> ListeVerificationVisuelle:
    resultat = await session.execute(
        select(VerificationVisuelle)
        .where(VerificationVisuelle.utilisateur_id == utilisateur.id)
        .order_by(desc(VerificationVisuelle.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()

    return ListeVerificationVisuelle(
        historique=[
            VerificationVisuelleDetail(
                id=enregistrement.id,
                statut=enregistrement.statut,
                raison=enregistrement.raison,
                score_liveness=enregistrement.score_liveness,
                score_similarite=enregistrement.score_similarite,
                date_upload=enregistrement.cree_le,
                date_verification=enregistrement.date_verification,
                est_supprime=enregistrement.est_supprime,
                date_suppression=enregistrement.date_suppression,
                details=enregistrement.details,
            )
            for enregistrement in enregistrements
        ],
        total=len(enregistrements),
    )


async def supprimer_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    verification_id: str,
) -> SuppressionVerification:
    """Marque une vérification comme supprimée (corbeille)."""
    import uuid
    try:
        uid = uuid.UUID(verification_id)
    except ValueError:
        raise ErreurValidation(
            "ID de vérification invalide.",
            message_utilisateur="L'identifiant de la vérification est invalide."
        )

    # Vérifier que la vérification appartient à l'utilisateur
    resultat = await session.execute(
        select(VerificationVisuelle).where(
            VerificationVisuelle.id == uid,
            VerificationVisuelle.utilisateur_id == utilisateur.id,
        )
    )
    verification = resultat.scalar_one_or_none()

    if verification is None:
        raise ErreurValidation(
            "Vérification introuvable.",
            message_utilisateur="Cette vérification n'existe pas ou ne t'appartient pas."
        )

    if verification.est_supprime:
        raise ErreurValidation(
            "Vérification déjà supprimée.",
            message_utilisateur="Cette vérification est déjà dans la corbeille."
        )

    # Soft-delete
    maintenant = datetime.now(timezone.utc)
    await session.execute(
        update(VerificationVisuelle)
        .where(VerificationVisuelle.id == uid)
        .values(est_supprime=True, date_suppression=maintenant)
    )
    await session.commit()

    journal.info(
        f"Vérification supprimée : id={verification_id} utilisateur={utilisateur.id}"
    )
    return SuppressionVerification(id=uid)


async def restaurer_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    verification_id: str,
) -> RestaurationVerification:
    """Restaure une vérification depuis la corbeille."""
    import uuid
    try:
        uid = uuid.UUID(verification_id)
    except ValueError:
        raise ErreurValidation(
            "ID de vérification invalide.",
            message_utilisateur="L'identifiant de la vérification est invalide."
        )

    resultat = await session.execute(
        select(VerificationVisuelle).where(
            VerificationVisuelle.id == uid,
            VerificationVisuelle.utilisateur_id == utilisateur.id,
        )
    )
    verification = resultat.scalar_one_or_none()

    if verification is None:
        raise ErreurValidation(
            "Vérification introuvable.",
            message_utilisateur="Cette vérification n'existe pas ou ne t'appartient pas."
        )

    if not verification.est_supprime:
        raise ErreurValidation(
            "Vérification non supprimée.",
            message_utilisateur="Cette vérification n'est pas dans la corbeille."
        )

    await session.execute(
        update(VerificationVisuelle)
        .where(VerificationVisuelle.id == uid)
        .values(est_supprime=False, date_suppression=None)
    )
    await session.commit()

    journal.info(
        f"Vérification restaurée : id={verification_id} utilisateur={utilisateur.id}"
    )
    return RestaurationVerification(id=uid)
