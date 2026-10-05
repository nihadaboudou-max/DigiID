# -*- coding: utf-8 -*-
"""Modèles du domaine logistique (référentiel + colis de bout en bout)."""
from src.modeles.logistique.gare import Gare
from src.modeles.logistique.ligne import Ligne
from src.modeles.logistique.vehicule import Vehicule
from src.modeles.logistique.voyage import Voyage, STATUTS_VOYAGE
from src.modeles.logistique.acteur_logistique import ActeurLogistique, ROLES_ACTEUR
from src.modeles.logistique.ticket import Ticket, STATUTS_TICKET, TYPES_TICKET
from src.modeles.logistique.colis import Colis, STATUTS_COLIS
from src.modeles.logistique.colis_evenement import (
    ColisEvenement,
    TYPES_EVENEMENT_COLIS,
)
from src.modeles.logistique.suivi_familial import (
    SuiviFamilial,
    STATUTS_SUIVI_FAMILIAL,
)
from src.modeles.logistique.suivi_familial_evenement import (
    SuiviFamilialEvenement,
    TYPES_EVENEMENT_SUIVI,
)
from src.modeles.logistique.notification_logistique import (
    NotificationLogistique,
    CANAUX_NOTIFICATION,
    TYPES_CIBLE_NOTIFICATION,
)

__all__ = [
    "Gare",
    "Ligne",
    "Vehicule",
    "Voyage",
    "STATUTS_VOYAGE",
    "ActeurLogistique",
    "ROLES_ACTEUR",
    "Ticket",
    "STATUTS_TICKET",
    "TYPES_TICKET",
    "Colis",
    "STATUTS_COLIS",
    "ColisEvenement",
    "TYPES_EVENEMENT_COLIS",
    "SuiviFamilial",
    "STATUTS_SUIVI_FAMILIAL",
    "SuiviFamilialEvenement",
    "TYPES_EVENEMENT_SUIVI",
    "NotificationLogistique",
    "CANAUX_NOTIFICATION",
    "TYPES_CIBLE_NOTIFICATION",
]
