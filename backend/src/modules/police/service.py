# -*- coding: utf-8 -*-
"""Service métier pour le module Police — version complète avec cloisonnement."""
import time
from datetime import datetime, timezone
try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from src.modeles import Utilisateur
from src.modeles.verification_police import (
    VerificationPolice,
    SignalementFraude,
    NoteInternePolice,
    AlertePolice,
    HistoriqueRecherchePolice,
)
from src.modeles.verification_cni import VerificationCNI
from src.modeles.document_identite import DocumentIdentite
from src.noyau import dechiffrer_donnee, journal
from src.noyau.exceptions import ErreurRessourceIntrouvable


# ─── Fonctions utilitaires de cloisonnement ──────────────────────────

def _est_super_admin(utilisateur: Utilisateur) -> bool:
    """Vérifie si l'utilisateur est super admin."""
    return utilisateur.role in ["super_admin", "super_administrateur"]


def _appliquer_filtres_cloisonnement(
    query,
    utilisateur: Utilisateur,
    modele,
):
    """Applique les filtres de cloisonnement selon le rôle de l'utilisateur."""
    if _est_super_admin(utilisateur):
        return query  # Super admin voit tout
    
    conditions = []
    if utilisateur.domaine_id:
        conditions.append(modele.domaine_id == utilisateur.domaine_id)
    
    # Admin domaine voit tout son domaine, pas besoin de filtrer par département
    if utilisateur.role not in ["admin_domaine"] and utilisateur.departement_id:
        conditions.append(modele.departement_id == utilisateur.departement_id)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    return query


# =============================================================================
# VÉRIFICATIONS D'IDENTITÉ
# =============================================================================

async def creer_verification(
    session: AsyncSession,
    officier: Utilisateur,  # Changé de officier_id à officier complet
    data: dict,
) -> VerificationPolice:
    """Crée une nouvelle vérification d'identité avec motif et cloisonnement."""
    if data.get("personne_digiid"):
        result = await session.execute(
            select(Utilisateur).where(Utilisateur.digiid_public == data["personne_digiid"])
        )
        utilisateur = result.scalar_one_or_none()
        if utilisateur:
            if not data.get("personne_nom"):
                prenom = dechiffrer_donnee(utilisateur.prenom_chiffre) if utilisateur.prenom_chiffre else ""
                nom = dechiffrer_donnee(utilisateur.nom_chiffre) if utilisateur.nom_chiffre else ""
                data["personne_nom"] = f"{prenom} {nom}".strip()
            if not data.get("personne_email"):
                data["personne_email"] = dechiffrer_donnee(utilisateur.email_chiffre) if utilisateur.email_chiffre else ""
            if not data.get("personne_telephone"):
                data["personne_telephone"] = dechiffrer_donnee(utilisateur.telephone_chiffre) if utilisateur.telephone_chiffre else ""
    
    data.pop("personne_id", None)
    
    # --- Cloisonnement automatique (NOUVEAU) ---
    verification = VerificationPolice(
        officier_id=officier.id,
        domaine_id=officier.domaine_id,
        departement_id=officier.departement_id,
        **data
    )
    session.add(verification)
    await session.commit()
    await session.refresh(verification)
    return verification


async def obtenir_verifications(
    session: AsyncSession,
    utilisateur: Utilisateur,  # Changé de officier_id à utilisateur complet
    limite: int = 50,
    page: int = 1,
) -> tuple[list[VerificationPolice], int]:
    """Liste les vérifications avec pagination et cloisonnement."""
    query = select(VerificationPolice).order_by(VerificationPolice.date_verification.desc())
    
    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, VerificationPolice)
    
    # Si ce n'est pas un super admin, on filtre aussi par officier (ses propres vérifications)
    if not _est_super_admin(utilisateur):
        query = query.where(VerificationPolice.officier_id == utilisateur.id)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * limite
    query = query.offset(offset).limit(limite)

    result = await session.execute(query)
    return list(result.scalars().all()), total


async def obtenir_verification_par_id(
    session: AsyncSession, verification_id: UUID
) -> Optional[VerificationPolice]:
    """Récupère une vérification par son ID."""
    result = await session.execute(
        select(VerificationPolice).where(VerificationPolice.id == verification_id)
    )
    return result.scalar_one_or_none()


# =============================================================================
# RECHERCHE AVANCÉE
# =============================================================================

