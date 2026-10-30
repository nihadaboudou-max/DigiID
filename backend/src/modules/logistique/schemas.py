
# -*- coding: utf-8 -*-
"""Schémas Pydantic du domaine logistique (référentiel)."""
from datetime import datetime
from typing import Generic, Literal, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

T = TypeVar("T")


class ReponseListe(BaseModel, Generic[T]):
    """Réponse paginée générique."""
    elements: list[T]
    total: int
    page: int
    par_page: int


# ─── Gare ────────────────────────────────────────────────────────────

class GareBase(BaseModel):
    nom: str = Field(..., min_length=2, max_length=150)
    code: str = Field(..., min_length=2, max_length=20, pattern=r"^[A-Z0-9-]+$")
    ville: str = Field(..., min_length=2, max_length=100)
    domain_id: Optional[UUID] = None
    actif: bool = True

    @field_validator("code")
    @classmethod
    def _normaliser_code(cls, v: str) -> str:
        return v.upper().strip()


class GareCreate(GareBase):
    pass


class GareUpdate(BaseModel):
    nom: Optional[str] = Field(None, min_length=2, max_length=150)
    ville: Optional[str] = Field(None, min_length=2, max_length=100)
    domain_id: Optional[UUID] = None
    actif: Optional[bool] = None


class GareResponse(GareBase):
    id: UUID
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ─── Arrêts d'une ligne (trajets avec escales) ─────────────────────

class ArretLigneBase(BaseModel):
    """Un arrêt intermédiaire : la gare et sa position dans la tournée."""
    gare_id: UUID
    ordre: int = Field(..., ge=1, le=100)
    actif: bool = True


class ArretLigneCreate(ArretLigneBase):
    pass


class ArretLigneUpdate(BaseModel):
    gare_id: Optional[UUID] = None
    ordre: Optional[int] = Field(None, ge=1, le=100)
    actif: Optional[bool] = None


class ArretLigneResponse(ArretLigneBase):
    id: UUID
    ligne_id: UUID
    gare_nom: Optional[str] = None
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ─── Ligne ───────────────────────────────────────────────────────────

class LigneCreate(BaseModel):
    gare_depart_id: UUID
    gare_arrivee_id: UUID
    distance_km: Optional[float] = Field(None, ge=0)
    duree_min: Optional[int] = Field(None, ge=0)
    actif: bool = True
    # Arrêts intermédiaires (facultatif) : on peut créer le trajet et ses
    # escales en une seule requête — sinon voir ``POST /lignes/{id}/arrets``.
    arrets: list[ArretLigneCreate] = []

    @model_validator(mode="after")
    def _gares_distinctes(self):
        if self.gare_depart_id == self.gare_arrivee_id:
            raise ValueError("Les gares de départ et d'arrivée doivent être différentes")
        return self


class LigneUpdate(BaseModel):
    gare_depart_id: Optional[UUID] = None
    gare_arrivee_id: Optional[UUID] = None
    distance_km: Optional[float] = Field(None, ge=0)
    duree_min: Optional[int] = Field(None, ge=0)
    actif: Optional[bool] = None


class LigneResponse(BaseModel):
    id: UUID
    gare_depart_id: UUID
    gare_arrivee_id: UUID
    distance_km: Optional[float] = None
    duree_min: Optional[int] = None
    actif: bool
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    gare_depart_nom: Optional[str] = None
    gare_arrivee_nom: Optional[str] = None
    # Arrêts intermédiaires ordonnés (le terminus n'y figure pas : il est porté
    # par ``gare_arrivee_id``).
    arrets: list[ArretLigneResponse] = []
    model_config = ConfigDict(from_attributes=True)


# ─── Vehicule ────────────────────────────────────────────────────────

class VehiculeCreate(BaseModel):
    immatriculation: str = Field(..., min_length=2, max_length=30)
    marque: Optional[str] = Field(None, max_length=100)
    capacite: Optional[int] = Field(None, ge=0)
    gare_id: Optional[UUID] = None
    actif: bool = True
    # Chauffeur propriétaire du car. Le gérant de gare et le receveur peuvent
    # l'affecter à l'enregistrement ; un chauffeur qui crée son propre car y est
    # affecté d'office par le serveur (il ne choisit pas à qui il appartient).
    chauffeur_id: Optional[UUID] = None

    @field_validator("immatriculation")
    @classmethod
    def _normaliser_immat(cls, v: str) -> str:
        return v.upper().strip()


