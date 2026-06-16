# -*- coding: utf-8 -*-
"""
Service OCR CNI — orchestration du scan et de l'authentification
des Cartes Nationales d'Identité.

Ce service gère :
  1. L'upload et le traitement OCR d'une face (recto ou verso)
  2. La combinaison des résultats des deux faces
  3. La validation complète des données extraites
  4. La persistance des vérifications en base de données
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.verification_cni import VerificationCNI
from src.modules.ocr_cni.extraction_cni import extraire_donnees_cni
from src.modules.ocr_cni.ocr_engine import analyser_image_cni
from src.modules.ocr_cni.schemas import (
    DonneesCNIExtraites,
    ListeVerificationsCNI,
    ResultatOCRCNI,
    SyntheseVerificationCNI,
    ValidationCNIResultat,
    VerificationCNIDetail,
    SuppressionCNI,
    RestaurationCNI,
)
from src.modules.ocr_cni.validation_cni import (
    valider_donnees_cni,
    verifier_coherence_recto_verso,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurRessourceIntrouvable, ErreurValidation

# =============================================================================
# Constantes
# =============================================================================

TAILLE_MAX_IMAGE = 15 * 1024 * 1024  # 15 Mo
TYPES_MIME_AUTORISES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/tiff": "tiff",
}


# =============================================================================
# Fonctions internes
# =============================================================================

async def _lire_image(fichier: UploadFile) -> bytes:
    """Lit et valide le fichier image uploadé."""
    # Vérifier le type MIME
    if fichier.content_type not in TYPES_MIME_AUTORISES:
        raise ErreurValidation(
            f"Type MIME refusé : {fichier.content_type}",
            message_utilisateur=(
                "Format d'image non supporté. Utilise JPG, PNG, WEBP ou TIFF."
            ),
        )

    contenu = await fichier.read()
    if not contenu:
        raise ErreurValidation(
            "Fichier vide reçu pour l'OCR CNI.",
            message_utilisateur="Le fichier est vide. Merci de sélectionner une image valide.",
        )

    if len(contenu) > TAILLE_MAX_IMAGE:
        raise ErreurValidation(
            f"Image trop volumineuse : {len(contenu)} octets (max {TAILLE_MAX_IMAGE})",
            message_utilisateur=f"L'image dépasse la taille maximale de {TAILLE_MAX_IMAGE // 1024 // 1024} Mo.",
        )

    return contenu


def _compter_champs_extraits(donnees: DonneesCNIExtraites) -> int:
    """Compte le nombre de champs non-nuls extraits."""
    champs_pertinents = [
        donnees.nom_famille,
        donnees.prenoms,
        donnees.sexe,
        donnees.date_naissance,
        donnees.lieu_naissance,
        donnees.numero_cni,
        donnees.date_delivrance,
        donnees.date_expiration,
        donnees.autorite_delivrance,
        donnees.taille,
    ]
    return sum(1 for c in champs_pertinents if c is not None and c != "non_detecte")


async def _enregistrer_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    face: str,
    nom_fichier: str,
    type_mime: str,
    taille_octets: int,
    donnees: DonneesCNIExtraites,
    validation: Optional[ValidationCNIResultat] = None,
    resultat_ocr: Optional[ResultatOCRCNI] = None,
) -> VerificationCNI:
    """Enregistre une vérification CNI en base de données."""
    verification = VerificationCNI(
        utilisateur_id=utilisateur.id,
        face=face,
        nom_fichier=nom_fichier,
        type_mime=type_mime,
        taille_octets=taille_octets,
        statut="en_attente",
        # Données extraites
        nom_famille=donnees.nom_famille,
        prenoms=donnees.prenoms,
        sexe=donnees.sexe,
        date_naissance=donnees.date_naissance,
        lieu_naissance=donnees.lieu_naissance,
        numero_cni=donnees.numero_cni,
        date_delivrance=donnees.date_delivrance,
        date_expiration=donnees.date_expiration,
        autorite_delivrance=donnees.autorite_delivrance,
        taille=donnees.taille,
        mrz_ligne_1=donnees.mrz_ligne_1,
        mrz_ligne_2=donnees.mrz_ligne_2,
        mrz_ligne_3=donnees.mrz_ligne_3,
        format_carte=donnees.format_carte,
        texte_brut=donnees.texte_brut,
        taux_confiance_ocr=donnees.taux_confiance_moyen,
        erreurs_ocr=resultat_ocr.erreurs if resultat_ocr else [],
    )

    # Si validation fournie, mettre à jour le statut
    if validation:
        verification.est_valide = validation.est_valide
        verification.scores_validation = validation.scores_validation
        verification.validation_mrz = validation.verification_mrz
        verification.statut = "approuve" if validation.est_valide else "rejete"
        verification.date_traitement = datetime.now(timezone.utc)

    session.add(verification)
    await session.commit()
    await session.refresh(verification)

    # --- Mettre à jour le statut de l'utilisateur si la CNI est approuvée ---
    if validation and validation.est_valide:
        utilisateur.est_cni_verifiee = True
        utilisateur.date_verification_cni = datetime.now(timezone.utc)
        utilisateur.date_derniere_mise_a_jour_verifications = datetime.now(timezone.utc)
        await session.commit()

    return verification


# =============================================================================
# Services publics
# =============================================================================

async def traiter_upload_cni(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
    face: str = "recto",
) -> dict:
    """
    Traite l'upload d'une image de CNI (recto ou verso).

    Pipeline complet :
      1. Validation du fichier (format, taille)
      2. Analyse OCR de l'image
      3. Extraction structurée des champs
      4. Validation des données extraites
      5. Enregistrement en base de données

    Args :
        session : Session SQLAlchemy
        utilisateur : Utilisateur authentifié
        fichier : Fichier image uploadé
        face : Face de la carte ("recto" ou "verso")

    Retour :
        Dictionnaire avec les résultats complets.
    """
    # 1. Lire et valider l'image
    contenu = await _lire_image(fichier)
    nom_fichier = fichier.filename or f"cni_{face}.jpg"

    # 2. Analyser l'image avec OCR
    resultat_analyse = analyser_image_cni(contenu)

    succes_ocr = resultat_analyse["succes"]
    texte_brut = resultat_analyse["texte_brut"]
    confiance = resultat_analyse["confiance_moyenne"]
    mrz_lignes = resultat_analyse["mrz_lignes"]
    temps_ms = resultat_analyse["temps_analyse_ms"]
    erreurs = resultat_analyse["erreurs"]

    # 3. Extraire les données structurées
    donnees = extraire_donnees_cni(
        texte_brut=texte_brut,
        confiance=confiance,
        mrz_lignes=mrz_lignes,
    )

    # 4. Compter les champs extraits
    nb_champs = _compter_champs_extraits(donnees)

    # 5. Valider les données
    validation = valider_donnees_cni(donnees) if succes_ocr else None

    # 6. Enregistrer en base
    verification = await _enregistrer_verification(
        session=session,
        utilisateur=utilisateur,
        face=face,
        nom_fichier=nom_fichier,
        type_mime=fichier.content_type or "image/jpeg",
        taille_octets=len(contenu),
        donnees=donnees,
        validation=validation,
        resultat_ocr=ResultatOCRCNI(
            succes=succes_ocr,
            donnees=donnees,
            erreurs=erreurs,
            champs_extraits=nb_champs,
            temps_analyse_ms=temps_ms,
        ),
    )

    # 7. Journaliser
    journal.info(
        f"OCR CNI ({face}) : utilisateur={utilisateur.id}, "
        f"statut={verification.statut}, "
        f"champs={nb_champs}, confiance={confiance:.1f}%, "
        f"temps={temps_ms}ms"
    )

    return {
        "id": verification.id,
        "face": face,
        "statut": verification.statut,
        "resultat_ocr": {
            "succes": succes_ocr,
            "donnees": donnees,
            "erreurs": erreurs,
            "champs_extraits": nb_champs,
            "temps_analyse_ms": temps_ms,
        },
        "validation": validation,
        "message": (
            "Carte scannée avec succès." if succes_ocr
            else "L'OCR n'a pas pu extraire les données. Vérifie la qualité de l'image."
        ),
    }


async def obtenir_synthese_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> SyntheseVerificationCNI:
    """
    Obtient la synthèse de la dernière vérification CNI complète (recto + verso).

    Retourne les résultats combinés des deux faces avec une validation croisée.
    """
    # Récupérer les dernières vérifications recto et verso
    resultats = await session.execute(
        select(VerificationCNI)
        .where(
            VerificationCNI.utilisateur_id == utilisateur.id,
            VerificationCNI.est_supprime == False,
        )
        .order_by(desc(VerificationCNI.cree_le))
        .limit(20)
    )
    toutes_verifs = resultats.scalars().all()

    # Trouver le dernier recto et le dernier verso
    dernier_recto = None
    dernier_verso = None
    for v in toutes_verifs:
        if v.face == "recto" and dernier_recto is None:
            dernier_recto = v
        elif v.face == "verso" and dernier_verso is None:
            dernier_verso = v

    if not dernier_recto and not dernier_verso:
        return SyntheseVerificationCNI(
            statut="en_attente",
            message="Aucune vérification CNI trouvée. Scanne d'abord le recto de ta carte.",
        )

    # Construire les données structurées
    donnees_recto = None
    donnees_verso = None
    validation_globale = None
    statut = "en_attente"

    if dernier_recto:
        donnees_recto = DonneesCNIExtraites(
            nom_famille=dernier_recto.nom_famille,
            prenoms=dernier_recto.prenoms,
            sexe=dernier_recto.sexe,
            date_naissance=dernier_recto.date_naissance,
            lieu_naissance=dernier_recto.lieu_naissance,
            numero_cni=dernier_recto.numero_cni,
            date_delivrance=dernier_recto.date_delivrance,
            date_expiration=dernier_recto.date_expiration,
            autorite_delivrance=dernier_recto.autorite_delivrance,
            taille=dernier_recto.taille,
            mrz_ligne_1=dernier_recto.mrz_ligne_1,
            mrz_ligne_2=dernier_recto.mrz_ligne_2,
            mrz_ligne_3=dernier_recto.mrz_ligne_3,
            format_carte=dernier_recto.format_carte or "non_reconnu",
            taux_confiance_moyen=dernier_recto.taux_confiance_ocr,
        )

        # Statut basé sur le recto (la face principale)
        if dernier_recto.statut == "approuve":
            statut = "approuve"
        elif dernier_recto.statut == "rejete":
            statut = "rejete"

    if dernier_verso:
        donnees_verso = DonneesCNIExtraites(
            nom_famille=dernier_verso.nom_famille,
            prenoms=dernier_verso.prenoms,
            sexe=dernier_verso.sexe,
            date_naissance=dernier_verso.date_naissance,
            lieu_naissance=dernier_verso.lieu_naissance,
            numero_cni=dernier_verso.numero_cni,
            date_delivrance=dernier_verso.date_delivrance,
            date_expiration=dernier_verso.date_expiration,
            autorite_delivrance=dernier_verso.autorite_delivrance,
            taille=dernier_verso.taille,
            mrz_ligne_1=dernier_verso.mrz_ligne_1,
            mrz_ligne_2=dernier_verso.mrz_ligne_2,
            mrz_ligne_3=dernier_verso.mrz_ligne_3,
            format_carte=dernier_verso.format_carte or "non_reconnu",
            taux_confiance_moyen=dernier_verso.taux_confiance_ocr,
        )

    # Validation croisée si les deux faces sont disponibles
    if donnees_recto and donnees_verso:
        coherent, msg_coherence = verifier_coherence_recto_verso(donnees_recto, donnees_verso)

        if not coherent:
            statut = "rejete"
            message = msg_coherence
        else:
            # Re-valider avec les données combinées (priorité recto)
            donnees_combinees = DonneesCNIExtraites(
                nom_famille=donnees_recto.nom_famille or donnees_verso.nom_famille,
                prenoms=donnees_recto.prenoms or donnees_verso.prenoms,
                sexe=donnees_recto.sexe if donnees_recto.sexe != "non_detecte" else donnees_verso.sexe,
                date_naissance=donnees_recto.date_naissance or donnees_verso.date_naissance,
                lieu_naissance=donnees_recto.lieu_naissance or donnees_verso.lieu_naissance,
                numero_cni=donnees_recto.numero_cni or donnees_verso.numero_cni,
                date_delivrance=donnees_recto.date_delivrance or donnees_verso.date_delivrance,
                date_expiration=donnees_recto.date_expiration or donnees_verso.date_expiration,
                autorite_delivrance=donnees_recto.autorite_delivrance or donnees_verso.autorite_delivrance,
                taille=donnees_recto.taille or donnees_verso.taille,
                mrz_ligne_1=donnees_recto.mrz_ligne_1 or donnees_verso.mrz_ligne_1,
                mrz_ligne_2=donnees_recto.mrz_ligne_2 or donnees_verso.mrz_ligne_2,
                mrz_ligne_3=donnees_recto.mrz_ligne_3 or donnees_verso.mrz_ligne_3,
                format_carte=donnees_recto.format_carte if donnees_recto.format_carte != "non_reconnu" else donnees_verso.format_carte,
                taux_confiance_moyen=max(
                    donnees_recto.taux_confiance_moyen or 0,
                    donnees_verso.taux_confiance_moyen or 0,
                ),
            )
            validation_globale = valider_donnees_cni(donnees_combinees)
            statut = "approuve" if validation_globale.est_valide else "rejete"
            message = validation_globale.message
    else:
        # Une seule face traitée
        if donnees_recto:
            validation_globale = valider_donnees_cni(donnees_recto)
            message = validation_globale.message
        else:
            message = "Seul le verso a été scanné. Scanne aussi le recto."

    # Compter les champs vérifiés
    champs_verifies = 0
    if donnees_recto:
        champs_verifies += _compter_champs_extraits(donnees_recto)
    if donnees_verso:
        champs_verifies += _compter_champs_extraits(donnees_verso)

    return SyntheseVerificationCNI(
        id_recto=dernier_recto.id if dernier_recto else None,
        id_verso=dernier_verso.id if dernier_verso else None,
        statut=statut,
        donnees_recto=donnees_recto,
        donnees_verso=donnees_verso,
        validation_globale=validation_globale,
        message=message,
        champs_verifies=champs_verifies,
        champs_total=10,  # Nombre total de champs potentiels
    )


async def obtenir_verifications(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsCNI:
    """Liste l'historique des vérifications CNI de l'utilisateur."""
    resultat = await session.execute(
        select(VerificationCNI)
        .where(VerificationCNI.utilisateur_id == utilisateur.id)
        .order_by(desc(VerificationCNI.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()

    return ListeVerificationsCNI(
        historique=[
            VerificationCNIDetail(
                id=v.id,
                utilisateur_id=v.utilisateur_id,
                statut=v.statut,
                face=v.face,
                nom_fichier=v.nom_fichier,
                type_mime=v.type_mime,
                taille_octets=v.taille_octets,
                nom_famille=v.nom_famille,
                prenoms=v.prenoms,
                sexe=v.sexe,
                date_naissance=v.date_naissance,
                lieu_naissance=v.lieu_naissance,
                numero_cni=v.numero_cni,
                date_delivrance=v.date_delivrance,
                date_expiration=v.date_expiration,
                autorite_delivrance=v.autorite_delivrance,
                taille=v.taille,
                mrz_ligne_1=v.mrz_ligne_1,
                mrz_ligne_2=v.mrz_ligne_2,
                mrz_ligne_3=v.mrz_ligne_3,
                format_carte=v.format_carte,
                taux_confiance_ocr=v.taux_confiance_ocr,
                validation_mrz=v.validation_mrz,
                est_valide=v.est_valide,
                scores_validation=v.scores_validation,
                erreurs_ocr=v.erreurs_ocr,
                date_traitement=v.date_traitement,
                cree_le=v.cree_le,
                est_supprime=v.est_supprime,
                date_suppression=v.date_suppression,
            )
            for v in enregistrements
        ],
        total=len(enregistrements),
    )


async def supprimer_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    verification_id: UUID,
) -> SuppressionCNI:
    """Supprime (soft-delete) une vérification CNI."""
    resultat = await session.execute(
        select(VerificationCNI).where(
            VerificationCNI.id == verification_id,
            VerificationCNI.utilisateur_id == utilisateur.id,
        )
    )
    verification = resultat.scalar_one_or_none()

    if verification is None:
        raise ErreurRessourceIntrouvable(
            f"Vérification CNI {verification_id} introuvable.",
            message_utilisateur="Cette vérification n'existe pas ou ne t'appartient pas.",
        )

    if verification.est_supprime:
        raise ErreurValidation(
            "Vérification déjà supprimée.",
            message_utilisateur="Cette vérification est déjà dans la corbeille.",
        )

    maintenant = datetime.now(timezone.utc)
    await session.execute(
        update(VerificationCNI)
        .where(VerificationCNI.id == verification_id)
        .values(est_supprime=True, date_suppression=maintenant)
    )
    await session.commit()

    journal.info(
        f"Vérification CNI supprimée : id={verification_id} utilisateur={utilisateur.id}"
    )
    return SuppressionCNI(id=verification_id)


async def restaurer_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    verification_id: UUID,
) -> RestaurationCNI:
    """Restaure une vérification CNI depuis la corbeille."""
    resultat = await session.execute(
        select(VerificationCNI).where(
            VerificationCNI.id == verification_id,
            VerificationCNI.utilisateur_id == utilisateur.id,
        )
    )
    verification = resultat.scalar_one_or_none()

    if verification is None:
        raise ErreurRessourceIntrouvable(
            f"Vérification CNI {verification_id} introuvable.",
            message_utilisateur="Cette vérification n'existe pas ou ne t'appartient pas.",
        )

    if not verification.est_supprime:
        raise ErreurValidation(
            "Vérification non supprimée.",
            message_utilisateur="Cette vérification n'est pas dans la corbeille.",
        )

    await session.execute(
        update(VerificationCNI)
        .where(VerificationCNI.id == verification_id)
        .values(est_supprime=False, date_suppression=None)
    )
    await session.commit()

    journal.info(
        f"Vérification CNI restaurée : id={verification_id} utilisateur={utilisateur.id}"
    )
    return RestaurationCNI(id=verification_id)
