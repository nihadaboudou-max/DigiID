# -*- coding: utf-8 -*-
"""
Service Chatbot — orchestration complète.

Pour chaque message envoyé par l'utilisateur :
  1. On enregistre son message en base
  2. On reconstitue l'historique de la conversation (mémoire)
  3. On ajoute les documents qu'il a uploadés comme contexte (RAG basique)
  4. On appelle le LLM
  5. On enregistre la réponse en base
  6. On retourne les deux messages au frontend
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.modeles import Conversation, Message, Utilisateur
from src.modules.chatbot.fournisseur_llm import appeler_llm
from src.modules.documents.service import obtenir_textes_documents
from src.modules.gamification import service_badges, service_tracking
from src.noyau import journal
from src.noyau.exceptions import ErreurRessourceIntrouvable


# Combien de messages précédents on garde dans la "mémoire"
# (au-delà, la conversation devient trop longue pour le LLM)
TAILLE_MEMOIRE_MESSAGES = 10

# Limite de caractères par document inclus dans le contexte
# (sinon on dépasse la fenêtre de contexte du LLM)
LIMITE_CARACTERES_PAR_DOC = 2000


def _construire_prompt_systeme(prenom: Optional[str], documents: list[tuple[str, str]]) -> str:
    """
    Construit le message système qui donne au LLM son rôle et son contexte.

    On y inclut :
      - Sa mission (assistant DigiID)
      - Son ton (clair, amical, factuel)
      - Les documents que l'utilisateur a uploadés (pour qu'il puisse répondre dessus)
    """
    base = (
        "Tu es l'assistant DigiID, un système d'identité numérique africaine. "
        "Tu réponds aux questions de l'utilisateur sur l'application DigiID, "
        "son score, ses données, ainsi que sur les documents qu'il t'a fournis. "
        "Tu réponds en français, de manière claire, amicale et factuelle. "
        "Tu ne donnes jamais d'informations sur d'autres utilisateurs. "
        "Si tu ne sais pas, tu le dis honnêtement."
    )

    # Personnalisation par prénom si disponible
    if prenom:
        base += f"\n\nL'utilisateur s'appelle {prenom}. Tu peux l'appeler par son prénom."

    # Ajouter les documents en contexte (limités en taille)
    if documents:
        base += "\n\n--- DOCUMENTS FOURNIS PAR L'UTILISATEUR ---"
        for nom, contenu in documents:
            # On tronque chaque document pour ne pas exploser la fenêtre de contexte
            contenu_tronque = contenu[:LIMITE_CARACTERES_PAR_DOC]
            if len(contenu) > LIMITE_CARACTERES_PAR_DOC:
                contenu_tronque += "\n[... document tronqué pour économiser l'espace]"
            base += f"\n\n### Document : {nom}\n{contenu_tronque}"
        base += (
            "\n\n--- FIN DES DOCUMENTS ---\n"
            "Quand tu réponds, cite le document utilisé. Si la question ne porte "
            "pas sur un document, ignore-les."
        )

    return base


async def creer_conversation(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> Conversation:
    """Crée une conversation vide pour l'utilisateur."""
    conversation = Conversation(
        utilisateur_id=utilisateur.id,
        titre="Nouvelle conversation",
    )
    session.add(conversation)
    await session.commit()
    await session.refresh(conversation)
    journal.info(f"Conversation créée : id={conversation.id} utilisateur={utilisateur.id}")
    return conversation


async def lister_conversations(
    session: AsyncSession,
    utilisateur: Utilisateur,
) -> list[Conversation]:
    """Liste les conversations de l'utilisateur, triées par activité récente."""
    resultat = await session.execute(
        select(Conversation)
        .where(Conversation.utilisateur_id == utilisateur.id)
        .order_by(
            # Trier d'abord par date_dernier_message (les conversations actives en haut),
            # puis par date de création pour les conversations encore vides
            desc(func.coalesce(Conversation.date_dernier_message, Conversation.cree_le))
        )
    )
    return list(resultat.scalars().all())


