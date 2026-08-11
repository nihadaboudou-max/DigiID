# -*- coding: utf-8 -*-
"""
Service OCR CNI — orchestration du scan et de l'authentification
des Cartes Nationales d'Identité.
"""
from datetime import datetime, timezone
from typing import Optional, Tuple
from uuid import UUID
from fastapi import UploadFile
from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date as date_type

from src.modeles import Utilisateur
from src.modules.ocr_cni.extraction_cni import extraire_donnees_cni
from src.modules.ocr_cni.ocr_engine import analyser_image_cni
from src.modules.ocr_cni.mrz_parser import parser_mrz_complet, CODES_PAYS_ICAO
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
from src.noyau import journal, dechiffrer_donnee
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
# Fonction utilitaire : Déduire la nationalité depuis le pays émetteur
# =============================================================================
def _deduire_nationalite_depuis_pays(pays_emetteur: Optional[str]) -> Optional[str]:
    """
    Déduit la nationalité depuis le pays émetteur.
    Ex: "Bénin" → "Béninoise", "Sénégal" → "Sénégalaise"
    """
    if not pays_emetteur:
        return None
    
    correspondances = {
        "Bénin": "Béninoise",
        "Sénégal": "Sénégalaise",
        "Mali": "Malienne",
        "Côte d'Ivoire": "Ivoirienne",
        "Burkina Faso": "Burkinabè",
        "Niger": "Nigérienne",
        "Togo": "Togolaise",
        "Guinée": "Guinéenne",
        "Cameroun": "Camerounaise",
        "Maroc": "Marocaine",
        "Algérie": "Algérienne",
        "Tunisie": "Tunisienne",
        "Ghana": "Ghanéenne",
        "Nigeria": "Nigériane",
    }
    return correspondances.get(pays_emetteur)

# =============================================================================
# Extraire premier prénom (utile pour la comparaison de cohérence)
# =============================================================================
def _extraire_premier_prenom(prenoms_complets: str) -> str:
    """
    Extrait le premier prénom d'une chaîne contenant potentiellement
    plusieurs prénoms. Règle métier : on ne garde que le premier
    pour éviter la saturation lors de la comparaison.
    Exemple : "Jean Pierre Marie" → "Jean"
    """
    if not prenoms_complets:
        return ""
    return prenoms_complets.strip().split()[0]

# =============================================================================
# ✅ NOUVEAU : Vérification de cohérence d'identité
# =============================================================================
async def verifier_coherence_identite(
    session: AsyncSession,
    utilisateur: Utilisateur,
    nouvelles_donnees: DonneesCNIExtraites,
) -> Tuple[bool, str]:
    """
    Vérifie la cohérence entre la nouvelle CNI et le profil utilisateur.
    ⚠️ BLOQUANT : Si incohérence détectée, on REJETTE la CNI
    """
    incoherences = []

    # 1. Comparaison Nom (STRICT)
    nom_utilisateur = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
    if nom_utilisateur and nouvelles_donnees.nom_famille:
        nom_cni = nouvelles_donnees.nom_famille.upper().strip()
        nom_profil = nom_utilisateur.upper().strip()
        # Comparaison stricte : doit correspondre exactement
        if nom_profil != nom_cni:
            incoherences.append(
                f"Nom CNI ({nom_cni}) ≠ Nom profil ({nom_profil})"
            )

    # 2. Comparaison Prénom (premier prénom uniquement)
    prenom_utilisateur = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""
    if prenom_utilisateur and nouvelles_donnees.prenoms:
        prenom_cni = nouvelles_donnees.prenoms.upper().strip().split()[0]
        prenom_profil = prenom_utilisateur.upper().strip().split()[0]
        if prenom_profil != prenom_cni:
            incoherences.append(
                f"Prénom CNI ({prenom_cni}) ≠ Prénom profil ({prenom_profil})"
            )

    if incoherences:
        #  BLOQUANT : On rejette la CNI
        return False, "Incohérence détectée : " + "; ".join(incoherences)

    return True, "Identité cohérente"

# =============================================================================
# Fonctions internes
# =============================================================================
async def _lire_image(fichier: UploadFile) -> bytes:
    """Lit et valide le fichier image uploadé."""
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
    return sum(1 for c in champs_pertinents if c is not None and c != "non_detecte" and c != "N/A")

