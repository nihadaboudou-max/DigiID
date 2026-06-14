# -*- coding: utf-8 -*-
"""Ajout de la table ui_module_permissions pour la gestion des droits UI par rôle.

Revision ID: d5e6f7a8b9c0
Revises: a1b2c3d4e5f6
Create Date: 2026-06-10 12:00:00.000000

Description :
  Crée la table ui_module_permissions qui permet au Super Admin de
  configurer finement les modules UI accessibles par chaque rôle.
  Ajoute les colonnes ui_layout et modules_overrides à la table users.
"""
from typing import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# Identifiants de révision
revision: str = "d5e6f7a8b9c0"
down_revision: str = "a1b2c3d4e5f6"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Crée la table ui_module_permissions et ajoute les colonnes à users."""

    # --- Table des permissions UI par rôle ---
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ui_module_permissions (
            id UUID NOT NULL DEFAULT gen_random_uuid(),
            role_name VARCHAR(50) NOT NULL,
            module_key VARCHAR(100) NOT NULL,
            module_label VARCHAR(200),
            module_description TEXT,
            module_icon VARCHAR(50) DEFAULT 'default',
            is_enabled BOOLEAN DEFAULT true,
            is_read_only BOOLEAN DEFAULT false,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            CONSTRAINT pk_ui_module_permissions PRIMARY KEY (id),
            CONSTRAINT uq_ui_module_role_module UNIQUE (role_name, module_key)
        );
        """
    )

    # --- Index ---
    op.execute(
        "CREATE INDEX ix_ui_module_role ON ui_module_permissions(role_name);"
    )
    op.execute(
        "CREATE INDEX ix_ui_module_module ON ui_module_permissions(module_key);"
    )
    op.execute(
        "CREATE INDEX ix_ui_module_enabled ON ui_module_permissions(is_enabled);"
    )

    # --- Colonnes dans users ---
    op.execute(
        "ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS ui_layout VARCHAR(50);"
    )
    op.execute(
        "ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS modules_overrides JSONB DEFAULT '{}'::jsonb;"
    )

    # --- Seed des modules par défaut pour chaque rôle ---
    op.execute(
        """
        INSERT INTO ui_module_permissions (role_name, module_key, module_label, module_description, module_icon, is_enabled, is_read_only) VALUES
        -- SUPER_ADMIN
        ('super_administrateur', 'gestion_roles', 'Gestion des rôles', 'Attribution et révocation des rôles', 'shield', true, false),
        ('super_administrateur', 'matrice_droits_ui', 'Matrice des droits UI', 'Configuration des modules UI par rôle', 'grid', true, false),
        ('super_administrateur', 'audit_logs', 'Journal d''audit', 'Consultation des événements système', 'file-text', true, true),
        ('super_administrateur', 'config_systeme', 'Configuration système', 'Feature flags et paramètres globaux', 'settings', true, false),
        ('super_administrateur', 'gestion_utilisateurs', 'Gestion des utilisateurs', 'CRUD complet des utilisateurs', 'users', true, false),
        ('super_administrateur', 'statistiques_globales', 'Statistiques globales', 'KPIs et métriques système', 'bar-chart', true, true),
        ('super_administrateur', 'monitoring_temps_reel', 'Monitoring temps réel', 'Supervision en direct', 'activity', true, true),
        ('super_administrateur', 'gestion_admins', 'Gestion des admins', 'Création et suspension d''admins', 'user-plus', true, false),
        -- CITOYEN
        ('citoyen', 'mon_profil', 'Mon profil', 'Informations personnelles et identité', 'user', true, true),
        ('citoyen', 'mes_attestations', 'Mes attestations', 'Attestations reçues et émises', 'award', true, true),
        ('citoyen', 'mon_score', 'Mon score', 'Score de confiance et historique', 'trending-up', true, true),
        ('citoyen', 'mes_documents', 'Mes documents', 'Documents et justificatifs', 'file', true, true),
        ('citoyen', 'historique_acces', 'Historique d''accès', 'Traçabilité des consultations', 'clock', true, true),
        ('citoyen', 'verification_cni', 'Vérification CNI', 'Scan de la carte d''identité', 'credit-card', true, false),
        ('citoyen', 'verification_faciale', 'Vérification faciale', 'Reconnaissance faciale biométrique', 'camera', true, false),
        ('citoyen', 'consentements', 'Mes consentements', 'Gestion des autorisations', 'check-square', true, false),
        ('citoyen', 'chatbot', 'Assistant DigiID', 'Chatbot intelligent', 'message-circle', true, true),
        ('citoyen', 'badges', 'Mes badges', 'Gamification et récompenses', 'award', true, true),
        ('citoyen', 'parrainage', 'Mon parrainage', 'Code de parrainage et bonus', 'share-2', true, false),
        -- AGENT_TERRAIN
        ('agent', 'enrolement_citoyen', 'Enrôlement citoyen', 'Création de nouveaux comptes', 'user-plus', true, false),
        ('agent', 'scan_ocr_cni', 'Scan OCR CNI', 'Extraction des données CNI', 'scan', true, false),
        ('agent', 'capture_biometrique', 'Capture biométrique', 'Photo et empreintes', 'fingerprint', true, false),
        ('agent', 'liste_enrollements', 'Liste des enrôlements', 'Suivi des inscriptions récentes', 'list', true, true),
        ('agent', 'recherche_citoyen', 'Recherche citoyen', 'Recherche par identifiant', 'search', true, true),
        ('agent', 'stats_enrolement', 'Statistiques enrôlement', 'Compteurs et objectifs', 'bar-chart', true, true),
        ('agent', 'mon_profil_agent', 'Mon profil agent', 'Informations personnelles', 'user', true, true),
        -- MEDECIN
        ('medecin', 'creation_dossier', 'Création dossier médical', 'Nouveau dossier patient', 'file-plus', true, false),
        ('medecin', 'suivi_dossier', 'Suivi des dossiers', 'Consultation et suivi des patients', 'folder', true, false),
        ('medecin', 'recherche_patient', 'Recherche patient', 'Recherche par ID DigiID ou CNI', 'search', true, false),
        ('medecin', 'attestations_medicales', 'Attestations médicales', 'Émission et gestion d''attestations', 'file-text', true, false),
        ('medecin', 'historique_consultations', 'Historique consultations', 'Timeline des consultations', 'clock', true, true),
        ('medecin', 'ordonnances', 'Ordonnances', 'Prescriptions et documents', 'file', true, false),
        ('medecin', 'calendrier_rendezvous', 'Calendrier rendez-vous', 'Planification des consultations', 'calendar', true, false),
        ('medecin', 'mon_profil_medecin', 'Mon profil médecin', 'Informations professionnelles', 'user', true, true),
        -- POLICE
        ('police', 'verification_identite', 'Vérification d''identité', 'Vérification rapide d''une personne', 'search', true, false),
        ('police', 'consultation_score', 'Consultation score', 'Score de confiance du citoyen', 'trending-up', true, true),
        ('police', 'recherche_personne', 'Recherche personne', 'Recherche par empreinte ou identifiant', 'fingerprint', true, false),
        ('police', 'audit_acces_police', 'Audit accès police', 'Historique des vérifications effectuées', 'clock', true, true),
        ('police', 'signalement_fraude', 'Signalement fraude', 'Déclaration d''incidents', 'alert-triangle', true, false),
        ('police', 'mon_profil_police', 'Mon profil police', 'Informations professionnelles', 'user', true, true),
        -- ONG
        ('ong', 'consultation_beneficiaires', 'Bénéficiaires', 'Liste des bénéficiaires du programme', 'users', true, false),
        ('ong', 'attestations_communautaires', 'Attestations communautaires', 'Émission d''attestations pour bénéficiaires', 'award', true, false),
        ('ong', 'rapports_terrain', 'Rapports terrain', 'Export et analyse des données terrain', 'file-text', true, false),
        ('ong', 'gestion_programme', 'Gestion programme', 'Indicateurs et suivi de programme', 'bar-chart', true, false),
        ('ong', 'mon_profil_ong', 'Mon profil ONG', 'Informations de l''organisation', 'user', true, true),
        ('ong', 'statistiques_ong', 'Statistiques ONG', 'Indicateurs de couverture', 'pie-chart', true, true),
        ('ong', 'calendrier_missions', 'Calendrier missions', 'Planification des missions terrain', 'calendar', true, false),
        -- ADMINISTRATEUR (admin standard, pas super admin)
        ('administrateur', 'gestion_utilisateurs_admin', 'Gestion utilisateurs', 'Liste et recherche utilisateurs', 'users', true, true),
        ('administrateur', 'matrice_droits', 'Matrice des droits', 'Consultation RBAC', 'grid', true, true),
        ('administrateur', 'audit_logs_admin', 'Journal d''audit', 'Consultation des logs', 'file-text', true, true),
        ('administrateur', 'statistiques_admin', 'Statistiques', 'KPIs système', 'bar-chart', true, true),
        ('administrateur', 'alertes_securite', 'Alertes sécurité', 'Incidents de sécurité', 'alert-triangle', true, true),
        ('administrateur', 'mon_profil_admin', 'Mon profil admin', 'Informations personnelles', 'user', true, true)
        ON CONFLICT (role_name, module_key) DO NOTHING;
        """
    )


def downgrade() -> None:
    """Supprime la table et les colonnes ajoutées."""
    op.execute("DROP TABLE IF EXISTS ui_module_permissions;")
    op.execute("ALTER TABLE utilisateur DROP COLUMN IF EXISTS modules_overrides;")
    op.execute("ALTER TABLE utilisateur DROP COLUMN IF EXISTS ui_layout;")
