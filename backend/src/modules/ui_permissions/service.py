# -*- coding: utf-8 -*-
"""
Service UI Permissions — Logique métier de configuration des interfaces par rôle.

Permet au Super Admin de :
  - Consulter la matrice complète rôle × module
  - Activer/désactiver des modules UI par rôle
  - Mettre en lecture seule certains modules
  - Gérer les overrides individuels par utilisateur

Chaque modification est tracée dans le journal d'audit.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Utilisateur, JournalAudit
from src.noyau import journal
from src.noyau.exceptions import ErreurRessourceIntrouvable, ErreurValidation
from src.noyau.journal import journal_audit

# ---------------------------------------------------------------------------
# Types internes — dictionnaire représentant une ligne de ui_module_permissions
# ---------------------------------------------------------------------------

ModulePermissionDict = dict

# ---------------------------------------------------------------------------
# CONSTANTES : Modules UI par défaut pour chaque rôle
# ---------------------------------------------------------------------------

MODULES_PAR_DEFAUT: dict[str, list[dict]] = {
    "super_administrateur": [
        {"module_key": "gestion_roles", "module_label": "Gestion des rôles", "is_enabled": True, "is_read_only": False},
        {"module_key": "matrice_droits_ui", "module_label": "Matrice des droits UI", "is_enabled": True, "is_read_only": False},
        {"module_key": "audit_logs", "module_label": "Journal d'audit", "is_enabled": True, "is_read_only": True},
        {"module_key": "config_systeme", "module_label": "Configuration système", "is_enabled": True, "is_read_only": False},
        {"module_key": "gestion_utilisateurs", "module_label": "Gestion des utilisateurs", "is_enabled": True, "is_read_only": False},
        {"module_key": "statistiques_globales", "module_label": "Statistiques globales", "is_enabled": True, "is_read_only": True},
        {"module_key": "monitoring_temps_reel", "module_label": "Monitoring temps réel", "is_enabled": True, "is_read_only": True},
        {"module_key": "gestion_admins", "module_label": "Gestion des admins", "is_enabled": True, "is_read_only": False},
    ],
    "administrateur": [
        {"module_key": "gestion_utilisateurs_admin", "module_label": "Gestion utilisateurs", "is_enabled": True, "is_read_only": True},
        {"module_key": "matrice_droits", "module_label": "Matrice des droits", "is_enabled": True, "is_read_only": True},
        {"module_key": "audit_logs_admin", "module_label": "Journal d'audit", "is_enabled": True, "is_read_only": True},
        {"module_key": "statistiques_admin", "module_label": "Statistiques", "is_enabled": True, "is_read_only": True},
        {"module_key": "alertes_securite", "module_label": "Alertes sécurité", "is_enabled": True, "is_read_only": True},
        {"module_key": "mon_profil_admin", "module_label": "Mon profil admin", "is_enabled": True, "is_read_only": True},
    ],
    "citoyen": [
        {"module_key": "mon_profil", "module_label": "Mon profil", "is_enabled": True, "is_read_only": True},
        {"module_key": "mes_attestations", "module_label": "Mes attestations", "is_enabled": True, "is_read_only": True},
        {"module_key": "mon_score", "module_label": "Mon score", "is_enabled": True, "is_read_only": True},
        {"module_key": "mes_documents", "module_label": "Mes documents", "is_enabled": True, "is_read_only": True},
        {"module_key": "historique_acces", "module_label": "Historique d'accès", "is_enabled": True, "is_read_only": True},
        {"module_key": "verification_cni", "module_label": "Vérification CNI", "is_enabled": True, "is_read_only": False},
        {"module_key": "verification_faciale", "module_label": "Vérification faciale", "is_enabled": True, "is_read_only": False},
        {"module_key": "consentements", "module_label": "Mes consentements", "is_enabled": True, "is_read_only": False},
        {"module_key": "chatbot", "module_label": "Assistant DigiID", "is_enabled": True, "is_read_only": True},
        {"module_key": "badges", "module_label": "Mes badges", "is_enabled": True, "is_read_only": True},
        {"module_key": "parrainage", "module_label": "Mon parrainage", "is_enabled": True, "is_read_only": False},
    ],
    "agent": [
        {"module_key": "enrolement_citoyen", "module_label": "Enrôlement citoyen", "is_enabled": True, "is_read_only": False},
        {"module_key": "scan_ocr_cni", "module_label": "Scan OCR CNI", "is_enabled": True, "is_read_only": False},
        {"module_key": "capture_biometrique", "module_label": "Capture biométrique", "is_enabled": True, "is_read_only": False},
        {"module_key": "liste_enrollements", "module_label": "Liste des enrôlements", "is_enabled": True, "is_read_only": True},
        {"module_key": "recherche_citoyen", "module_label": "Recherche citoyen", "is_enabled": True, "is_read_only": True},
        {"module_key": "stats_enrolement", "module_label": "Statistiques enrôlement", "is_enabled": True, "is_read_only": True},
        {"module_key": "mon_profil_agent", "module_label": "Mon profil agent", "is_enabled": True, "is_read_only": True},
    ],
    "medecin": [
        {"module_key": "creation_dossier", "module_label": "Création dossier médical", "is_enabled": True, "is_read_only": False},
        {"module_key": "suivi_dossier", "module_label": "Suivi des dossiers", "is_enabled": True, "is_read_only": False},
        {"module_key": "recherche_patient", "module_label": "Recherche patient", "is_enabled": True, "is_read_only": False},
        {"module_key": "attestations_medicales", "module_label": "Attestations médicales", "is_enabled": True, "is_read_only": False},
        {"module_key": "historique_consultations", "module_label": "Historique consultations", "is_enabled": True, "is_read_only": True},
        {"module_key": "ordonnances", "module_label": "Ordonnances", "is_enabled": True, "is_read_only": False},
        {"module_key": "calendrier_rendezvous", "module_label": "Calendrier rendez-vous", "is_enabled": True, "is_read_only": False},
        {"module_key": "mon_profil_medecin", "module_label": "Mon profil médecin", "is_enabled": True, "is_read_only": True},
    ],
    "police": [
        {"module_key": "verification_identite", "module_label": "Vérification d'identité", "is_enabled": True, "is_read_only": False},
        {"module_key": "consultation_score", "module_label": "Consultation score", "is_enabled": True, "is_read_only": True},
        {"module_key": "recherche_personne", "module_label": "Recherche personne", "is_enabled": True, "is_read_only": False},
        {"module_key": "audit_acces_police", "module_label": "Audit accès police", "is_enabled": True, "is_read_only": True},
        {"module_key": "signalement_fraude", "module_label": "Signalement fraude", "is_enabled": True, "is_read_only": False},
        {"module_key": "mon_profil_police", "module_label": "Mon profil police", "is_enabled": True, "is_read_only": True},
    ],
    "ong": [
        {"module_key": "consultation_beneficiaires", "module_label": "Bénéficiaires", "is_enabled": True, "is_read_only": False},
        {"module_key": "attestations_communautaires", "module_label": "Attestations communautaires", "is_enabled": True, "is_read_only": False},
        {"module_key": "rapports_terrain", "module_label": "Rapports terrain", "is_enabled": True, "is_read_only": False},
        {"module_key": "gestion_programme", "module_label": "Gestion programme", "is_enabled": True, "is_read_only": False},
        {"module_key": "mon_profil_ong", "module_label": "Mon profil ONG", "is_enabled": True, "is_read_only": True},
        {"module_key": "statistiques_ong", "module_label": "Statistiques ONG", "is_enabled": True, "is_read_only": True},
        {"module_key": "calendrier_missions", "module_label": "Calendrier missions", "is_enabled": True, "is_read_only": False},
    ],
}

# Liste de tous les rôles valides
ROLES_VALIDES = list(MODULES_PAR_DEFAUT.keys())


async def _creer_table_si_necessaire(session: AsyncSession) -> None:
    """Crée la table ui_module_permissions si elle n'existe pas encore."""
    from sqlalchemy import text
    await session.execute(
        text("""
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
        """)
    )
    # Créer les index s'ils n'existent pas
    await session.execute(text("CREATE INDEX IF NOT EXISTS ix_ui_module_role ON ui_module_permissions(role_name);"))
    await session.execute(text("CREATE INDEX IF NOT EXISTS ix_ui_module_module ON ui_module_permissions(module_key);"))
    await session.execute(text("CREATE INDEX IF NOT EXISTS ix_ui_module_enabled ON ui_module_permissions(is_enabled);"))
    # Ajouter les colonnes sur utilisateur si absentes
    await session.execute(text("ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS ui_layout VARCHAR(50);"))
    await session.execute(text("ALTER TABLE utilisateur ADD COLUMN IF NOT EXISTS modules_overrides JSONB DEFAULT '{}'::jsonb;"))
    await session.commit()


