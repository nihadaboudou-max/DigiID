# -*- coding: utf-8 -*-
"""Schémas Pydantic du module documents d'identité."""
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentIdentiteDetail(BaseModel):
    """Document d'identité complet (lecture)."""
    model_config = {"from_attributes": True}

    id: UUID
    utilisateur_id: UUID
    type_document: str
    est_actif: bool
    source: Optional[str] = "manuel"
    a_ete_corrige: bool = False
    verification_id: Optional[UUID] = None

    # Communs
    numero_document: Optional[str] = None
    nom_complet: Optional[str] = None
    date_naissance: Optional[date] = None
    lieu_naissance: Optional[str] = None
    nationalite: Optional[str] = None
    sexe: Optional[str] = None
    adresse: Optional[str] = None
    date_delivrance: Optional[date] = None
    date_expiration: Optional[date] = None
    pays_emetteur: Optional[str] = None

    # CNI
    autorite_delivrance: Optional[str] = None
    profession: Optional[str] = None
    taille_cm: Optional[int] = None

    # Permis
    categories_permis: Optional[str] = None
    centre_examen: Optional[str] = None
    numero_permis: Optional[str] = None

    # Assurance
    compagnie_assurance: Optional[str] = None
    type_couverture: Optional[str] = None
    numero_contrat: Optional[str] = None
    immatriculation_vehicule: Optional[str] = None
    marque_vehicule: Optional[str] = None
    modele_vehicule: Optional[str] = None
    annee_vehicule: Optional[int] = None

    # Métadonnées
    cree_le: datetime
    modifie_le: datetime


class DocumentIdentiteCreation(BaseModel):
    """Création d'un nouveau document d'identité."""
    type_document: str = Field(..., pattern=r"^(cni|permis|assurance)$")
    source: Optional[str] = "manuel"

    # Tous les champs sont optionnels à la création
    numero_document: Optional[str] = None
    nom_complet: Optional[str] = None
    date_naissance: Optional[date] = None
    lieu_naissance: Optional[str] = None
    nationalite: Optional[str] = None
    sexe: Optional[str] = None
    adresse: Optional[str] = None
    date_delivrance: Optional[date] = None
    date_expiration: Optional[date] = None
    pays_emetteur: Optional[str] = None

    autorite_delivrance: Optional[str] = None
    profession: Optional[str] = None
    taille_cm: Optional[int] = None

    categories_permis: Optional[str] = None
    centre_examen: Optional[str] = None
    numero_permis: Optional[str] = None

    compagnie_assurance: Optional[str] = None
    type_couverture: Optional[str] = None
    numero_contrat: Optional[str] = None
    immatriculation_vehicule: Optional[str] = None
    marque_vehicule: Optional[str] = None
    modele_vehicule: Optional[str] = None
    annee_vehicule: Optional[int] = None


class DocumentIdentiteModification(BaseModel):
    """Modification partielle d'un document existant."""
    est_actif: Optional[bool] = None
    numero_document: Optional[str] = None
    nom_complet: Optional[str] = None
    date_naissance: Optional[date] = None
    lieu_naissance: Optional[str] = None
    nationalite: Optional[str] = None
    sexe: Optional[str] = None
    adresse: Optional[str] = None
    date_delivrance: Optional[date] = None
    date_expiration: Optional[date] = None
    pays_emetteur: Optional[str] = None

    autorite_delivrance: Optional[str] = None
    profession: Optional[str] = None
    taille_cm: Optional[int] = None

    categories_permis: Optional[str] = None
    centre_examen: Optional[str] = None
    numero_permis: Optional[str] = None

    compagnie_assurance: Optional[str] = None
    type_couverture: Optional[str] = None
    numero_contrat: Optional[str] = None
    immatriculation_vehicule: Optional[str] = None
    marque_vehicule: Optional[str] = None
    modele_vehicule: Optional[str] = None
    annee_vehicule: Optional[int] = None


class ListeDocumentsIdentite(BaseModel):
    """Liste des documents d'identité."""
    documents: list[DocumentIdentiteDetail]
    total: int
