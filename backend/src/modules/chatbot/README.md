# Module Chatbot — Phase 3

Assistant conversationnel DigiID basé sur LangChain + RAG (Retrieval-Augmented Generation).

## Fichiers prévus

| Fichier             | Rôle                                                      |
| ------------------- | --------------------------------------------------------- |
| `service.py`        | Orchestration : question → contexte → réponse → mémoire   |
| `chaine.py`         | Chaîne LangChain RAG (retrieval + génération)             |
| `fournisseurs_llm.py` | Abstraction Ollama / Groq / OpenRouter                  |
| `memoire.py`        | Mémoire conversationnelle persistante par utilisateur     |
| `contexte.py`       | Construction du contexte autorisé pour l'utilisateur      |
| `indexation.py`     | Ingestion documents dans ChromaDB (commun + personnel)    |
| `routes.py`         | Endpoints `/api/v1/utilisateur/chatbot/*`                 |
| `schemas.py`        | Pydantic : Question, ReponseChatbot, MessageHistorique    |

## Architecture RAG

Deux index ChromaDB par requête :
- **Index commun** `chat_savoir_commun` : documentation, FAQ, règles DigiID
- **Index personnel** `chat_user_<uuid>` : documents et infos privées de l'utilisateur

À chaque question :
1. Récupération top-k chunks pertinents dans l'index commun
2. Récupération top-k chunks pertinents dans l'index personnel
3. Construction du prompt : système (rôle, contraintes) + contextes + historique + question
4. Appel LLM via abstraction `FournisseurLLM`
5. Enregistrement Q/R dans la mémoire conversationnelle
6. Retour de la réponse

## Fournisseurs LLM

Le code applicatif appelle uniquement l'interface `FournisseurLLM`.
Bascule par variable d'environnement `FOURNISSEUR_LLM` :

| Fournisseur  | Usage         | Modèle par défaut                        |
| ------------ | ------------- | ---------------------------------------- |
| `ollama`     | Développement | `mistral:7b-instruct`                    |
| `groq`       | Production    | `llama-3.3-70b-versatile` (gratuit)      |
| `openrouter` | Fallback      | `meta-llama/llama-3.3-70b-instruct:free` |

## Sécurité

- Aucun utilisateur ne reçoit jamais le contenu d'un autre utilisateur, même en injection
- Le LLM est appelé avec un prompt système qui rappelle qui est l'utilisateur
- Les questions et réponses sont enregistrées dans le journal d'audit
- Limite de débit : 30 messages/heure par utilisateur en standard
- Mode dégradé : si l'API LLM est indisponible, réponse gracieuse + redirection doc
