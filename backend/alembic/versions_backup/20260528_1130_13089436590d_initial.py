"""initial — Migration IDEMPOTENTE.

ID de révision : 13089436590d
Révisions précédentes : 
Créée le : 2026-05-28 11:30:15.468257

IMPORTANT : Toutes les créations et suppressions utilisent IF NOT EXISTS / IF EXISTS.
Ceci permet d'exécuter cette migration même si les tables existent déjà
(par exemple créées par un précédent create_all() ou par une exécution
partielle d'Alembic).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identifiants de révision
revision: str = '13089436590d'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Application de la migration — IDEMPOTENTE.

    Toutes les créations de tables et d'index utilisent IF NOT EXISTS
    pour éviter les DuplicateTableError/ProgrammingError quand les
    tables existent déjà (créées par un précédent create_all ou une
    exécution partielle d'Alembic).
    """

    # =====================================================================
    # Table : role
    # =====================================================================
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS role (
            id SERIAL NOT NULL,
            nom_technique VARCHAR(50) NOT NULL,
            nom_affichage VARCHAR(100) NOT NULL,
            description TEXT,
            niveau_hierarchie INTEGER NOT NULL,
            cree_le TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            modifie_le TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_role PRIMARY KEY (id)
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_role_cree_le ON role (cree_le)"
    ))
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_role_nom_technique ON role (nom_technique)"
    ))

    # =====================================================================
    # Table : utilisateur
    # =====================================================================
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS utilisateur (
            id UUID NOT NULL,
            digiid_public VARCHAR(16),
            email_chiffre VARCHAR(512) NOT NULL,
            email_hash VARCHAR(64) NOT NULL,
            mot_de_passe_hash VARCHAR(255) NOT NULL,
            prenom_chiffre VARCHAR(512),
            nom_chiffre VARCHAR(512),
            telephone_chiffre VARCHAR(512),
            ville VARCHAR(100),
            pays VARCHAR(50),
            role VARCHAR(50) NOT NULL,
            secret_2fa_chiffre VARCHAR(512),
            deux_fa_active BOOLEAN NOT NULL DEFAULT FALSE,
            est_actif BOOLEAN NOT NULL DEFAULT TRUE,
            est_email_verifie BOOLEAN NOT NULL DEFAULT FALSE,
            est_verrouille BOOLEAN NOT NULL DEFAULT FALSE,
            date_verrouillage TIMESTAMP WITH TIME ZONE,
            tentatives_connexion_echouees INTEGER NOT NULL DEFAULT 0,
            score_actuel INTEGER DEFAULT 0,
            date_dernier_calcul_score TIMESTAMP WITH TIME ZONE,
            empreinte_faciale BYTEA,
            est_supprime BOOLEAN NOT NULL DEFAULT FALSE,
            date_suppression TIMESTAMP WITH TIME ZONE,
            date_derniere_connexion TIMESTAMP WITH TIME ZONE,
            ip_derniere_connexion VARCHAR(45),
            cree_le TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            modifie_le TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_utilisateur PRIMARY KEY (id)
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_utilisateur_cree_le ON utilisateur (cree_le)"
    ))
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_utilisateur_digiid_public ON utilisateur (digiid_public)"
    ))
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_utilisateur_email_hash ON utilisateur (email_hash)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_utilisateur_est_actif ON utilisateur (est_actif)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_utilisateur_est_supprime ON utilisateur (est_supprime)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_utilisateur_role ON utilisateur (role)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_utilisateur_role_actif ON utilisateur (role, est_actif)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_utilisateur_role_supprime ON utilisateur (role, est_supprime)"
    ))

    # =====================================================================
    # Table : consentement
    # =====================================================================
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS consentement (
            id UUID NOT NULL,
            utilisateur_id UUID NOT NULL,
            categorie VARCHAR(100) NOT NULL,
            version_texte VARCHAR(20) NOT NULL,
            texte_accepte TEXT NOT NULL,
            est_accorde BOOLEAN NOT NULL,
            date_accord TIMESTAMP WITH TIME ZONE NOT NULL,
            date_retrait TIMESTAMP WITH TIME ZONE,
            adresse_ip_accord VARCHAR(45),
            cree_le TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            modifie_le TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_consentement PRIMARY KEY (id),
            CONSTRAINT fk_consentement_utilisateur_id_utilisateur
                FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id)
                ON DELETE CASCADE
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_consentement_categorie ON consentement (categorie)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_consentement_cree_le ON consentement (cree_le)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_consentement_utilisateur_id ON consentement (utilisateur_id)"
    ))

    # =====================================================================
    # Table : journal_audit
    # =====================================================================
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS journal_audit (
            id UUID NOT NULL,
            date_evenement TIMESTAMP WITH TIME ZONE NOT NULL,
            utilisateur_id UUID,
            role_acteur VARCHAR(50),
            type_evenement VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            adresse_ip VARCHAR(45),
            agent_utilisateur TEXT,
            request_id VARCHAR(36),
            donnees_supplementaires JSON,
            score_risque INTEGER,
            signature_cryptographique VARCHAR(128),
            CONSTRAINT pk_journal_audit PRIMARY KEY (id),
            CONSTRAINT fk_journal_audit_utilisateur_id_utilisateur
                FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id)
                ON DELETE SET NULL
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_audit_type_date ON journal_audit (type_evenement, date_evenement)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_audit_utilisateur_date ON journal_audit (utilisateur_id, date_evenement)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_journal_audit_adresse_ip ON journal_audit (adresse_ip)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_journal_audit_date_evenement ON journal_audit (date_evenement)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_journal_audit_request_id ON journal_audit (request_id)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_journal_audit_type_evenement ON journal_audit (type_evenement)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_journal_audit_utilisateur_id ON journal_audit (utilisateur_id)"
    ))

    # =====================================================================
    # Table : session_authentification
    # =====================================================================
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS session_authentification (
            id UUID NOT NULL,
            utilisateur_id UUID NOT NULL,
            refresh_token_hash VARCHAR(64) NOT NULL,
            adresse_ip VARCHAR(45) NOT NULL,
            agent_utilisateur TEXT,
            ville_estimee VARCHAR(100),
            pays_estime VARCHAR(50),
            date_expiration TIMESTAMP WITH TIME ZONE NOT NULL,
            date_derniere_utilisation TIMESTAMP WITH TIME ZONE NOT NULL,
            est_revoquee BOOLEAN NOT NULL DEFAULT FALSE,
            raison_revocation VARCHAR(100),
            cree_le TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            modifie_le TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_session_authentification PRIMARY KEY (id),
            CONSTRAINT fk_session_authentification_utilisateur_id_utilisateur
                FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id)
                ON DELETE CASCADE
        )
    """))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_session_authentification_cree_le "
        "ON session_authentification (cree_le)"
    ))
    op.execute(sa.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_session_authentification_refresh_token_hash "
        "ON session_authentification (refresh_token_hash)"
    ))
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_session_authentification_utilisateur_id "
        "ON session_authentification (utilisateur_id)"
    ))


def downgrade() -> None:
    """
    Annulation de la migration — IDEMPOTENTE.

    Toutes les suppressions utilisent IF EXISTS pour éviter les erreurs
    si la table/l'index a déjà été supprimé par un downgrade partiel.
    """
    op.execute(sa.text(
        "DROP INDEX IF EXISTS ix_session_authentification_utilisateur_id"
    ))
    op.execute(sa.text(
        "DROP INDEX IF EXISTS ix_session_authentification_refresh_token_hash"
    ))
    op.execute(sa.text(
        "DROP INDEX IF EXISTS ix_session_authentification_cree_le"
    ))
    op.execute(sa.text("DROP TABLE IF EXISTS session_authentification"))

    op.execute(sa.text("DROP INDEX IF EXISTS ix_journal_audit_utilisateur_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_journal_audit_type_evenement"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_journal_audit_request_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_journal_audit_date_evenement"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_journal_audit_adresse_ip"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_audit_utilisateur_date"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_audit_type_date"))
    op.execute(sa.text("DROP TABLE IF EXISTS journal_audit"))

    op.execute(sa.text("DROP INDEX IF EXISTS ix_consentement_utilisateur_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_consentement_cree_le"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_consentement_categorie"))
    op.execute(sa.text("DROP TABLE IF EXISTS consentement"))

    op.execute(sa.text("DROP INDEX IF EXISTS ix_utilisateur_role_supprime"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_utilisateur_role_actif"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_utilisateur_role"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_utilisateur_est_supprime"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_utilisateur_est_actif"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_utilisateur_email_hash"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_utilisateur_digiid_public"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_utilisateur_cree_le"))
    op.execute(sa.text("DROP TABLE IF EXISTS utilisateur"))

    op.execute(sa.text("DROP INDEX IF EXISTS ix_role_nom_technique"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_role_cree_le"))
    op.execute(sa.text("DROP TABLE IF EXISTS role"))
