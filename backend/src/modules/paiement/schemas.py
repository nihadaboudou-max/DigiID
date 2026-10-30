# -*- coding: utf-8 -*-
"""Schémas Pydantic du domaine paiement (wallet, transactions, commissions)."""
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


# ─── Portefeuille ────────────────────────────────────────────────────

class PortefeuilleResponse(BaseModel):
    id: UUID
    proprietaire_id: UUID
    solde_fcfa: int
    devise: str
    actif: bool
    maj_le: Optional[datetime] = None
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class MouvementResponse(BaseModel):
    id: UUID
    portefeuille_id: UUID
    sens: str
    montant_fcfa: int
    motif: str
    reference_id: Optional[UUID] = None
    solde_apres: int
    cree_le: datetime
    model_config = ConfigDict(from_attributes=True)


# ─── Transactions ────────────────────────────────────────────────────

TypeTransaction = Literal[
    "COLIS", "PASSAGER", "BAGAGE", "ABONNEMENT", "API", "REVERSEMENT"
]
MoyenPaiement = Literal["especes", "mtn", "moov"]


class TransactionCreate(BaseModel):
    """Demande de paiement (S6 : un colis)."""
    type: TypeTransaction = "COLIS"
    colis_id: Optional[UUID] = None
    # ⚠️ Pour un COLIS, ce montant est **ignoré** : le prix est le frais de
    # service issu du barème par nombre d'articles (100 / 200 / 350 / 500 F selon
    # le contenu du colis). Il ne sert qu'aux autres types (abonnement, API…).
    montant_fcfa: Optional[int] = Field(None, ge=0)
    moyen: MoyenPaiement = "especes"
    telephone: Optional[str] = Field(None, max_length=30)
    # Par défaut : le payeur est l'utilisateur courant (guichet).
    payeur_id: Optional[UUID] = None
    idempotency_key: Optional[str] = Field(None, max_length=120)

    @model_validator(mode="after")
    def _colis_requis(self):
        if self.type == "COLIS" and self.colis_id is None:
            raise ValueError("Un paiement de type COLIS doit référencer 'colis_id'")
        if self.moyen in ("mtn", "moov") and not self.telephone:
            raise ValueError("Le numéro de téléphone mobile money est obligatoire")
        return self


class FraisSuiviCreate(BaseModel):
    """Paiement préalable des frais de suivi d'un dépôt commerçant."""
    nombre_articles: int = Field(..., ge=1, le=9999)
    moyen: MoyenPaiement
    telephone: Optional[str] = Field(None, max_length=30)
    payeur_id: UUID
    destinataire_id: Optional[UUID] = None
    telephone_destinataire: Optional[str] = Field(None, max_length=30)
    idempotency_key: str = Field(..., min_length=16, max_length=80)

    @field_validator("telephone_destinataire", mode="before")
    @classmethod
    def _normaliser_telephone_destinataire(cls, valeur):
        from src.noyau.telephone import normaliser_numero_tiers

        return normaliser_numero_tiers(valeur)

    @model_validator(mode="after")
    def _telephone_mobile_requis(self):
        if self.moyen in ("mtn", "moov") and not self.telephone:
            raise ValueError("Le numéro de téléphone mobile money est obligatoire")
        return self


class TransactionResponse(BaseModel):
    id: UUID
    reference: str
    type: str
    colis_id: Optional[UUID] = None
    payeur_id: Optional[UUID] = None
    beneficiaire_id: Optional[UUID] = None
    montant_fcfa: int
    # Répartition du frais de service : notre part, puis celle du receveur.
    frais_plateforme: int
    commission_receveur: int = 0
    montant_net: int
    statut: str
    moyen: str
    telephone: Optional[str] = None
    confirme_le: Optional[datetime] = None
    cree_le: datetime
    modifie_le: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class CommissionResponse(BaseModel):
    id: UUID
    transaction_id: UUID
    receveur_id: Optional[UUID] = None
    montant_fcfa: int
    statut: str
    portefeuille_id: Optional[UUID] = None
    verse_le: Optional[datetime] = None
    cree_le: datetime
    model_config = ConfigDict(from_attributes=True)


class PaiementResultat(BaseModel):
    """Résultat d'un paiement : transaction + commission + cagnotte bénéficiaire."""
    transaction: TransactionResponse
    commission: Optional[CommissionResponse] = None
    portefeuille_beneficiaire: Optional[PortefeuilleResponse] = None
    message: str
    model_config = ConfigDict(from_attributes=True)


# ─── Catalogue des moyens (UI) ───────────────────────────────────────

class MoyenPaiementInfo(BaseModel):
    code: str
    libelle: str
    immediat: bool


# ─── Tarifs (barème par nombre d'articles) ─────────────────

class PalierTarifaire(BaseModel):
    """Un palier du barème (bornes d'articles + frais + commission receveur)."""
    nb_articles_min: int
    # ``None`` = palier ouvert (« plus de N articles »).
    nb_articles_max: Optional[int] = None
    frais_fcfa: int
    part_receveur_fcfa: int


class TarifsColisResponse(BaseModel):
    """Tarif applicable à un colis (selon son nombre d'articles) + barème complet."""
    nombre_articles: int
    frais_fcfa: int
    part_receveur_fcfa: int
    part_plateforme_fcfa: int
    bareme: list[PalierTarifaire]


class ActeurStatistiquesFinancieres(BaseModel):
    acteur_id: UUID
    nom_complet: str
    transactions_reussies: int
    montant_encaisse_fcfa: int
    revenu_plateforme_fcfa: int
    commissions_fcfa: int


class StatistiquesPlateformeResponse(BaseModel):
    transactions_reussies: int
    montant_total_encaisse_fcfa: int
    revenu_plateforme_fcfa: int
    commissions_fcfa: int
    solde_total_cagnottes_fcfa: int
    top_acteurs: list[ActeurStatistiquesFinancieres]
