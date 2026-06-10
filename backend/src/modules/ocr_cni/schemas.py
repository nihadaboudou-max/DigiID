# -*- coding: utf-8 -*-
"""
Schémas Pydantic du module OCR CNI — validation et typage des données
extraites de la Carte Nationale d'Identité française.
"""
from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


# =============================================================================
# Types énumérés
# =============================================================================

StatutCNI = Literal["en_attente", "approuve", "rejete"]
TypeFormatCNI = Literal["nouveau_2021", "ancien", "non_reconnu"]
SexeCNI = Literal["M", "F", "non_detecte"]


# =============================================================================
# Schémas de données extraites de la CNI
# =============================================================================

class DonneesCNIExtraites(BaseModel):
    """
    Données structurées extraites automatiquement de la CNI par OCR.

    Tous les champs sont optionnels car l'OCR peut ne pas réussir
    à tout extraire selon la qualité de l'image.
    """
    # --- Identité ---
    nom_famille: Optional[str] = Field(None, description="Nom de famille")
    prenoms: Optional[str] = Field(None, description="Prénom(s)")
    sexe: Optional[SexeCNI] = Field(None, description="Sexe (M/F)")
    date_naissance: Optional[str] = Field(
        None, description="Date de naissance (format JJ/MM/AAAA)"
    )
    lieu_naissance: Optional[str] = Field(None, description="Lieu de naissance")

    # --- Carte d'identité ---
    numero_cni: Optional[str] = Field(
        None, description="Numéro de la carte (12 caractères alphanumériques)"
    )
    date_delivrance: Optional[str] = Field(
        None, description="Date de délivrance (format JJ/MM/AAAA)"
    )
    date_expiration: Optional[str] = Field(
        None, description="Date d'expiration (format JJ/MM/AAAA)"
    )
    autorite_delivrance: Optional[str] = Field(
        None, description="Autorité de délivrance"
    )
    taille: Optional[str] = Field(None, description="Taille en cm")

    # --- MRZ (Machine Readable Zone) ---
    mrz_ligne_1: Optional[str] = Field(None, description="Première ligne MRZ (30 car.)")
    mrz_ligne_2: Optional[str] = Field(None, description="Deuxième ligne MRZ (30 car.)")
    mrz_ligne_3: Optional[str] = Field(None, description="Troisième ligne MRZ (30 car.)")

    # --- Méta données OCR ---
    format_carte: Optional[TypeFormatCNI] = Field(
        "non_reconnu", description="Format de carte détecté"
    )
    texte_brut: Optional[str] = Field(
        None, description="Texte OCR brut complet (debug)"
    )
    taux_confiance_moyen: Optional[float] = Field(
        None, ge=0.0, le=100.0,
        description="Taux de confiance moyen de l'OCR (0-100)"
    )

    @field_validator("numero_cni")
    @classmethod
    def valider_format_numero(cls, valeur: Optional[str]) -> Optional[str]:
        """Validation basique du format du numéro CNI."""
        if valeur is None:
            return valeur
        # Nettoyer
        valeur = valeur.strip().upper().replace(" ", "").replace("-", "")
        # Le numéro CNI français fait 12 caractères alphanumériques
        # Format typique : 12AB34567CD (12 caractères)
        if len(valeur) == 12 and valeur.isalnum():
            return valeur
        # On accepte aussi les formats avec préfixe
        import re
        if re.match(r"^[A-Z0-9]{9,15}$", valeur):
            return valeur
        return valeur  # On garde quand même, l'OCR peut avoir mal lu

    @field_validator("date_naissance", "date_delivrance", "date_expiration")
    @classmethod
    def valider_format_date(cls, valeur: Optional[str]) -> Optional[str]:
        """Vérifie que la date est au format JJ/MM/AAAA."""
        if valeur is None:
            return valeur
        import re
        # Accepter différents séparateurs
        valeur = valeur.strip()
        # Normaliser les séparateurs
        valeur = re.sub(r"[.\-]", "/", valeur)
        # Vérifier le format JJ/MM/AAAA
        if re.match(r"^\d{2}/\d{2}/\d{4}$", valeur):
            # Vérifier validité de la date
            try:
                from datetime import datetime as dt
                dt.strptime(valeur, "%d/%m/%Y")
                return valeur
            except ValueError:
                return valeur  # On garde la valeur brute
        return valeur  # On garde ce que l'OCR a trouvé