async def obtenir_matrice_complete(session: AsyncSession) -> list[ModulePermissionDict]:
    """
    Retourne toute la matrice rôle × module depuis la base de données.
    Si la table est vide, utilise les valeurs par défaut.
    """
    from sqlalchemy import text

    await _creer_table_si_necessaire(session)

    resultat = await session.execute(
        text("""
            SELECT role_name, module_key, module_label, module_description,
                   module_icon, is_enabled, is_read_only, updated_at
            FROM ui_module_permissions
            ORDER BY role_name, module_key
        """)
    )
    lignes = resultat.mappings().all()

    if not lignes:
        # Fallback sur les données par défaut et insérer en base
        await _initialiser_modules_defaut(session)
        return await obtenir_matrice_complete(session)

    return [dict(ligne) for ligne in lignes]


async def obtenir_modules_role(
    session: AsyncSession,
    role: str,
) -> list[ModulePermissionDict]:
    """
    Retourne tous les modules d'un rôle spécifique.
    Crée la table si nécessaire (premier appel).
    """
    from sqlalchemy import text

    # S'assurer que la table existe (peut ne pas être le cas en prod)
    await _creer_table_si_necessaire(session)

    resultat = await session.execute(
        text("""
            SELECT role_name, module_key, module_label, module_description,
                   module_icon, is_enabled, is_read_only, updated_at
            FROM ui_module_permissions
            WHERE role_name = :role
            ORDER BY module_key
        """),
        {"role": role},
    )
    lignes = resultat.mappings().all()

    if not lignes:
        # Fallback sur les données par défaut
        modules_defaut = MODULES_PAR_DEFAUT.get(role, [])
        if not modules_defaut:
            raise ErreurRessourceIntrouvable(
                f"Rôle '{role}' inconnu",
                message_utilisateur=f"Le rôle '{role}' n'existe pas dans le système.",
            )
        # Insérer les modules par défaut pour ce rôle
        await _inserer_modules_pour_role(session, role, modules_defaut)
        return await obtenir_modules_role(session, role)

    return [dict(ligne) for ligne in lignes]