def _fusionner_donnees_mrz(
    donnees_ocr: DonneesCNIExtraites,
    mrz_lignes: tuple,
) -> DonneesCNIExtraites:
    """Fusionne les données OCR avec les données MRZ (priorité MRZ)."""
    if not mrz_lignes or not mrz_lignes[0]:
        return donnees_ocr
    l1, l2, l3 = mrz_lignes
    try:
        resultat_mrz = parser_mrz_complet(l1, l2, l3)
        donnees_finales = donnees_ocr.model_copy()
        if resultat_mrz.get("numero_document"):
            donnees_finales.numero_cni = resultat_mrz["numero_document"]
        if resultat_mrz.get("nom_famille"):
            donnees_finales.nom_famille = resultat_mrz["nom_famille"]
        if resultat_mrz.get("prenoms"):
            donnees_finales.prenoms = resultat_mrz["prenoms"]
        if resultat_mrz.get("date_naissance_date"):
            donnees_finales.date_naissance = resultat_mrz["date_naissance_date"]
        if resultat_mrz.get("date_expiration_date"):
            donnees_finales.date_expiration = resultat_mrz["date_expiration_date"]
        if resultat_mrz.get("sexe") and resultat_mrz["sexe"] in ("M", "F"):
            donnees_finales.sexe = resultat_mrz["sexe"]
        if resultat_mrz.get("pays_emetteur_nom"):
            donnees_finales.autorite_delivrance = resultat_mrz["pays_emetteur_nom"]
        return donnees_finales
    except Exception as e:
        journal.warning(f"Erreur lors du parsing MRZ : {e}")
        return donnees_ocr

