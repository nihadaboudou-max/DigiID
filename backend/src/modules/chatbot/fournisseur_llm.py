# -*- coding: utf-8 -*-
"""
Couche d'abstraction pour appeler le LLM.

Phase 3 : implémentation pour Ollama (en local).
Plus tard : Groq (production gratuite) et OpenRouter (fallback).

Le code applicatif appelle uniquement `appeler_llm(...)` —
on bascule de fournisseur en changeant uniquement la variable
d'environnement FOURNISSEUR_LLM.
"""
import httpx

from src.config import parametres
from src.noyau import journal
from src.noyau.exceptions import ErreurServiceIndisponible


# Délai max d'attente d'une réponse LLM (en secondes).
# Ollama en local peut être lent au premier appel (chargement du modèle).
TIMEOUT_SECONDES = 60.0


async def appeler_llm(
    prompt_systeme: str,
    messages_historique: list[dict],
    question_utilisateur: str,
) -> str:
    """
    Appelle le LLM configuré et retourne sa réponse textuelle.

    Arguments :
        prompt_systeme : instructions globales (rôle, ton, contraintes)
        messages_historique : liste de dicts {role: "user"|"assistant", content: "..."}
                              dans l'ordre chronologique
        question_utilisateur : le dernier message de l'utilisateur

    Retour :
        Le texte de la réponse de l'assistant.

    Lève :
        ErreurServiceIndisponible si le LLM ne répond pas.
    """
    fournisseur = parametres.fournisseur_llm

    if fournisseur == "ollama":
        return await _appeler_ollama(prompt_systeme, messages_historique, question_utilisateur)
    elif fournisseur == "groq":
        return await _appeler_groq(prompt_systeme, messages_historique, question_utilisateur)
    else:
        raise ErreurServiceIndisponible(
            f"Fournisseur LLM non supporté : {fournisseur}",
            message_utilisateur="Configuration du chatbot invalide.",
        )


async def _appeler_ollama(
    prompt_systeme: str,
    messages_historique: list[dict],
    question_utilisateur: str,
) -> str:
    """
    Appelle Ollama via son API REST locale.

    Le service Ollama doit tourner et avoir le modèle déjà téléchargé :
        docker compose exec ollama ollama pull mistral:7b-instruct
    """
    # Construire la liste de messages au format Ollama (compatible OpenAI chat)
    messages = [{"role": "system", "content": prompt_systeme}]
    messages.extend(messages_historique)
    messages.append({"role": "user", "content": question_utilisateur})

    url = f"{parametres.ollama_url}/api/chat"
    journal.debug(f"Appel Ollama : url={url} modele={parametres.ollama_modele} messages={len(messages)}")

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDES) as client:
            reponse = await client.post(
                url,
                json={
                    "model": parametres.ollama_modele,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,
                        "num_predict": 800,  # Limite tokens en sortie
                    },
                },
            )
            reponse.raise_for_status()
            donnees = reponse.json()

    except httpx.TimeoutException:
        journal.error("Timeout Ollama — le modèle est peut-être en cours de chargement")
        raise ErreurServiceIndisponible(
            "Timeout Ollama",
            message_utilisateur=(
                "L'assistant met du temps à répondre. Le modèle est peut-être en cours de chargement. "
                "Réessaye dans 30 secondes."
            ),
        )
    except httpx.HTTPError as erreur:
        journal.error(f"Erreur HTTP Ollama : {erreur}")
        raise ErreurServiceIndisponible(
            f"Erreur Ollama : {erreur}",
            message_utilisateur=(
                "L'assistant est temporairement indisponible. "
                "Vérifie qu'Ollama est démarré et que le modèle est téléchargé."
            ),
        )

    # Extraire le texte de la réponse
    return donnees.get("message", {}).get("content", "").strip()


async def _appeler_groq(
    prompt_systeme: str,
    messages_historique: list[dict],
    question_utilisateur: str,
) -> str:
    """
    Appelle l'API Groq (production gratuite). Format OpenAI-compatible.
    Nécessite la variable d'environnement GROQ_API_KEY.
    """
    if not parametres.groq_api_key:
        raise ErreurServiceIndisponible(
            "GROQ_API_KEY non configurée",
            message_utilisateur="Configuration du chatbot incomplète. Contacte l'administrateur.",
        )

    messages = [{"role": "system", "content": prompt_systeme}]
    messages.extend(messages_historique)
    messages.append({"role": "user", "content": question_utilisateur})

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDES) as client:
            reponse = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {parametres.groq_api_key}"},
                json={
                    "model": parametres.groq_modele,
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 800,
                },
            )
            reponse.raise_for_status()
            donnees = reponse.json()
    except httpx.HTTPError as erreur:
        journal.error(f"Erreur Groq : {erreur}")
        raise ErreurServiceIndisponible(
            f"Erreur Groq : {erreur}",
            message_utilisateur="L'assistant est temporairement indisponible.",
        )

    return donnees["choices"][0]["message"]["content"].strip()
