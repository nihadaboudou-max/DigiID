# -*- coding: utf-8 -*-
"""
Service de vérification visuelle — upload, comparaison, statut.
Gère la détection de visage, l'anti-spoofing, et la comparaison biométrique 
avec l'empreinte faciale extraite de la CNI.
"""
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import numpy as np
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
    ResultatComparaisonFaciale,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurValidation


async def _lire_image(fichier: UploadFile) -> bytes:
    """Lit et valide le contenu du fichier uploadé."""
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
    """Recherche des visages similaires dans la base de données (anti-doublon global)."""
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
    
    return comparaison.comparer_embeddings(
        embedding, 
        historique, 
        seuil=parametres.seuil_similarite_visage
    )


async def traiter_upload_photo(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
    adresse_ip: str | None = None,
    user_agent: str | None = None,
) -> VerificationVisuelle:
    """
    Traite l'upload de photo et enregistre un résultat de vérification.
    Compare automatiquement avec l'embedding de la CNI si disponible.
    """
    contenu = await _lire_image(fichier)

    # 1. Détection de visage
    visage_detecte, _ = detection_visage.detecter_visage(contenu)
    if not visage_detecte:
        raise ErreurValidation(
            "Aucun visage détecté dans la photo de vérification.",
            message_utilisateur=(
                "Impossible de détecter un visage sur la photo. "
                "Assure-toi de télécharger une photo nette de ton visage, bien éclairée."
            ),
        )

    # 2. Analyse biométrique
    score_liveness, verdict = anti_spoofing.evaluer_anti_spoofing(contenu)
    embedding = embedding_facial.generer_embedding(contenu)
    doublons = await _chercher_doublons(session, embedding, utilisateur.id)

    # 3. Détermination du statut initial
    statut = "approuve"
    raison = "Vérification réussie. Identité confirmée."
    score_similarite: float | None = None
    date_verification = datetime.now(timezone.utc)

    # 4. Vérifications de rejet (Anti-spoofing, Doublons, Listes)
    if verdict != "vivant":
        statut = "rejete"
        raison = "Photo suspecte d'usurpation (écran, masque) ou de faible qualité."
        date_verification = None
    elif doublons:
        statut = "rejete"
        raison = "Un visage similaire existe déjà dans la base DigiID."
        score_similarite = doublons[0]["similarite"]
        date_verification = None
    elif score_liveness < 0.3:
        statut = "rejete"
        raison = "La qualité du visage est insuffisante pour vérifier l'identité."
        date_verification = None
    else:
        resultat_listes = listes_recherchees.verifier_listes_officielles(None, None)
        if resultat_listes:
            raison = "Correspondance détectée avec une liste de personnes recherchées."
            statut = "rejete"
            date_verification = None

    # 5. Comparaison avec la photo de la CNI (si les étapes précédentes sont OK)
    if statut == "approuve":
        from src.modeles.verification_cni import VerificationCNI
        
        resultat_cni = await session.execute(
            select(VerificationCNI)
            .where(
                VerificationCNI.utilisateur_id == utilisateur.id,
                VerificationCNI.face == "recto",
                VerificationCNI.est_valide.is_(True),
                VerificationCNI.embedding_photo_cni.isnot(None),
                VerificationCNI.est_supprime.is_(False),
            )
            .order_by(desc(VerificationCNI.cree_le))
            .limit(1)
        )
        cni_verification = resultat_cni.scalar_one_or_none()
        
        if cni_verification and cni_verification.embedding_photo_cni:
            # Comparer les embeddings (seuil=0.0 pour obtenir le score brut sans filtrage)
            doublons_cni = comparaison.comparer_embeddings(
                embedding,
                [("cni", cni_verification.embedding_photo_cni)],
                seuil=0.0
            )
            score_similarite = doublons_cni[0]["similarite"] if doublons_cni else 0.0
            
            # Seuil abaissé à 50% (0.50) pour tolérer les différences d'angle/éclairage
            if score_similarite < 0.50:  
                statut = "rejete"
                raison = (
                    f"La photo ne correspond pas à celle de votre CNI "
                    f"(similarité: {score_similarite:.1%}). "
                    f"Assurez-vous que c'est bien vous sur la photo, bien éclairé et face à la caméra."
                )
                date_verification = None
                journal.warning(
                    f"REJET VÉRIFICATION VISUELLE - Pas de match CNI | "
                    f"user={utilisateur.id} score={score_similarite:.2f}"
                )
            else:
                journal.info(
                    f"MATCH CNI RÉUSSI | user={utilisateur.id} score={score_similarite:.2f}"
                )

    journal.info(
        f"Traitement vérification visuelle terminé : "
        f"verdict={verdict}, liveness={score_liveness:.2f}, "
        f"doublons={len(doublons)}, statut_final={statut}, similarite_cni={score_similarite}"
    )

    # 6. Enregistrement en base de données
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
        date_verification=date_verification,
    )
    session.add(verification)
    await session.commit()
    await session.refresh(verification)

    # 7. Mise à jour du profil utilisateur si la vérification est approuvée
    if statut == "approuve":
        utilisateur.est_visage_verifie = True
        utilisateur.date_verification_visage = datetime.now(timezone.utc)
        utilisateur.date_derniere_mise_a_jour_verifications = datetime.now(timezone.utc)
        utilisateur.empreinte_faciale = np.array(embedding, dtype=np.float32).tobytes()
        await session.commit()

    return verification


