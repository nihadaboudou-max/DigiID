# -*- coding: utf-8 -*-
"""Service métier pour le module médical — avec cloisonnement."""
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from src.modeles.dossier_medical import DossierMedical, Consultation, Ordonnance
from src.modeles import Utilisateur
from datetime import datetime
from src.noyau.exceptions import ErreurRessourceIntrouvable, ErreurValidation
from src.noyau import dechiffrer_donnee


# ─── Fonctions utilitaires de cloisonnement ──────────────────────────

def _est_super_admin(utilisateur: Utilisateur) -> bool:
    """Vérifie si l'utilisateur est super admin."""
    return utilisateur.role in ["super_admin", "super_administrateur"]


def _appliquer_filtres_cloisonnement(query, utilisateur: Utilisateur, modele):
    """Applique les filtres de cloisonnement selon le rôle."""
    if _est_super_admin(utilisateur):
        return query

    conditions = []
    if utilisateur.domaine_id:
        conditions.append(modele.domaine_id == utilisateur.domaine_id)
    if utilisateur.role not in ["admin_domaine"] and utilisateur.departement_id:
        conditions.append(modele.departement_id == utilisateur.departement_id)

    if conditions:
        query = query.where(and_(*conditions))

    return query


# =============================================================================
# VÉRIFICATION DIGIID
# =============================================================================

async def verifier_digiid(session: AsyncSession, digiid: str) -> Utilisateur | None:
    """Recherche un utilisateur par son DigiID public."""
    result = await session.execute(
        select(Utilisateur).where(
            Utilisateur.digiid_public == digiid,
            Utilisateur.est_supprime == False,
        )
    )
    return result.scalar_one_or_none()


async def _verifier_digiid_existe(session: AsyncSession, digiid: str) -> Utilisateur:
    """Vérifie qu'un DigiID public correspond à un utilisateur existant."""
    utilisateur = await verifier_digiid(session, digiid)
    if not utilisateur:
        raise ErreurValidation(
            f"DigiID '{digiid}' introuvable",
            message_utilisateur=f"Aucun citoyen trouvé avec le DigiID '{digiid}'.",
        )
    return utilisateur


# =============================================================================
# DOSSIERS MÉDICAUX
# =============================================================================

async def creer_dossier(
    session: AsyncSession,
    medecin: Utilisateur,
    data: dict,
) -> DossierMedical:
    """Crée un dossier médical avec cloisonnement automatique."""
    await _verifier_digiid_existe(session, data["patient_digiid"])
    dossier = DossierMedical(
        medecin_id=medecin.id,
        domaine_id=medecin.domaine_id,
        departement_id=medecin.departement_id,
        **data
    )
    session.add(dossier)
    await session.commit()
    await session.refresh(dossier)
    return dossier


async def obtenir_dossiers(
    session: AsyncSession,
    utilisateur: Utilisateur,
    statut: str | None = None,
    recherche: str | None = None,
) -> list[DossierMedical]:
    """Liste les dossiers avec cloisonnement."""
    query = select(DossierMedical)

    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, DossierMedical)

    # Si ce n'est pas un super admin, on filtre aussi par medecin_id
    if not _est_super_admin(utilisateur):
        query = query.where(DossierMedical.medecin_id == utilisateur.id)

    if statut and statut != "tous":
        query = query.where(DossierMedical.statut == statut)
    if recherche:
        query = query.where(
            DossierMedical.patient_nom.ilike(f"%{recherche}%")
            | DossierMedical.patient_digiid.ilike(f"%{recherche}%")
        )

    query = query.order_by(DossierMedical.date_creation.desc())
    result = await session.execute(query)
    return list(result.scalars().all())


async def obtenir_dossier(
    session: AsyncSession,
    dossier_id: UUID,
    utilisateur: Utilisateur,
) -> DossierMedical:
    """Récupère un dossier avec vérification d'accès."""
    query = select(DossierMedical).where(DossierMedical.id == dossier_id)

    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, DossierMedical)

    if not _est_super_admin(utilisateur):
        query = query.where(DossierMedical.medecin_id == utilisateur.id)

    result = await session.execute(query)
    dossier = result.scalar_one_or_none()
    if not dossier:
        raise ErreurRessourceIntrouvable(f"Dossier {dossier_id} introuvable")
    return dossier


async def modifier_dossier(
    session: AsyncSession,
    dossier_id: UUID,
    utilisateur: Utilisateur,
    data: dict,
) -> DossierMedical:
    """Modifie un dossier médical."""
    dossier = await obtenir_dossier(session, dossier_id, utilisateur)
    for key, value in data.items():
        if value is not None:
            setattr(dossier, key, value)
    await session.commit()
    await session.refresh(dossier)
    return dossier


# =============================================================================
# CONSULTATIONS
# =============================================================================

async def ajouter_consultation(
    session: AsyncSession,
    medecin: Utilisateur,
    data: dict,
) -> Consultation:
    """Ajoute une consultation avec cloisonnement automatique."""
    consultation = Consultation(
        medecin_id=medecin.id,
        domaine_id=medecin.domaine_id,
        departement_id=medecin.departement_id,
        **data
    )
    session.add(consultation)
    await session.commit()
    await session.refresh(consultation)
    return consultation


async def obtenir_consultations(
    session: AsyncSession,
    dossier_id: UUID,
) -> list[Consultation]:
    """Liste les consultations d'un dossier."""
    result = await session.execute(
        select(Consultation)
        .where(Consultation.dossier_id == dossier_id)
        .order_by(Consultation.date_consultation.desc())
    )
    return list(result.scalars().all())


# =============================================================================
# ORDONNANCES
# =============================================================================