class ResultatOCRCNI(BaseModel):
    """Résultat complet de l'OCR d'une CNI."""
    succes: bool = Field(..., description="L'OCR a-t-il réussi à extraire des données ?")
    donnees: DonneesCNIExtraites = Field(..., description="Données extraites")
    erreurs: list[str] = Field(
        default_factory=list,
        description="Liste des erreurs ou avertissements lors de l'extraction"
    )
    champs_extraits: int = Field(0, description="Nombre de champs extraits avec succès")
    temps_analyse_ms: Optional[int] = Field(
        None, description="Temps d'analyse en millisecondes"
    )


class ValidationCNIResultat(BaseModel):
    """Résultat de la validation des données CNI."""
    est_valide: bool = Field(..., description="La CNI est-elle valide ?")
    scores_validation: dict[str, bool] = Field(
        default_factory=dict,
        description="Détail des validations par champ"
    )
    verification_mrz: Optional[bool] = Field(
        None, description="La MRZ est-elle valide (checksum OK) ?"
    )
    message: str = Field(..., description="Message explicatif du résultat")


# =============================================================================
# Schémas API
# =============================================================================

class UploadCNIRequete(BaseModel):
    """Requête d'upload d'une image de CNI."""
    face: Literal["recto", "verso"] = Field(
        "recto", description="Face de la carte scannée"
    )


class ReponseUploadCNI(BaseModel):
    """Réponse après upload et traitement d'une face de CNI."""
    id: UUID = Field(..., description="ID de la vérification CNI")
    face: Literal["recto", "verso"] = Field(..., description="Face traitée")
    statut: StatutCNI = Field(..., description="Statut après traitement")
    resultat_ocr: ResultatOCRCNI = Field(..., description="Résultat de l'OCR")
    message: str = Field(..., description="Message à afficher à l'utilisateur")


class VerificationCNIDetail(BaseModel):
    """Détail complet d'une vérification CNI."""
    model_config = {"from_attributes": True}

    id: UUID
    utilisateur_id: UUID
    statut: StatutCNI
    face: Literal["recto", "verso"]
    nom_fichier: str
    type_mime: str
    taille_octets: int

    # Données extraites
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    sexe: Optional[str] = None
    date_naissance: Optional[str] = None
    lieu_naissance: Optional[str] = None
    numero_cni: Optional[str] = None
    date_delivrance: Optional[str] = None
    date_expiration: Optional[str] = None
    autorite_delivrance: Optional[str] = None
    taille: Optional[str] = None
    mrz_ligne_1: Optional[str] = None
    mrz_ligne_2: Optional[str] = None
    mrz_ligne_3: Optional[str] = None
    format_carte: Optional[str] = None

    # Scores et validation
    taux_confiance_ocr: Optional[float] = None
    validation_mrz: Optional[bool] = None
    est_valide: Optional[bool] = None
    scores_validation: Optional[dict] = None
    erreurs_ocr: Optional[list[str]] = None

    # Dates
    date_traitement: Optional[datetime] = None
    cree_le: datetime
    est_supprime: bool = False
    date_suppression: Optional[datetime] = None


class SyntheseVerificationCNI(BaseModel):
    """
    Synthèse d'une vérification complète (recto + verso).
    Utilisée pour afficher le résultat final à l'utilisateur.
    """
    id_recto: Optional[UUID] = None
    id_verso: Optional[UUID] = None
    statut: StatutCNI = "en_attente"
    donnees_recto: Optional[DonneesCNIExtraites] = None
    donnees_verso: Optional[DonneesCNIExtraites] = None
    validation_globale: Optional[ValidationCNIResultat] = None
    message: str = "En attente des deux faces de la carte."
    champs_verifies: int = 0
    champs_total: int = 10


class ListeVerificationsCNI(BaseModel):
    """Liste des vérifications CNI d'un utilisateur."""
    historique: list[VerificationCNIDetail]
    total: int


class SuppressionCNI(BaseModel):
    """Réponse après suppression d'une vérification CNI."""
    id: UUID
    message: str = "Vérification CNI supprimée avec succès."


class RestaurationCNI(BaseModel):
    """Réponse après restauration d'une vérification CNI."""
    id: UUID
    message: str = "Vérification CNI restaurée avec succès."