async def rechercher_personne(
    session: AsyncSession,
    query: str,
    type_recherche: str = "tout",
    filtre_statut: Optional[str] = None,
    filtre_score_min: Optional[int] = None,
    filtre_score_max: Optional[int] = None,
    filtre_ville: Optional[str] = None,
    limite: int = 20,
    page: int = 1,
    utilisateur: Optional[Utilisateur] = None,  # Changé de officier_id à utilisateur complet
) -> tuple[list[dict], int, float]:
    """
    Recherche avancée de personnes avec filtres et cloisonnement.
    Retourne les résultats, le total et le temps de recherche.
    """
    debut = time.time()
    query_clean = query.strip()
    query_lower = query_clean.lower()
    resultats: list[dict] = []
    utilisateurs_vus: set = set()

    etat_filtre = None
    if filtre_statut == "actif":
        etat_filtre = True
    elif filtre_statut == "inactif":
        etat_filtre = False

    base_query = select(Utilisateur)
    if etat_filtre is not None:
        base_query = base_query.where(Utilisateur.est_actif == etat_filtre)
    
    # --- Cloisonnement : filtrer les utilisateurs par domaine/département (NOUVEAU) ---
    if utilisateur and not _est_super_admin(utilisateur):
        if utilisateur.domaine_id:
            base_query = base_query.where(Utilisateur.domaine_id == utilisateur.domaine_id)
        if utilisateur.role not in ["admin_domaine"] and utilisateur.departement_id:
            base_query = base_query.where(Utilisateur.departement_id == utilisateur.departement_id)

    result = await session.execute(base_query)
    utilisateurs_list = result.scalars().all()

    for utilisateur_cible in utilisateurs_list:
        digiid = utilisateur_cible.digiid_public or ""
        prenom = dechiffrer_donnee(utilisateur_cible.prenom_chiffre) if utilisateur_cible.prenom_chiffre else ""
        nom = dechiffrer_donnee(utilisateur_cible.nom_chiffre) if utilisateur_cible.nom_chiffre else ""
        email = dechiffrer_donnee(utilisateur_cible.email_chiffre) if utilisateur_cible.email_chiffre else ""
        telephone = dechiffrer_donnee(utilisateur_cible.telephone_chiffre) if utilisateur_cible.telephone_chiffre else ""
        nom_complet = f"{prenom} {nom}".strip().lower()

        correspond = False
        score_similarite = 0.0

        if type_recherche in ("tout", "nom"):
            if query_lower in nom_complet or query_lower in prenom.lower() or query_lower in nom.lower():
                correspond = True
                score_similarite = max(score_similarite, _calculer_similarite(query_lower, nom_complet), _calculer_similarite(query_lower, prenom.lower()))

        if type_recherche in ("tout", "digiid"):
            if query_lower in digiid.lower():
                correspond = True
                score_similarite = max(score_similarite, _calculer_similarite(query_lower, digiid.lower()))

        if type_recherche in ("tout", "email"):
            if query_lower in email.lower():
                correspond = True
                score_similarite = max(score_similarite, _calculer_similarite(query_lower, email.lower()))

        if type_recherche in ("tout", "telephone"):
            if telephone and query_lower in telephone.lower():
                correspond = True
                score_similarite = max(score_similarite, _calculer_similarite(query_lower, telephone.lower()))

        if type_recherche in ("tout", "cni"):
            result_cni = await session.execute(
                select(VerificationCNI)
                .where(VerificationCNI.utilisateur_id == utilisateur_cible.id, VerificationCNI.est_supprime == False, VerificationCNI.numero_cni.ilike(f"%{query_clean}%"))
                .limit(1)
            )
            if result_cni.scalar_one_or_none():
                correspond = True
                score_similarite = max(score_similarite, 0.95)

        if not correspond:
            continue

        if filtre_score_min is not None and (utilisateur_cible.score_actuel or 0) < filtre_score_min:
            continue
        if filtre_score_max is not None and (utilisateur_cible.score_actuel or 0) > filtre_score_max:
            continue
        if filtre_ville and filtre_ville.lower() not in (utilisateur_cible.ville or "").lower():
            continue

        if utilisateur_cible.id in utilisateurs_vus:
            continue
        utilisateurs_vus.add(utilisateur_cible.id)

        docs = await session.execute(
            select(DocumentIdentite).where(DocumentIdentite.utilisateur_id == utilisateur_cible.id, DocumentIdentite.est_actif == True)
        )
        documents = docs.scalars().all()
        a_permis = any(d.type_document == "permis" for d in documents)
        a_assurance = any(d.type_document == "assurance" for d in documents)

        result_cni = await session.execute(
            select(VerificationCNI)
            .where(VerificationCNI.utilisateur_id == utilisateur_cible.id, VerificationCNI.est_supprime == False)
            .order_by(VerificationCNI.date_traitement.desc())
            .limit(1)
        )
        verif_cni = result_cni.scalar_one_or_none()

        resultats.append({
            "digiid": digiid,
            "nom": nom_complet.title(),
            "email": email,
            "telephone": telephone,
            "score": utilisateur_cible.score_actuel or 0,
            "est_actif": utilisateur_cible.est_actif,
            "est_verifie": utilisateur_cible.est_cni_verifiee or utilisateur_cible.est_visage_verifie,
            "ville": utilisateur_cible.ville or "",
            "pays": utilisateur_cible.pays or "",
            "photo_url": None,
            "numero_cni": verif_cni.numero_cni if verif_cni else None,
            "a_permis": a_permis,
            "a_assurance": a_assurance,
            "score_similarite": round(score_similarite, 4),
        })

    resultats.sort(key=lambda r: r["score_similarite"] or 0, reverse=True)
    total = len(resultats)
    offset = (page - 1) * limite
    resultats_page = resultats[offset:offset + limite]
    temps = (time.time() - debut) * 1000

    if utilisateur:
        await _enregistrer_recherche(session, utilisateur.id, type_recherche, query_clean, total, utilisateur)

    return resultats_page, total, round(temps, 2)


