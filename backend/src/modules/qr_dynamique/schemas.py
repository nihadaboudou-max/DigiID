# -*- coding: utf-8 -*-
"""Schémas Pydantic pour le module QR Code Dynamique."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class QRCodeGenere(BaseModel):
    """Réponse lors de la génération d'un QR Code."""
    token: str = Field(..., description="Token unique du QR Code")
    qr_code_url: str = Field(..., description="URL/contenu du QR Code à afficher")
    expire_a: datetime = Field(..., description="Date d'expiration du token")
    duree_vie_secondes: int = Field(default=30, description="Durée de vie en secondes")
    message: str = Field(default="QR Code généré avec succès")


class QRCodeVerification(BaseModel):
    """Réponse lors de la vérification d'un QR Code scanné."""
    succes: bool = Field(..., description="Indique si la vérification a réussi")
    citoyen: Optional[dict] = Field(None, description="Informations du citoyen")
    message: str = Field(..., description="Message d'état")


class QRCodeInvalide(BaseModel):
    """Réponse quand un QR Code est invalide/expiré."""
    succes: bool = Field(default=False)
    raison: str = Field(..., description="Raison de l'invalidation")
    message: str = Field(..., description="Message utilisateur")