# -*- coding: utf-8 -*-
"""
Couche d'abstraction pour appeler le LLM.
Gère à la fois le Chatbot (texte) et l'Extraction de documents (vision).
"""
import httpx
from typing import Optional

from src.config import parametres
from src.noyau import journal
from src.noyau.exceptions import ErreurServiceIndisponible

TIMEOUT_SECONDES = 120.0


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
                    "model": parametres.ollama_modele,
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
                    "model": parametres.groq_modele,
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
) -> str:
    fournisseur = parametres.fournisseur_llm

    if fournisseur == "groq":
        return await _appeler_groq_vision(image_base64, prompt, modele)
    elif fournisseur == "ollama":
        return await _appeler_ollama_vision(image_base64, prompt, modele)
    else:
        raise ErreurServiceIndisponible(
            f"Fournisseur LLM non supporté pour la vision : {fournisseur}",
            message_utilisateur="Configuration du VLM invalide.",
        )


async def _appeler_groq_vision(
    image_base64: str,
    prompt: str,
    modele: Optional[str] = None,
) -> str:
    """Appelle Groq avec une image (modèle de vision)."""
    if not parametres.groq_api_key:
        raise ErreurServiceIndisponible("GROQ_API_KEY non configurée")
    
    # ⚠️ MODIFICATION : Utilisation du modèle 11B qui est le plus stable pour la vision sur Groq
    modele_vision = "llama-3.2-90b-vision-preview"
    
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_base64}"
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
                    "temperature": 0.1,
                    "max_tokens": 1000,
                },
            )
            
            # 🕵️ LOG CRUCIAL : Si ça échoue, on affiche la réponse exacte de Groq pour savoir pourquoi (ex: "Model not found")
            if not reponse.is_success:
                journal.error(f"Groq API a rejeté la requête ({reponse.status_code}) : {reponse.text}")
            
            reponse.raise_for_status()
            donnees = reponse.json()
            return donnees["choices"][0]["message"]["content"].strip()
            
    except httpx.HTTPStatusError as erreur:
        journal.error(f"Erreur HTTP Groq Vision : {erreur.response.text}")
        raise ErreurServiceIndisponible(
            f"Erreur lors de l'analyse du document. Vérifiez votre clé API Groq et le modèle.",
            message_utilisateur="Le service d'analyse des documents a rencontré une erreur de configuration."
        )
    except httpx.HTTPError as erreur:
        journal.error(f"Erreur de connexion Groq Vision : {erreur}")
        raise ErreurServiceIndisponible(
            "Erreur de connexion au service d'analyse des documents."
        )


async def _appeler_ollama_vision(
    image_base64: str,
    prompt: str,
    modele: Optional[str] = None,
) -> str:
    modele_vision = modele or "qwen2-vl:2b"
    url = f"{parametres.ollama_url}/api/chat"
    
    messages = [
        {
            "role": "user",
            "content": prompt,
            "images": [image_base64]
        }
    ]
    
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDES) as client:
            reponse = await client.post(
                url,
                json={
                    "model": modele_vision,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_predict": 1000,
                    },
                },
            )
            reponse.raise_for_status()
            donnees = reponse.json()
            return donnees.get("message", {}).get("content", "").strip()
    except httpx.HTTPError as erreur:
        journal.error(f"Erreur Ollama Vision : {erreur}")
        raise ErreurServiceIndisponible(f"Erreur Ollama Vision : {erreur}")