# -*- coding: utf-8 -*-
"""
Repository — Accès base de données pour les attestations communautaires.

Centralise toutes les requêtes SQLAlchemy pour :
  - CRUD des attestations
  - Requêtes de liste avec filtres et pagination
  - Calcul des statistiques
  - Vérifications d'intégrité (unicité, limites)
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, and_, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from src.modeles import AttestationCommunautaire, Utilisateur


class AttestationRepository:
    """
    Accès aux données des attestations communautaires dans PostgreSQL.
    Chaque méthode est asynchrone et reçoit une session SQLAlchemy.
    """

    # ========================================================================
    # CRUD de base
    # ========================================================================

    @staticmethod
    async def creer(
        session: AsyncSession,
        attestation: AttestationCommunautaire,
    ) -> AttestationCommunautaire:
        """
        Persiste une nouvelle attestation en base de données.
        
        Args:
            session: Session SQLAlchemy active
            attestation: Instance AttestationCommunautaire à créer
        
        Returns:
            L'attestation créée avec son ID généré et ses relations chargées
        """
        session.add(attestation)
        await session.flush()

        # Recharger avec les relations utilisateur pour la réponse
        resultat = await session.execute(
            select(AttestationCommunautaire)
            .options(
                joinedload(AttestationCommunautaire.attestant),
                joinedload(AttestationCommunautaire.atteste),
            )
            .where(AttestationCommunautaire.id == attestation.id)
        )
        return resultat.unique().scalar_one()

    @staticmethod
    async def obtenir_par_id(
        session: AsyncSession,
        attestation_id: UUID,
    ) -> Optional[AttestationCommunautaire]:
        """
        Récupère une attestation par son ID avec les relations chargées.
        
        Args:
            session: Session SQLAlchemy active
            attestation_id: UUID de l'attestation
        
        Returns:
            L'attestation trouvée ou None
        """
        resultat = await session.execute(
            select(AttestationCommunautaire)
            .options(
                joinedload(AttestationCommunautaire.attestant),
                joinedload(AttestationCommunautaire.atteste),
            )
            .where(AttestationCommunautaire.id == attestation_id)
        )
        return resultat.unique().scalar_one_or_none()

    @staticmethod
    async def mettre_a_jour(
        session: AsyncSession,
        attestation: AttestationCommunautaire,
    ) -> AttestationCommunautaire:
        """
        Met à jour une attestation existante.
        
        Args:
            session: Session SQLAlchemy active
            attestation: Instance modifiée à persister
        
        Returns:
            L'attestation mise à jour
        """
        await session.flush()
        return attestation

    @staticmethod
    async def supprimer(
        session: AsyncSession,
        attestation_id: UUID,
    ) -> bool:
        """
        Supprime définitivement une attestation.
        
        Args:
            session: Session SQLAlchemy active
            attestation_id: UUID de l'attestation à supprimer
        
        Returns:
            True si supprimée, False si inexistante
        """
        resultat = await session.execute(
            delete(AttestationCommunautaire)
            .where(AttestationCommunautaire.id == attestation_id)
        )
        return resultat.rowcount > 0

    # ========================================================================
    # Requêtes de liste
    # ========================================================================

    @staticmethod
    async def lister_par_utilisateur(
        session: AsyncSession,
        utilisateur_id: UUID,
        statut: Optional[str] = None,
        type_attestation: Optional[str] = None,
        direction: str = "recues",
        page: int = 1,
        limite: int = 20,
    ) -> tuple[list[AttestationCommunautaire], int]:
        """
        Liste les attestations d'un utilisateur (recues ou envoyées)
        avec filtres optionnels et pagination.

        Args:
            session: Session SQLAlchemy active
            utilisateur_id: UUID de l'utilisateur
            statut: Filtre par statut (optionnel)
            type_attestation: Filtre par type (optionnel)
            direction: "recues" ou "envoyees"
            page: Numéro de page (1-indexé)
            limite: Nombre d'éléments par page
        
        Returns:
            Tuple (liste d'attestations, total)
        """
        # Construction de la requête de base
        if direction == "recues":
            clause_where = AttestationCommunautaire.atteste_id == utilisateur_id
        else:
            clause_where = AttestationCommunautaire.attestant_id == utilisateur_id

        # Filtres optionnels
        conditions = [clause_where]

        if statut:
            conditions.append(AttestationCommunautaire.statut == statut.upper())
        if type_attestation:
            conditions.append(
                AttestationCommunautaire.type_attestation == type_attestation.lower()
            )

        # Compter le total
        requete_compte = select(func.count(AttestationCommunautaire.id)).where(
            and_(*conditions)
        )
        total = await session.scalar(requete_compte) or 0

        # Récupérer la page
        decalage = (page - 1) * limite
        requete = (
            select(AttestationCommunautaire)
            .options(
                joinedload(AttestationCommunautaire.attestant),
                joinedload(AttestationCommunautaire.atteste),
            )
            .where(and_(*conditions))
            .order_by(AttestationCommunautaire.date_soumission.desc())
            .offset(decalage)
            .limit(limite)
        )

        resultat = await session.execute(requete)
        attestations = list(resultat.unique().scalars().all())

        return attestations, total

    @staticmethod
    async def lister_recues_en_attente(
        session: AsyncSession,
        utilisateur_id: UUID,
        page: int = 1,
        limite: int = 20,
    ) -> tuple[list[AttestationCommunautaire], int]:
        """
        Liste les attestations reçues en attente de décision.
        
        Args:
            session: Session SQLAlchemy active
            utilisateur_id: UUID de l'utilisateur
            page: Numéro de page
            limite: Éléments par page
        
        Returns:
            Tuple (liste, total)
        """
        return await AttestationRepository.lister_par_utilisateur(
            session,
            utilisateur_id,
            statut="EN_ATTENTE",
            direction="recues",
            page=page,
            limite=limite,
        )

    # ========================================================================
    # Statistiques
    # ========================================================================

    @staticmethod
    async def calculer_statistiques(
        session: AsyncSession,
        utilisateur_id: UUID,
    ) -> dict:
        """
        Calcule les statistiques complètes d'attestation pour un utilisateur.
        
        Args:
            session: Session SQLAlchemy active
            utilisateur_id: UUID de l'utilisateur
        
        Returns:
            Dictionnaire de statistiques
        """
        # --- Attestations reçues ---
        stats_recues = await session.execute(
            select(
                func.count(AttestationCommunautaire.id).label("total_recues"),
                func.sum(
                    AttestationCommunautaire.poids_score
                ).filter(
                    AttestationCommunautaire.statut == "APPROUVEE"
                ).label("score_total"),
                func.count(AttestationCommunautaire.id).filter(
                    AttestationCommunautaire.statut == "APPROUVEE"
                ).label("approuvees_recues"),
                func.count(AttestationCommunautaire.id).filter(
                    AttestationCommunautaire.statut == "EN_ATTENTE"
                ).label("en_attente_recues"),
                func.count(AttestationCommunautaire.id).filter(
                    AttestationCommunautaire.statut == "REFUSEE"
                ).label("refusees_recues"),
                func.count(AttestationCommunautaire.id).filter(
                    AttestationCommunautaire.statut == "EXPIREE"
                ).label("expirees_recues"),
                func.count(
                    func.distinct(AttestationCommunautaire.attestant_id)
                ).label("attestants_uniques"),
            ).where(AttestationCommunautaire.atteste_id == utilisateur_id)
        )
        ligne_recues = stats_recues.one()

        # --- Attestations envoyées ---
        stats_envoyees = await session.execute(
            select(
                func.count(AttestationCommunautaire.id).label("total_envoyees"),
                func.count(AttestationCommunautaire.id).filter(
                    AttestationCommunautaire.statut == "APPROUVEE"
                ).label("approuvees_envoyees"),
                func.count(AttestationCommunautaire.id).filter(
                    AttestationCommunautaire.statut == "EN_ATTENTE"
                ).label("en_attente_envoyees"),
            ).where(AttestationCommunautaire.attestant_id == utilisateur_id)
        )
        ligne_envoyees = stats_envoyees.one()

        return {
            "total_recues": ligne_recues.total_recues or 0,
            "total_envoyees": ligne_envoyees.total_envoyees or 0,
            "approuvees_recues": ligne_recues.approuvees_recues or 0,
            "approuvees_envoyees": ligne_envoyees.approuvees_envoyees or 0,
            "en_attente_recues": ligne_recues.en_attente_recues or 0,
            "en_attente_envoyees": ligne_envoyees.en_attente_envoyees or 0,
            "refusees_recues": ligne_recues.refusees_recues or 0,
            "expirees_recues": ligne_recues.expirees_recues or 0,
            "score_total_attestations": float(ligne_recues.score_total or 0),
            "attestants_uniques": ligne_recues.attestants_uniques or 0,
        }

    # ========================================================================
    # Vérifications d'intégrité
    # ========================================================================

    @staticmethod
    async def verifier_existence_attestation_active(
        session: AsyncSession,
        attestant_id: UUID,
        atteste_id: UUID,
    ) -> bool:
        """
        Vérifie si une attestation active existe déjà entre ces deux utilisateurs.
        Évite les doublons.

        Args:
            session: Session SQLAlchemy active
            attestant_id: UUID de l'attestant
            atteste_id: UUID de l'attesté
        
        Returns:
            True si une attestation active existe déjà
        """
        resultat = await session.execute(
            select(AttestationCommunautaire)
            .where(
                and_(
                    AttestationCommunautaire.attestant_id == attestant_id,
                    AttestationCommunautaire.atteste_id == atteste_id,
                    AttestationCommunautaire.est_active.is_(True),
                    AttestationCommunautaire.statut.in_(["EN_ATTENTE", "APPROUVEE"]),
                )
            )
        )
        return resultat.first() is not None

    @staticmethod
    async def compter_attestations_par_attestant(
        session: AsyncSession,
        attestant_id: UUID,
    ) -> int:
        """
        Compte le nombre d'attestations actives émises par un attestant.
        Utile pour les limites de taux.
        
        Args:
            session: Session SQLAlchemy active
            attestant_id: UUID de l'attestant
        
        Returns:
            Nombre d'attestations actives émises
        """
        resultat = await session.execute(
            select(func.count(AttestationCommunautaire.id))
            .where(
                and_(
                    AttestationCommunautaire.attestant_id == attestant_id,
                    AttestationCommunautaire.est_active.is_(True),
                    AttestationCommunautaire.statut == "APPROUVEE",
                )
            )
        )
        return resultat.scalar() or 0

    # ========================================================================
    # Requêtes admin (modération)
    # ========================================================================

    @staticmethod
    async def lister_toutes(
        session: AsyncSession,
        statut: Optional[str] = None,
        type_attestation: Optional[str] = None,
        utilisateur_id: Optional[UUID] = None,
        page: int = 1,
        limite: int = 20,
    ) -> tuple[list[AttestationCommunautaire], int]:
        """
        Liste TOUTES les attestations du système (réservé aux admins).

        Args:
            session: Session SQLAlchemy active
            statut: Filtre par statut (optionnel)
            type_attestation: Filtre par type (optionnel)
            utilisateur_id: Filtre par utilisateur concerné (attestant ou attesté)
            page: Numéro de page (1-indexé)
            limite: Nombre d'éléments par page

        Returns:
            Tuple (liste d'attestations, total)
        """
        conditions = []

        if statut:
            conditions.append(AttestationCommunautaire.statut == statut.upper())
        if type_attestation:
            conditions.append(
                AttestationCommunautaire.type_attestation == type_attestation.lower()
            )
        if utilisateur_id:
            conditions.append(
                or_(
                    AttestationCommunautaire.attestant_id == utilisateur_id,
                    AttestationCommunautaire.atteste_id == utilisateur_id,
                )
            )

        # Construire la clause WHERE
        requete_base = select(AttestationCommunautaire).options(
            joinedload(AttestationCommunautaire.attestant),
            joinedload(AttestationCommunautaire.atteste),
        )
        if conditions:
            clause_filtres = and_(*conditions)
            requete_base = requete_base.where(clause_filtres)

        # Compter le total
        requete_compte = select(func.count(AttestationCommunautaire.id))
        if conditions:
            requete_compte = requete_compte.where(and_(*conditions))
        total = await session.scalar(requete_compte) or 0

        # Récupérer la page
        decalage = (page - 1) * limite
        requete = requete_base.order_by(
            AttestationCommunautaire.date_soumission.desc()
        ).offset(decalage).limit(limite)

        resultat = await session.execute(requete)
        attestations = list(resultat.unique().scalars().all())

        return attestations, total

    @staticmethod
    async def calculer_statistiques_globales(
        session: AsyncSession,
    ) -> dict:
        """
        Calcule les statistiques globales du système (réservé aux admins).

        Args:
            session: Session SQLAlchemy active

        Returns:
            Dictionnaire de statistiques globales
        """
        # Total général
        requete_total = select(
            func.count(AttestationCommunautaire.id).label("total"),
            func.count(AttestationCommunautaire.id).filter(
                AttestationCommunautaire.statut == "APPROUVEE"
            ).label("approuvees"),
            func.count(AttestationCommunautaire.id).filter(
                AttestationCommunautaire.statut == "EN_ATTENTE"
            ).label("en_attente"),
            func.count(AttestationCommunautaire.id).filter(
                AttestationCommunautaire.statut == "REFUSEE"
            ).label("refusees"),
            func.count(AttestationCommunautaire.id).filter(
                AttestationCommunautaire.statut == "EXPIREE"
            ).label("expirees"),
            func.sum(
                AttestationCommunautaire.poids_score
            ).filter(
                AttestationCommunautaire.statut == "APPROUVEE"
            ).label("score_total"),
            func.avg(AttestationCommunautaire.poids_score).label("poids_moyen"),
            func.count(func.distinct(AttestationCommunautaire.attestant_id)).label("attestants_total"),
            func.count(func.distinct(AttestationCommunautaire.atteste_id)).label("attestes_total"),
        )
        ligne = (await session.execute(requete_total)).one()

        # Répartition par type
        requete_types = (
            select(
                AttestationCommunautaire.type_attestation,
                func.count(AttestationCommunautaire.id).label("nombre"),
            )
            .group_by(AttestationCommunautaire.type_attestation)
            .order_by(func.count(AttestationCommunautaire.id).desc())
        )
        repartition_types = [
            {"type": t, "nombre": n}
            for t, n in (await session.execute(requete_types)).all()
        ]

        # Créées aujourd'hui
        aujourd_hui = datetime.now(timezone.utc).date()
        requete_ajd = select(func.count(AttestationCommunautaire.id)).where(
            func.date(AttestationCommunautaire.date_soumission) == aujourd_hui
        )
        creees_ajd = await session.scalar(requete_ajd) or 0

        return {
            "total": ligne.total or 0,
            "approuvees": ligne.approuvees or 0,
            "en_attente": ligne.en_attente or 0,
            "refusees": ligne.refusees or 0,
            "expirees": ligne.expirees or 0,
            "score_total_systeme": float(ligne.score_total or 0),
            "poids_moyen": round(float(ligne.poids_moyen or 0), 1),
            "attestants_uniques": ligne.attestants_total or 0,
            "attestes_uniques": ligne.attestes_total or 0,
            "creees_aujourd_hui": creees_ajd,
            "repartition_types": repartition_types,
        }

    # ========================================================================
    # Expiration (tâche planifiée)
    # ========================================================================

    @staticmethod
    async def expirer_attestations_obsoletes(
        session: AsyncSession,
    ) -> int:
        """
        Marque comme expirées toutes les attestations dont la date
        d'expiration est dépassée.
        
        À appeler périodiquement (ex: via une tâche CRON ou APScheduler).
        
        Args:
            session: Session SQLAlchemy active
        
        Returns:
            Nombre d'attestations expirées
        """
        maintenant = datetime.now(timezone.utc)
        resultat = await session.execute(
            select(AttestationCommunautaire)
            .options(
                joinedload(AttestationCommunautaire.attestant),
                joinedload(AttestationCommunautaire.atteste),
            )
            .where(
                and_(
                    AttestationCommunautaire.statut == "APPROUVEE",
                    AttestationCommunautaire.date_expiration <= maintenant,
                    AttestationCommunautaire.est_active.is_(True),
                )
            )
        )
        attestations = list(resultat.unique().scalars().all())

        for att in attestations:
            att.expirer()

        await session.flush()
        return len(attestations)