async def obtenir_statut_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> VerificationVisuelleDetail | None:
    """Récupère la dernière vérification visuelle de l'utilisateur."""
    resultat = await session.execute(
        select(VerificationVisuelle)
        .where(VerificationVisuelle.utilisateur_id == utilisateur.id)
        .order_by(desc(VerificationVisuelle.cree_le))
        .limit(1)
    )
    verification = resultat.scalar_one_or_none()
    
    if verification is None:
        return None

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
    """Récupère l'historique des vérifications visuelles."""
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

    maintenant = datetime.now(timezone.utc)
    await session.execute(
        update(VerificationVisuelle)
        .where(VerificationVisuelle.id == uid)
        .values(est_supprime=True, date_suppression=maintenant)
    )
    await session.commit()

    journal.info(f"Vérification supprimée (corbeille) : id={verification_id} user={utilisateur.id}")
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

    journal.info(f"Vérification restaurée : id={verification_id} user={utilisateur.id}")
    return RestaurationVerification(id=uid)


# =============================================================================
# NOUVELLE FONCTION : Comparaison explicite Selfie vs Document CNI
# =============================================================================
async def comparer_photo_profil_avec_document(
    session: AsyncSession,
    utilisateur: Utilisateur,
    document_id: str,
) -> ResultatComparaisonFaciale:
    """
    Compare l'embedding facial de la dernière vérification visuelle (selfie) 
    avec l'embedding de la CNI (document_id).
    """
    import uuid
    try:
        doc_uuid = uuid.UUID(document_id)
    except ValueError:
        raise ErreurValidation(
            "ID de document invalide.",
            message_utilisateur="L'identifiant du document est invalide."
        )

    # 1. Récupérer la dernière vérification visuelle approuvée de l'utilisateur
    resultat_visuelle = await session.execute(
        select(VerificationVisuelle)
        .where(
            VerificationVisuelle.utilisateur_id == utilisateur.id,
            VerificationVisuelle.statut == "approuve",
            VerificationVisuelle.embedding.isnot(None),
            VerificationVisuelle.est_supprime.is_(False),
        )
        .order_by(desc(VerificationVisuelle.cree_le))
        .limit(1)
    )
    verification_visuelle = resultat_visuelle.scalar_one_or_none()

    if not verification_visuelle or not verification_visuelle.embedding:
        raise ErreurValidation(
            "Aucune vérification visuelle approuvée trouvée.",
            message_utilisateur="Vous devez d'abord effectuer une vérification visuelle réussie."
        )

    # 2. Récupérer la vérification CNI correspondante
    from src.modeles.verification_cni import VerificationCNI
    resultat_cni = await session.execute(
        select(VerificationCNI)
        .where(
            VerificationCNI.id == doc_uuid,
            VerificationCNI.utilisateur_id == utilisateur.id,
            VerificationCNI.face == "recto",
            VerificationCNI.est_valide.is_(True),
            VerificationCNI.embedding_photo_cni.isnot(None),
            VerificationCNI.est_supprime.is_(False),
        )
    )
    verification_cni = resultat_cni.scalar_one_or_none()

    if not verification_cni or not verification_cni.embedding_photo_cni:
        raise ErreurValidation(
            "Document CNI invalide ou sans empreinte faciale.",
            message_utilisateur="Le document sélectionné n'est pas une CNI validée avec photo."
        )

    # 3. Comparer les embeddings (seuil=0.0 pour obtenir le score brut)
    resultat_comparaison = comparaison.comparer_embeddings(
        verification_visuelle.embedding,
        [("cni", verification_cni.embedding_photo_cni)],
        seuil=0.0
    )
    
    score_similarite = resultat_comparaison[0]["similarite"] if resultat_comparaison else 0.0
    
    # 4. Construire la réponse avec le seuil optimisé à 50%
    SEUIL_RECOMMANDE = 0.50
    correspond = score_similarite >= SEUIL_RECOMMANDE
    
    if correspond:
        if score_similarite >= 0.65:
            message = "Excellente correspondance. Visage confirmé."
        elif score_similarite >= 0.55:
            message = "Bonne correspondance. Visage confirmé."
        else:
            message = "Correspondance acceptable. Visage confirmé."
    else:
        if score_similarite >= 0.40:
            message = "Faible similarité. La photo CNI peut être ancienne ou l'angle différent."
        else:
            message = "Visage non correspondant. Assurez-vous que c'est bien vous."

    return ResultatComparaisonFaciale(
        correspond=correspond,
        score_confiance=round(score_similarite, 3),
        message=message,
        seuil_utilise=SEUIL_RECOMMANDE,
    )