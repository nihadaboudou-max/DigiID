# -*- coding: utf-8 -*-
"""
Service OCR Assurance — orchestration du scan, validation stricte d'identité et sauvegarde.
"""
import time
from datetime import datetime, date
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur
from src.modeles.assurance_auto import AssuranceAuto
from src.modules.ocr_cni.ocr_engine import analyser_image_cni
from src.modules.ocr_assurance.extraction_assurance import extraire_donnees_assurance
from src.modules.ocr_assurance.schemas import (
    DonneesAssuranceExtraites,
    ListeVerificationsAssurance,
    ReponseUploadAssurance,
    ResultatOCRAssurance,
    VerificationAssuranceDetail,
)
from src.noyau import journal
from src.noyau.exceptions import ErreurValidation
from src.noyau.chiffrement import dechiffrer_donnee


# =============================================================================
# Constantes
# =============================================================================
TAILLE_MAX_IMAGE = 15 * 1024 * 1024  # 15 Mo
TYPES_MIME_AUTORISES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

# =============================================================================
# Fonctions internes
# =============================================================================
async def _lire_image(fichier: UploadFile) -> bytes:
    """Lit et valide le fichier image uploadé."""
    if fichier.content_type not in TYPES_MIME_AUTORISES:
        raise ErreurValidation(
            f"Type MIME refusé : {fichier.content_type}",
            message_utilisateur="Format d'image non supporté. Utilise JPG, PNG ou WEBP.",
        )
    contenu = await fichier.read()
    if not contenu:
        raise ErreurValidation("Fichier vide reçu.", message_utilisateur="Le fichier est vide.")
    if len(contenu) > TAILLE_MAX_IMAGE:
        raise ErreurValidation(
            f"Image trop volumineuse : {len(contenu)} octets",
            message_utilisateur=f"L'image dépasse {TAILLE_MAX_IMAGE // 1024 // 1024} Mo.",
        )
    return contenu

def _compter_champs_extraits(donnees: DonneesAssuranceExtraites) -> int:
    """Compte le nombre de champs non-nuls extraits."""
    champs = [
        donnees.compagnie_assurance,
        donnees.numero_contrat,
        donnees.immatriculation_vehicule,
        donnees.date_expiration,
    ]
    return sum(1 for c in champs if c is not None)

def _parser_date(chaine_date: str | None, est_expiration: bool = False) -> date | None:
    """Convertit une chaîne de date brute en objet datetime.date pour la BDD."""
    if not chaine_date:
        return None
    dates_trouvees = []
    import re
    dates_trouvees = re.findall(r'\d{1,2}[./-]\d{1,2}[./-]\d{2,4}', chaine_date)
    if not dates_trouvees:
        return None
    date_cible = dates_trouvees[-1] if est_expiration else dates_trouvees[0]
    for fmt in ["%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%y", "%d/%m/%y", "%d-%m-%y"]:
        try:
            return datetime.strptime(date_cible, fmt).date()
        except ValueError:
            continue
    return None