def _calculer_similarite(terme: str, cible: str) -> float:
    """Calcule un score de similarité simple (0-1)."""
    if not terme or not cible:
        return 0.0
    if terme == cible:
        return 1.0
    if terme in cible:
        return 0.8 + (len(terme) / len(cible)) * 0.2
    distance = _levenshtein(terme, cible[:len(terme)] if len(cible) > len(terme) else cible)
    max_len = max(len(terme), len(cible))
    if max_len == 0:
        return 1.0
    return max(0, 1.0 - distance / max_len)


def _levenshtein(a: str, b: str) -> int:
    """Distance de Levenshtein."""
    if len(a) < len(b):
        a, b = b, a
    if len(b) == 0:
        return len(a)
    prev_row = range(len(b) + 1)
    for i, ca in enumerate(a):
        curr_row = [i + 1]
        for j, cb in enumerate(b):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (ca != cb)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]


# =============================================================================
# PROFIL DÉTAILLÉ D'UNE PERSONNE
# =============================================================================

async def obtenir_profil_personne(
    session: AsyncSession,
    digiid: str,
    utilisateur: Utilisateur,  # Changé de officier_id à utilisateur complet
) -> dict:
    """Obtient le profil détaillé d'une personne pour un officier."""
    result = await session.execute(
        select(Utilisateur).where(Utilisateur.digiid_public == digiid)
    )
    utilisateur_cible = result.scalar_one_or_none()

    if not utilisateur_cible:
        raise ErreurRessourceIntrouvable(
            f"Personne avec DigiID {digiid} introuvable.",
            message_utilisateur="Aucune personne trouvée avec cet identifiant.",
        )

    # --- Cloisonnement : vérifier que l'officier peut voir ce profil (NOUVEAU) ---
    if not _est_super_admin(utilisateur):
        if utilisateur.domaine_id and utilisateur_cible.domaine_id != utilisateur.domaine_id:
            raise ErreurRessourceIntrouvable(
                "Accès refusé : cette personne n'est pas dans votre domaine.",
                message_utilisateur="Vous n'avez pas accès à ce profil.",
            )
        if utilisateur.role not in ["admin_domaine"] and utilisateur.departement_id and utilisateur_cible.departement_id != utilisateur.departement_id:
            raise ErreurRessourceIntrouvable(
                "Accès refusé : cette personne n'est pas dans votre département.",
                message_utilisateur="Vous n'avez pas accès à ce profil.",
            )

    prenom = dechiffrer_donnee(utilisateur_cible.prenom_chiffre) if utilisateur_cible.prenom_chiffre else ""
    nom = dechiffrer_donnee(utilisateur_cible.nom_chiffre) if utilisateur_cible.nom_chiffre else ""
    email = dechiffrer_donnee(utilisateur_cible.email_chiffre) if utilisateur_cible.email_chiffre else ""
    telephone = dechiffrer_donnee(utilisateur_cible.telephone_chiffre) if utilisateur_cible.telephone_chiffre else ""

    docs = await session.execute(
        select(DocumentIdentite).where(DocumentIdentite.utilisateur_id == utilisateur_cible.id, DocumentIdentite.est_actif == True)
    )
    documents = []
    for d in docs.scalars().all():
        documents.append({
            "type_document": d.type_document,
            "numero": d.numero_document,
            "nom_complet": d.nom_complet,
            "date_expiration": d.date_expiration.isoformat() if d.date_expiration else None,
            "est_valide": d.date_expiration is None or (d.date_expiration if isinstance(d.date_expiration, datetime) else datetime.combine(d.date_expiration, datetime.min.time())) >= datetime.now(UTC),
            "photo_url": None,
        })

    signalements = await session.execute(
        select(SignalementFraude).where(SignalementFraude.personne_digiid == digiid).order_by(SignalementFraude.date_signalement.desc()).limit(20)
    )
    verifs = await session.execute(
        select(VerificationPolice).where(VerificationPolice.personne_digiid == digiid).order_by(VerificationPolice.date_verification.desc()).limit(20)
    )
    verifications_list = []
    for v in verifs.scalars().all():
        off_result = await session.execute(select(Utilisateur).where(Utilisateur.id == v.officier_id))
        off = off_result.scalar_one_or_none()
        off_nom = None
        if off:
            off_prenom = dechiffrer_donnee(off.prenom_chiffre) if off.prenom_chiffre else ""
            off_nom_dechiffre = dechiffrer_donnee(off.nom_chiffre) if off.nom_chiffre else ""
            off_nom = f"{off_prenom} {off_nom_dechiffre}".strip()
        verifications_list.append({
            "id": v.id,
            "officier_nom": off_nom,
            "type_verification": v.type_verification,
            "resultat": v.resultat,
            "motif_verification": v.motif_verification,
            "date_verification": v.date_verification,
            "notes": v.notes,
        })

    notes = await session.execute(
        select(NoteInternePolice).where(NoteInternePolice.personne_digiid == digiid).order_by(NoteInternePolice.date_creation.desc()).limit(20)
    )

    return {
        "digiid": utilisateur_cible.digiid_public or "",
        "nom": f"{prenom} {nom}".strip(),
        "email": email,
        "telephone": telephone,
        "ville": utilisateur_cible.ville or "",
        "pays": utilisateur_cible.pays or "",
        "photo_url": None,
        "role": utilisateur_cible.role,
        "score": utilisateur_cible.score_actuel or 0,
        "est_actif": utilisateur_cible.est_actif,
        "est_email_verifie": utilisateur_cible.est_email_verifie,
        "est_visage_verifie": utilisateur_cible.est_visage_verifie,
        "est_cni_verifiee": utilisateur_cible.est_cni_verifiee,
        "date_inscription": utilisateur_cible.cree_le,
        "documents": documents,
        "signalements": [{"id": s.id, "officier_id": s.officier_id, "personne_digiid": s.personne_digiid, "motif": s.motif, "description": s.description, "statut": s.statut, "priorite": s.priorite, "date_signalement": s.date_signalement, "date_traitement": s.date_traitement} for s in signalements.scalars().all()],
        "verifications_precedentes": verifications_list,
        "notes_internes": [{"id": n.id, "officier_id": n.officier_id, "personne_digiid": n.personne_digiid, "titre": n.titre, "contenu": n.contenu, "categorie": n.categorie, "est_important": n.est_important, "est_partagee": n.est_partagee, "date_creation": n.date_creation, "date_modification": n.date_modification} for n in notes.scalars().all()],
    }


