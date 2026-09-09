# -*- coding: utf-8 -*-
"""
Couche d'abstraction pour appeler le LLM.
Gère le Chatbot (texte) et l'Extraction de documents (vision) :
- Groq (production) pour la vision via llama-3.2-11b-vision-preview
- Ollama (développement) pour la vision via qwen2-vl:2b
Le fournisseur est choisi par la variable d'environnement FOURNISSEUR_LLM.
"""
import httpx
from typing import Optional

from src.config import parametres
from src.noyau import journal
from src.noyau.exceptions import ErreurServiceIndisponible

TIMEOUT_SECONDES = 120.0  # Plus long pour la vision

# =============================================================================
# 1. FONCTIONS POUR LE CHATBOT (TEXTE)
# =============================================================================

async def appeler_llm(
    prompt_systeme: str,
    messages_historique: list[dict],
    question_utilisateur: str,
) -> str:
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
    messages = [{"role": "system", "content": prompt_systeme}]
    messages.extend(messages_historique)
    messages.append({"role": "user", "content": question_utilisateur})

    url = f"{parametres.ollama_url}/api/chat"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDES) as client:
            reponse = await client.post(
                url,
                json={
                    "model": parametres.ollama_modele or "mistral:7b-instruct",
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": 0.7, "num_predict": 800},
                },
            )
            reponse.raise_for_status()
            return reponse.json().get("message", {}).get("content", "").strip()
    except httpx.HTTPError as erreur:
        journal.error(f"Erreur HTTP Ollama : {erreur}")
        raise ErreurServiceIndisponible("L'assistant est temporairement indisponible.")


async def _appeler_groq(
    prompt_systeme: str,
    messages_historique: list[dict],
    question_utilisateur: str,
) -> str:
    if not parametres.groq_api_key:
        raise ErreurServiceIndisponible("GROQ_API_KEY non configurée")

    messages = [{"role": "system", "content": prompt_systeme}]
    messages.extend(messages_historique)
    messages.append({"role": "user", "content": question_utilisateur})

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDES) as client:
            reponse = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {parametres.groq_api_key}"},
                json={
                    "model": parametres.groq_modele or "llama-3.1-8b-instant",
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 800,
                },
            )
            reponse.raise_for_status()
            return reponse.json()["choices"][0]["message"]["content"].strip()
    except httpx.HTTPError as erreur:
        journal.error(f"Erreur Groq : {erreur}")
        raise ErreurServiceIndisponible("L'assistant est temporairement indisponible.")


# =============================================================================
# 2. FONCTIONS POUR L'EXTRACTION DE DOCUMENTS (VISION)
# =============================================================================

async def appeler_llm_vision(
    image_base64: str,
    prompt: str,
    modele: Optional[str] = None,
    mime_type: str = "image/jpeg",
) -> str:
    """
    Analyse une image via le fournisseur LLM configuré.
    - Groq (prod) : llama-3.2-11b-vision-preview par défaut
    - Ollama (dev) : qwen2-vl:2b par défaut (à tirer : ollama pull qwen2-vl:2b)
    """
    if parametres.fournisseur_llm == "ollama":
        return await _appeler_ollama_vision(
            image_base64,
            prompt,
            modele or parametres.ollama_modele_vision,
        )
    return await _appeler_groq_vision(image_base64, prompt, modele, mime_type)


async def _appeler_ollama_vision(
    image_base64: str,
    prompt: str,
    modele: str,
) -> str:
    """Appelle le modèle vision local via l'API /api/chat d'Ollama."""
    url = f"{parametres.ollama_url}/api/chat"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDES) as client:
            reponse = await client.post(
                url,
                json={
                    "model": modele,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt,
                            "images": [image_base64],
                        }
                    ],
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
            )
            reponse.raise_for_status()
            return reponse.json().get("message", {}).get("content", "").strip()
    except httpx.HTTPError as erreur:
        journal.error(f"Erreur HTTP Ollama Vision : {erreur}")
        raise ErreurServiceIndisponible(
            "Erreur de connexion au modèle vision local."
        )


async def _appeler_groq_vision(
    image_base64: str,
    prompt: str,
    modele: Optional[str] = None,
    mime_type: str = "image/jpeg",
) -> str:
    """Appelle l'API Groq avec une image."""
    if not parametres.groq_api_key:
        raise ErreurServiceIndisponible(
            "GROQ_API_KEY non configurée",
            message_utilisateur="La clé API pour l'analyse des documents est manquante."
        )
    
    # Modèle stable chez Groq pour la vision ; surchargeable via GROQ_MODELE_VISION
    modele_vision = modele or parametres.groq_modele_vision or "qwen-3.6-27b"

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime_type};base64,{image_base64}"
                    }
                }
            ]
        }
    ]
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDES) as client:
            reponse = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {parametres.groq_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": modele_vision,
                    "messages": messages,
                    "temperature": 0.1,  # Très bas pour une extraction de données précise
                    "max_tokens": 1000,
                },
            )
            
            # Journalisation détaillée en cas d'échec pour débogage facile
            if not reponse.is_success:
                journal.error(f"Groq API a rejeté la requête ({reponse.status_code}) : {reponse.text}")
            
            reponse.raise_for_status()
            donnees = reponse.json()
            return donnees["choices"][0]["message"]["content"].strip()
            
    except httpx.HTTPStatusError as erreur:
        journal.error(f"Erreur HTTP Groq Vision : {erreur.response.text}")
        raise ErreurServiceIndisponible(
            f"Erreur lors de l'analyse du document (Modèle: {modele_vision}). Vérifiez la clé API.",
            message_utilisateur="Le service d'analyse des documents a rencontré une erreur de configuration."
        )
    except httpx.HTTPError as erreur:
        journal.error(f"Erreur de connexion Groq Vision : {erreur}")
        raise ErreurServiceIndisponible(
            "Erreur de connexion au service d'analyse des documents."
        )