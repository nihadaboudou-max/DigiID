# -*- coding: utf-8 -*-
"""
Schémas Pydantic unifiés pour le module d'inspection de documents.
Supporte tous les types de documents d'identité :
- CNI (biométrique et papier)
- Passeports
- Permis de conduire
- Cartes d'assurance (auto, vie)
- Cartes de séjour
- Tout document officiel avec données personnelles
"""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, List, Any
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# ENUMS — Types et statuts
# =============================================================================
class TypeDocument(str, Enum):
    """Types de documents supportés."""
    CNI_BIOMETRIQUE = "cni_biometrique"
    CNI_PAPIER = "cni_papier"
    PASSEPORT = "passeport"
    PERMIS_CONDUIRE = "permis_conduire"
    CARTE_ASSURANCE = "carte_assurance"
    CARTE_SEJOUR = "carte_sejour"
    CARTE_VOTE = "carte_vote"
    CARTE_ETUDIANT = "carte_etudiant"
    INCONNU = "inconnu"


class StatutVerification(str, Enum):
    """Statuts possibles d'une vérification."""
    EN_ATTENTE = "en_attente"
    APPROUVE = "approuve"
    REJETE = "rejete"
    PARTIEL = "partiel"


class FaceDocument(str, Enum):
    """Face du document scanné."""
    RECTO = "recto"
    VERSO = "verso"
    UNIQUE = "unique"


class SexeDocument(str, Enum):
    """Sexe extrait du document."""
    MASCULIN = "M"
    FEMININ = "F"
    NON_DETECTE = "non_detecte"


# =============================================================================
# SCHÉMA PRINCIPAL — Données extraites d'un document
# =============================================================================
class DonneesDocumentExtraites(BaseModel):
    """
    Schéma unifié pour les données extraites de n'importe quel document.
    Les champs spécifiques à un type (ex: catégories de permis) sont
    stockés dans `donnees_specifiques` pour garder le schéma flexible.
    """
    # Identification du document
    type_document: TypeDocument = TypeDocument.INCONNU
    pays_emetteur: Optional[str] = None
    face: FaceDocument = FaceDocument.UNIQUE
    
    # Champs d'identité communs (le cœur du système)
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    date_naissance: Optional[str] = None
    sexe: SexeDocument = SexeDocument.NON_DETECTE
    numero_document: Optional[str] = None
    date_expiration: Optional[str] = None
    
    # Champs secondaires (optionnels selon le type)
    lieu_naissance: Optional[str] = None
    date_delivrance: Optional[str] = None
    autorite_delivrance: Optional[str] = None
    nationalite: Optional[str] = None
    taille: Optional[str] = None
    
    # MRZ (si présente)
    mrz_ligne_1: Optional[str] = None
    mrz_ligne_2: Optional[str] = None
    mrz_ligne_3: Optional[str] = None
    mrz_valide: bool = False
    
    # Données spécifiques au type (JSON flexible)
    # Exemples :
    # - Permis : {"categories": ["A", "B"], "restrictions": []}
    # - Assurance : {"compagnie": "AXA", "num_police": "12345", "couverture": "Tous risques"}
    # - CNI : {"format_carte": "nouveau_2021", "code_pays": "SEN"}
    donnees_specifiques: Dict[str, Any] = Field(default_factory=dict)
    
    # Métadonnées techniques
    taux_confiance_ocr: float = 0.0
    texte_brut: str = ""
    format_carte: Optional[str] = None
    
    # Validations
    @field_validator("taux_confiance_ocr")
    @classmethod
    def confiance_valide(cls, v: float) -> float:
        return max(0.0, min(100.0, v))


# =============================================================================
# SCHÉMA DE VALIDATION
# =============================================================================
class ResultatValidation(BaseModel):
    """Résultat de la validation d'un document."""
    est_valide: bool = False
    statut: StatutVerification = StatutVerification.EN_ATTENTE
    scores: Dict[str, bool] = Field(default_factory=dict)
    message: str = ""
    erreurs: List[str] = Field(default_factory=list)


# =============================================================================
# SCHÉMA DE COHÉRENCE IDENTITÉ
# =============================================================================
class ResultatCoherence(BaseModel):
    """Résultat de la vérification de cohérence avec le profil utilisateur."""
    est_coherent: bool = False
    mode: str = "citoyen"  # "citoyen" ou "agent_terrain"
    message: str = ""
    incoherences: List[str] = Field(default_factory=list)


# =============================================================================
# SCHÉMA DE RÉPONSE API — Upload
# =============================================================================
class ReponseUploadDocument(BaseModel):
    """Réponse complète après upload et analyse d'un document."""
    id_verification: UUID
    type_document: TypeDocument
    statut: StatutVerification
    donnees: DonneesDocumentExtraites
    validation: ResultatValidation
    coherence: Optional[ResultatCoherence] = None
    message: str = ""
    temps_traitement_ms: int = 0


# =============================================================================
# SCHÉMA DE SYNTHÈSE
# =============================================================================
class SyntheseVerification(BaseModel):
    """Synthèse des vérifications d'un utilisateur."""
    id_recto: Optional[UUID] = None
    id_verso: Optional[UUID] = None
    statut: StatutVerification = StatutVerification.EN_ATTENTE
    donnees_recto: Optional[DonneesDocumentExtraites] = None
    donnees_verso: Optional[DonneesDocumentExtraites] = None
    validation_globale: Optional[ResultatValidation] = None
    message: str = ""
    champs_verifies: int = 0
    champs_total: int = 10


# =============================================================================
# SCHÉMA HISTORIQUE
# =============================================================================
class DetailVerification(BaseModel):
    """Détail d'une vérification dans l'historique."""
    id: UUID
    utilisateur_id: UUID
    type_document: TypeDocument
    statut: StatutVerification
    face: FaceDocument
    nom_fichier: str
    numero_document: Optional[str] = None
    nom_famille: Optional[str] = None
    prenoms: Optional[str] = None
    date_naissance: Optional[str] = None
    taux_confiance_ocr: float = 0.0
    est_valide: bool = False
    cree_le: datetime
    est_supprime: bool = False


class ListeVerifications(BaseModel):
    """Liste paginée des vérifications."""
    historique: List[DetailVerification]
    total: int
    limite: int


# =============================================================================
# SCHÉMA SUPPRESSION / RESTAURATION
# =============================================================================
class ReponseSuppression(BaseModel):
    id: UUID
    message: str = "Vérification supprimée avec succès."


class ReponseRestauration(BaseModel):
    id: UUID
    message: str = "Vérification restaurée avec succès."