# =============================================================================
# SIGNALEMENTS DE FRAUDE
# =============================================================================

async def creer_signalement(session: AsyncSession, officier: Utilisateur, data: dict) -> SignalementFraude:
    """Crée un nouveau signalement de fraude avec cloisonnement."""
    data.pop("personne_id", None)
    signalement = SignalementFraude(
        officier_id=officier.id,
        domaine_id=officier.domaine_id,
        departement_id=officier.departement_id,
        **data
    )
    session.add(signalement)
    await session.commit()
    await session.refresh(signalement)
    return signalement


async def obtenir_signalements(
    session: AsyncSession,
    utilisateur: Utilisateur,  # Changé de officier_id à utilisateur complet
    statut: Optional[str] = None,
    limite: int = 50,
    page: int = 1,
) -> tuple[list[SignalementFraude], int]:
    """Liste les signalements avec pagination, filtre et cloisonnement."""
    query = select(SignalementFraude).order_by(SignalementFraude.date_signalement.desc())
    
    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, SignalementFraude)
    
    if not _est_super_admin(utilisateur):
        query = query.where(SignalementFraude.officier_id == utilisateur.id)
    
    if statut:
        query = query.where(SignalementFraude.statut == statut)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * limite
    query = query.offset(offset).limit(limite)
    result = await session.execute(query)
    return list(result.scalars().all()), total


async def traiter_signalement(
    session: AsyncSession,
    signalement_id: UUID,
    utilisateur: Utilisateur,  # Changé de officier_id à utilisateur complet
    data: dict,
) -> SignalementFraude:
    """Traite un signalement (changer statut, ajouter notes)."""
    result = await session.execute(select(SignalementFraude).where(SignalementFraude.id == signalement_id))
    signalement = result.scalar_one_or_none()
    if not signalement:
        raise ErreurRessourceIntrouvable("Signalement introuvable.")
    
    signalement.statut = data.get("statut", signalement.statut)
    signalement.notes_traitement = data.get("notes_traitement", signalement.notes_traitement)
    signalement.traite_par_id = utilisateur.id
    signalement.date_traitement = datetime.now(UTC)
    await session.commit()
    await session.refresh(signalement)
    return signalement


# =============================================================================
# NOTES INTERNES
# =============================================================================

async def creer_note(session: AsyncSession, officier: Utilisateur, data: dict) -> NoteInternePolice:
    """Crée une note interne sur une personne avec cloisonnement."""
    note = NoteInternePolice(
        officier_id=officier.id,
        domaine_id=officier.domaine_id,
        departement_id=officier.departement_id,
        **data
    )
    session.add(note)
    await session.commit()
    await session.refresh(note)
    return note


async def obtenir_notes(
    session: AsyncSession,
    utilisateur: Utilisateur,  # Changé de officier_id à utilisateur complet
    personne_digiid: Optional[str] = None,
    categorie: Optional[str] = None,
    limite: int = 50,
) -> tuple[list[NoteInternePolice], int]:
    """Liste les notes internes avec filtres et cloisonnement."""
    query = select(NoteInternePolice).order_by(NoteInternePolice.date_creation.desc())
    
    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, NoteInternePolice)
    
    if not _est_super_admin(utilisateur):
        query = query.where(NoteInternePolice.officier_id == utilisateur.id)
    
    if personne_digiid:
        query = query.where(NoteInternePolice.personne_digiid == personne_digiid)
    if categorie:
        query = query.where(NoteInternePolice.categorie == categorie)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = query.limit(limite)
    result = await session.execute(query)
    return list(result.scalars().all()), total


async def modifier_note(session: AsyncSession, note_id: UUID, utilisateur: Utilisateur, data: dict) -> NoteInternePolice:
    """Modifie une note interne."""
    result = await session.execute(select(NoteInternePolice).where(NoteInternePolice.id == note_id, NoteInternePolice.officier_id == utilisateur.id))
    note = result.scalar_one_or_none()
    if not note:
        raise ErreurRessourceIntrouvable("Note introuvable ou non autorisée.")
    for key, value in data.items():
        if value is not None:
            setattr(note, key, value)
    note.date_modification = datetime.now(UTC)
    await session.commit()
    await session.refresh(note)
    return note