async def _creer_ou_mettre_a_jour_document_identite(
    session: AsyncSession,
    utilisateur: Utilisateur,
    donnees: DonneesCNIExtraites,
    verification,  # Type VerificationCNI — pas d'import au niveau supérieur
) -> None:
    """Crée ou met à jour un DocumentIdentite à partir des données OCR validées."""
    if not donnees.numero_cni:
        return

    # ✅ Import local pour éviter le circular import
    from src.modeles.document_identite import DocumentIdentite
    
    resultat = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.utilisateur_id == utilisateur.id,
            DocumentIdentite.type_document == "cni",
            DocumentIdentite.verification_id == verification.id,
        )
    )
    doc_existant = resultat.scalar_one_or_none()

    if doc_existant:
        if not doc_existant.a_ete_corrige:
            doc_existant.numero_document = donnees.numero_cni
            doc_existant.nom_complet = f"{donnees.prenoms or ''} {donnees.nom_famille or ''}".strip() or None
            if donnees.sexe and donnees.sexe in ("M", "F"):
                doc_existant.sexe = donnees.sexe
            # ✅ MAJ nationalité et pays_emetteur si pas encore définis
            if not doc_existant.nationalite and donnees.nationalite:
                doc_existant.nationalite = donnees.nationalite
            if not doc_existant.pays_emetteur:
                pays_emetteur_code = donnees.mrz_ligne_1[2:5] if donnees.mrz_ligne_1 and len(donnees.mrz_ligne_1) >= 5 else ""
                doc_existant.pays_emetteur = CODES_PAYS_ICAO.get(pays_emetteur_code)
            await session.commit()
        # ✅ Rappel : la CNI expire bientôt ?
        from src.noyau.rappels_expiration import notifier_expiration_proche
        await notifier_expiration_proche(session, utilisateur, "cni", doc_existant.date_expiration)
        return

    def _parser_date(d: Optional[str]) -> Optional[date_type]:
        if not d: return None
        import re
        m = re.match(r'(\d{2})/(\d{2})/(\d{4})', d)
        if m: return date_type(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        return None

    # ✅ DÉTERMINER LE PAYS ÉMETTEUR DEPUIS LE MRZ
    pays_emetteur_code = donnees.mrz_ligne_1[2:5] if donnees.mrz_ligne_1 and len(donnees.mrz_ligne_1) >= 5 else ""
    pays_emetteur_nom = CODES_PAYS_ICAO.get(pays_emetteur_code)
    nationalite_finale = donnees.nationalite or _deduire_nationalite_depuis_pays(pays_emetteur_nom)

    doc = DocumentIdentite(
        utilisateur_id=utilisateur.id,
        type_document="cni",
        est_actif=True,
        source="ocr",
        a_ete_corrige=False,
        verification_id=verification.id,
        numero_document=donnees.numero_cni,
        nom_complet=f"{donnees.prenoms or ''} {donnees.nom_famille or ''}".strip() or None,
        date_naissance=_parser_date(donnees.date_naissance),
        lieu_naissance=donnees.lieu_naissance,
        sexe=donnees.sexe if donnees.sexe in ("M", "F") else None,
        date_delivrance=_parser_date(donnees.date_delivrance),
        date_expiration=_parser_date(donnees.date_expiration),
        autorite_delivrance=donnees.autorite_delivrance,
        taille_cm=int(donnees.taille) if donnees.taille and donnees.taille.isdigit() else None,
        nationalite=nationalite_finale,  # ✅ AJOUTÉ
        pays_emetteur=pays_emetteur_nom,  # ✅ Plus de fallback "Sénégal"
    )
    session.add(doc)
    await session.commit()
    # ✅ Rappel : la CNI expire bientôt ?
    from src.noyau.rappels_expiration import notifier_expiration_proche
    await notifier_expiration_proche(session, utilisateur, "cni", doc.date_expiration)

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
):
    """Enregistre une vérification CNI en base de données."""
    # ✅ Import local pour éviter le circular import
    from src.modeles.verification_cni import VerificationCNI

    verification = VerificationCNI(
        utilisateur_id=utilisateur.id,
        face=face,
        nom_fichier=nom_fichier,
        type_mime=type_mime,
        taille_octets=taille_octets,
        statut="en_attente",
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
    if validation:
        verification.est_valide = validation.est_valide
        verification.scores_validation = validation.scores_validation
        verification.validation_mrz = validation.verification_mrz
        verification.statut = "approuve" if validation.est_valide else "rejete"
        verification.date_traitement = datetime.now(timezone.utc)
    session.add(verification)
    await session.commit()
    await session.refresh(verification)
    if validation and validation.est_valide:
        utilisateur.est_cni_verifiee = True
        utilisateur.date_verification_cni = datetime.now(timezone.utc)
        utilisateur.date_derniere_mise_a_jour_verifications = datetime.now(timezone.utc)
        await session.commit()
        await _creer_ou_mettre_a_jour_document_identite(session, utilisateur, donnees, verification)
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
    ⚠️ BLOQUE l'enregistrement si les données extraites ne correspondent
    pas strictement au nom et au premier prénom du profil utilisateur.
    ✅ Extrait et sauvegarde l'embedding facial de la photo CNI (recto).
    """
    contenu = await _lire_image(fichier)
    nom_fichier = fichier.filename or f"cni_{face}.jpg"

    # 1. Analyse OCR
    resultat_analyse = analyser_image_cni(contenu)
    succes_ocr = resultat_analyse["succes"]
    texte_brut = resultat_analyse["texte_brut"]
    confiance = resultat_analyse["confiance_moyenne"]
    mrz_lignes = resultat_analyse["mrz_lignes"]
    temps_ms = resultat_analyse["temps_analyse_ms"]
    erreurs = resultat_analyse["erreurs"]

    # 2. Extraction et fusion des données
    donnees_ocr = extraire_donnees_cni(
        texte_brut=texte_brut,
        confiance=confiance,
        mrz_lignes=mrz_lignes,
    )
    donnees = _fusionner_donnees_mrz(donnees_ocr, mrz_lignes)
    nb_champs = _compter_champs_extraits(donnees)
    validation = valider_donnees_cni(donnees) if succes_ocr else None

    # 🔴 REJET IMMÉDIAT : carte EXPIRÉE (message clair, upload bloqué)
    if (
        succes_ocr
        and donnees.date_expiration
        and validation
        and not validation.scores_validation.get("date_expiration", True)
    ):
        try:
            dexp = datetime.strptime(donnees.date_expiration, "%d/%m/%Y").date()
            libelle_date = f" depuis le {dexp.strftime('%d/%m/%Y')}"
        except (ValueError, TypeError):
            libelle_date = ""
        message_erreur = (
            f"❌ Carte expirée{libelle_date}. Ce document est refusé : "
            "vous devez renouveler votre carte avant de pouvoir l'utiliser avec DigiID."
        )
        journal.warning(
            f"REJET CNI | Carte expirée | utilisateur={utilisateur.id} | "
            f"date_expiration={donnees.date_expiration}"
        )
        raise ErreurValidation(
            message_erreur,
            message_utilisateur=message_erreur,
        )

    # 3. ✅ VÉRIFICATION STRICTE DE COHÉRENCE (Uniquement pour le recto)
    if succes_ocr and face == "recto" and donnees.nom_famille:
        # Déchiffrement des données du profil
        nom_profil = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
        prenom_profil = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""

        # Normalisation : majuscules, suppression des espaces, et extraction du PREMIER prénom
        nom_cni_pur = donnees.nom_famille.strip().upper()
        prenom_cni_pur = donnees.prenoms.strip().split()[0].upper() if donnees.prenoms else ""
        nom_profil_pur = nom_profil.strip().upper()
        prenom_profil_pur = prenom_profil.strip().split()[0].upper() if prenom_profil else ""

        incoherences = []

        # Comparaison stricte du nom
        if nom_profil_pur and nom_cni_pur and nom_profil_pur != nom_cni_pur:
            incoherences.append(
                f"Le nom sur la CNI ({nom_cni_pur}) ne correspond pas à votre profil ({nom_profil_pur})."
            )

        # Comparaison stricte du premier prénom
        if prenom_profil_pur and prenom_cni_pur and prenom_profil_pur != prenom_cni_pur:
            incoherences.append(
                f"Le prénom sur la CNI ({prenom_cni_pur}) ne correspond pas à votre profil ({prenom_profil_pur})."
            )

        #  BLOCAGE : Si incohérence détectée, on rejette l'upload immédiatement
        if incoherences:
            message_erreur = "Incohérence d'identité détectée : " + " ".join(incoherences) + " Veuillez corriger votre nom/prénom dans vos paramètres avant de scanner votre CNI."
            journal.warning(
                f"REJET CNI | Incohérence identité | utilisateur={utilisateur.id} | "
                f"CNI(nom={nom_cni_pur}, prenom={prenom_cni_pur}) vs Profil(nom={nom_profil_pur}, prenom={prenom_profil_pur})"
            )
            # Lève une erreur 400 qui sera affichée clairement au frontend
            raise ErreurValidation(
                message_erreur,
                message_utilisateur=message_erreur
            )

    # 4. Enregistrement en base
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

    # 5. ✅ EXTRACTION EMBEDDING FACIAL (Uniquement pour le recto validé)
    if face == "recto" and succes_ocr and verification.est_valide:
        try:
            from src.modules.verification_visuelle import embedding_facial
            # Générer l'embedding facial à partir de l'image CNI
            embedding_cni = embedding_facial.generer_embedding(contenu)
            # Sauvegarder dans la base
            verification.embedding_photo_cni = embedding_cni
            await session.commit()
            await session.refresh(verification)
            journal.info(
                f"Embedding photo CNI extrait et sauvegardé | "
                f"user={utilisateur.id} embedding_dim={len(embedding_cni)}"
            )
        except Exception as e:
            journal.warning(f"Échec extraction embedding photo CNI : {e}")
            # On ne bloque pas pour autant - l'embedding est optionnel

        # ✅ Stocker l'image recto (contient la photo du citoyen) sur disque
        #   → elle sera servie à la police pour le contrôle visuel.
        try:
            from src.noyau.stockage_photos import stocker_photo
            verification.photo_chemin = stocker_photo(
                contenu,
                prefixe="cni_recto",
                type_mime=fichier.content_type,
            )
            await session.commit()
            await session.refresh(verification)
            journal.info(
                f"Photo recto CNI stockée | user={utilisateur.id} "
                f"chemin={verification.photo_chemin}"
            )
        except Exception as e:
            journal.warning(f"Échec stockage photo recto CNI : {e}")

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
        "coherence_identite": "Vérifiée et cohérente",
        "message": (
            "Carte scannée et identité validée avec succès." if succes_ocr
            else "L'OCR n'a pas pu extraire les données. Vérifie la qualité de l'image."
        ),
    }

async def obtenir_synthese_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> SyntheseVerificationCNI:
    """Obtient la synthèse de la dernière vérification CNI complète."""
    # ✅ Import local
    from src.modeles.verification_cni import VerificationCNI

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
            message="Aucune vérification CNI trouvée.",
        )

    donnees_recto = None
    donnees_verso = None
    validation_globale = None
    statut = "en_attente"
    message = ""

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

    if donnees_recto and donnees_verso:
        coherent, msg_coherence = verifier_coherence_recto_verso(donnees_recto, donnees_verso)
        if not coherent:
            statut = "rejete"
            message = msg_coherence
        else:
            donnees_combinees = DonneesCNIExtraites(
                nom_famille=donnees_recto.nom_famille or donnees_verso.nom_famille,
                prenoms=donnees_recto.prenoms or donnees_verso.prenoms,
                sexe=donnees_recto.sexe if donnees_recto.sexe not in ("non_detecte", "N/A") else donnees_verso.sexe,
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
        if donnees_recto:
            validation_globale = valider_donnees_cni(donnees_recto)
            message = validation_globale.message
        else:
            message = "Seul le verso a été scanné."

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
        champs_total=10,
    )
    

async def obtenir_verifications(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsCNI:
    """Liste l'historique des vérifications CNI de l'utilisateur."""
    # ✅ Import local
    from src.modeles.verification_cni import VerificationCNI

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
    # ✅ Import local
    from src.modeles.verification_cni import VerificationCNI

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
    return SuppressionCNI(id=verification_id)

async def restaurer_verification(
    session: AsyncSession,
    utilisateur: Utilisateur,
    verification_id: UUID,
) -> RestaurationCNI:
    """Restaure une vérification CNI depuis la corbeille."""
    # ✅ Import local
    from src.modeles.verification_cni import VerificationCNI

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
    return RestaurationCNI(id=verification_id)