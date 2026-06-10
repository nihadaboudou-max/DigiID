# -*- coding: utf-8 -*-
"""
Catalogue des 14 badges deblocables.

Chaque badge a :
  - Un code technique stable (pour la base)
  - Un titre lisible
  - Une description (comment le debloquer)
  - Une icone (emoji)
  - Un bonus de score
  - Une condition de deblocage (fonction)
"""
from dataclasses import dataclass
from typing import Callable, Dict


@dataclass(frozen=True)
class DefinitionBadge:
    """Description d'un badge."""
    code: str
    titre: str
    description: str
    icone: str          # Emoji affiche dans le frontend
    bonus_score: int    # Points ajoutes au score quand debloque
    rarete: str         # "commun", "rare", "epique", "legendaire"


# Catalogue stable des badges disponibles.
# IMPORTANT : ne JAMAIS supprimer un badge, sinon les utilisateurs qui l'ont
# perdraient leur historique. On peut seulement ajouter de nouveaux badges.
CATALOGUE: Dict[str, DefinitionBadge] = {
    # --- Inscription et premiers pas ---
    "BIENVENUE": DefinitionBadge(
        code="BIENVENUE",
        titre="Bienvenue !",
        description="Tu t'es inscrit sur DigiID. Felicitations !",
        icone="🎉",
        bonus_score=2,
        rarete="commun",
    ),
    "PIONNIER": DefinitionBadge(
        code="PIONNIER",
        titre="Pionnier",
        description="Tu fais partie des 100 premiers utilisateurs DigiID.",
        icone="🌅",
        bonus_score=5,
        rarete="legendaire",
    ),

    # --- Completion du profil ---
    "PROFIL_COMPLET": DefinitionBadge(
        code="PROFIL_COMPLET",
        titre="Profil complet",
        description="Tu as rempli toutes les informations de ton profil.",
        icone="📋",
        bonus_score=4,
        rarete="commun",
    ),
    "VERIFIE": DefinitionBadge(
        code="VERIFIE",
        titre="Verifie",
        description="Ton email est verifie. Bienvenue dans la communaute.",
        icone="✅",
        bonus_score=3,
        rarete="commun",
    ),
    "SECURITE_PLUS": DefinitionBadge(
        code="SECURITE_PLUS",
        titre="Securite Plus",
        description="Tu as active la double authentification (2FA).",
        icone="🛡️",
        bonus_score=5,
        rarete="rare",
    ),

    # --- Streak (regularite d'usage) ---
    "STREAK_3_JOURS": DefinitionBadge(
        code="STREAK_3_JOURS",
        titre="3 jours d'affilee",
        description="3 jours consecutifs d'activite sur DigiID. Bonne habitude !",
        icone="🔥",
        bonus_score=2,
        rarete="commun",
    ),
    "STREAK_7_JOURS": DefinitionBadge(
        code="STREAK_7_JOURS",
        titre="Une semaine entiere",
        description="7 jours consecutifs d'activite. Tu deviens un habitue.",
        icone="🔥🔥",
        bonus_score=5,
        rarete="rare",
    ),
    "STREAK_30_JOURS": DefinitionBadge(
        code="STREAK_30_JOURS",
        titre="Mois complet !",
        description="30 jours consecutifs ! Tu fais partie des plus engages.",
        icone="🔥🔥🔥",
        bonus_score=10,
        rarete="epique",
    ),

    # --- Score (performance) ---
    "SCORE_50": DefinitionBadge(
        code="SCORE_50",
        titre="Mi-chemin",
        description="Ton score a atteint 50/100.",
        icone="📈",
        bonus_score=3,
        rarete="commun",
    ),
    "SCORE_80": DefinitionBadge(
        code="SCORE_80",
        titre="Excellence",
        description="Ton score depasse 80/100. Tu inspires confiance.",
        icone="⭐",
        bonus_score=6,
        rarete="rare",
    ),

    # --- Engagement social ---
    "CONFIANT": DefinitionBadge(
        code="CONFIANT",
        titre="Confiance accordee",
        description="Tu as accorde tous les consentements facultatifs.",
        icone="🤝",
        bonus_score=4,
        rarete="commun",
    ),
    "SOCIAL": DefinitionBadge(
        code="SOCIAL",
        titre="Sociable",
        description="Un de tes amis s'est inscrit grace a toi.",
        icone="👥",
        bonus_score=5,
        rarete="rare",
    ),

    # --- Utilisation des features ---
    "CHATBOT_ACTIF": DefinitionBadge(
        code="CHATBOT_ACTIF",
        titre="Discutant",
        description="Tu as cree 10 conversations avec l'assistant.",
        icone="💬",
        bonus_score=3,
        rarete="commun",
    ),
    "DOCUMENT_PARTAGE": DefinitionBadge(
        code="DOCUMENT_PARTAGE",
        titre="Bien organise",
        description="Tu as uploade au moins un document.",
        icone="📄",
        bonus_score=2,
        rarete="commun",
    ),
}


def obtenir_definition(code: str) -> DefinitionBadge | None:
    """Retourne la definition d'un badge, ou None si code inconnu."""
    return CATALOGUE.get(code)


def lister_tous() -> list[DefinitionBadge]:
    """Liste tous les badges du catalogue."""
    return list(CATALOGUE.values())