async def supprimer_note(session: AsyncSession, note_id: UUID, utilisateur: Utilisateur) -> bool:
    """Supprime une note interne."""
    result = await session.execute(select(NoteInternePolice).where(NoteInternePolice.id == note_id, NoteInternePolice.officier_id == utilisateur.id))
    note = result.scalar_one_or_none()
    if not note:
        raise ErreurRessourceIntrouvable("Note introuvable ou non autorisée.")
    await session.delete(note)
    await session.commit()
    return True


# =============================================================================
# ALERTES EN TEMPS RÉEL
# =============================================================================

async def creer_alerte(session: AsyncSession, officier: Utilisateur, data: dict) -> AlertePolice:
    """Crée une alerte pour un officier avec cloisonnement."""
    alerte = AlertePolice(
        officier_id=officier.id,
        domaine_id=officier.domaine_id,
        departement_id=officier.departement_id,
        **data
    )
    session.add(alerte)
    await session.commit()
    await session.refresh(alerte)
    return alerte


async def obtenir_alertes(
    session: AsyncSession,
    utilisateur: Utilisateur,  # Changé de officier_id à utilisateur complet
    non_lues_seulement: bool = False,
    limite: int = 50,
) -> tuple[list[AlertePolice], int, int]:
    """Liste les alertes d'un officier avec cloisonnement."""
    query = select(AlertePolice).where(AlertePolice.est_active == True).order_by(AlertePolice.date_creation.desc())
    
    # --- Cloisonnement (NOUVEAU) ---
    query = _appliquer_filtres_cloisonnement(query, utilisateur, AlertePolice)
    
    if not _est_super_admin(utilisateur):
        query = query.where(AlertePolice.officier_id == utilisateur.id)
    
    if non_lues_seulement:
        query = query.where(AlertePolice.est_lue == False)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    non_lues_query = select(func.count()).where(AlertePolice.est_lue == False, AlertePolice.est_active == True)
    if not _est_super_admin(utilisateur):
        non_lues_query = non_lues_query.where(AlertePolice.officier_id == utilisateur.id)
    non_lues_result = await session.execute(non_lues_query)
    non_lues = non_lues_result.scalar() or 0

    query = query.limit(limite)
    result = await session.execute(query)
    return list(result.scalars().all()), total, non_lues


async def marquer_alerte_lue(session: AsyncSession, alerte_id: UUID, utilisateur: Utilisateur) -> AlertePolice:
    """Marque une alerte comme lue."""
    result = await session.execute(select(AlertePolice).where(AlertePolice.id == alerte_id, AlertePolice.officier_id == utilisateur.id))
    alerte = result.scalar_one_or_none()
    if not alerte:
        raise ErreurRessourceIntrouvable("Alerte introuvable.")
    alerte.est_lue = True
    alerte.date_lecture = datetime.now(UTC)
    await session.commit()
    await session.refresh(alerte)
    return alerte


async def creer_alerte_pour_tous(
    session: AsyncSession, type_alerte: str, titre: str, message: str,
    niveau: str = "info", donnees_liees: Optional[dict] = None,
) -> int:
    """Crée une alerte pour TOUS les officiers de police."""
    result = await session.execute(select(Utilisateur).where(Utilisateur.role == "police", Utilisateur.est_actif == True))
    officiers = result.scalars().all()
    nb_alertes = 0
    for off in officiers:
        alerte = AlertePolice(
            officier_id=off.id,
            type_alerte=type_alerte,
            titre=titre,
            message=message,
            niveau=niveau,
            donnees_liees=donnees_liees,
            domaine_id=off.domaine_id,
            departement_id=off.departement_id,
        )
        session.add(alerte)
        nb_alertes += 1
    await session.commit()
    journal.info(f"Alertes créées pour {nb_alertes} officiers: {titre}")
    return nb_alertes


# =============================================================================
# STATISTIQUES / DASHBOARD
# =============================================================================
# Suite du fichier service.py - Reprend depuis obtenir_statistiques