class VehiculeUpdate(BaseModel):
    marque: Optional[str] = Field(None, max_length=100)
    capacite: Optional[int] = Field(None, ge=0)
    gare_id: Optional[UUID] = None
    actif: Optional[bool] = None


class AffectationVehiculeRequest(BaseModel):
    """Affectation (ou retrait) d'un car à un chauffeur.

    ``chauffeur_id = None`` retire le car du chauffeur sans le supprimer : le
    car redevient « non affecté » et seul le guichet peut le réattribuer.
    """
    chauffeur_id: Optional[UUID] = None


class VehiculeResponse(BaseModel):
    id: UUID
    immatriculation: str
    marque: Optional[str] = None
    capacite: Optional[int] = None
    gare_id: Optional[UUID] = None
    gare_nom: Optional[str] = None
    chauffeur_id: Optional[UUID] = None
    chauffeur_nom: Optional[str] = None
    actif: bool
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ─── Voyage ──────────────────────────────────────────────────────────

StatutVoyage = Literal["planifie", "en_cours", "termine", "annule"]


class VoyageCreate(BaseModel):
    ligne_id: UUID
    vehicule_id: UUID
    chauffeur_id: Optional[UUID] = None
    date_depart: datetime
    date_arrivee: Optional[datetime] = None
    statut: StatutVoyage = "planifie"


class VoyageUpdate(BaseModel):
    vehicule_id: Optional[UUID] = None
    chauffeur_id: Optional[UUID] = None
    date_depart: Optional[datetime] = None
    date_arrivee: Optional[datetime] = None
    statut: Optional[StatutVoyage] = None


class VoyageResponse(BaseModel):
    id: UUID
    ligne_id: UUID
    vehicule_id: UUID
    chauffeur_id: Optional[UUID] = None
    date_depart: datetime
    date_arrivee: Optional[datetime] = None
    statut: str
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    vehicule_immatriculation: Optional[str] = None
    chauffeur_nom: Optional[str] = None
    # Trajet lisible (« Cotonou → Parakou ») : évite un appel par voyage côté front.
    ligne_libelle: Optional[str] = None
    gare_depart_id: Optional[UUID] = None
    gare_arrivee_id: Optional[UUID] = None
    model_config = ConfigDict(from_attributes=True)


# ─── Acteur logistique ───────────────────────────────────────────────

RoleActeur = Literal["receveur", "chauffeur", "gerant_gare", "commercant"]


class ActeurCreate(BaseModel):
    utilisateur_id: UUID
    role: RoleActeur
    gare_id: UUID
    numero_licence: Optional[str] = Field(None, max_length=50)
    actif: bool = True


class ActeurUpdate(BaseModel):
    role: Optional[RoleActeur] = None
    gare_id: Optional[UUID] = None
    numero_licence: Optional[str] = Field(None, max_length=50)
    actif: Optional[bool] = None


class ActeurResponse(BaseModel):
    id: UUID
    utilisateur_id: UUID
    role: str
    gare_id: UUID
    numero_licence: Optional[str] = None
    actif: bool
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    utilisateur_nom: Optional[str] = None
    gare_nom: Optional[str] = None
    # Fiche utilisateur déchiffrée (les noms/téléphones sont chiffrés au repos) :
    # le super-admin et le guichet voient **qui** ils désignent avant de valider.
    utilisateur_prenom: Optional[str] = None
    utilisateur_nom_famille: Optional[str] = None
    utilisateur_telephone: Optional[str] = None
    utilisateur_digiid_public: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ChauffeurDisponible(BaseModel):
    """Chauffeur proposé à l'attribution d'un colis ou d'un passager.

    Répond au terrain : on ne désigne pas un chauffeur par un identifiant
    technique, on le **reconnaît** — par le scan de sa carte DigiID, par son
    code, ou dans la liste des chauffeurs qui font ce trajet (recherche par nom).
    """
    utilisateur_id: UUID
    nom_complet: str
    prenom: Optional[str] = None
    nom_famille: Optional[str] = None
    telephone: Optional[str] = None
    digiid_public: Optional[str] = None
    numero_licence: Optional[str] = None
    gare_id: Optional[UUID] = None
    gare_nom: Optional[str] = None
    # Vrai si le chauffeur est rattaché à la gare de départ du trajet ou s'il a
    # déjà un voyage (planifié / en cours) sur cette ligne.
    fait_le_trajet: bool = False
    prochain_depart_le: Optional[datetime] = None


