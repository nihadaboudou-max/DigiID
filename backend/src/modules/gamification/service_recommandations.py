# -*- coding: utf-8 -*-
"""
Moteur de recommandations personnalisees.

Analyse l'etat du compte de l'utilisateur et suggere des actions CONCRETES
pour ameliorer son score, avec le GAIN ESTIME pour chaque suggestion.

C'est le pendant transparent du scoring : on ne dit pas seulement "ton score
est de 42" mais aussi "voici comment tu peux le faire monter".
"""
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.modeles import Consentement, Conversation, Document, Utilisateur


@dataclass
class Recommandation:
    """Une suggestion d'action concrete."""
    code: str
    titre: str
    description: str
    icone: str
    gain_estime: int       # Points de score si l'action est faite
    lien_action: str       # URL frontend ou l'utilisateur peut faire l'action
    priorite: str          # "haute", "moyenne", "basse"


async def generer_recommandations(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> list[Recommandation]:
    """
    Genere les recommandations adaptees au profil de l'utilisateur.

    Algorithme simple mais efficace : on regarde ce qui MANQUE dans son
    profil/usage, et on lui suggere de le faire avec un gain estime.

    Les recommandations sont triees par priorite (haute → basse).
    """
    suggestions: list[Recommandation] = []

    # --- 1. Verifier l'email ---
    if not utilisateur.est_email_verifie:
        suggestions.append(Recommandation(
            code="VERIFIER_EMAIL",
            titre="Verifier ton email",
            description="Confirme ton email pour gagner en credibilite et debloquer le badge Verifie.",
            icone="✉️",
            gain_estime=5,
            lien_action="/parametres",
            priorite="haute",
        ))

    # --- 2. Activer la 2FA ---
    if not utilisateur.deux_fa_active:
        suggestions.append(Recommandation(
            code="ACTIVER_2FA",
            titre="Activer la double authentification",
            description="Securise ton compte avec un code TOTP. Tu gagnes le badge Securite Plus.",
            icone="🛡️",
            gain_estime=8,
            lien_action="/parametres",
            priorite="haute",
        ))

    # --- 3. Completer le profil ---
    champs_manquants = []
    if not utilisateur.prenom_chiffre: champs_manquants.append("prenom")
    if not utilisateur.nom_chiffre: champs_manquants.append("nom")
    if not utilisateur.telephone_chiffre: champs_manquants.append("telephone")
    if not utilisateur.ville: champs_manquants.append("ville")

    if champs_manquants:
        nombre = len(champs_manquants)
        suggestions.append(Recommandation(
            code="COMPLETER_PROFIL",
            titre=f"Completer ton profil ({nombre} champ{'s' if nombre > 1 else ''} manquant{'s' if nombre > 1 else ''})",
            description=f"Remplis : {', '.join(champs_manquants)}. Chaque champ ajoute fait monter ton score.",
            icone="📋",
            gain_estime=nombre * 3,
            lien_action="/profil",
            priorite="haute" if nombre >= 2 else "moyenne",
        ))

    # --- 4. Accorder plus de consentements ---
    nb_consentements_facultatifs = await session.scalar(
        select(func.count(Consentement.id)).where(
            Consentement.utilisateur_id == utilisateur.id,
            Consentement.est_accorde == True,
            Consentement.date_retrait.is_(None),
            Consentement.categorie != "cgu",
        )
    ) or 0

    if nb_consentements_facultatifs < 5:
        manquants = 5 - nb_consentements_facultatifs
        suggestions.append(Recommandation(
            code="ACCORDER_CONSENTEMENTS",
            titre=f"Accorder {manquants} consentement{'s' if manquants > 1 else ''} de plus",
            description="Plus tu autorises de sources de donnees, plus ton score est precis. Tu peux retirer a tout moment.",
            icone="🤝",
            gain_estime=manquants * 4,
            lien_action="/consentements",
            priorite="moyenne",
        ))

    # --- 5. Utiliser le chatbot ---
    nb_conversations = await session.scalar(
        select(func.count(Conversation.id)).where(
            Conversation.utilisateur_id == utilisateur.id,
        )
    ) or 0

    if nb_conversations < 3:
        suggestions.append(Recommandation(
            code="UTILISER_CHATBOT",
            titre="Discuter avec l'assistant DigiID",
            description="Lance une conversation. L'assistant peut te conseiller pour ton score et tes documents.",
            icone="💬",
            gain_estime=2,
            lien_action="/chatbot",
            priorite="basse",
        ))

    # --- 6. Uploader un document ---
    nb_documents = await session.scalar(
        select(func.count(Document.id)).where(
            Document.utilisateur_id == utilisateur.id,
        )
    ) or 0

    if nb_documents == 0:
        suggestions.append(Recommandation(
            code="UPLOADER_DOCUMENT",
            titre="Uploader un document personnel",
            description="Ajoute un CV, attestation, ou note. L'assistant pourra l'utiliser pour repondre.",
            icone="📄",
            gain_estime=3,
            lien_action="/documents",
            priorite="basse",
        ))

    # --- 7. Inviter un ami (parrainage) ---
    suggestions.append(Recommandation(
        code="INVITER_AMI",
        titre="Inviter un ami a rejoindre DigiID",
        description="Partage ton code de parrainage. Tu gagnes 5 points par filleul inscrit, et il gagne 3 points.",
        icone="👥",
        gain_estime=5,
        lien_action="/parrainage",
        priorite="basse",
    ))

    # --- 8. Maintenir le streak ---
    if utilisateur.streak_actuel >= 1 and utilisateur.streak_actuel < 7:
        prochain_palier = 3 if utilisateur.streak_actuel < 3 else 7
        manque = prochain_palier - utilisateur.streak_actuel
        suggestions.append(Recommandation(
            code="MAINTENIR_STREAK",
            titre=f"Atteindre {prochain_palier} jours d'affilee ({manque} a faire)",
            description=f"Tu es a {utilisateur.streak_actuel} jours. Reviens chaque jour pour debloquer le badge !",
            icone="🔥",
            gain_estime=3 if prochain_palier == 3 else 5,
            lien_action="/tableau-de-bord",
            priorite="moyenne",
        ))

    # Trier par priorite : haute > moyenne > basse, puis gain decroissant
    ordre_priorite = {"haute": 0, "moyenne": 1, "basse": 2}
    suggestions.sort(key=lambda r: (ordre_priorite[r.priorite], -r.gain_estime))

    return suggestions