async def obtenir_statistiques(session: AsyncSession, utilisateur: Utilisateur) -> dict:
    """Obtient les statistiques pour le dashboard avec cloisonnement."""
    aujourdhui = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # --- Cloisonnement : base queries (NOUVEAU) ---
    base_query_verif = select(VerificationPolice)
    base_query_signalement = select(SignalementFraude)
    base_query_alerte = select(AlertePolice)
    base_query_note = select(NoteInternePolice)
    base_query_historique = select(HistoriqueRecherchePolice)
    
    if not _est_super_admin(utilisateur):
        base_query_verif = base_query_verif.where(VerificationPolice.officier_id == utilisateur.id)
        base_query_signalement = base_query_signalement.where(SignalementFraude.officier_id == utilisateur.id)
        base_query_alerte = base_query_alerte.where(AlertePolice.officier_id == utilisateur.id)
        base_query_note = base_query_note.where(NoteInternePolice.officier_id == utilisateur.id)
        base_query_historique = base_query_historique.where(HistoriqueRecherchePolice.officier_id == utilisateur.id)

    result = await session.execute(select(func.count()).select_from(base_query_verif.subquery()))
    total_verifs = result.scalar() or 0

    result = await session.execute(select(func.count()).select_from(base_query_verif.where(VerificationPolice.date_verification >= aujourdhui).subquery()))
    verifs_aujourdhui = result.scalar() or 0

    result = await session.execute(select(func.count()).select_from(base_query_signalement.subquery()))
    total_signalements = result.scalar() or 0

    result = await session.execute(select(func.count()).select_from(base_query_signalement.where(SignalementFraude.statut == "en_cours").subquery()))
    signalements_en_cours = result.scalar() or 0

    result = await session.execute(select(func.count()).select_from(base_query_signalement.where(SignalementFraude.statut == "traite").subquery()))
    signalements_traites = result.scalar() or 0

    result = await session.execute(select(func.count()).select_from(base_query_alerte.where(AlertePolice.est_lue == False, AlertePolice.est_active == True).subquery()))
    alertes_non_lues = result.scalar() or 0

    result = await session.execute(select(func.count()).select_from(base_query_note.subquery()))
    notes_total = result.scalar() or 0

    result = await session.execute(select(func.count()).select_from(base_query_historique.subquery()))
    personnes_recherchees = result.scalar() or 0

    result = await session.execute(select(func.count()).select_from(base_query_verif.where(VerificationPolice.resultat == "confirme").subquery()))
    confirme = result.scalar() or 0
    taux_confirmation = round((confirme / total_verifs) * 100, 1) if total_verifs > 0 else None

    # Récupérer les récents (limité à 5)
    verifs_result = await session.execute(base_query_verif.order_by(VerificationPolice.date_verification.desc()).limit(5))
    verifs = verifs_result.scalars().all()
    
    signalements_result = await session.execute(base_query_signalement.order_by(SignalementFraude.date_signalement.desc()).limit(5))
    signalements = signalements_result.scalars().all()
    
    alertes_result = await session.execute(base_query_alerte.order_by(AlertePolice.date_creation.desc()).limit(5))
    alertes = alertes_result.scalars().all()

    return {
        "total_verifications": total_verifs,
        "verifications_aujourdhui": verifs_aujourdhui,
        "total_signalements": total_signalements,
        "signalements_en_cours": signalements_en_cours,
        "signalements_traites": signalements_traites,
        "alertes_non_lues": alertes_non_lues,
        "notes_total": notes_total,
        "personnes_recherchees": personnes_recherchees,
        "taux_confirmation": taux_confirmation,
        "verification_recents": [{"id": v.id, "officier_id": v.officier_id, "personne_digiid": v.personne_digiid, "personne_nom": v.personne_nom, "type_verification": v.type_verification, "motif_verification": v.motif_verification, "resultat": v.resultat, "notes": v.notes, "date_verification": v.date_verification, "est_signalement_fraude": v.est_signalement_fraude} for v in verifs],
        "signalements_recents": [{"id": s.id, "officier_id": s.officier_id, "personne_digiid": s.personne_digiid, "motif": s.motif, "description": s.description, "statut": s.statut, "priorite": s.priorite, "date_signalement": s.date_signalement} for s in signalements],
        "alertes_recents": [{"id": a.id, "type_alerte": a.type_alerte, "titre": a.titre, "message": a.message, "niveau": a.niveau, "est_lue": a.est_lue, "date_creation": a.date_creation} for a in alertes],
        "activite_dernieres_heures": [],
    }


# =============================================================================
# CARTE GÉOGRAPHIQUE
# =============================================================================

async def obtenir_points_carte(session: AsyncSession, utilisateur: Utilisateur, limite: int = 100) -> dict:
    """Obtient les points pour la carte géographique avec cloisonnement."""
    query = select(VerificationPolice).where(
        VerificationPolice.localisation_lat.isnot(None),
        VerificationPolice.localisation_lng.isnot(None)
    ).order_by(VerificationPolice.date_verification.desc())
    
    # --- Cloisonnement (NOUVEAU) ---
    if not _est_super_admin(utilisateur):
        query = query.where(VerificationPolice.officier_id == utilisateur.id)
        if utilisateur.domaine_id:
            query = query.where(VerificationPolice.domaine_id == utilisateur.domaine_id)
        if utilisateur.role not in ["admin_domaine"] and utilisateur.departement_id:
            query = query.where(VerificationPolice.departement_id == utilisateur.departement_id)
    
    query = query.limit(limite)
    result = await session.execute(query)
    verifications = result.scalars().all()
    
    points = []
    for v in verifications:
        points.append({
            "lat": v.localisation_lat,
            "lng": v.localisation_lng,
            "adresse": v.localisation_adresse,
            "titre": f"{v.personne_nom or v.personne_digiid} - {v.type_verification}",
            "type": v.resultat or "en_cours",
            "date": v.date_verification,
            "verification_id": v.id
        })
    
    centre_lat = sum(p["lat"] for p in points) / len(points) if points else None
    centre_lng = sum(p["lng"] for p in points) / len(points) if points else None
    
    return {
        "points": points,
        "total": len(points),
        "centre_lat": centre_lat,
        "centre_lng": centre_lng
    }