class VoyagePublic(BaseModel):
    """Horaire public d'un voyage (page citoyens) — aucune donnée sensible."""
    voyage_id: UUID
    trajet: str
    gare_depart: Optional[str] = None
    gare_arrivee: Optional[str] = None
    date_depart: datetime
    vehicule: Optional[str] = None
    # « Moussa D. » : on identifie le chauffeur sans exposer son nom complet.
    chauffeur_apercu: Optional[str] = None
    statut: str
    capacite: Optional[int] = None


# ─── Ticket (QR + numéro en clair) ───────────────────────────────────

class TicketResponse(BaseModel):
    id: UUID
    code_clair: str
    qr_token: str
    qr_code_url: Optional[str] = None
    type: str
    reference_id: Optional[UUID] = None
    voyage_id: Optional[UUID] = None
    statut: str
    nb_scans: int
    premier_scan_le: Optional[datetime] = None
    imprime_le: Optional[datetime] = None
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


# ─── Bagages (étiquettes QR par sac — traçabilité) ──────────────────

class BagageResponse(BaseModel):
    id: UUID
    ticket_id: Optional[UUID] = None
    suivi_familial_id: Optional[UUID] = None
    colis_id: Optional[UUID] = None
    numero_serie: str
    position: int
    nombre_total: int
    statut: str
    # Étiquette QR du sac (ticket type=BAGAGE).
    code_clair: Optional[str] = None
    qr_code_url: Optional[str] = None
    cree_le: datetime
    model_config = ConfigDict(from_attributes=True)


# ─── Colis ───────────────────────────────────────────────────────────

class ColisCreate(BaseModel):
    destinataire_nom: str = Field(..., min_length=2, max_length=150)
    destinataire_tel: str = Field(..., min_length=6, max_length=30)
    # Expéditeur saisi au guichet (souvent un tiers sans compte DigiID).
    expediteur_nom: Optional[str] = Field(None, max_length=150)
    expediteur_tel: Optional[str] = Field(None, max_length=30)
    expediteur_id: Optional[UUID] = None
    destinataire_id: Optional[UUID] = None
    gare_depart_id: UUID
    gare_arrivee_id: UUID
    # Arrêt précis où le colis doit descendre (facultatif : à défaut, la gare
    # d'arrivée). Il doit appartenir à la ligne du voyage.
    arret_destination_id: Optional[UUID] = None
    description: Optional[str] = Field(None, max_length=500)
    poids_kg: Optional[float] = Field(None, ge=0)
    valeur_fcfa: Optional[int] = Field(None, ge=0)
    # Nombre de sacs (1 à 10) — **traçabilité + anti-fraude à l'arrivée**
    # uniquement : cela n'impacte pas le prix.
    nombre_bagages: int = Field(1, ge=1, le=10)
    # Nombre d'articles dans le colis (information libre du guichet).
    nombre_articles: int = Field(1, ge=1, le=9999)
    # Prix du transport — **facultatif** : DigiID n'encaisse pas ce montant (les
    # frais de service sont payés séparément par le client).
    frais_fcfa: Optional[int] = Field(None, ge=0)
    # Moyen de paiement **choisi à l'inscription** : le QR n'est généré qu'après
    # l'encaissement (espèces immédiat, mobile money en mode prototype).
    moyen_paiement: Literal["especes", "mtn", "moov"]
    telephone_paiement: Optional[str] = Field(None, max_length=30)
    # Si non fourni, le receveur = utilisateur courant (guichet).
    receveur_id: Optional[UUID] = None
    # **Attribution obligatoire** : tout enregistrement est lié à un chauffeur
    # précis et à un trajet précis (gare de départ → gare d'arrivée).
    voyage_id: Optional[UUID] = None
    # **Obligatoire** hors enregistrement direct. En mode ``enregistrement_direct``
    # (le chauffeur inscrit son client en route), le champ peut Ǧtre omis : le
    # backend force alors le chauffeur = utilisateur connecté.
    chauffeur_id: Optional[UUID] = None
    # **Enregistrement direct par le chauffeur** : le client monte en route, le
    # chauffeur crée le colis lui-même depuis son téléphone. Le backend force
    # alors ``mode_enregistrement="chauffeur_direct"``, le chauffeur du colis =
    # utilisateur courant et le statut initial = ``enregistre_direct``.
    enregistrement_direct: bool = False

    # ─── Numéros de téléphone (guichet) ──────────────────────────────
    # Sans contrôle, n'importe quelle chaîne (« 1234 », « abc ») passait : le
    # colis devenait introuvable par téléphone et les SMS partaient dans le vide.
    # Les numéros sont normalisés en ``+229…`` ; un numéro étranger explicite
    # (``+226…``) reste accepté, tout le reste est refusé (HTTP 422).
    @field_validator(
        "destinataire_tel", "expediteur_tel", "telephone_paiement", mode="before"
    )
    @classmethod
    def _valider_telephones(cls, valeur):
        from src.noyau.telephone import normaliser_numero_tiers

        return normaliser_numero_tiers(valeur)

    @model_validator(mode="after")
    def _gares_distinctes(self):
        if self.gare_depart_id == self.gare_arrivee_id:
            raise ValueError("Les gares de départ et d'arrivée doivent être différentes")
        if self.moyen_paiement in ("mtn", "moov") and not self.telephone_paiement:
            raise ValueError("Le numéro de téléphone mobile money est obligatoire")
        # En **enregistrement direct**, le chauffeur connaît forcément son
        # voyage : il est donc obligatoire. Au guichet, on autorise l'inverse —
        # enregistrer d'abord, affecter le voyage/chauffeur ensuite (voir
        # le POST « affectation »).
        if self.enregistrement_direct and self.voyage_id is None:
            raise ValueError(
                "voyage_id est obligatoire pour un enregistrement direct par le chauffeur"
            )
        return self


