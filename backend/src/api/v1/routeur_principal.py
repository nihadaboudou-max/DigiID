# -*- coding: utf-8 -*-
"""
Routeur principal de l'API v1 DigiID.

Assemble tous les sous-routeurs des différents modules en un seul,
qui sera ensuite inclus dans l'application FastAPI.

Trois espaces séparés :
  /api/v1/auth/...           — authentification publique
  /api/v1/utilisateur/...    — espace utilisateur
  /api/v1/admin/...          — espace administrateur
  /api/v1/super-admin/...    — espace super administrateur

Plus des endpoints de monitoring :
  /api/v1/sante              — health check
  /api/v1/version            — version de l'API
"""
from fastapi import APIRouter

from src.modules.authentification import routeur_authentification
from src.modules.utilisateurs import routeur_utilisateur
from src.modules.admin import routeur_admin
from src.modules.super_admin import routeur_super_admin
from src.modules.monitoring import routeur_monitoring

# --- Phase 2 — modules métier ---
from src.modules.profil import routeur_profil
from src.modules.consentements import routeur_consentements
from src.modules.scoring import routeur_scoring

# --- Phase 3 — chatbot et documents ---
from src.modules.documents import routeur_documents
from src.modules.chatbot import routeur_chatbot

# --- Phase 4 — sécurité avancée ---
from src.modules.detection_fraude import routeur_fraude
from src.modules.verification_visuelle import routeur_verification

# --- Bonus — gamification (badges, streak, recommandations, notifications, parrainage) ---
from src.modules.gamification import routeur_gamification

# --- Module OCR CNI ---
from src.modules.ocr_cni import routeur_ocr_cni

# --- Module Documents d'Identité (CNI + Permis + Assurance) ---
# CORRECTION : renommé pour éviter l'écrasement de routeur_documents (Phase 3)
from src.modules.documents_identite import routeur_documents_identite

# --- Module Roles & Permissions (RBAC étendu) ---
from src.modules.roles import routeur_roles

# --- Verification d'identite (email, SMS, appel) ---
from src.modules.verification import routeur_verification as routeur_verif_identite

# --- Étape 4 — Attestations communautaires ---
from src.modules.attestations_communautaires import routeur_attestations

# --- Admin — Attestations communautaires (modération) ---
from src.modules.admin import routeur_admin_attestations

# --- Module Permissions UI (configuration des interfaces par rôle) ---
from src.modules.ui_permissions import routeur_ui_permissions
from src.modules.ui_permissions.routes import routeur_ui_config

# --- Modules métier par rôle professionnel ---
from src.modules.medical import routeur_medical, routeur_patient
from src.modules.enrolement import routeur_enrolement
from src.modules.police import routeur_police
from src.modules.ong import routeur_ong


# Routeur racine — préfixe et tag globaux gérés au montage
routeur_v1 = APIRouter()

# Authentification (publique)
routeur_v1.include_router(routeur_authentification)

# Monitoring (public)
routeur_v1.include_router(routeur_monitoring)

# Espaces protégés par rôle
routeur_v1.include_router(routeur_utilisateur)
routeur_v1.include_router(routeur_admin)
routeur_v1.include_router(routeur_super_admin)

# Modules métier Phase 2 (utilisateur authentifié uniquement)
routeur_v1.include_router(routeur_profil)
routeur_v1.include_router(routeur_consentements)
routeur_v1.include_router(routeur_scoring)

# Modules Phase 3 — chatbot et documents RAG (utilisateur authentifié uniquement)
routeur_v1.include_router(routeur_documents)
routeur_v1.include_router(routeur_chatbot)

# Phase 4 — sécurité avancée
routeur_v1.include_router(routeur_fraude)
routeur_v1.include_router(routeur_verification)

# Bonus — gamification (badges, streak, recommandations, notifications, parrainage)
routeur_v1.include_router(routeur_gamification)

# Module OCR CNI — scan et authentification carte d'identité
routeur_v1.include_router(routeur_ocr_cni)

# Module Documents d'Identité — CNI, Permis, Assurance
# CORRECTION : utilise routeur_documents_identite (distinct de routeur_documents Phase 3)
routeur_v1.include_router(routeur_documents_identite)

# Module Roles & Permissions (RBAC étendu) — Étape 2
routeur_v1.include_router(routeur_roles)

# Verification d'identite (email, SMS, appel)
routeur_v1.include_router(routeur_verif_identite)

# Étape 4 — Attestations communautaires (réseau de confiance pair-à-pair)
routeur_v1.include_router(routeur_attestations)

# Admin — Attestations communautaires (modération réservée aux admins)
routeur_v1.include_router(routeur_admin_attestations)

# Module Permissions UI — configuration des interfaces par rôle
routeur_v1.include_router(routeur_ui_permissions)
routeur_v1.include_router(routeur_ui_config)

# Modules métier par rôle professionnel
routeur_v1.include_router(routeur_medical)
routeur_v1.include_router(routeur_enrolement)
routeur_v1.include_router(routeur_police)
routeur_v1.include_router(routeur_ong)

# Module Patient — accès citoyen à ses informations médicales
routeur_v1.include_router(routeur_patient)