async def mettre_a_jour_module_role(
    session: AsyncSession,
    super_admin: Utilisateur,
    role: str,
    module_key: str,
    is_enabled: Optional[bool] = None,
    is_read_only: Optional[bool] = None,
    adresse_ip: Optional[str] = None,
) -> ModulePermissionDict:
    """
    Met à jour un module spécifique pour un rôle donné.
    """
    from sqlalchemy import text

    # Vérifier que le rôle existe
    if role not in ROLES_VALIDES:
        raise ErreurValidation(
            f"Rôle invalide : {role}",
            message_utilisateur=f"Le rôle '{role}' n'est pas reconnu.",
        )

    # Construire la requête de mise à jour dynamique
    updates = []
    params = {"role": role, "module_key": module_key}

    if is_enabled is not None:
        updates.append("is_enabled = :is_enabled")
        params["is_enabled"] = is_enabled
    if is_read_only is not None:
        updates.append("is_read_only = :is_read_only")
        params["is_read_only"] = is_read_only

    if not updates:
        raise ErreurValidation(
            "Aucun changement fourni",
            message_utilisateur="Tu dois fournir au moins un champ à modifier (is_enabled ou is_read_only).",
        )

    updates.append("updated_at = :updated_at")
    params["updated_at"] = datetime.now(timezone.utc)

    set_clause = ", ".join(updates)
    await session.execute(
        text(f"""
            UPDATE ui_module_permissions
            SET {set_clause}
            WHERE role_name = :role AND module_key = :module_key
            RETURNING role_name, module_key, module_label, module_description,
                      module_icon, is_enabled, is_read_only, updated_at
        """),
        params,
    )

    # Audit
    entree_audit = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="modification_droits_ui",
        description=f"Module '{module_key}' modifié pour le rôle '{role}'",
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "role": role,
            "module_key": module_key,
            "is_enabled": is_enabled,
            "is_read_only": is_read_only,
        },
    )
    session.add(entree_audit)
    await session.commit()

    journal_audit(
        f"droits_ui | modifié | role={role} | module={module_key} "
        f"| enabled={is_enabled} | readonly={is_read_only} | par={super_admin.id}"
    )

    # Retourner l'état mis à jour
    resultat = await session.execute(
        text("""
            SELECT role_name, module_key, module_label, module_description,
                   module_icon, is_enabled, is_read_only, updated_at
            FROM ui_module_permissions
            WHERE role_name = :role AND module_key = :module_key
        """),
        {"role": role, "module_key": module_key},
    )
    ligne = resultat.mappings().first()
    return dict(ligne) if ligne else {}