class ColisResponse(BaseModel):
    id: UUID
    ticket_id: Optional[UUID] = None
    code_clair: Optional[str] = None
    qr_token: Optional[str] = None
    qr_code_url: Optional[str] = None
    expediteur_id: Optional[UUID] = None
    destinataire_id: Optional[UUID] = None
    destinataire_nom: str
    destinataire_tel: str
    description: Optional[str] = None
    poids_kg: Optional[float] = None
    valeur_fcfa: Optional[int] = None
    nombre_articles: int = 1
    nombre_bagages: int = 1
    gare_depart_id: UUID
    gare_arrivee_id: UUID
    voyage_id: Optional[UUID] = None
    receveur_id: Optional[UUID] = None
    chauffeur_id: Optional[UUID] = None
    statut: str
    frais_fcfa: Optional[int] = None
    livre_le: Optional[datetime] = None
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    # Champs enrichis (noms lisibles)
    gare_depart_nom: Optional[str] = None
    gare_arrivee_nom: Optional[str] = None
    expediteur_nom: Optional[str] = None
    expediteur_tel: Optional[str] = None
    receveur_nom: Optional[str] = None
    chauffeur_nom: Optional[str] = None
    # Arrêt de destination et sa position dans la tournée (tri du chauffeur).
    arret_destination_id: Optional[UUID] = None
    arret_destination_nom: Optional[str] = None
    arret_ordre: Optional[int] = None
    photo_url: Optional[str] = None
    # Confirmation de prise en charge par le chauffeur + remise au guichet.
    reception_confirmee_le: Optional[datetime] = None
    remis_guichet_le: Optional[datetime] = None
    remis_guichet_par_nom: Optional[str] = None
    remis_guichet_a_id: Optional[UUID] = None
    remis_guichet_a_nom: Optional[str] = None
    # Moyen de paiement choisi à l'inscription (aucun encaissement après coup).
    moyen_paiement: Optional[str] = None
    # Origine de l'enregistrement : « guichet » ou « chauffeur_direct ».
    mode_enregistrement: str = "guichet"
    enregistre_par_id: Optional[UUID] = None
    enregistre_par_nom: Optional[str] = None
    # Étiquettes QR générées (une par sac).
    bagages: list[BagageResponse] = []
    model_config = ConfigDict(from_attributes=True)


class ColisHorsLigne(ColisCreate):
    """Colis saisi **sans réseau** puis rejoué à la reconnexion (S3).

    ``id_local`` est la clé d'idempotence générée par le poste guichet : rejouer
    la file deux fois ne crée jamais de doublon.
    """

    id_local: str = Field(..., min_length=8, max_length=64)


class ColisEnregistre(BaseModel):
    colis: ColisResponse
    ticket: TicketResponse


class PhotoColisResponse(BaseModel):
    photo_url: str