async def obtenir_conversation_avec_messages(
    session: AsyncSession,
    utilisateur: Utilisateur,
    conversation_id: UUID,
) -> Conversation:
    """Récupère une conversation avec tous ses messages — vérifie l'ownership."""
    resultat = await session.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.utilisateur_id == utilisateur.id,  # Sécurité : on filtre par owner
        )
        .options(selectinload(Conversation.messages))
    )
    conversation = resultat.scalar_one_or_none()
    if conversation is None:
        raise ErreurRessourceIntrouvable(
            f"Conversation {conversation_id} introuvable",
            message_utilisateur="Conversation introuvable.",
        )
    return conversation


async def envoyer_message(
    session: AsyncSession,
    utilisateur: Utilisateur,
    conversation_id: UUID,
    contenu_utilisateur: str,
) -> tuple[Message, Message]:
    """
    Envoie un message dans une conversation et reçoit la réponse de l'assistant.

    Retour :
        (message_utilisateur, message_assistant)
    """
    # 1. Récupérer la conversation et son historique
    conversation = await obtenir_conversation_avec_messages(
        session, utilisateur, conversation_id,
    )

    # 2. Enregistrer le message de l'utilisateur
    maintenant = datetime.now(timezone.utc)
    message_user = Message(
        conversation_id=conversation_id,
        auteur="utilisateur",
        contenu=contenu_utilisateur,
    )
    session.add(message_user)

    # 3. Construire l'historique pour le LLM (les N derniers messages)
    # On les prend dans l'ordre chronologique
    derniers_messages = conversation.messages[-TAILLE_MEMOIRE_MESSAGES:]
    historique_pour_llm = [
        {"role": m.auteur if m.auteur == "assistant" else "user", "content": m.contenu}
        for m in derniers_messages
    ]

    # 4. Récupérer les documents de l'utilisateur pour le contexte RAG
    documents = await obtenir_textes_documents(session, utilisateur, limite=5)

    # 5. Récupérer le prénom (pour personnalisation) — déchiffré
    prenom = None
    if utilisateur.prenom_chiffre:
        from src.noyau.chiffrement import dechiffrer_donnee
        try:
            prenom = dechiffrer_donnee(utilisateur.prenom_chiffre)
        except Exception:
            prenom = None

    # 6. Construire le prompt système avec les docs en contexte
    prompt_systeme = _construire_prompt_systeme(prenom=prenom, documents=documents)

    # 7. Appeler le LLM
    journal.info(f"Appel LLM : utilisateur={utilisateur.id} historique={len(historique_pour_llm)} docs={len(documents)}")
    contenu_reponse = await appeler_llm(
        prompt_systeme=prompt_systeme,
        messages_historique=historique_pour_llm,
        question_utilisateur=contenu_utilisateur,
    )

    # 8. Enregistrer la réponse de l'assistant
    message_assistant = Message(
        conversation_id=conversation_id,
        auteur="assistant",
        contenu=contenu_reponse,
    )
    session.add(message_assistant)

    # 9. Mettre à jour la conversation (date dernière activité + titre si vide)
    conversation.date_dernier_message = maintenant
    if conversation.titre == "Nouvelle conversation":
        # Titre = premiers 80 caractères du premier message utilisateur
        nouveau_titre = contenu_utilisateur[:80]
        if len(contenu_utilisateur) > 80:
            nouveau_titre = nouveau_titre.rsplit(" ", 1)[0] + "..."
        conversation.titre = nouveau_titre

    await session.commit()
    await session.refresh(message_user)
    await session.refresh(message_assistant)

    await service_tracking.tracker_action(session, utilisateur, "chatbot_message")
    await service_badges.verifier_et_debloquer_badges(session, utilisateur)
    await session.commit()

    return message_user, message_assistant


async def supprimer_conversation(
    session: AsyncSession,
    utilisateur: Utilisateur,
    conversation_id: UUID,
) -> None:
    """Supprime une conversation et tous ses messages."""
    conversation = await obtenir_conversation_avec_messages(
        session, utilisateur, conversation_id,
    )
    await session.delete(conversation)
    await session.commit()
    journal.info(f"Conversation supprimée : id={conversation_id} utilisateur={utilisateur.id}")