async def obtenir_config_ui_utilisateur(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> dict:
    """
    Retourne la configuration UI complète pour un utilisateur connecté.
    Fusionne :
      1. Les modules par défaut de son rôle
      2. Les overrides individuels (modules_overrides)
      3. Le layout préféré (ui_layout)
    """
    role = utilisateur.role

    # 1. Modules de base pour le rôle
    modules_role = await obtenir_modules_role(session, role)

    # 2. Overrides individuels (les colonnes peuvent ne pas exister en base)
    overrides = getattr(utilisateur, 'modules_overrides', None) or {}
    layout = getattr(utilisateur, 'ui_layout', None) or "default"

    # Appliquer les overrides
    modules_final = []
    for module in modules_role:
        module_key = module["module_key"]
        override = overrides.get(module_key, {})

        module_final = dict(module)
        if "is_enabled" in override:
            module_final["is_enabled"] = override["is_enabled"]
        if "is_read_only" in override:
            module_final["is_read_only"] = override["is_read_only"]
        modules_final.append(module_final)

    return {
        "role": role,
        "layout": layout,
        "modules": modules_final,
    }


async def mettre_a_jour_overrides_utilisateur(
    session: AsyncSession,
    super_admin: Utilisateur,
    utilisateur_id: UUID,
    modules_overrides: dict,
    adresse_ip: Optional[str] = None,
) -> dict:
    """
    Met à jour les overrides individuels d'un utilisateur.
    """
    from sqlalchemy import text

    # Vérifier que l'utilisateur existe
    resultat = await session.execute(
        text("SELECT id, role FROM utilisateur WHERE id = :id AND est_supprime = false"),
        {"id": utilisateur_id},
    )
    utilisateur_cible = resultat.mappings().first()
    if not utilisateur_cible:
        raise ErreurRessourceIntrouvable(
            f"Utilisateur {utilisateur_id} introuvable",
            message_utilisateur="Cet utilisateur n'existe pas ou a été supprimé.",
        )

    await session.execute(
        text("""
            UPDATE utilisateur
            SET modules_overrides = :overrides::jsonb
            WHERE id = :id
        """),
        {
            "id": utilisateur_id,
            "overrides": modules_overrides,
        },
    )

    # Audit
    entree_audit = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=super_admin.id,
        role_acteur=super_admin.role,
        type_evenement="modification_overrides_ui",
        description=f"Overrides UI modifiés pour l'utilisateur {utilisateur_id}",
        adresse_ip=adresse_ip,
        donnees_supplementaires={
            "utilisateur_cible_id": str(utilisateur_id),
            "overrides": modules_overrides,
        },
    )
    session.add(entree_audit)
    await session.commit()

    journal_audit(
        f"droits_ui | overrides | cible={utilisateur_id} | par={super_admin.id}"
    )

    return {
        "utilisateur_id": str(utilisateur_id),
        "modules_overrides": modules_overrides,
        "message": "Overrides UI mis à jour avec succès.",
    }


async def _initialiser_modules_defaut(session: AsyncSession) -> int:
    """
    Insère les modules par défaut pour tous les rôles dans la base.
    Retourne le nombre de modules insérés.
    """
    from sqlalchemy import text
    total = 0

    for role, modules in MODULES_PAR_DEFAUT.items():
        for module in modules:
            try:
                await session.execute(
                    text("""
                        INSERT INTO ui_module_permissions
                            (role_name, module_key, module_label, is_enabled, is_read_only)
                        VALUES
                            (:role, :module_key, :module_label, :is_enabled, :is_read_only)
                        ON CONFLICT (role_name, module_key) DO NOTHING
                    """),
                    {
                        "role": role,
                        "module_key": module["module_key"],
                        "module_label": module["module_label"],
                        "is_enabled": module["is_enabled"],
                        "is_read_only": module["is_read_only"],
                    },
                )
                total += 1
            except Exception:
                # Ignorer les doublons
                pass

    await session.commit()
    return total


async def _inserer_modules_pour_role(
    session: AsyncSession,
    role: str,
    modules: list[dict],
) -> None:
    """Insère les modules pour un rôle spécifique."""
    from sqlalchemy import text
    for module in modules:
        await session.execute(
            text("""
                INSERT INTO ui_module_permissions
                    (role_name, module_key, module_label, is_enabled, is_read_only)
                VALUES
                    (:role, :module_key, :module_label, :is_enabled, :is_read_only)
                ON CONFLICT (role_name, module_key) DO NOTHING
            """),
            {
                "role": role,
                "module_key": module["module_key"],
                "module_label": module["module_label"],
                "is_enabled": module["is_enabled"],
                "is_read_only": module["is_read_only"],
            },
        )
    await session.commit()