class ColisUpdate(BaseModel):
    """Correction d'une fiche colis par le guichet.

    Autorisée **avant** la prise en charge par le chauffeur
    (``reception_confirmee_le``) et seulement par l'agent qui a enregistré le
    colis : au-delà, la fiche est figée (le colis est dans le car).
    """
    destinataire_nom: Optional[str] = Field(None, min_length=2, max_length=150)
    destinataire_tel: Optional[str] = Field(None, min_length=6, max_length=30)
    expediteur_nom: Optional[str] = Field(None, max_length=150)
    expediteur_tel: Optional[str] = Field(None, max_length=30)
    description: Optional[str] = Field(None, max_length=500)
    poids_kg: Optional[float] = Field(None, ge=0)
    valeur_fcfa: Optional[int] = Field(None, ge=0)
    nombre_articles: Optional[int] = Field(None, ge=1, le=9999)
    nombre_bagages: Optional[int] = Field(None, ge=1, le=10)
    frais_fcfa: Optional[int] = Field(None, ge=0)
    arret_destination_id: Optional[UUID] = None

    @field_validator("destinataire_tel", "expediteur_tel", mode="before")
    @classmethod
    def _valider_telephones(cls, valeur):
        from src.noyau.telephone import normaliser_numero_tiers

        return normaliser_numero_tiers(valeur)


class AffectationRequest(BaseModel):
    """Affectation (ou réaffectation) d'un enregistrement à un voyage.

    Répond au terrain : au guichet, on enregistre un colis **avant** de savoir
    quel car partira. Le receveur revient ensuite sur la fiche choisir le
    voyage — le chauffeur en découle automatiquement (il est celui du voyage).
    """
    voyage_id: UUID
    # Facultatif : si omis, le chauffeur affecté au voyage est retenu.
    chauffeur_id: Optional[UUID] = None


# ─── Événements (timeline) ───────────────────────────────────────────

class ColisEvenementResponse(BaseModel):
    id: UUID
    colis_id: UUID
    type_evenement: str
    acteur_id: Optional[UUID] = None
    acteur_nom: Optional[str] = None
    gare_id: Optional[UUID] = None
    localisation: Optional[str] = None
    horodatage: datetime
    idempotency_key: Optional[str] = None
    synchro_le: Optional[datetime] = None
    cree_le: datetime
    model_config = ConfigDict(from_attributes=True)


# ─── Scan ────────────────────────────────────────────────────────────

TypeEvenementScan = Literal["livraison", "depart", "mise_en_transit", "arrivee"]


class ScanCreate(BaseModel):
    """Payload d'un scan : soit un token QR, soit le code clair (repli manuel)."""
    token: Optional[str] = Field(None, max_length=200)
    code_clair: Optional[str] = Field(None, max_length=40)
    type_evenement: TypeEvenementScan = "livraison"
    gare_id: Optional[UUID] = None
    voyage_id: Optional[UUID] = None
    localisation: Optional[str] = Field(None, max_length=200)
    idempotency_key: Optional[str] = Field(None, max_length=120)
    horodatage: Optional[datetime] = None

    @model_validator(mode="after")
    def _cible_obligatoire(self):
        if not self.token and not self.code_clair:
            raise ValueError("Fournir soit 'token', soit 'code_clair'")
        return self


# ─── Notifications logistiques (SMS départ/arrivée) ──────────────────

class NotificationLogistiqueResponse(BaseModel):
    id: UUID
    canal: str
    type_cible: str
    cible_id: Optional[UUID] = None
    type_evenement: str
    destinataire_role: Optional[str] = None
    telephone: Optional[str] = None
    message: str
    envoye: bool
    cree_le: datetime
    model_config = ConfigDict(from_attributes=True)


# ─── Suivi familial (enfants seuls) ──────────────────────────────────

StatutSuiviFamilial = Literal["enregistre", "enregistre_direct", "en_route", "arrive", "annule"]
TypeEvenementSuivi = Literal["depart", "arrivee", "livraison", "incident"]


