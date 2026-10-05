"""Restaure ui_module_permissions et migre les rôles legacy (agent → agent_terrain).

Corrige la régression des migrations qui avaient droppé la table
ui_module_permissions et les colonnes ui_layout / modules_overrides.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "c7a8b9d0e1f2"
down_revision: Union[str, None] = "b532ed16b0a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Colonnes UI sur utilisateur
    op.execute("ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS ui_layout VARCHAR(50)")
    op.execute(
        "ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS modules_overrides "
        "JSONB DEFAULT '{}'::jsonb"
    )

    # Table des permissions UI (recréée si absente après drop accidentel)
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
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_ui_module_role ON ui_module_permissions(role_name)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ui_module_module ON ui_module_permissions(module_key)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ui_module_enabled ON ui_module_permissions(is_enabled)")

    # Migrer les anciens noms de rôles vers les noms canoniques
    for legacy, canon in (
        ("agent", "agent_terrain"),
        ("medecin", "agent_medical"),
        ("police", "agent_police"),
        ("ong", "agent_ong"),
    ):
        op.execute(
            f"""
            UPDATE ui_module_permissions AS u
            SET role_name = '{canon}'
            WHERE role_name = '{legacy}'
              AND NOT EXISTS (
                  SELECT 1 FROM ui_module_permissions u2
                  WHERE u2.role_name = '{canon}' AND u2.module_key = u.module_key
              )
            """
        )
        op.execute(f"DELETE FROM ui_module_permissions WHERE role_name = '{legacy}'")

    # Seed / réactivation des modules agent_terrain
    op.execute(
        """
        INSERT INTO ui_module_permissions
            (role_name, module_key, module_label, module_description, module_icon, is_enabled, is_read_only)
        VALUES
            ('agent_terrain', 'enrolement_citoyen', 'Enrôlement citoyen', 'Création de nouveaux comptes', 'user-plus', true, false),
            ('agent_terrain', 'scan_ocr_cni', 'Scan OCR CNI', 'Extraction des données CNI', 'scan', true, false),
            ('agent_terrain', 'capture_biometrique', 'Capture biométrique', 'Photo et empreintes', 'fingerprint', true, false),
            ('agent_terrain', 'liste_enrollements', 'Liste des enrôlements', 'Suivi des inscriptions récentes', 'list', true, true),
            ('agent_terrain', 'recherche_citoyen', 'Recherche citoyen', 'Recherche par identifiant', 'search', true, true),
            ('agent_terrain', 'stats_enrolement', 'Statistiques enrôlement', 'Compteurs et objectifs', 'bar-chart', true, true),
            ('agent_terrain', 'mon_profil_agent', 'Mon profil agent', 'Informations personnelles', 'user', true, true)
        ON CONFLICT (role_name, module_key) DO UPDATE
        SET is_enabled = EXCLUDED.is_enabled,
            is_read_only = EXCLUDED.is_read_only,
            module_label = EXCLUDED.module_label,
            updated_at = now()
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM ui_module_permissions
        WHERE role_name = 'agent_terrain'
          AND module_key IN (
            'enrolement_citoyen', 'scan_ocr_cni', 'capture_biometrique',
            'liste_enrollements', 'recherche_citoyen', 'stats_enrolement', 'mon_profil_agent'
          )
        """
    )