# =============================================================================
# Service principal
# =============================================================================
async def traiter_upload_assurance(
    session: AsyncSession,
    utilisateur: Utilisateur,
    fichier: UploadFile,
) -> ReponseUploadAssurance:
    """
    Traite l'upload d'une image d'assurance avec vérification stricte d'identité.
    """
    debut = time.time()
    contenu = await _lire_image(fichier)
    nom_fichier = fichier.filename or "assurance.jpg"
    
    # 1. Analyse OCR réelle
    try:
        resultat_ocr_engine = analyser_image_cni(contenu)
        texte_brut = resultat_ocr_engine.get("texte_brut", "")
        confiance = resultat_ocr_engine.get("confiance_moyenne", 0.0)
    except Exception as e:
        journal.error(f"Erreur OCR assurance: {e}")
        texte_brut, confiance = "", 0.0
    
    # 2. Extraction des données
    donnees = extraire_donnees_assurance(
        texte_brut=texte_brut,
        confiance=confiance,
    )
    
    nb_champs = _compter_champs_extraits(donnees)
    succes_ocr = nb_champs >= 2
    erreurs = [] if succes_ocr else ["Extraction insuffisante des champs critiques (immatriculation, contrat)"]
    temps_ms = int((time.time() - debut) * 1000)

    # 3. ✅ VÉRIFICATION STRICTE DE COHÉRENCE (Inspirée exactement de la CNI)
    if succes_ocr and (donnees.nom_assure or donnees.prenoms_assure):
        # Déchiffrement des données du profil
        nom_profil = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
        prenom_profil = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""

        # Normalisation : majuscules, et extraction du PREMIER prénom
        nom_assurance_pur = donnees.nom_assure.strip().upper() if donnees.nom_assure else ""
        prenom_assurance_pur = donnees.prenoms_assure.strip().split()[0].upper() if donnees.prenoms_assure else ""
        nom_profil_pur = nom_profil.strip().upper()
        prenom_profil_pur = prenom_profil.strip().split()[0].upper() if prenom_profil else ""

        incoherences = []

        # Comparaison stricte du nom
        if nom_profil_pur and nom_assurance_pur and nom_profil_pur != nom_assurance_pur:
            incoherences.append(
                f"Le nom sur l'assurance ({nom_assurance_pur}) ne correspond pas à votre profil ({nom_profil_pur})."
            )

        # Comparaison stricte du premier prénom
        if prenom_profil_pur and prenom_assurance_pur and prenom_profil_pur != prenom_assurance_pur:
            incoherences.append(
                f"Le prénom sur l'assurance ({prenom_assurance_pur}) ne correspond pas à votre profil ({prenom_profil_pur})."
            )

        # 🚨 BLOCAGE : Si incohérence détectée, on rejette l'upload immédiatement
        if incoherences:
            message_erreur = "Incohérence d'identité détectée : " + " ".join(incoherences) + " Veuillez corriger votre nom/prénom dans vos paramètres avant de scanner votre assurance."
            journal.warning(
                f"REJET ASSURANCE | Incohérence identité | utilisateur={utilisateur.id} | "
                f"Assurance(nom={nom_assurance_pur}, prenom={prenom_assurance_pur}) vs Profil(nom={nom_profil_pur}, prenom={prenom_profil_pur})"
            )
            raise ErreurValidation(
                message_erreur,
                message_utilisateur=message_erreur
            )

    # 4. Validation des champs critiques
    if not succes_ocr or not donnees.immatriculation_vehicule or not donnees.numero_contrat:
        return ReponseUploadAssurance(
            id=UUID("00000000-0000-0000-0000-000000000000"),
            statut="rejete",
            resultat_ocr=ResultatOCRAssurance(
                succes=False,
                donnees=donnees,
                erreurs=erreurs,
                champs_extraits=nb_champs,
                temps_analyse_ms=temps_ms,
            ),
            message="L'OCR n'a pas pu extraire l'immatriculation ou le numéro de contrat.",
        )
    
    # 5. Enregistrement en base de données
    nouvelle_assurance = AssuranceAuto(
        utilisateur_id=utilisateur.id,
        nom_famille=donnees.nom_assure,
        prenoms=donnees.prenoms_assure,
        compagnie_assurance=donnees.compagnie_assurance or "Inconnue",
        numero_contrat=donnees.numero_contrat,
        immatriculation=donnees.immatriculation_vehicule.upper(),
        marque_vehicule=donnees.marque_vehicule,
        modele_vehicule=donnees.modele_vehicule,
        date_effet=_parser_date(donnees.date_effet),
        date_expiration=_parser_date(donnees.date_expiration, est_expiration=True),
        est_active=succes_ocr,
    )
    
    session.add(nouvelle_assurance)
    await session.commit()
    await session.refresh(nouvelle_assurance)
    
    journal.info(
        f"Assurance scannée et enregistrée | user={utilisateur.id} | "
        f"succes={succes_ocr} | contrat={donnees.numero_contrat or 'N/A'} | temps={temps_ms}ms"
    )
    
    # 6. Construction de la réponse
    return ReponseUploadAssurance(
        id=str(nouvelle_assurance.id),  # Converti en string pour le frontend TypeScript
        statut="approuve" if succes_ocr else "rejete",
        resultat_ocr=ResultatOCRAssurance(
            succes=succes_ocr,
            donnees=donnees,
            erreurs=erreurs,
            champs_extraits=nb_champs,
            temps_analyse_ms=temps_ms,
        ),
        message="Assurance scannée et enregistrée avec succès." if succes_ocr else "L'OCR n'a pas pu extraire suffisamment de données.",
    )

async def obtenir_historique_assurance(
    session: AsyncSession,
    utilisateur: Utilisateur,
    limite: int = 20,
) -> ListeVerificationsAssurance:
    """Liste l'historique des vérifications d'assurance."""
    resultat = await session.execute(
        select(AssuranceAuto)
        .where(AssuranceAuto.utilisateur_id == utilisateur.id)
        .order_by(desc(AssuranceAuto.cree_le))
        .limit(limite)
    )
    enregistrements = resultat.scalars().all()
    
    historique = [
                VerificationAssuranceDetail(
            id=str(assurance.id),
            utilisateur_id=str(assurance.utilisateur_id),
            statut="approuve" if assurance.est_active else "expiree",
            nom_fichier=f"assurance_{assurance.immatriculation}.jpg",
            nom_famille=assurance.nom_famille,
            prenoms=assurance.prenoms,
            compagnie_assurance=assurance.compagnie_assurance,
            numero_contrat=assurance.numero_contrat,
            immatriculation_vehicule=assurance.immatriculation,
            marque_vehicule=assurance.marque_vehicule,
            modele_vehicule=assurance.modele_vehicule,
            date_effet=assurance.date_effet.isoformat() if assurance.date_effet else None,
            date_expiration=assurance.date_expiration.isoformat() if assurance.date_expiration else None,
            taux_confiance_ocr=None,
            cree_le=assurance.cree_le.isoformat(),
            est_supprime=False,
        )
        for assurance in enregistrements
    ]
    
    return ListeVerificationsAssurance(historique=historique, total=len(historique))