class SuiviFamilialCreate(BaseModel):
    enfant_nom: str = Field(..., min_length=2, max_length=150)
    enfant_age: Optional[int] = Field(None, ge=0, le=120)
    enfant_sexe: Optional[str] = Field(None, pattern=r"^[MF]$")
    parent_nom: Optional[str] = Field(None, max_length=150)
    # Téléphone du responsable principal (parent pour un enfant ; le passager
    # lui-même pour un adulte). Rempli automatiquement selon ``type_passager``.
    telephone_parent: Optional[str] = Field(None, min_length=6, max_length=30)
    # ─── Enregistrement & contacts (P0 ajusté) ───────────────────────
    # « enfant » : voyage sous la responsabilité d'un tiers (acheteur du ticket).
    # « adulte » : voyageur autonome (son propre numéro est saisi).
    type_passager: Literal["enfant", "adulte"] = "enfant"
    # Adulte : son propre numéro.
    telephone_passager: Optional[str] = Field(None, min_length=6, max_length=30)
    # Enfant : nom/numéro de l'acheteur du ticket (celui qui a payé le voyage).
    acheteur_nom: Optional[str] = Field(None, max_length=150)
    acheteur_tel: Optional[str] = Field(None, min_length=6, max_length=30)
    # Proche de confiance à prévenir (obligatoire dans les deux cas).
    proche_nom: Optional[str] = Field(None, max_length=150)
    proche_telephone: str = Field(..., min_length=6, max_length=30)
    # Nombre de sacs (1 à 10) — traçabilité, **sans impact** sur le prix.
    nombre_bagages: int = Field(1, ge=1, le=10)
    # Moyen de paiement **choisi à l'inscription** (avant la génération du QR).
    moyen_paiement: Literal["especes", "mtn", "moov"]
    telephone_paiement: Optional[str] = Field(None, max_length=30)
    gare_depart_id: UUID
    gare_arrivee_id: UUID
    # Arrêt précis où le passager descend (facultatif : à défaut, la gare
    # d'arrivée). Il doit appartenir à la ligne du voyage.
    arret_destination_id: Optional[UUID] = None
    # **Attribution obligatoire** : chauffeur précis + voyage précis.
    voyage_id: Optional[UUID] = None
    # **Obligatoire** hors enregistrement direct (voir ``enregistrement_direct``).
    chauffeur_id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    # **Enregistrement direct par le chauffeur** : passager monté en route,
    # enregistré par le chauffeur lui-même (statut ``enregistre_direct``).
    enregistrement_direct: bool = False

    # ─── Numéros de téléphone (guichet / chauffeur) ──────────────────
    # Obligatoires pour joindre les proches : ils étaient libres (« text »)
    # et donc inutilisables pour les SMS. Normalisés en ``+229…``, refusés
    # sinon (HTTP 422).
    @field_validator(
        "telephone_parent",
        "telephone_passager",
        "acheteur_tel",
        "proche_telephone",
        "telephone_paiement",
        mode="before",
    )
    @classmethod
    def _valider_telephones(cls, valeur):
        from src.noyau.telephone import normaliser_numero_tiers

        return normaliser_numero_tiers(valeur)

    @model_validator(mode="after")
    def _valider_contacts(self):
        if self.gare_depart_id == self.gare_arrivee_id:
            raise ValueError("Les gares de départ et d'arrivée doivent être différentes")
        if self.moyen_paiement in ("mtn", "moov") and not self.telephone_paiement:
            raise ValueError("Le numéro de téléphone mobile money est obligatoire")
        if self.type_passager == "adulte":
            if not self.telephone_passager:
                raise ValueError("Le numéro du passager adulte est obligatoire")
            if not self.telephone_parent:
                self.telephone_parent = self.telephone_passager
        else:  # enfant
            if not self.acheteur_nom:
                raise ValueError("Le nom de l'acheteur du ticket est obligatoire pour un enfant")
            if not self.acheteur_tel:
                raise ValueError("Le numéro de l'acheteur du ticket est obligatoire pour un enfant")
            if not self.telephone_parent:
                self.telephone_parent = self.acheteur_tel
        # En **enregistrement direct**, le chauffeur connaît forcément son
        # voyage : il est donc obligatoire. Au guichet, on autorise l'inverse —
        # enregistrer d'abord, affecter le voyage/chauffeur ensuite (voir
        # le POST « affectation »).
        if self.enregistrement_direct and self.voyage_id is None:
            raise ValueError(
                "voyage_id est obligatoire pour un enregistrement direct par le chauffeur"
            )
        return self


class SuiviFamilialEvenementCreate(BaseModel):
    """Marque une étape du voyage d'un enfant (départ, arrivée, remise)."""
    type_evenement: TypeEvenementSuivi
    gare_id: Optional[UUID] = None
    localisation: Optional[str] = Field(None, max_length=200)
    idempotency_key: Optional[str] = Field(None, max_length=120)
    horodatage: Optional[datetime] = None


