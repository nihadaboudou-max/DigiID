# -*- coding: utf-8 -*-
"""
Système de journalisation (logs) DigiID.

Utilise Loguru pour :
  - Logs structurés JSON en production (exploitables par Loki/Grafana)
  - Logs lisibles colorisés en développement
  - Rotation automatique (10 Mo par fichier, 30 jours de rétention)
  - Niveaux DEBUG / INFO / WARNING / ERROR / CRITICAL
  - Corrélation par identifiant de requête (request_id)

Usage standard :
    from src.noyau import journal
    journal.info("Utilisateur connecté", utilisateur_id=42)
    journal.warning("Tentative de connexion échouée", email="x@y.com", ip="1.2.3.4")
    journal.error("Erreur base de données", exception=erreur)
"""
import sys
from pathlib import Path

from loguru import logger as journal

from src.config import parametres


def configurer_journal() -> None:
    """
    Configure Loguru avec les paramètres adaptés à l'environnement.

    À appeler une seule fois au démarrage de l'application (dans main.py).
    """
    # Supprimer le handler par défaut
    journal.remove()

    # --- Sortie console ---
    if parametres.est_developpement:
        # En dev : format coloré, lisible, avec emplacement du code
        format_console = (
            "<green>{time:HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        )
        journal.add(
            sys.stdout,
            format=format_console,
            level=parametres.niveau_journal,
            colorize=True,
            backtrace=True,
            diagnose=True,
        )
    else:
        # En prod : format JSON pour exploitation par outils centralisés (Loki)
        journal.add(
            sys.stdout,
            format="{message}",
            serialize=True,
            level=parametres.niveau_journal,
            backtrace=False,
            diagnose=False,
        )

    # --- Sortie fichier (toujours active) ---
    repertoire_logs = Path("logs")
    try:
        repertoire_logs.mkdir(exist_ok=True)
    except PermissionError:
        # Fallback : utiliser /tmp/logs si le dossier n'est pas accessible en écriture
        import tempfile
        repertoire_logs = Path(tempfile.gettempdir()) / "digiid_logs"
        repertoire_logs.mkdir(exist_ok=True)
        journal.warning(
            f"Impossible de créer 'logs/' à la racine — utilisation de {repertoire_logs} "
            "comme dossier de repli"
        )

    # Fichier principal — tous les niveaux
    journal.add(
        repertoire_logs / "digiid.log",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
        level=parametres.niveau_journal,
        rotation="10 MB",
        retention="30 days",
        compression="gz",
        encoding="utf-8",
    )

    # Fichier dédié aux erreurs — pour faciliter le tri
    journal.add(
        repertoire_logs / "erreurs.log",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
        level="ERROR",
        rotation="10 MB",
        retention="90 days",  # On garde les erreurs plus longtemps
        compression="gz",
        encoding="utf-8",
        backtrace=True,
        diagnose=True,
    )

    # Fichier d'audit sécurité — événements critiques
    journal.add(
        repertoire_logs / "audit.log",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | AUDIT | {message}",
        level="INFO",
        rotation="50 MB",
        retention="365 days",  # Audit gardé 1 an
        compression="gz",
        encoding="utf-8",
        filter=lambda enregistrement: "audit" in enregistrement["extra"],
    )

    journal.info(
        f"Journal configuré — environnement={parametres.environnement} "
        f"niveau={parametres.niveau_journal}"
    )


# Alias pratique pour audit
def journal_audit(message: str, **donnees) -> None:
    """
    Enregistre un événement d'audit sécurité.
    Va dans le fichier audit.log dédié, séparé des logs applicatifs.
    """
    journal.bind(audit=True).info(message, **donnees)


async def enregistrer_evenement_audit(
    session: "AsyncSession",
    type_evenement: str,
    description: str,
    utilisateur_id: "UUID | None" = None,
    role_acteur: str | None = None,
    adresse_ip: str | None = None,
    agent_utilisateur: str | None = None,
    donnees_supplementaires: dict | None = None,
) -> None:
    """
    Enregistre un événement dans la table `JournalAudit` (base de données).
    
    C'est CETTE fonction que le super admin consulte dans /super-admin/audit.
    Contrairement à `journal_audit()` qui écrit seulement dans les fichiers logs,
    celle-ci écrit en DB pour que l'événement soit visible dans l'interface d'audit.
    
    Usage :
        from src.noyau.journal import enregistrer_evenement_audit
        await enregistrer_evenement_audit(
            session=db,
            type_evenement="dossier_medical_creation",
            description=f"Création dossier pour patient {digiid}",
            utilisateur_id=medecin.id,
            role_acteur="medecin",
            adresse_ip=ip,
        )
    """
    # Import différé pour éviter les imports circulaires
    from datetime import datetime, timezone
    from src.modeles.audit import JournalAudit
    
    entree = JournalAudit(
        date_evenement=datetime.now(timezone.utc),
        utilisateur_id=utilisateur_id,
        role_acteur=role_acteur,
        type_evenement=type_evenement,
        description=description,
        adresse_ip=adresse_ip,
        agent_utilisateur=agent_utilisateur,
        donnees_supplementaires=donnees_supplementaires,
    )
    session.add(entree)
    
    # Aussi dans les logs fichiers
    journal_audit(f"{type_evenement} | utilisateur={utilisateur_id} | {description}")
