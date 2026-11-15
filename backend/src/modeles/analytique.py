# -*- coding: utf-8 -*-
"""Référentiels et événements pseudonymisés pour les analyses logistiques."""
import hashlib
import hmac
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    event as sqlalchemy_event,
    func,
    inspect,
    select,
)
from sqlalchemy.dialects.postgresql import UUID, insert as insert_postgresql
from sqlalchemy.orm import Mapped, mapped_column

from src.base_donnees.base import Base
from src.config import parametres
from src.modeles.logistique.colis import Colis
from src.modeles.logistique.colis_evenement import ColisEvenement
from src.modeles.logistique.gare import Gare
from src.modeles.logistique.ligne import Ligne
from src.modeles.logistique.voyage import Voyage


class DimensionGareAnalytique(Base):
    """Référence locale d'une gare, sans données personnelles."""

    __tablename__ = "dimension_gare_analytique"

    gare_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    nom: Mapped[str] = mapped_column(String(150), nullable=False)
    ville: Mapped[str] = mapped_column(String(100), nullable=False)
    actif: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )


class DimensionLigneAnalytique(Base):
    """Référence locale d'une ligne de transport."""

    __tablename__ = "dimension_ligne_analytique"

    ligne_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    gare_depart_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    gare_arrivee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    distance_km: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duree_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    actif: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )


class DimensionChauffeurAnalytique(Base):
    """Dimension chauffeur limitée à un identifiant HMAC non réversible."""

    __tablename__ = "dimension_chauffeur_analytique"

    chauffeur_id_anonyme: Mapped[str] = mapped_column(String(64), primary_key=True)


class DimensionDateAnalytique(Base):
    """Calendrier de référence pour les agrégations temporelles."""

    __tablename__ = "dimension_date_analytique"

    date_id: Mapped[date] = mapped_column(Date, primary_key=True)
    annee: Mapped[int] = mapped_column(Integer, nullable=False)
    mois: Mapped[int] = mapped_column(Integer, nullable=False)
    jour: Mapped[int] = mapped_column(Integer, nullable=False)
    jour_semaine: Mapped[int] = mapped_column(Integer, nullable=False)
    semaine_iso: Mapped[int] = mapped_column(Integer, nullable=False)
    trimestre: Mapped[int] = mapped_column(Integer, nullable=False)


class EvenementAnalytique(Base):
    """Fait analytique append-only; aucun identifiant opérationnel personnel."""

    __tablename__ = "evenements_analytiques"
    __table_args__ = (
        Index("ix_evenements_analytiques_type_date", "type_evenement", "date_id"),
        Index("ix_evenements_analytiques_gare_date", "gare_id", "date_id"),
        Index("ix_evenements_analytiques_ligne_date", "ligne_id", "date_id"),
        Index(
            "ix_evenements_analytiques_chauffeur_date",
            "chauffeur_id_anonyme",
            "date_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    type_evenement: Mapped[str] = mapped_column(String(50), nullable=False)
    colis_id_anonyme: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    voyage_id_anonyme: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    chauffeur_id_anonyme: Mapped[Optional[str]] = mapped_column(
        String(64),
        ForeignKey(
            "dimension_chauffeur_analytique.chauffeur_id_anonyme",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )
    gare_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dimension_gare_analytique.gare_id", ondelete="RESTRICT"),
        nullable=True,
    )
    ligne_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dimension_ligne_analytique.ligne_id", ondelete="RESTRICT"),
        nullable=True,
    )
    date_id: Mapped[date] = mapped_column(
        Date,
        ForeignKey("dimension_date_analytique.date_id", ondelete="RESTRICT"),
        nullable=False,
    )
    horodatage: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    depart_prevu_le: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    est_simule: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )


class ScoreConfianceChauffeurAnalytique(Base):
    """Instantané agrégé quotidien du score de confiance chauffeur."""

    __tablename__ = "scores_confiance_chauffeurs"
    __table_args__ = (
        UniqueConstraint(
            "chauffeur_id_anonyme",
            "date_calcul",
            name="uq_score_confiance_chauffeur_date",
        ),
        Index(
            "ix_score_confiance_chauffeur_date",
            "chauffeur_id_anonyme",
            "date_calcul",
        ),
        Index("ix_score_confiance_date", "date_calcul"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    chauffeur_id_anonyme: Mapped[str] = mapped_column(
        String(64),
        ForeignKey(
            "dimension_chauffeur_analytique.chauffeur_id_anonyme",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    date_calcul: Mapped[date] = mapped_column(Date, nullable=False)
    score_total: Mapped[int] = mapped_column(Integer, nullable=False)
    niveau: Mapped[str] = mapped_column(String(10), nullable=False)
    score_litiges: Mapped[int] = mapped_column(Integer, nullable=False)
    score_regularite: Mapped[int] = mapped_column(Integer, nullable=False)
    score_volume: Mapped[int] = mapped_column(Integer, nullable=False)
    score_avis: Mapped[int] = mapped_column(Integer, nullable=False)
    litiges_mesures: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    regularite_mesuree: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    volume_mesure: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    avis_mesures: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    est_provisoire: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    nombre_depart_analyse: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    nombre_depart_a_lheure: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    nombre_colis_livres: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    calcule_le: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class PrevisionDemandeLigneAnalytique(Base):
    """Prévision quotidienne et mesure d'erreur par ligne."""

    __tablename__ = "previsions_demande_ligne_analytique"
    __table_args__ = (
        UniqueConstraint(
            "date_prevue",
            "depart",
            "arrivee",
            name="uq_prevision_demande_ligne_date_route",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    date_prevue: Mapped[date] = mapped_column(Date, nullable=False)
    depart: Mapped[str] = mapped_column(String(100), nullable=False)
    arrivee: Mapped[str] = mapped_column(String(100), nullable=False)
    demande_prevue: Mapped[float] = mapped_column(Float, nullable=False)
    moyenne_simple: Mapped[float] = mapped_column(Float, nullable=False)
    demande_reelle: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    erreur_absolue: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    erreur_moyenne_simple: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )
    calcule_le: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class AlerteAnomalieScanAnalytique(Base):
    """Alerte sans donnée personnelle pour un volume de scans atypique."""

    __tablename__ = "alertes_anomalies_scans_analytiques"
    __table_args__ = (
        UniqueConstraint(
            "gare_id",
            "periode_debut",
            "type_anomalie",
            name="uq_alerte_scan_gare_periode_type",
        ),
        Index("ix_alerte_scan_periode", "periode_debut"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    gare_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dimension_gare_analytique.gare_id", ondelete="RESTRICT"),
        nullable=False,
    )
    periode_debut: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    type_anomalie: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="volume_scans_atypique",
        server_default="volume_scans_atypique",
    )
    nombre_scans: Mapped[int] = mapped_column(Integer, nullable=False)
    nombre_colis: Mapped[int] = mapped_column(Integer, nullable=False)
    nombre_chauffeurs: Mapped[int] = mapped_column(Integer, nullable=False)
    score_anomalie: Mapped[float] = mapped_column(Float, nullable=False)
    cree_le: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


def anonymiser_identifiant_analytique(
    type_identifiant: str, identifiant: uuid.UUID | None
) -> str | None:
    """Produit un pseudonyme stable et séparé par type d'identifiant."""
    if identifiant is None:
        return None
    valeur = f"digiid-analytique-v1:{type_identifiant}:{identifiant}".encode("utf-8")
    cle = parametres.cle_secrete_jwt.encode("utf-8")
    return hmac.new(cle, valeur, hashlib.sha256).hexdigest()


def _normaliser_horodatage(valeur: datetime | None) -> datetime:
    horodatage = valeur or datetime.now(timezone.utc)
    if horodatage.tzinfo is None:
        return horodatage.replace(tzinfo=timezone.utc)
    return horodatage


def _ajouter_dimension_date(connection, horodatage: datetime) -> date:
    date_id = horodatage.date()
    calendrier = date_id.isocalendar()
    connection.execute(
        insert_postgresql(DimensionDateAnalytique)
        .values(
            date_id=date_id,
            annee=date_id.year,
            mois=date_id.month,
            jour=date_id.day,
            jour_semaine=date_id.weekday(),
            semaine_iso=calendrier.week,
            trimestre=(date_id.month - 1) // 3 + 1,
        )
        .on_conflict_do_nothing(index_elements=["date_id"])
    )
    return date_id


def _ajouter_dimension_chauffeur(connection, chauffeur_id: str | None) -> None:
    if chauffeur_id is None:
        return
    connection.execute(
        insert_postgresql(DimensionChauffeurAnalytique)
        .values(chauffeur_id_anonyme=chauffeur_id)
        .on_conflict_do_nothing(index_elements=["chauffeur_id_anonyme"])
    )


def _synchroniser_gare(connection, gare: dict | None) -> uuid.UUID | None:
    if gare is None or gare["gare_id"] is None:
        return None
    connection.execute(
        insert_postgresql(DimensionGareAnalytique)
        .values(
            gare_id=gare["gare_id"],
            code=gare["code"],
            nom=gare["nom"],
            ville=gare["ville"],
            actif=gare["actif"],
        )
        .on_conflict_do_update(
            index_elements=["gare_id"],
            set_={
                "code": gare["code"],
                "nom": gare["nom"],
                "ville": gare["ville"],
                "actif": gare["actif"],
            },
        )
    )
    return gare["gare_id"]


def _synchroniser_ligne(connection, ligne: dict | None) -> uuid.UUID | None:
    if ligne is None or ligne["ligne_id"] is None:
        return None
    connection.execute(
        insert_postgresql(DimensionLigneAnalytique)
        .values(
            ligne_id=ligne["ligne_id"],
            gare_depart_id=ligne["gare_depart_id"],
            gare_arrivee_id=ligne["gare_arrivee_id"],
            distance_km=ligne["distance_km"],
            duree_min=ligne["duree_min"],
            actif=ligne["actif"],
        )
        .on_conflict_do_update(
            index_elements=["ligne_id"],
            set_={
                "gare_depart_id": ligne["gare_depart_id"],
                "gare_arrivee_id": ligne["gare_arrivee_id"],
                "distance_km": ligne["distance_km"],
                "duree_min": ligne["duree_min"],
                "actif": ligne["actif"],
            },
        )
    )
    return ligne["ligne_id"]


def _ajouter_evenement(
    connection,
    *,
    type_evenement: str,
    colis_id: uuid.UUID | None,
    voyage_id: uuid.UUID | None,
    chauffeur_id: uuid.UUID | None,
    gare: dict | None,
    ligne: dict | None,
    horodatage: datetime,
    depart_prevu_le: datetime | None = None,
) -> None:
    date_id = _ajouter_dimension_date(connection, horodatage)
    gare_id = _synchroniser_gare(connection, gare)
    ligne_id = _synchroniser_ligne(connection, ligne)
    chauffeur_id_anonyme = anonymiser_identifiant_analytique(
        "chauffeur", chauffeur_id
    )
    _ajouter_dimension_chauffeur(connection, chauffeur_id_anonyme)

    connection.execute(
        insert_postgresql(EvenementAnalytique).values(
            id=uuid.uuid4(),
            type_evenement=type_evenement,
            colis_id_anonyme=anonymiser_identifiant_analytique("colis", colis_id),
            voyage_id_anonyme=anonymiser_identifiant_analytique("voyage", voyage_id),
            chauffeur_id_anonyme=chauffeur_id_anonyme,
            gare_id=gare_id,
            ligne_id=ligne_id,
            date_id=date_id,
            horodatage=horodatage,
            depart_prevu_le=depart_prevu_le,
            est_simule=False,
        )
    )


@sqlalchemy_event.listens_for(ColisEvenement, "after_insert")
def _collecter_evenement_colis(mapper, connection, evenement: ColisEvenement) -> None:
    gare_arrivee_evenements = (
        "arrivee",
        "livraison",
        "code_remise_confirme",
        "remise_guichet",
    )
    gare_par_defaut = (
        Colis.gare_arrivee_id
        if evenement.type_evenement in gare_arrivee_evenements
        else Colis.gare_depart_id
    )
    gare_selectionnee = func.coalesce(evenement.gare_id, gare_par_defaut)
    contexte = (
        select(
            Colis.voyage_id.label("voyage_id"),
            func.coalesce(Voyage.chauffeur_id, Colis.chauffeur_id).label(
                "chauffeur_id"
            ),
            Voyage.ligne_id.label("ligne_id"),
            Voyage.date_depart.label("depart_prevu_le"),
            Ligne.gare_depart_id.label("ligne_gare_depart_id"),
            Ligne.gare_arrivee_id.label("ligne_gare_arrivee_id"),
            Ligne.distance_km.label("ligne_distance_km"),
            Ligne.duree_min.label("ligne_duree_min"),
            Ligne.actif.label("ligne_actif"),
            Gare.id.label("gare_id"),
            Gare.code.label("gare_code"),
            Gare.nom.label("gare_nom"),
            Gare.ville.label("gare_ville"),
            Gare.actif.label("gare_actif"),
        )
        .select_from(Colis)
        .outerjoin(Voyage, Voyage.id == Colis.voyage_id)
        .outerjoin(Ligne, Ligne.id == Voyage.ligne_id)
        .outerjoin(Gare, Gare.id == gare_selectionnee)
        .where(Colis.id == evenement.colis_id)
    )
    ligne_contexte = connection.execute(contexte).mappings().one_or_none()
    if ligne_contexte is None:
        raise RuntimeError(
            "Impossible de relier un événement de colis à son colis source."
        )

    ligne = None
    if ligne_contexte["ligne_id"] is not None:
        ligne = {
            "ligne_id": ligne_contexte["ligne_id"],
            "gare_depart_id": ligne_contexte["ligne_gare_depart_id"],
            "gare_arrivee_id": ligne_contexte["ligne_gare_arrivee_id"],
            "distance_km": ligne_contexte["ligne_distance_km"],
            "duree_min": ligne_contexte["ligne_duree_min"],
            "actif": ligne_contexte["ligne_actif"],
        }
    gare = None
    if ligne_contexte["gare_id"] is not None:
        gare = {
            "gare_id": ligne_contexte["gare_id"],
            "code": ligne_contexte["gare_code"],
            "nom": ligne_contexte["gare_nom"],
            "ville": ligne_contexte["gare_ville"],
            "actif": ligne_contexte["gare_actif"],
        }

    _ajouter_evenement(
        connection,
        type_evenement=evenement.type_evenement,
        colis_id=evenement.colis_id,
        voyage_id=ligne_contexte["voyage_id"],
        chauffeur_id=ligne_contexte["chauffeur_id"],
        gare=gare,
        ligne=ligne,
        horodatage=_normaliser_horodatage(evenement.horodatage),
        depart_prevu_le=ligne_contexte["depart_prevu_le"],
    )


def _collecter_evenement_voyage(
    connection, voyage: Voyage, type_evenement: str
) -> None:
    ligne_resultat = connection.execute(
        select(
            Ligne.id.label("ligne_id"),
            Ligne.gare_depart_id.label("gare_depart_id"),
            Ligne.gare_arrivee_id.label("gare_arrivee_id"),
            Ligne.distance_km.label("distance_km"),
            Ligne.duree_min.label("duree_min"),
            Ligne.actif.label("ligne_actif"),
        ).where(Ligne.id == voyage.ligne_id)
    ).mappings().one_or_none()
    gare = None
    ligne = None
    if ligne_resultat is None:
        raise RuntimeError("Impossible de trouver la ligne du voyage analytique.")
    ligne = {
        "ligne_id": ligne_resultat["ligne_id"],
        "gare_depart_id": ligne_resultat["gare_depart_id"],
        "gare_arrivee_id": ligne_resultat["gare_arrivee_id"],
        "distance_km": ligne_resultat["distance_km"],
        "duree_min": ligne_resultat["duree_min"],
        "actif": ligne_resultat["ligne_actif"],
    }
    gare_resultat = connection.execute(
        select(
            Gare.id.label("gare_id"),
            Gare.code.label("code"),
            Gare.nom.label("nom"),
            Gare.ville.label("ville"),
            Gare.actif.label("actif"),
        ).where(Gare.id == ligne_resultat["gare_depart_id"])
    ).mappings().one_or_none()
    if gare_resultat is None:
        raise RuntimeError("Impossible de trouver la gare du voyage analytique.")
    gare = dict(gare_resultat)

    _ajouter_evenement(
        connection,
        type_evenement=type_evenement,
        colis_id=None,
        voyage_id=voyage.id,
        chauffeur_id=voyage.chauffeur_id,
        gare=gare,
        ligne=ligne,
        horodatage=datetime.now(timezone.utc),
        depart_prevu_le=voyage.date_depart,
    )


@sqlalchemy_event.listens_for(Voyage, "after_insert")
def _collecter_creation_voyage(mapper, connection, voyage: Voyage) -> None:
    _collecter_evenement_voyage(connection, voyage, "voyage_planifie")


@sqlalchemy_event.listens_for(Voyage, "after_update")
def _collecter_modification_voyage(mapper, connection, voyage: Voyage) -> None:
    etat = inspect(voyage)
    if etat.attrs.statut.history.has_changes():
        _collecter_evenement_voyage(
            connection, voyage, f"voyage_{voyage.statut}"
        )
    if etat.attrs.chauffeur_id.history.has_changes():
        _collecter_evenement_voyage(
            connection, voyage, "affectation_chauffeur"
        )
