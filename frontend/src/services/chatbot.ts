/**
 * Service chatbot — appels API pour la page /chatbot.
 * Branché sur /api/v1/utilisateur/chatbot/*
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/utilisateur/chatbot";

// --- Types ---

export interface Message {
  id: string;
  auteur: "utilisateur" | "assistant";
  contenu: string;
  cree_le: string;
}

export interface ConversationApercu {
  id: string;
  titre: string;
  date_dernier_message: string | null;
  cree_le: string;
}

export interface ConversationDetail {
  id: string;
  titre: string;
  cree_le: string;
  messages: Message[];
}

export interface ListeConversations {
  conversations: ConversationApercu[];
  total: number;
}

export interface ReponseMessage {
  message_utilisateur: Message;
  message_assistant: Message;
}

// --- API ---

export const creerConversation = () =>
  clientAPI.post<ConversationApercu>(`${PREFIXE}/conversations`, undefined, { authentifie: true });

export const listerConversations = () =>
  clientAPI.get<ListeConversations>(`${PREFIXE}/conversations`, { authentifie: true });

export const obtenirConversation = (id: string) =>
  clientAPI.get<ConversationDetail>(`${PREFIXE}/conversations/${id}`, { authentifie: true });

export const envoyerMessage = (conversationId: string, contenu: string) =>
  clientAPI.post<ReponseMessage>(
    `${PREFIXE}/conversations/${conversationId}/messages`,
    { contenu },
    { authentifie: true },
  );

export const supprimerConversation = (id: string) =>
  clientAPI.delete<void>(`${PREFIXE}/conversations/${id}`, { authentifie: true });