# =============================================================================
# SCAN QR
# =============================================================================

async def scanner_qr(session: AsyncSession, digiid: str, utilisateur: Utilisateur) -> dict:
    """Traite un scan de QR code citoyen avec cloisonnement."""
    result = await session.execute(select(Utilisateur).where(Utilisateur.digiid_public == digiid))
    utilisateur_cible = result.scalar_one_or_none()
    
    if not utilisateur_cible:
        raise ErreurRessourceIntrouvable(
            f"DigiID {digiid} introuvable.",
            message_utilisateur="Ce code QR n'est pas reconnu dans le système."
        )
    
    # --- Cloisonnement : vérifier l'accès (NOUVEAU) ---
    if not _est_super_admin(utilisateur):
        if utilisateur.domaine_id and utilisateur_cible.domaine_id != utilisateur.domaine_id:
            raise ErreurRessourceIntrouvable(
                "Accès refusé : cette personne n'est pas dans votre domaine.",
                message_utilisateur="Vous n'avez pas accès à ce profil."
            )
        if utilisateur.role not in ["admin_domaine"] and utilisateur.departement_id and utilisateur_cible.departement_id != utilisateur.departement_id:
            raise ErreurRessourceIntrouvable(
                "Accès refusé : cette personne n'est pas dans votre département.",
                message_utilisateur="Vous n'avez pas accès à ce profil."
            )
    
    prenom = dechiffrer_donnee(utilisateur_cible.prenom_chiffre) if utilisateur_cible.prenom_chiffre else ""
    nom = dechiffrer_donnee(utilisateur_cible.nom_chiffre) if utilisateur_cible.nom_chiffre else ""
    
    docs = await session.execute(
        select(DocumentIdentite).where(
            DocumentIdentite.utilisateur_id == utilisateur_cible.id,
            DocumentIdentite.est_actif == True
        )
    )
    documents = []
    for d in docs.scalars().all():
        documents.append({
            "type_document": d.type_document,
            "numero": d.numero_document,
            "nom_complet": d.nom_complet,
            "date_expiration": d.date_expiration.isoformat() if d.date_expiration else None,
            "est_valide": d.date_expiration is None or (d.date_expiration if isinstance(d.date_expiration, datetime) else datetime.combine(d.date_expiration, datetime.min.time())) >= datetime.now(UTC)
        })
    
    return {
        "digiid": utilisateur_cible.digiid_public or "",
        "nom": f"{prenom} {nom}".strip(),
        "email": dechiffrer_donnee(utilisateur_cible.email_chiffre) if utilisateur_cible.email_chiffre else "",
        "photo_url": None,
        "est_actif": utilisateur_cible.est_actif,
        "est_verifie": utilisateur_cible.est_cni_verifiee or utilisateur_cible.est_visage_verifie,
        "documents": documents
    }


# =============================================================================
# HISTORIQUE
# =============================================================================

async def obtenir_historique_complet(session: AsyncSession, utilisateur: Utilisateur, type_historique: Optional[str] = None, limite: int = 50) -> dict:
    """Obtient l'historique complet des activités avec cloisonnement."""
    resultats = {}
    
    if not type_historique or type_historique == "verifications":
        verifs, total_v = await obtenir_verifications(session, utilisateur, limite)
        resultats["verifications"] = [
            {
                "id": v.id,
                "personne_digiid": v.personne_digiid,
                "personne_nom": v.personne_nom,
                "type_verification": v.type_verification,
                "motif_verification": v.motif_verification,
                "resultat": v.resultat,
                "notes": v.notes,
                "date_verification": v.date_verification,
                "est_signalement_fraude": v.est_signalement_fraude
            } for v in verifs
        ]
        resultats["total_verifications"] = total_v
    
    if not type_historique or type_historique == "signalements":
        signalements, total_s = await obtenir_signalements(session, utilisateur, limite=limite)
        resultats["signalements"] = [
            {
                "id": s.id,
                "personne_digiid": s.personne_digiid,
                "motif": s.motif,
                "statut": s.statut,
                "priorite": s.priorite,
                "date_signalement": s.date_signalement
            } for s in signalements
        ]
        resultats["total_signalements"] = total_s
    
    if not type_historique or type_historique == "recherches":
        query = select(HistoriqueRecherchePolice).order_by(HistoriqueRecherchePolice.date_recherche.desc()).limit(limite)
        
        # --- Cloisonnement (NOUVEAU) ---
        if not _est_super_admin(utilisateur):
            query = query.where(HistoriqueRecherchePolice.officier_id == utilisateur.id)
        
        result = await session.execute(query)
        recherches = result.scalars().all()
        resultats["recherches"] = [
            {
                "id": r.id,
                "type_recherche": r.type_recherche,
                "terme_recherche": r.terme_recherche,
                "resultats_trouves": r.resultats_trouves,
                "date_recherche": r.date_recherche
            } for r in recherches
        ]
        resultats["total_recherches"] = len(recherches)
    
    return resultats


# =============================================================================
# EXPORT DE RAPPORT
# =============================================================================