class SuiviFamilialEvenementResponse(BaseModel):
    id: UUID
    suivi_familial_id: UUID
    type_evenement: str
    acteur_id: Optional[UUID] = None
    acteur_nom: Optional[str] = None
    gare_id: Optional[UUID] = None
    localisation: Optional[str] = None
    horodatage: datetime
    idempotency_key: Optional[str] = None
    synchro_le: Optional[datetime] = None
    cree_le: datetime
    model_config = ConfigDict(from_attributes=True)


class SuiviFamilialResponse(BaseModel):
    id: UUID
    ticket_id: Optional[UUID] = None
    code_clair: Optional[str] = None
    qr_token: Optional[str] = None
    qr_code_url: Optional[str] = None
    enfant_nom: str
    enfant_age: Optional[int] = None
    enfant_sexe: Optional[str] = None
    parent_nom: Optional[str] = None
    telephone_parent: str
    type_passager: str = "enfant"
    telephone_passager: Optional[str] = None
    acheteur_nom: Optional[str] = None
    acheteur_tel: Optional[str] = None
    proche_nom: Optional[str] = None
    proche_telephone: Optional[str] = None
    nombre_bagages: int = 1
    parent_id: Optional[UUID] = None
    gare_depart_id: UUID
    gare_arrivee_id: UUID
    # Arrêt précis où le passager descend (facultatif : à défaut, la gare
    # d'arrivée). Il doit appartenir à la ligne du voyage.
    arret_destination_id: Optional[UUID] = None
    voyage_id: Optional[UUID] = None
    chauffeur_id: Optional[UUID] = None
    statut: str
    sms_depart_envoye: bool
    sms_arrivee_envoye: bool
    pre_alerte_envoyee: bool = False
    # Origine de l'enregistrement : « guichet » ou « chauffeur_direct ».
    mode_enregistrement: str = "guichet"
    # Frais de service **fixe** (100 FCFA, quel que soit le nombre de bagages).
    frais_service_fcfa: int = 100
    enregistre_par_id: Optional[UUID] = None
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    # Champs enrichis (noms lisibles + ticket)
    gare_depart_nom: Optional[str] = None
    gare_arrivee_nom: Optional[str] = None
    enregistre_par_nom: Optional[str] = None
    chauffeur_nom: Optional[str] = None
    nb_evenements: int = 0
    # Position de l'arrêt de descente dans la tournée (tri du chauffeur).
    arret_destination_nom: Optional[str] = None
    arret_ordre: Optional[int] = None
    # Confirmation de prise en charge + remise au guichet d'arrivée.
    reception_confirmee_le: Optional[datetime] = None
    remis_guichet_le: Optional[datetime] = None
    remis_guichet_par_nom: Optional[str] = None
    remis_guichet_a_id: Optional[UUID] = None
    remis_guichet_a_nom: Optional[str] = None
    moyen_paiement: Optional[str] = None
    # Étiquettes QR générées (une par sac).
    bagages: list[BagageResponse] = []
    model_config = ConfigDict(from_attributes=True)


class ScanResponse(BaseModel):
    succes: bool
    deja_livre: bool = False
    deja_scanne: bool = False
    message: str
    statut_colis: Optional[str] = None
    colis: Optional[ColisResponse] = None
    suivi: Optional[SuiviFamilialResponse] = None
    ticket: Optional[TicketResponse] = None
    evenement: Optional[ColisEvenementResponse] = None


class SuiviFamilialEnregistre(BaseModel):
    """Réponse d'enregistrement : le suivi + son ticket (QR + code)."""
    suivi: SuiviFamilialResponse
    ticket: TicketResponse


class SuiviFamilialUpdate(BaseModel):
    """Correction d'une fiche passager par le guichet.

    Même règle que pour un colis : possible uniquement **avant** la prise en
    charge par le chauffeur et par l'agent qui a enregistré la fiche.
    """
    enfant_nom: Optional[str] = Field(None, min_length=2, max_length=150)
    enfant_age: Optional[int] = Field(None, ge=0, le=120)
    enfant_sexe: Optional[str] = Field(None, pattern=r"^[MF]$")
    parent_nom: Optional[str] = Field(None, max_length=150)
    telephone_parent: Optional[str] = Field(None, min_length=6, max_length=30)
    telephone_passager: Optional[str] = Field(None, min_length=6, max_length=30)
    acheteur_nom: Optional[str] = Field(None, max_length=150)
    acheteur_tel: Optional[str] = Field(None, min_length=6, max_length=30)
    proche_nom: Optional[str] = Field(None, max_length=150)
    proche_telephone: Optional[str] = Field(None, min_length=6, max_length=30)
    nombre_bagages: Optional[int] = Field(None, ge=1, le=10)
    arret_destination_id: Optional[UUID] = None

    @field_validator(
        "telephone_parent",
        "telephone_passager",
        "acheteur_tel",
        "proche_telephone",
        mode="before",
    )
    @classmethod
    def _valider_telephones(cls, valeur):
        from src.noyau.telephone import normaliser_numero_tiers

        return normaliser_numero_tiers(valeur)


