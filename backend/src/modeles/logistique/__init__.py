# -*- coding: utf-8 -*-
"""Modèles du domaine logistique (référentiel + colis de bout en bout)."""
from src.modeles.logistique.gare import Gare
from src.modeles.logistique.ligne import Ligne
from src.modeles.logistique.vehicule import Vehicule
from src.modeles.logistique.voyage import Voyage, STATUTS_VOYAGE
from src.modeles.logistique.acteur_logistique import ActeurLogistique, ROLES_ACTEUR
from src.modeles.logistique.ticket import Ticket, STATUTS_TICKET, TYPES_TICKET
from src.modeles.logistique.colis import Colis, STATUTS_COLIS, MODES_ENREGISTREMENT_COLIS
from src.modeles.logistique.colis_evenement import (
    ColisEvenement,
    TYPES_EVENEMENT_COLIS,
)
from src.modeles.logistique.suivi_familial import (
    SuiviFamilial,
    STATUTS_SUIVI_FAMILIAL,
    MODES_ENREGISTREMENT_SUIVI,
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
from src.modeles.logistique.bagage import Bagage, STATUTS_BAGAGE
from src.modeles.logistique.profil_logistique import (
    ProfilLogistique,
    TYPES_PROFIL_LOGISTIQUE,
    STATUTS_VERIFICATION_PROFIL,
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
    "MODES_ENREGISTREMENT_COLIS",
    "ColisEvenement",
    "TYPES_EVENEMENT_COLIS",
    "SuiviFamilial",
    "STATUTS_SUIVI_FAMILIAL",
    "MODES_ENREGISTREMENT_SUIVI",
    "SuiviFamilialEvenement",
    "TYPES_EVENEMENT_SUIVI",
    "NotificationLogistique",
    "CANAUX_NOTIFICATION",
    "TYPES_CIBLE_NOTIFICATION",
    "Bagage",
    "STATUTS_BAGAGE",
    "ProfilLogistique",
    "TYPES_PROFIL_LOGISTIQUE",
    "STATUTS_VERIFICATION_PROFIL",
]
