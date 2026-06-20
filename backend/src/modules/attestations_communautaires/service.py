# -*- coding: utf-8 -*-
"""
Service — Logique métier des attestations communautaires.

Contient toute la logique décisionnelle :
  - Création d'attestation (avec vérifications d'intégrité)
  - Approbation / Refus avec mise à jour du score
  - Calcul des métriques et statistiques
  - Gestion du cycle de vie (expiration, désactivation)

Ce module est purement métier : il ne dépend pas de FastAPI,
uniquement des modèles SQLAlchemy et du repository.
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import AttestationCommunautaire, Utilisateur
from src.noyau.chiffrement import dechiffrer_donnee
from src.modules.scoring.service import calculer_et_enregistrer_score
from src.modules.attestations_communautaires.repository import (
    AttestationRepository,
)
from src.modules.attestations_communautaires.schemas import (
    CreationAttestation,
    DecisionAttestation,
    MiseAJourAttestation,
    AttestationDetail,
    AttestationResume,
    ListeAttestations,
    StatistiquesAttestations,
    ResultatCreation,
    ResultatDecision,
    TYPES_ATTESTATION,
)

journal = logging.getLogger("digiid.attestations")


class ServiceAttestations:
    """
    Service métier des attestations communautaires.
    Orchestre la création, la gestion des décisions et les statistiques.
    """

    # Limites de taux pour éviter les abus
    LIMITE_MAX_ATTESTATIONS_ACTIVES_PAR_UTILISATEUR = 50
    LIMITE_MAX_ATTESTATIONS_PAR_JOUR = 10

    def __init__(self, session: AsyncSession):
        """
        Initialise le service avec une session SQLAlchemy.

        Args:
            session: Session asynchrone SQLAlchemy
        """
        self.session = session
        self.repository = AttestationRepository()

    # ========================================================================
    # Création
    # ========================================================================

    async def creer_attestation(
        self,
        attestant: Utilisateur,
        donnees: CreationAttestation,
    ) -> ResultatCreation:
        """
        Crée une nouvelle attestation communautaire après vérifications.

        Étapes :
          1. Recherche de l'utilisateur attesté par son DigiID public
          2. Vérification que l'attestant et l'attesté sont différents
          3. Vérification qu'aucune attestation active n'existe déjà
          4. Vérification des limites de taux
          5. Création et persistance de l'attestation

        Args:
            attestant: Utilisateur authentifié (celui qui atteste)
            donnees: Données de création validées

        Returns:
            ResultatCreation avec l'attestation créée

        Raises:
            ValueError: Si l'utilisateur attesté n'est pas trouvé
            ValueError: Si auto-attestation
            ValueError: Si attestation en double
            ValueError: Si limite de taux dépassée
        """
        # --- 1. Rechercher l'utilisateur attesté ---
        atteste = await self._rechercher_par_digiid(donnees.atteste_digiid)
        if not atteste:
            raise ValueError(
                f"Aucun utilisateur trouvé avec le DigiID : {donnees.atteste_digiid}"
            )

        # --- 2. Pas d'auto-attestation ---
        if attestant.id == atteste.id:
            raise ValueError("Vous ne pouvez pas vous attester vous-même.")

        # --- 3. Pas de doublon actif ---
        existe_deja = await self.repository.verifier_existence_attestation_active(
            self.session, attestant.id, atteste.id
        )
        if existe_deja:
            raise ValueError(
                "Une attestation active existe déjà entre vous et cet utilisateur."
            )

        # --- 4. Vérifier les limites de taux ---
        await self._verifier_limites(attestant)

        # --- 5. Créer l'attestation ---
        attestation = AttestationCommunautaire(
            attestant_id=attestant.id,
            atteste_id=atteste.id,
            type_attestation=donnees.type_attestation,
            titre=donnees.titre,
            description=donnees.description,
            forces=donnees.forces,
            lien_connu_depuis=donnees.lien_connu_depuis,
            lien_nature=donnees.lien_nature,
            poids_score=donnees.poids_score,
            est_visible_public=donnees.est_visible_public,
            statut="EN_ATTENTE",
            est_active=True,
            date_soumission=datetime.now(timezone.utc),
        )

        attestation_creee = await self.repository.creer(self.session, attestation)

        # --- 6. Journalisation ---
        journal.info(
            "Attestation créée | id=%s | attestant=%s | attesté=%s | type=%s",
            attestation_creee.id,
            attestant.digiid_public,
            atteste.digiid_public,
            donnees.type_attestation,
        )

        return ResultatCreation(
            message="Attestation créée avec succès. En attente de l'approbation de la personne attestée.",
            attestation=self._vers_detail(
                await self._enregistrer_et_retourner(attestation_creee)
            ),
        )

    async def _enregistrer_et_retourner(
        self,
        attestation: AttestationCommunautaire,
    ) -> AttestationCommunautaire:
        """
        Sauvegarde les modifications et recharge les relations.
        Appelée après chaque opération d'écriture.
        """
        await self.session.commit()
        await self.session.refresh(attestation)
        # Recharger les relations
        from sqlalchemy import select
        from sqlalchemy.orm import joinedload
        resultat = await self.session.execute(
            select(AttestationCommunautaire)
            .options(
                joinedload(AttestationCommunautaire.attestant),
                joinedload(AttestationCommunautaire.atteste),
            )
            .where(AttestationCommunautaire.id == attestation.id)
        )
        return resultat.unique().scalar_one()

    # ========================================================================
    # Modération admin
    # ========================================================================

    async def lister_toutes_attestations(
        self,
        utilisateur: Utilisateur,
        statut: Optional[str] = None,
        type_attestation: Optional[str] = None,
        utilisateur_id: Optional[UUID] = None,
        page: int = 1,
        limite: int = 20,
    ) -> ListeAttestations:
        """
        Liste TOUTES les attestations du système (réservé aux admins).

        Args:
            utilisateur: Administrateur connecté
            statut: Filtre par statut
            type_attestation: Filtre par type
            utilisateur_id: Filtre par utilisateur (attestant ou attesté)
            page: Numéro de page
            limite: Éléments par page

        Returns:
            ListeAttestations paginée

        Raises:
            PermissionError: Si l'utilisateur n'est pas admin
        """
        if utilisateur.role not in ("administrateur", "super_administrateur"):
            raise PermissionError(
                "Seuls les administrateurs peuvent lister toutes les attestations."
            )

        attestations, total = await self.repository.lister_toutes(
            self.session,
            statut=statut,
            type_attestation=type_attestation,
            utilisateur_id=utilisateur_id,
            page=page,
            limite=limite,
        )

        pages_totales = max(1, (total + limite - 1) // limite)

        return ListeAttestations(
            attestations=[self._vers_resume(a) for a in attestations],
            total=total,
            page=page,
            limite=limite,
            pages_totales=pages_totales,
        )

    async def obtenir_statistiques_globales(
        self,
        utilisateur: Utilisateur,
    ) -> dict:
        """
        Calcule les statistiques globales du système (réservé aux admins).

        Args:
            utilisateur: Administrateur connecté

        Returns:
            Statistiques globales

        Raises:
            PermissionError: Si l'utilisateur n'est pas admin
        """
        if utilisateur.role not in ("administrateur", "super_administrateur"):
            raise PermissionError(
                "Seuls les administrateurs peuvent voir les statistiques globales."
            )

        return await self.repository.calculer_statistiques_globales(self.session)

    # ========================================================================
    # Décision (approuver / refuser)
    # ========================================================================

    async def approuver_attestation(
        self,
        attestation_id: UUID,
        utilisateur: Utilisateur,
    ) -> ResultatDecision:
        """
        Approuve une attestation reçue et met à jour le score.

        Args:
            attestation_id: UUID de l'attestation à approuver
            utilisateur: Utilisateur authentifié (doit être l'attesté)

        Returns:
            ResultatDecision avec l'attestation mise à jour

        Raises:
            ValueError: Si attestation introuvable
            PermissionError: Si l'utilisateur n'est pas l'attesté
            ValueError: Si l'attestation n'est pas en attente
        """
        attestation = await self._obtenir_et_verifier_acces(
            attestation_id, utilisateur, doit_etre_atteste=True
        )

        if attestation.statut != "EN_ATTENTE":
            raise ValueError(
                f"Cette attestation est déjà {attestation.statut}. "
                "Seules les attestations en attente peuvent être approuvées."
            )

        # Approuver l'attestation
        attestation.approuver()
        attestation_maj = await self._enregistrer_et_retourner(attestation)

        # Mettre à jour le score de l'utilisateur attesté (recalcul complet via le moteur de scoring)
        nouveau_score = await self._reinitialiser_score_atteste(attestation)

        journal.info(
            "Attestation approuvée | id=%s | attestant=%s | attesté=%s | poids=%s",
            attestation.id,
            attestation.attestant.digiid_public,
            attestation.atteste.digiid_public,
            attestation.poids_score,
        )

        return ResultatDecision(
            message=f"Attestation approuvée. +{attestation.poids_score} points de confiance ajoutés.",
            attestation=self._vers_detail(attestation_maj),
            score_mis_a_jour=nouveau_score,
        )

    async def refuser_attestation(
        self,
        attestation_id: UUID,
        utilisateur: Utilisateur,
        decision: DecisionAttestation,
    ) -> ResultatDecision:
        """
        Refuse une attestation reçue avec un motif.

        Args:
            attestation_id: UUID de l'attestation à refuser
            utilisateur: Utilisateur authentifié (doit être l'attesté)
            decision: Décision contenant le motif de refus

        Returns:
            ResultatDecision avec l'attestation refusée

        Raises:
            ValueError: Si attestation introuvable
            PermissionError: Si l'utilisateur n'est pas l'attesté
            ValueError: Si l'attestation n'est pas en attente
        """
        attestation = await self._obtenir_et_verifier_acces(
            attestation_id, utilisateur, doit_etre_atteste=True
        )

        if attestation.statut != "EN_ATTENTE":
            raise ValueError(
                f"Cette attestation est déjà {attestation.statut}. "
                "Seules les attestations en attente peuvent être refusées."
            )

        # Refuser avec motif
        attestation.refuser(decision.motif_refus or "Motif non spécifié")
        attestation_maj = await self._enregistrer_et_retourner(attestation)

        journal.info(
            "Attestation refusée | id=%s | attestant=%s | attesté=%s | motif=%s",
            attestation.id,
            attestation.attestant.digiid_public,
            attestation.atteste.digiid_public,
            decision.motif_refus,
        )

        return ResultatDecision(
            message="Attestation refusée.",
            attestation=self._vers_detail(attestation_maj),
        )

    # ========================================================================
    # Liste et consultation
    # ========================================================================

    async def lister_mes_attestations(
        self,
        utilisateur: Utilisateur,
        statut: Optional[str] = None,
        type_attestation: Optional[str] = None,
        direction: str = "recues",
        page: int = 1,
        limite: int = 20,
    ) -> ListeAttestations:
        """
        Liste les attestations de l'utilisateur connecté.

        Args:
            utilisateur: Utilisateur connecté
            statut: Filtre optionnel par statut
            type_attestation: Filtre optionnel par type
            direction: "recues" ou "envoyees"
            page: Numéro de page
            limite: Éléments par page

        Returns:
            ListeAttestations paginée
        """
        attestations, total = await self.repository.lister_par_utilisateur(
            self.session,
            utilisateur.id,
            statut=statut,
            type_attestation=type_attestation,
            direction=direction,
            page=page,
            limite=limite,
        )

        pages_totales = max(1, (total + limite - 1) // limite)

        return ListeAttestations(
            attestations=[self._vers_resume(a) for a in attestations],
            total=total,
            page=page,
            limite=limite,
            pages_totales=pages_totales,
        )

    async def obtenir_detail_attestation(
        self,
        attestation_id: UUID,
        utilisateur: Utilisateur,
    ) -> AttestationDetail:
        """
        Obtient le détail complet d'une attestation.
        Accessible à l'attestant, l'attesté et aux administrateurs.

        Args:
            attestation_id: UUID de l'attestation
            utilisateur: Utilisateur connecté

        Returns:
            AttestationDetail complet

        Raises:
            ValueError: Si attestation introuvable
            PermissionError: Si l'utilisateur n'est pas concerné
        """
        attestation = await self.repository.obtenir_par_id(
            self.session, attestation_id
        )

        if not attestation:
            raise ValueError("Attestation introuvable.")

        # Vérifier que l'utilisateur est concerné
        if not (
            attestation.attestant_id == utilisateur.id
            or attestation.atteste_id == utilisateur.id
            or utilisateur.role == "super_administrateur"
            or utilisateur.role == "administrateur"
        ):
            raise PermissionError(
                "Vous n'êtes pas autorisé à consulter cette attestation."
            )

        return self._vers_detail(attestation)

    async def obtenir_statistiques(
        self,
        utilisateur: Utilisateur,
    ) -> StatistiquesAttestations:
        """
        Calcule les statistiques d'attestation pour l'utilisateur connecté.

        Args:
            utilisateur: Utilisateur connecté

        Returns:
            StatistiquesAttestations complètes
        """
        stats = await self.repository.calculer_statistiques(
            self.session, utilisateur.id
        )
        return StatistiquesAttestations(**stats)

    # ========================================================================
    # Mise à jour
    # ========================================================================

    async def mettre_a_jour_attestation(
        self,
        attestation_id: UUID,
        utilisateur: Utilisateur,
        donnees: MiseAJourAttestation,
    ) -> AttestationDetail:
        """
        Met à jour une attestation (titre, description, etc.).
        Seul l'attestant peut modifier son attestation.

        Args:
            attestation_id: UUID de l'attestation
            utilisateur: Utilisateur connecté (doit être l'attestant)
            donnees: Données de mise à jour

        Returns:
            AttestationDetail mise à jour

        Raises:
            ValueError: Si attestation introuvable
            PermissionError: Si l'utilisateur n'est pas l'attestant
        """
        attestation = await self._obtenir_et_verifier_acces(
            attestation_id, utilisateur, doit_etre_attestant=True
        )

        if donnees.titre is not None:
            attestation.titre = donnees.titre
        if donnees.description is not None:
            attestation.description = donnees.description
        if donnees.forces is not None:
            attestation.forces = donnees.forces
        if donnees.est_visible_public is not None:
            attestation.est_visible_public = donnees.est_visible_public

        attestation_maj = await self._enregistrer_et_retourner(attestation)

        return self._vers_detail(attestation_maj)

    # ========================================================================
    # Suppression
    # ========================================================================

    async def supprimer_attestation(
        self,
        attestation_id: UUID,
        utilisateur: Utilisateur,
    ) -> dict:
        """
        Supprime définitivement une attestation.
        Seul l'attestant ou un super-administrateur peut supprimer.

        Args:
            attestation_id: UUID de l'attestation
            utilisateur: Utilisateur connecté

        Returns:
            Message de confirmation

        Raises:
            ValueError: Si attestation introuvable
            PermissionError: Si non autorisé
        """
        attestation = await self.repository.obtenir_par_id(
            self.session, attestation_id
        )

        if not attestation:
            raise ValueError("Attestation introuvable.")

        est_attestant = attestation.attestant_id == utilisateur.id
        est_super_admin = utilisateur.role == "super_administrateur"
        est_admin = utilisateur.role == "administrateur"

        if not (est_attestant or est_super_admin or est_admin):
            raise PermissionError(
                "Seul l'attestant ou un administrateur peut supprimer cette attestation."
            )

        await self.repository.supprimer(self.session, attestation_id)
        await self.session.commit()

        journal.info(
            "Attestation supprimée | id=%s | par=%s",
            attestation_id,
            utilisateur.digiid_public,
        )

        return {"message": "Attestation supprimée avec succès."}

    # ========================================================================
    # Méthodes internes
    # ========================================================================

    async def _rechercher_par_digiid(
        self, digiid: str
    ) -> Optional[Utilisateur]:
        """Recherche un utilisateur par son DigiID public."""
        from sqlalchemy import select as sel
        from src.modeles import Utilisateur as UtilisateurModele

        resultat = await self.session.execute(
            sel(UtilisateurModele).where(
                UtilisateurModele.digiid_public == digiid
            )
        )
        return resultat.scalar_one_or_none()

    async def _obtenir_et_verifier_acces(
        self,
        attestation_id: UUID,
        utilisateur: Utilisateur,
        doit_etre_attestant: bool = False,
        doit_etre_atteste: bool = False,
    ) -> AttestationCommunautaire:
        """
        Récupère une attestation et vérifie les droits d'accès.

        Args:
            attestation_id: UUID de l'attestation
            utilisateur: Utilisateur connecté
            doit_etre_attestant: Si True, l'utilisateur doit être l'attestant
            doit_etre_atteste: Si True, l'utilisateur doit être l'attesté

        Returns:
            L'attestation

        Raises:
            ValueError: Si introuvable
            PermissionError: Si accès non autorisé
        """
        attestation = await self.repository.obtenir_par_id(
            self.session, attestation_id
        )

        if not attestation:
            raise ValueError("Attestation introuvable.")

        if doit_etre_attestant and attestation.attestant_id != utilisateur.id:
            raise PermissionError(
                "Vous n'êtes pas l'auteur de cette attestation."
            )

        if doit_etre_atteste and attestation.atteste_id != utilisateur.id:
            raise PermissionError(
                "Cette attestation ne vous est pas destinée."
            )

        return attestation

    async def _verifier_limites(self, utilisateur: Utilisateur) -> None:
        """
        Vérifie les limites de taux pour l'utilisateur.

        Raises:
            ValueError: Si une limite est dépassée
        """
        # Limite d'attestations actives totales
        nb_actives = (
            await self.repository.compter_attestations_par_attestant(
                self.session, utilisateur.id
            )
        )
        if nb_actives >= self.LIMITE_MAX_ATTESTATIONS_ACTIVES_PAR_UTILISATEUR:
            raise ValueError(
                f"Vous avez atteint la limite maximale de "
                f"{self.LIMITE_MAX_ATTESTATIONS_ACTIVES_PAR_UTILISATEUR} "
                f"attestations actives."
            )

        # Limite quotidienne (attestations créées aujourd'hui)
        aujourd_hui = datetime.now(timezone.utc).date()
        from sqlalchemy import select as sel, func as fn, and_
        from src.modeles import AttestationCommunautaire as AttModele

        resultat = await self.session.execute(
            sel(fn.count(AttModele.id)).where(
                and_(
                    AttModele.attestant_id == utilisateur.id,
                    fn.date(AttModele.date_soumission) == aujourd_hui,
                )
            )
        )
        nb_aujourd_hui = resultat.scalar() or 0
        if nb_aujourd_hui >= self.LIMITE_MAX_ATTESTATIONS_PAR_JOUR:
            raise ValueError(
                f"Vous avez atteint la limite quotidienne de "
                f"{self.LIMITE_MAX_ATTESTATIONS_PAR_JOUR} attestations. "
                f"Réessayez demain."
            )

    async def _reinitialiser_score_atteste(
        self,
        attestation: AttestationCommunautaire,
    ) -> Optional[float]:
        """
        Déclenche un recalcul complet du score via le moteur de scoring.

        Appelle directement calculer_et_enregistrer_score (SANS cooldown)
        pour garantir que le score est mis à jour immédiatement après
        l'approbation d'une attestation.

        Le recalcul force l'injection des vraies données d'attestations
        (collectées via _collecter_attestations) qui remplacent les
        valeurs simulées du generateur de donnees.
        """
        atteste = attestation.atteste
        if not atteste:
            return None

        try:
            score_avant = atteste.score_actuel

            resultat = await calculer_et_enregistrer_score(
                session=self.session,
                utilisateur=atteste,
                forcer_recalcul=True,
            )

            journal.info(
                "_reinitialiser_score_atteste | utilisateur=%s | "
                "score_avant=%s | score_apres=%s | "
                "methode=%s",
                atteste.id,
                score_avant,
                resultat.score_total,
                resultat.methode,
            )

            return float(resultat.score_total)
        except Exception as e:
            journal.warning(
                "Échec du recalcul score après attestation | "
                "utilisateur=%s erreur=%s",
                atteste.id,
                str(e),
            )
            return None

    # ========================================================================
    # Convertisseurs (modèle → schéma)
    # ========================================================================

    def _vers_detail(
        self, att: AttestationCommunautaire
    ) -> AttestationDetail:
        """Convertit un modèle ORM en schéma de détail."""
        attestant = att.attestant
        atteste = att.atteste

        return AttestationDetail(
            id=att.id,
            attestant_id=att.attestant_id,
            attestant_nom=dechiffrer_donnee(attestant.nom_chiffre) if attestant.nom_chiffre else "",
            attestant_prenom=dechiffrer_donnee(attestant.prenom_chiffre) if attestant.prenom_chiffre else "",
            attestant_digiid=attestant.digiid_public or "",
            atteste_id=att.atteste_id,
            atteste_nom=dechiffrer_donnee(atteste.nom_chiffre) if atteste.nom_chiffre else "",
            atteste_prenom=dechiffrer_donnee(atteste.prenom_chiffre) if atteste.prenom_chiffre else "",
            atteste_digiid=atteste.digiid_public or "",
            type_attestation=att.type_attestation,
            titre=att.titre,
            description=att.description,
            forces=att.forces,
            lien_connu_depuis=att.lien_connu_depuis,
            lien_nature=att.lien_nature,
            statut=att.statut,
            motif_refus=att.motif_refus,
            poids_score=att.poids_score,
            est_visible_public=att.est_visible_public,
            est_active=att.est_active,
            date_soumission=att.date_soumission,
            date_decision=att.date_decision,
            date_expiration=att.date_expiration,
        )

    def _vers_resume(
        self, att: AttestationCommunautaire
    ) -> AttestationResume:
        """Convertit un modèle ORM en schéma résumé."""
        attestant = att.attestant
        atteste = att.atteste

        return AttestationResume(
            id=att.id,
            attestant_nom_complet=(
                f"{dechiffrer_donnee(attestant.prenom_chiffre) if attestant.prenom_chiffre else ''} "
                f"{dechiffrer_donnee(attestant.nom_chiffre) if attestant.nom_chiffre else ''}".strip()
                or attestant.digiid_public or "Inconnu"
            ),
            atteste_nom_complet=(
                f"{dechiffrer_donnee(atteste.prenom_chiffre) if atteste.prenom_chiffre else ''} "
                f"{dechiffrer_donnee(atteste.nom_chiffre) if atteste.nom_chiffre else ''}".strip()
                or atteste.digiid_public or "Inconnu"
            ),
            type_attestation=att.type_attestation,
            titre=att.titre,
            statut=att.statut,
            poids_score=att.poids_score,
            est_active=att.est_active,
            date_soumission=att.date_soumission,
            date_decision=att.date_decision,
            date_expiration=att.date_expiration,
        )