async def generer_rapport(
    session: AsyncSession,
    utilisateur: Utilisateur,
    date_debut: Optional[datetime] = None,
    date_fin: Optional[datetime] = None,
    format: str = "json",
    type_donnees: list[str] = None,
) -> dict:
    """Génère un rapport exportable avec cloisonnement."""
    if type_donnees is None:
        type_donnees = ["verifications", "signalements"]
    
    rapport = {
        "officier_id": str(utilisateur.id),
        "date_generation": datetime.now(UTC).isoformat(),
        "periode": {
            "debut": date_debut.isoformat() if date_debut else None,
            "fin": date_fin.isoformat() if date_fin else None
        },
        "donnees": {}
    }
    
    base_query_verif = select(VerificationPolice)
    base_query_signal = select(SignalementFraude)
    
    # --- Cloisonnement (NOUVEAU) ---
    if not _est_super_admin(utilisateur):
        base_query_verif = base_query_verif.where(VerificationPolice.officier_id == utilisateur.id)
        base_query_signal = base_query_signal.where(SignalementFraude.officier_id == utilisateur.id)
        if utilisateur.domaine_id:
            base_query_verif = base_query_verif.where(VerificationPolice.domaine_id == utilisateur.domaine_id)
            base_query_signal = base_query_signal.where(SignalementFraude.domaine_id == utilisateur.domaine_id)
        if utilisateur.role not in ["admin_domaine"] and utilisateur.departement_id:
            base_query_verif = base_query_verif.where(VerificationPolice.departement_id == utilisateur.departement_id)
            base_query_signal = base_query_signal.where(SignalementFraude.departement_id == utilisateur.departement_id)
    
    if date_debut:
        base_query_verif = base_query_verif.where(VerificationPolice.date_verification >= date_debut)
        base_query_signal = base_query_signal.where(SignalementFraude.date_signalement >= date_debut)
    if date_fin:
        base_query_verif = base_query_verif.where(VerificationPolice.date_verification <= date_fin)
        base_query_signal = base_query_signal.where(SignalementFraude.date_signalement <= date_fin)
    
    if "verifications" in type_donnees:
        result = await session.execute(base_query_verif.order_by(VerificationPolice.date_verification.desc()))
        verifs = result.scalars().all()
        rapport["donnees"]["verifications"] = [
            {
                "personne_digiid": v.personne_digiid,
                "personne_nom": v.personne_nom,
                "type": v.type_verification,
                "motif": v.motif_verification,
                "resultat": v.resultat,
                "date": v.date_verification.isoformat()
            } for v in verifs
        ]
        rapport["donnees"]["total_verifications"] = len(verifs)
    
    if "signalements" in type_donnees:
        result = await session.execute(base_query_signal.order_by(SignalementFraude.date_signalement.desc()))
        signalements = result.scalars().all()
        rapport["donnees"]["signalements"] = [
            {
                "personne_digiid": s.personne_digiid,
                "motif": s.motif,
                "statut": s.statut,
                "priorite": s.priorite,
                "date": s.date_signalement.isoformat()
            } for s in signalements
        ]
        rapport["donnees"]["total_signalements"] = len(signalements)
    
    return rapport


# =============================================================================
# COMPARAISON DE PHOTOS
# =============================================================================

async def comparer_photos(
    session: AsyncSession,
    photo_source: str,
    photo_cible: str,
) -> dict:
    """Compare deux photos pour la reconnaissance faciale."""
    import base64
    from src.modules.verification_visuelle.embedding_facial import (
        generer_embedding,
        calculer_similarite,
    )
    
    try:
        source_bytes = base64.b64decode(photo_source)
        cible_bytes = base64.b64decode(photo_cible)
        debut = time.time()
        embedding_source = generer_embedding(source_bytes, dimension=512)
        embedding_cible = generer_embedding(cible_bytes, dimension=512)
        score = calculer_similarite(embedding_source, embedding_cible)
        temps = (time.time() - debut) * 1000
        
        return {
            "score_similarite": round(float(score), 4),
            "est_compatible": bool(score >= 0.75),
            "seuil_requis": 0.75,
            "temps_analyse_ms": round(temps, 2),
            "details": {
                "algorithme": "sha512_embedding",
                "dimension": 512
            }
        }
    except Exception as e:
        score = 0.5
        return {
            "score_similarite": score,
            "est_compatible": score >= 0.75,
            "seuil_requis": 0.75,
            "temps_analyse_ms": 0,
            "details": {
                "mode": "fallback",
                "erreur": str(e)[:200],
                "message": "Algorithme principal indisponible, fallback utilisé"
            }
        }


# =============================================================================
# FONCTIONS PRIVÉES
# =============================================================================

async def _enregistrer_recherche(
    session: AsyncSession,
    officier_id: UUID,
    type_recherche: str,
    terme: str,
    resultats: int,
    utilisateur: Optional[Utilisateur] = None,
) -> None:
    """Enregistre une recherche dans l'historique avec cloisonnement."""
    historique = HistoriqueRecherchePolice(
        officier_id=officier_id,
        type_recherche=type_recherche,
        terme_recherche=terme[:255],
        resultats_trouves=resultats,
    )
    
    # --- Cloisonnement automatique (NOUVEAU) ---
    if utilisateur:
        historique.domaine_id = utilisateur.domaine_id
        historique.departement_id = utilisateur.departement_id
    
    session.add(historique)
    await session.commit()