class SuiviFamilialEvenementResultat(BaseModel):
    """Résultat d'un événement de suivi (idempotent)."""
    succes: bool = True
    deja_enregistre: bool = False
    message: str
    statut_suivi: Optional[str] = None
    suivi: Optional[SuiviFamilialResponse] = None
    evenement: Optional[SuiviFamilialEvenementResponse] = None


# ─── Suivi public (sans connexion) ───────────────────────────────────

class EvenementSuiviPublic(BaseModel):
    type_evenement: str
    horodatage: datetime
    localisation: Optional[str] = None
    gare_nom: Optional[str] = None


class NotificationSuiviPublic(BaseModel):
    type_evenement: str
    destinataire_role: Optional[str] = None
    telephone_masque: Optional[str] = None
    message: str
    envoye: bool
    cree_le: datetime


class ColisPublicInfo(BaseModel):
    destinataire_nom: str
    description: Optional[str] = None
    poids_kg: Optional[float] = None
    nombre_articles: int = 1
    nombre_bagages: int = 1


class EnfantPublicInfo(BaseModel):
    enfant_nom: str
    enfant_age: Optional[int] = None
    enfant_sexe: Optional[str] = None
    parent_nom: Optional[str] = None
    type_passager: str = "enfant"
    nombre_bagages: int = 1


class SuiviPublicResponse(BaseModel):
    """Vue publique d'un suivi (colis ou enfant) — sans données sensibles."""
    type: Literal["colis", "enfant"]
    code: str
    statut: str
    gare_depart_nom: Optional[str] = None
    gare_arrivee_nom: Optional[str] = None
    date_depart: Optional[datetime] = None
    vehicule_immatriculation: Optional[str] = None
    nb_personnes_notifiees: int = 0
    colis: Optional[ColisPublicInfo] = None
    enfant: Optional[EnfantPublicInfo] = None
    evenements: list[EvenementSuiviPublic] = []
    notifications: list[NotificationSuiviPublic] = []


# ─── Actions groupées du chauffeur (départ / arrivée / pré-alerte) ───

class ActionLotVoyageRequest(BaseModel):
    """Action en lot du chauffeur sur un voyage (passagers ET colis à la fois)."""
    # Gare ciblée (optionnelle) : pour « Arrivés », ne traiter que les colis et
    # passagers destinés à cette gare d'arrivée. Par défaut, tous.
    gare_id: Optional[UUID] = None
    # Arrêt intermédiaire ciblé : prioritaire sur gare_id. Le chauffeur marque
    # arrivés uniquement les passagers/colis qui descendent à cet arrêt, sans
    # terminer le voyage (il reste en route vers le terminus).
    arret_id: Optional[UUID] = None
    localisation: Optional[str] = Field(None, max_length=200)


class ActionLotVoyageResponse(BaseModel):
    """Résultat d'une action groupée (départ / arrivée)."""
    succes: bool = True
    message: str
    type_action: str
    voyage_id: Optional[UUID] = None
    nb_passagers: int = 0
    nb_colis: int = 0
    # Arrêt intermédiaire effectivement traité (None = toutes les gares).
    arret_id: Optional[UUID] = None
    # Statut du voyage après l'action (ex. planifie → en_cours → termine).
    statut_voyage: Optional[str] = None


class RemiseGuichetRequest(BaseModel):
    """Personne du guichet à qui le chauffeur confie le colis / l'enfant."""
    agent_id: UUID


class PreAlerteRequest(BaseModel):
    """Pré-alerte d'arrivée imminente (« Prévenir de l'approche »)."""
    delai_minutes: Optional[int] = Field(None, ge=1, le=600)
    localisation: Optional[str] = Field(None, max_length=200)


class PreAlerteResponse(BaseModel):
    """SMS de pré-alerte émis (passagers, proches de confiance, destinataires)."""
    succes: bool = True
    message: str
    voyage_id: Optional[UUID] = None
    nb_sms: int = 0
    nb_passagers: int = 0
    nb_colis: int = 0
