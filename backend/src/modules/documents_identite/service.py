# -*- coding: utf-8 -*-
"""
Service Documents d'Identité — logique métier.

Fonctionnalités :
  - Ajouter un document (CNI, Permis, Assurance)
  - Lister les documents de l'utilisateur
  - Modifier/corriger les champs d'un document
  - Supprimer (soft-delete) un document
  - Déclencher recalcul du score après modification
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import DocumentIdentite, Utilisateur
from src.modules.documents_identite.schemas import (
    DocumentIdentiteCreation,
    DocumentIdentiteDetail,
    DocumentIdentiteModification,
    ListeDocumentsIdentite,
)
from src.noyau import journal
from src.modules.scoring import declencher_recalcul_score


def _document_vers_detail(doc: DocumentIdentite) -> DocumentIdentiteDetail:
    """Convertit un objet ORM en schéma Pydantic."""
    return DocumentIdentiteDetail(
        id=doc.id,
        utilisateur_id=doc.utilisateur_id,
        type_document=doc.type_document,
        est_actif=doc.est_actif,
        source=doc.source,
        a_ete_corrige=doc.a_ete_corrige,
        verification_id=doc.verification_id,
        numero_document=doc.numero_document,
        nom_complet=doc.nom_complet,
        date_naissance=doc.date_naissance,
        lieu_naissance=doc.lieu_naissance,
        nationalite=doc.nationalite,
        sexe=doc.sexe,
        adresse=doc.adresse,
        date_delivrance=doc.date_delivrance,
        date_expiration=doc.date_expiration,
        pays_emetteur=doc.pays_emetteur,
        autorite_delivrance=doc.autorite_delivrance,
        profession=doc.profession,
        taille_cm=doc.taille_cm,
        categories_permis=doc.categories_permis,
        centre_examen=doc.centre_examen,
        numero_permis=doc.numero_permis,
        compagnie_assurance=doc.compagnie_assurance,
        type_couverture=doc.type_couverture,
        numero_contrat=doc.numero_contrat,
        immatriculation_vehicule=doc.immatriculation_vehicule,
        marque_vehicule=doc.marque_vehicule,
        modele_vehicule=doc.modele_vehicule,
        annee_vehicule=doc.annee_vehicule,
        cree_le=doc.cree_le,
        modifie_le=doc.modifie_le,
    )


async def ajouter_document(
    session: AsyncSession,
    utilisateur: Utilisateur,
    donnees: DocumentIdentiteCreation,
    adresse_ip: Optional[str] = None,
) -> DocumentIdentiteDetail:
    """
    Ajoute un nouveau document d'identité pour l'utilisateur.

    Si c'est la première création (source=manuel), on crée directement.
    Si source=ocr, l'OCR a déjà extrait les données.
    """
    doc = DocumentIdentite(
        utilisateur_id=utilisateur.id,
        type_document=donnees.type_document,
        source=donnees.source or "manuel",
        # Copier tous les champs fournis
        numero_document=donnees.numero_document,
        nom_complet=donnees.nom_complet,
        date_naissance=donnees.date_naissance,
        lieu_naissance=donnees.lieu_naissance,
        nationalite=donnees.nationalite,
        sexe=donnees.sexe,
        adresse=donnees.adresse,
        date_delivrance=donnees.date_delivrance,
        date_expiration=donnees.date_expiration,
        pays_emetteur=donnees.pays_emetteur,
        autorite_delivrance=donnees.autorite_delivrance,
        profession=donnees.profession,
        taille_cm=donnees.taille_cm,
        categories_permis=donnees.categories_permis,
        centre_examen=donnees.centre_examen,
        numero_permis=donnees.numero_permis,
        compagnie_assurance=donnees.compagnie_assurance,
        type_couverture=donnees.type_couverture,
        numero_contrat=donnees.numero_contrat,
        immatriculation_vehicule=donnees.immatriculation_vehicule,
        marque_vehicule=donnees.marque_vehicule,
        modele_vehicule=donnees.modele_vehicule,
        annee_vehicule=donnees.annee_vehicule,
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)

    journal.info(
        f"Document ajouté : {doc.type_document} pour {utilisateur.id}"
    )

    # Recalcul score temps réel
    await declencher_recalcul_score(
        session, utilisateur, "document_identite_ajout", adresse_ip,
    )

    return _document_vers_detail(doc)


async def lister_documents(
    session: AsyncSession,
    utilisateur: Utilisateur,
    type_document: Optional[str] = None,
) -> ListeDocumentsIdentite:
    """
    Liste tous les documents actifs de l'utilisateur.

    Optionnellement filtré par type_document (cni, permis, assurance).
    """
    query = select(DocumentIdentite).where(
        DocumentIdentite.utilisateur_id == utilisateur.id,
        DocumentIdentite.est_actif.is_(True),
    )
    if type_document:
        query = query.where(DocumentIdentite.type_document == type_document)

    query = query.order_by(DocumentIdentite.type_document, DocumentIdentite.modifie_le.desc())
    resultat = await session.execute(query)
    docs = resultat.scalars().all()

    return ListeDocumentsIdentite(
        documents=[_document_vers_detail(d) for d in docs],
        total=len(docs),
    )


async def obtenir_document(
    session: AsyncSession,
    document_id: UUID,
    utilisateur: Utilisateur,
) -> Optional[DocumentIdentiteDetail]:
    """Récupère un document par son ID (vérifie le propriétaire)."""
    resultat = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.id == document_id,
            DocumentIdentite.utilisateur_id == utilisateur.id,
        )
    )
    doc = resultat.scalar_one_or_none()
    return _document_vers_detail(doc) if doc else None


# Champs officiels du document — NON modifiables par l'utilisateur
# Ces champs doivent UNIQUEMENT provenir de l'OCR (source="ocr")
CHAMPS_NON_MODIFIABLES = {
    "date_naissance",
    "lieu_naissance",
    "sexe",
    "nationalite",
    "date_delivrance",
    "date_expiration",
}


async def modifier_document(
    session: AsyncSession,
    document_id: UUID,
    utilisateur: Utilisateur,
    donnees: DocumentIdentiteModification,
    adresse_ip: Optional[str] = None,
) -> Optional[DocumentIdentiteDetail]:
    """
    Modifie un document existant.
    Seuls les champs NON officiels sont modifiables.
    Les dates et données d'état civil sont verrouillées (extraites par OCR uniquement).
    """
    resultat = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.id == document_id,
            DocumentIdentite.utilisateur_id == utilisateur.id,
        )
    )
    doc = resultat.scalar_one_or_none()
    if not doc:
        return None

    # Appliquer les modifications non-nulles, EN EXCLUANT les champs officiels
    modifications = donnees.model_dump(exclude_none=True)
    
    # 🔒 Sécurité : exclure les champs non modifiables
    champs_bloques = []
    for champ in CHAMPS_NON_MODIFIABLES:
        if champ in modifications:
            champs_bloques.append(champ)
            del modifications[champ]
    
    if champs_bloques:
        journal.warning(
            f"Tentative de modification de champs officiels bloquée | "
            f"user={utilisateur.id} doc={document_id} | "
            f"champs_bloques={champs_bloques}"
        )
    
    if not modifications:
        return _document_vers_detail(doc)

    for champ, valeur in modifications.items():
        setattr(doc, champ, valeur)

    # Si l'utilisateur a modifié un champ OCR, marquer
    if doc.source == "ocr" and not doc.a_ete_corrige:
        doc.a_ete_corrige = True
    doc.modifie_le = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(doc)

    journal.info(
        f"Document modifié : {doc.type_document} de {utilisateur.id} "
        f"champs={list(modifications.keys())}"
    )

    # Recalcul score
    await declencher_recalcul_score(
        session, utilisateur, "document_identite_modification", adresse_ip,
    )
    return _document_vers_detail(doc)


async def supprimer_document(
    session: AsyncSession,
    document_id: UUID,
    utilisateur: Utilisateur,
    adresse_ip: Optional[str] = None,
) -> bool:
    """
    Supprime (soft-delete) un document.
    Retourne True si supprimé, False si introuvable.
    """
    resultat = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.id == document_id,
            DocumentIdentite.utilisateur_id == utilisateur.id,
        )
    )
    doc = resultat.scalar_one_or_none()
    if not doc:
        return False

    doc.est_actif = False
    await session.commit()

    journal.info(f"Document supprimé : {doc.type_document} de {utilisateur.id}")

    await declencher_recalcul_score(
        session, utilisateur, "document_identite_suppression", adresse_ip,
    )

    return True

async def verifier_coherence_profil_document(
    session: AsyncSession,
    utilisateur: Utilisateur,
    document_id: UUID,
) -> dict:
    """
    Compare les données du profil utilisateur avec un document d'identité.
    Règles métier :
      - Nom : strictement identique (insensible à la casse)
      - Prénom : premier prénom uniquement (split()[0])
    Retourne un dict avec le détail de la cohérence.
    """
    from src.noyau import dechiffrer_donnee

    # Récupérer le document
    resultat = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.id == document_id,
            DocumentIdentite.utilisateur_id == utilisateur.id,
            DocumentIdentite.est_actif.is_(True),
        )
    )
    doc = resultat.scalar_one_or_none()
    if not doc:
        return {
            "est_coherent": False,
            "nom_correspond": False,
            "prenom_correspond": False,
            "message": "Document introuvable ou inactif.",
        }

    # Déchiffrer les données du profil
    nom_profil = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
    prenom_profil = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""

    # Extraire nom/prénom du document (nom_complet = "Prénom Nom" ou "Nom Prénom")
    nom_document = ""
    prenom_document = ""
    if doc.nom_complet:
        parties = doc.nom_complet.strip().split()
        if len(parties) >= 2:
            # Convention : dernier mot = nom de famille, reste = prénoms
            nom_document = parties[-1]
            prenom_document = parties[0]  # Premier prénom uniquement
        elif len(parties) == 1:
            nom_document = parties[0]

    # Comparaison stricte (insensible à la casse)
    nom_correspond = (
        nom_profil.upper().strip() == nom_document.upper().strip()
        if nom_profil and nom_document
        else False
    )
    prenom_correspond = (
        prenom_profil.strip().split()[0].upper() == prenom_document.upper().strip()
        if prenom_profil and prenom_document
        else False
    )

    est_coherent = nom_correspond and prenom_correspond

    incoherences = []
    if not nom_correspond:
        incoherences.append(f"Nom profil ({nom_profil}) ≠ Nom document ({nom_document})")
    if not prenom_correspond:
        incoherences.append(f"Prénom profil ({prenom_profil}) ≠ Prénom document ({prenom_document})")

    journal.info(
        f"Vérification cohérence profil↔document | user={utilisateur.id} "
        f"doc={document_id} | coherent={est_coherent}"
    )

    return {
        "est_coherent": est_coherent,
        "nom_correspond": nom_correspond,
        "prenom_correspond": prenom_correspond,
        "nom_profil": nom_profil,
        "nom_document": nom_document,
        "prenom_profil": prenom_profil.strip().split()[0] if prenom_profil else "",
        "prenom_document": prenom_document,
        "incoherences": incoherences,
        "message": (
            "Profil et document cohérents." if est_coherent
            else "Incohérences détectées : " + "; ".join(incoherences)
        ),
    }


async def synchroniser_profil_document(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> dict:
    """
    Vérifie si l'utilisateur remplit toutes les conditions pour
    est_verifie_identite = True :
      1. est_cni_verifiee = True
      2. est_visage_verifie = True
      3. Au moins un document actif avec nom/prénom cohérents
    Si toutes les conditions sont remplies, marque l'utilisateur
    comme vérifié et enregistre la date.
    """
    from datetime import datetime, timezone

    # Condition 1 : CNI vérifiée
    if not utilisateur.est_cni_verifiee:
        return {
            "est_verifie_identite": False,
            "raison": "CNI non vérifiée.",
            "est_cni_verifiee": False,
            "est_visage_verifie": utilisateur.est_visage_verifie,
        }

    # Condition 2 : Visage vérifié
    if not utilisateur.est_visage_verifie:
        return {
            "est_verifie_identite": False,
            "raison": "Visage non vérifié.",
            "est_cni_verifiee": True,
            "est_visage_verifie": False,
        }

    # Condition 3 : Au moins un document cohérent
    resultat = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.utilisateur_id == utilisateur.id,
            DocumentIdentite.est_actif.is_(True),
        )
    )
    documents = resultat.scalars().all()

    if not documents:
        return {
            "est_verifie_identite": False,
            "raison": "Aucun document d'identité actif.",
            "est_cni_verifiee": True,
            "est_visage_verifie": True,
        }

    # Vérifier la cohérence de chaque document
    document_coherent = False
    for doc in documents:
        resultat_coherence = await verifier_coherence_profil_document(
            session, utilisateur, doc.id
        )
        if resultat_coherence["est_coherent"]:
            document_coherent = True
            break

    if not document_coherent:
        return {
            "est_verifie_identite": False,
            "raison": "Aucun document cohérent avec le profil (nom/prénom).",
            "est_cni_verifiee": True,
            "est_visage_verifie": True,
        }

    # ✅ Toutes les conditions remplies → marquer comme vérifié
    utilisateur.est_verifie_identite = True
    utilisateur.date_verification_identite = datetime.now(timezone.utc)
    utilisateur.date_derniere_mise_a_jour_verifications = datetime.now(timezone.utc)
    await session.commit()

    journal.info(
        f"✅ Identité vérifiée | utilisateur={utilisateur.id} | "
        f"CNI OK + Visage OK + Document cohérent"
    )

    return {
        "est_verifie_identite": True,
        "raison": "Identité vérifiée avec succès (CNI + Visage + Document cohérent).",
        "est_cni_verifiee": True,
        "est_visage_verifie": True,
        "date_verification": utilisateur.date_verification_identite.isoformat(),
    }
    
    
async def comparer_photo_profil_document(
    session: AsyncSession,
    utilisateur: Utilisateur,
    document_id: str = "",
) -> dict:
    """
    Compare l'empreinte faciale de l'utilisateur (photo de profil)
    avec l'embedding de la dernière vérification visuelle approuvée.
    
    Seuil de validation : score >= 0.6
    """
    import numpy as np
    from sqlalchemy import desc, select
    from src.modeles import VerificationVisuelle
    from src.modules.verification_visuelle import comparaison
    from src.noyau import journal

    # 1. Vérifier que l'utilisateur a une empreinte faciale enregistrée
    if not utilisateur.empreinte_faciale:
        return {
            "correspond": False,
            "score_confiance": 0.0,
            "message": "Aucune photo de profil vérifiée enregistrée. Veuillez d'abord compléter une vérification visuelle réussie.",
        }

    # 2. Récupérer la dernière vérification visuelle approuvée de cet utilisateur
    resultat = await session.execute(
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
    verification = resultat.scalar_one_or_none()

    if not verification or not verification.embedding:
        return {
            "correspond": False,
            "score_confiance": 0.0,
            "message": "Aucune vérification visuelle approuvée avec embedding trouvée.",
        }

    try:
        # 3. Convertir l'empreinte_faciale (bytes) en liste de floats
        embedding_profil = np.frombuffer(utilisateur.empreinte_faciale, dtype=np.float32).tolist()
        embedding_verification = verification.embedding

        # 4. Calculer la similarité cosinus
        # On passe seuil=0.0 pour obtenir le score brut sans filtrage
        doublons = comparaison.comparer_embeddings(
            embedding_verification,
            [("profil", embedding_profil)],
            seuil=0.0,
        )

        score_confiance = doublons[0]["similarite"] if doublons else 0.0
        seuil_validation = 0.6
        correspond = score_confiance >= seuil_validation

        return {
            "correspond": correspond,
            "score_confiance": round(score_confiance, 4),
            "seuil": seuil_validation,
            "message": (
                "✅ Le visage correspond à votre photo de profil." if correspond
                else "❌ Le visage ne correspond pas suffisamment à votre photo de profil."
            ),
        }

    except Exception as e:
        journal.warning(f"Erreur lors de la comparaison faciale profil/document : {e}")
        return {
            "correspond": False,
            "score_confiance": 0.0,
            "message": f"Erreur technique lors de la comparaison : {str(e)}",
        }