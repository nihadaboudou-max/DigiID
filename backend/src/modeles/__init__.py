# -*- coding: utf-8 -*-
"""Modeles de base de donnees DigiID — tables SQLAlchemy 2.0."""
from src.modeles.utilisateur import Utilisateur
from src.modeles.role import Role
from src.modeles.session_authentification import SessionAuthentification
from src.modeles.audit import JournalAudit
from src.modeles.consentement import Consentement
from src.modeles.score_historique import ScoreHistorique
from src.modeles.document import Document
from src.modeles.conversation import Conversation, Message
from src.modeles.activite_quotidienne import ActiviteQuotidienne
from src.modeles.badge import Badge
from src.modeles.notification import Notification
from src.modeles.parrainage import Parrainage
from src.modeles.fraude_incident import FraudeIncident
from src.modeles.verification_visuelle import VerificationVisuelle
from src.modeles.configuration_systeme import ConfigurationSysteme
from src.modeles.code_verification import CodeVerification
from src.modeles.verification_cni import VerificationCNI
from src.modeles.attestation_communautaire import AttestationCommunautaire
from src.modeles.dossier_medical import DossierMedical, Consultation, Ordonnance
from src.modeles.enrolement import Enrolement
from src.modeles.verification_police import VerificationPolice, SignalementFraude
from src.modeles.ong import BeneficiaireONG, ProgrammeONG, MissionTerrain

__all__ = [
    "Utilisateur",
    "Role",
    "SessionAuthentification",
    "JournalAudit",
    "Consentement",
    "ScoreHistorique",
    "Document",
    "Conversation",
    "Message",
    "ActiviteQuotidienne",
    "Badge",
    "Notification",
    "Parrainage",
    "FraudeIncident",
    "VerificationVisuelle",
    "ConfigurationSysteme",
    "CodeVerification",
    "VerificationCNI",
    "AttestationCommunautaire",
    "DossierMedical",
    "Consultation",
    "Ordonnance",
    "Enrolement",
    "VerificationPolice",
    "SignalementFraude",
    "BeneficiaireONG",
    "ProgrammeONG",
    "MissionTerrain",
]