async def _generer_numero_ordonnance(session: AsyncSession) -> str:
    """Génère un numéro d'ordonnance unique."""
    result = await session.execute(
        select(func.max(Ordonnance.numero_ordonnance)).where(
            Ordonnance.numero_ordonnance.isnot(None)
        )
    )
    dernier = result.scalar()
    annee = str(datetime.utcnow().year)
    if dernier and dernier.startswith(f"ORD-{annee}-"):
        try:
            dernier_num = int(dernier.split("-")[-1])
            nouveau_num = dernier_num + 1
        except (IndexError, ValueError):
            nouveau_num = 1
    else:
        nouveau_num = 1
    return f"ORD-{annee}-{nouveau_num:06d}"


async def creer_ordonnance(
    session: AsyncSession,
    medecin: Utilisateur,
    data: dict,
    medecin_nom: str | None = None,
) -> Ordonnance:
    """Crée une ordonnance avec cloisonnement automatique."""
    numero = await _generer_numero_ordonnance(session)
    data["numero_ordonnance"] = numero
    data["medecin_nom"] = medecin_nom or "Médecin"
    data["statut"] = "active"
    ordonnance = Ordonnance(
        medecin_id=medecin.id,
        domaine_id=medecin.domaine_id,
        departement_id=medecin.departement_id,
        **data
    )
    session.add(ordonnance)
    await session.commit()
    await session.refresh(ordonnance)
    return ordonnance


async def obtenir_ordonnances(
    session: AsyncSession,
    dossier_id: UUID,
) -> list[Ordonnance]:
    """Liste les ordonnances d'un dossier."""
    result = await session.execute(
        select(Ordonnance)
        .where(Ordonnance.dossier_id == dossier_id)
        .order_by(Ordonnance.date_prescription.desc())
    )
    return list(result.scalars().all())


async def obtenir_toutes_ordonnances(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> list[Ordonnance]:
    """Liste toutes les ordonnances du médecin avec cloisonnement."""
    query = select(Ordonnance)

    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, Ordonnance)

    if not _est_super_admin(utilisateur):
        query = query.where(Ordonnance.medecin_id == utilisateur.id)

    query = query.order_by(Ordonnance.date_prescription.desc())
    result = await session.execute(query)
    return list(result.scalars().all())


async def compter_consultations(session: AsyncSession, dossier_id: UUID) -> int:
    """Compte les consultations d'un dossier."""
    result = await session.execute(
        select(func.count(Consultation.id)).where(Consultation.dossier_id == dossier_id)
    )
    return result.scalar() or 0


async def compter_ordonnances(session: AsyncSession, dossier_id: UUID) -> int:
    """Compte les ordonnances d'un dossier."""
    result = await session.execute(
        select(func.count(Ordonnance.id)).where(Ordonnance.dossier_id == dossier_id)
    )
    return result.scalar() or 0


async def obtenir_dossiers_par_digiid(
    session: AsyncSession,
    digiid: str,
) -> list[DossierMedical]:
    """Liste tous les dossiers médicaux d'un patient."""
    result = await session.execute(
        select(DossierMedical)
        .where(DossierMedical.patient_digiid == digiid)
        .order_by(DossierMedical.date_creation.desc())
    )
    return list(result.scalars().all())


async def _obtenir_ordonnance(
    session: AsyncSession,
    ordonnance_id: UUID,
    utilisateur: Utilisateur,
) -> Ordonnance:
    """Récupère une ordonnance avec vérification d'accès."""
    query = select(Ordonnance).where(Ordonnance.id == ordonnance_id)

    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, Ordonnance)

    if not _est_super_admin(utilisateur):
        query = query.where(Ordonnance.medecin_id == utilisateur.id)

    result = await session.execute(query)
    ordonnance = result.scalar_one_or_none()
    if not ordonnance:
        raise ErreurRessourceIntrouvable(f"Ordonnance {ordonnance_id} introuvable")
    return ordonnance


async def modifier_ordonnance(
    session: AsyncSession,
    ordonnance_id: UUID,
    utilisateur: Utilisateur,
    data: dict,
) -> Ordonnance:
    """Modifie une ordonnance."""
    ordonnance = await _obtenir_ordonnance(session, ordonnance_id, utilisateur)
    for key, value in data.items():
        if value is not None:
            setattr(ordonnance, key, value)
    await session.commit()
    await session.refresh(ordonnance)
    return ordonnance


async def supprimer_ordonnance(
    session: AsyncSession,
    ordonnance_id: UUID,
    utilisateur: Utilisateur,
) -> None:
    """Supprime une ordonnance."""
    ordonnance = await _obtenir_ordonnance(session, ordonnance_id, utilisateur)
    await session.delete(ordonnance)
    await session.commit()


async def obtenir_ordonnances_par_digiid(
    session: AsyncSession,
    digiid: str,
) -> list[Ordonnance]:
    """Liste toutes les ordonnances d'un patient."""
    dossiers = await obtenir_dossiers_par_digiid(session, digiid)
    if not dossiers:
        return []
    dossier_ids = [d.id for d in dossiers]
    result = await session.execute(
        select(Ordonnance)
        .where(Ordonnance.dossier_id.in_(dossier_ids))
        .order_by(Ordonnance.date_prescription.desc())
    )
    return list(result.scalars().all())


async def verifier_patient_ordonnance(
    session: AsyncSession,
    ordonnance_id: UUID,
    patient_digiid: str,
) -> bool:
    """Vérifie qu'une ordonnance appartient bien à un patient."""
    result = await session.execute(
        select(Ordonnance)
        .join(DossierMedical, Ordonnance.dossier_id == DossierMedical.id)
        .where(
            Ordonnance.id == ordonnance_id,
            DossierMedical.patient_digiid == patient_digiid,
        )
    )
    return result.scalar_one_or_none() is not None