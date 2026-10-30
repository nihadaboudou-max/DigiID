"use client";

/**
 * Page Chatbot — Phase 3 : vraie conversation avec mémoire + documents.
 * Branchée sur /api/v1/utilisateur/chatbot/*
 */
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { IconeEnvoyer, IconeChat } from "@/composants/commun/Icones";
import { useNotifications } from "@/contextes/notifications";
import { useAuthentification } from "@/contextes/authentification";
import {
  creerConversation, listerConversations, obtenirConversation,
  envoyerMessage, supprimerConversation,
  type ConversationApercu, type ConversationDetail, type Message,
} from "@/services/chatbot";
import { ErreurAPI } from "@/services/client_api";

export default function PageChatbot() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={[      
      // Citoyens et agents
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur", "super_admin",
      // Pivot logistique : le guichet, le chauffeur et le commerçant sont en
      // première ligne face aux clients — ils ont le plus besoin de l'assistant.
      "receveur", "gerant_gare", "chauffeur", "commercant"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

const ASSISTANCE_PAR_ROLE: Record<string, { titre: string; questions: string[] }> = {
  receveur: {
    titre: "Assistance guichet",
    questions: [
      "Comment enregistrer un colis ?",
      "Le QR du client est refusé, que faire ?",
      "Comment marquer un colis livré ?",
      "Comment enregistrer un enfant qui voyage seul ?",
    ],
  },
  gerant_gare: {
    titre: "Assistance gérant de gare",
    questions: [
      "Comment affecter un car à un chauffeur ?",
      "Un chauffeur n'apparaît pas dans la liste, que faire ?",
      "Comment planifier un départ ?",
      "Comment suivre un colis ou un passager ?",
    ],
  },
  chauffeur: {
    titre: "Assistance chauffeur",
    questions: [
      "Comment planifier un départ avec mon car ?",
      "Comment voir les colis et passagers à bord ?",
      "Comment valider le départ et l'arrivée ?",
      "Comment enregistrer un client en route ?",
      "Où consulter ma cagnotte ?",
    ],
  },
  commercant: {
    titre: "Assistance commerçant",
    questions: [
      "Comment enregistrer un colis ?",
      "Comment suivre un colis ?",
      "Où retrouver mes tickets ?",
    ],
  },
};

const ASSISTANCE_PAR_DEFAUT = {
  titre: "Assistant DigiID",
  questions: [
    "Comment suivre un colis ?",
    "Comment utiliser ma carte DigiID ?",
    "Comment modifier mon profil ?",
  ],
};

function Contenu() {
  const { utilisateur } = useAuthentification();
  const { notifier } = useNotifications();
  const assistance = ASSISTANCE_PAR_ROLE[utilisateur?.role ?? ""] ?? ASSISTANCE_PAR_DEFAUT;

  // Liste des conversations existantes (panneau gauche)
  const [conversations, setConversations] = useState<ConversationApercu[]>([]);
  // Conversation actuellement ouverte
  const [actuelle, setActuelle] = useState<ConversationDetail | null>(null);
  // Saisie utilisateur dans la zone de texte
  const [saisie, setSaisie] = useState("");
  // Indicateurs de chargement
  const [chargementListe, setChargementListe] = useState(true);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const refFin = useRef<HTMLDivElement>(null);

  // --- Chargement initial : récupérer la liste des conversations ---
  useEffect(() => {
    listerConversations()
      .then((r) => setConversations(r.conversations))
      .catch((e) => {
        const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement";
        notifier(msg, "erreur");
      })
      .finally(() => setChargementListe(false));
  }, []);

  // --- Auto-scroll vers le bas à chaque nouveau message ---
  useEffect(() => {
    refFin.current?.scrollIntoView({ behavior: "smooth" });
  }, [actuelle?.messages.length, envoiEnCours]);

  // --- Créer une nouvelle conversation ---
  async function gererNouvelleConversation() {
    try {
      const conv = await creerConversation();
      setConversations((c) => [conv, ...c]);
      // Ouvrir directement la nouvelle conversation (vide)
      setActuelle({
        id: conv.id,
        titre: conv.titre,
        cree_le: conv.cree_le,
        messages: [],
      });
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
      notifier(msg, "erreur");
    }
  }

  // --- Ouvrir une conversation existante ---
  async function ouvrirConversation(id: string) {
    try {
      const conv = await obtenirConversation(id);
      setActuelle(conv);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
      notifier(msg, "erreur");
    }
  }

  // --- Supprimer une conversation ---
  async function gererSuppression(id: string, evt: React.MouseEvent) {
    evt.stopPropagation();  // Empêche d'ouvrir la conversation au clic sur supprimer
    try {
      await supprimerConversation(id);
      setConversations((c) => c.filter((conv) => conv.id !== id));
      if (actuelle?.id === id) setActuelle(null);
      notifier("Conversation supprimée", "info");
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
      notifier(msg, "erreur");
    }
  }

  // --- Envoyer un message (formulaire ou question suggérée) ---
  async function gererEnvoi(evt: React.FormEvent) {
    evt.preventDefault();
    await envoyerTexte(saisie);
  }

  async function envoyerTexte(texteBrut: string) {
    const texte = texteBrut.trim();
    if (!texte || envoiEnCours) return;

    setSaisie("");
    setEnvoiEnCours(true);

    try {
      let conversation = actuelle;
      if (!conversation) {
        const nouvelle = await creerConversation();
        conversation = {
          id: nouvelle.id,
          titre: nouvelle.titre,
          cree_le: nouvelle.cree_le,
          messages: [],
        };
        setActuelle(conversation);
        setConversations((c) => [nouvelle, ...c]);
      }

      // Appel API : envoie le message et reçoit message + réponse
      const reponse = await envoyerMessage(conversation.id, texte);
      // Mettre à jour la conversation actuelle avec les deux nouveaux messages
      setActuelle((c) => c ? {
        ...c,
        messages: [...c.messages, reponse.message_utilisateur, reponse.message_assistant],
      } : null);

      // Rafraîchir la liste (le titre a pu changer si c'était le 1er message)
      const liste = await listerConversations();
      setConversations(liste.conversations);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur d'envoi";
      notifier(msg, "erreur");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="space-y-4 apparition">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Aide métier</p>
          <h1 className="mt-1">{assistance.titre}</h1>
        </div>
        <Bouton variante="primaire" taille="petit" onClick={gererNouvelleConversation}>
          Nouvelle question
        </Bouton>
      </header>

      <Carte className="!p-0 overflow-hidden">
        <div className="grid md:grid-cols-[220px_1fr] min-h-[520px]">
          {/* Panneau gauche : liste des conversations */}
          <aside className="border-r border-ardoise-clair/10 bg-sable-clair/50 flex flex-col">
            <div className="p-4 border-b border-ardoise-clair/10">
              <p className="text-xs font-semibold uppercase text-ardoise-clair">Questions récentes</p>
            </div>
            <div className="flex-grow overflow-y-auto p-2 space-y-1 max-h-[500px]">
              {chargementListe ? (
                <p className="text-xs text-ardoise-clair italic p-3">Chargement...</p>
              ) : conversations.length === 0 ? (
                <p className="text-xs text-ardoise-clair italic p-3">
                  Aucune question récente.
                </p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => ouvrirConversation(c.id)}
                    className={clsx(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-start justify-between gap-2 group",
                      actuelle?.id === c.id
                        ? "bg-lagune text-white"
                        : "hover:bg-white text-ardoise",
                    )}
                  >
                    <span className="truncate flex-grow">{c.titre}</span>
                    <span
                      role="button"
                      onClick={(e) => gererSuppression(c.id, e)}
                      className={clsx(
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        actuelle?.id === c.id ? "text-ocre" : "text-terre",
                      )}
                      title="Supprimer"
                    >
                      ✕
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Panneau droit : conversation active */}
          <div className="flex flex-col">
            {actuelle === null ? (
              <div className="flex-grow p-5 sm:p-8">
                <h2 className="font-semibold text-ardoise">Quel est le problème ?</h2>
                <p className="mt-1 text-sm text-ardoise-clair">Choisis une question ou écris la tienne.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {assistance.questions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      disabled={envoiEnCours}
                      onClick={() => void envoyerTexte(question)}
                      className="rounded-lg border border-lagune/20 bg-lagune/5 px-3 py-2 text-left text-sm font-medium text-lagune transition-colors hover:bg-lagune/10 disabled:opacity-50"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-white max-h-[500px]">
                  {actuelle.messages.length === 0 ? (
                    <p className="text-sm text-ardoise-clair">Choisis une question ou écris la tienne.</p>
                  ) : (
                    actuelle.messages.map((m) => (
                      <Bulle key={m.id} message={m} prenom={utilisateur?.prenom} />
                    ))
                  )}
                  {actuelle.messages.length === 0 && (
                    <div className="flex flex-wrap gap-2">
                      {assistance.questions.map((question) => (
                        <button
                          key={question}
                          type="button"
                          disabled={envoiEnCours}
                          onClick={() => void envoyerTexte(question)}
                          className="rounded-lg border border-lagune/20 bg-lagune/5 px-3 py-2 text-left text-sm font-medium text-lagune transition-colors hover:bg-lagune/10 disabled:opacity-50"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  )}
                  {envoiEnCours && <BulleReflexion />}
                  <div ref={refFin} />
                </div>
              </>
            )}
            <form onSubmit={gererEnvoi} className="border-t border-ardoise-clair/10 p-4 bg-white flex gap-3">
              <input
                type="text"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                placeholder="Écris ta question"
                className="champ-saisie flex-grow !py-2.5"
                disabled={envoiEnCours}
              />
              <Bouton
                type="submit"
                variante="primaire"
                disabled={!saisie.trim() || envoiEnCours}
                taille="moyen"
                className="!px-4"
                aria-label="Envoyer la question"
              >
                <IconeEnvoyer />
              </Bouton>
            </form>
          </div>
        </div>
      </Carte>
    </div>
  );
}

// --- Composants internes ---

function Bulle({ message, prenom }: { message: Message; prenom?: string | null }) {
  const estUtilisateur = message.auteur === "utilisateur";
  return (
    <div className={clsx("flex gap-3", estUtilisateur && "flex-row-reverse")}>
      <div className={clsx(
        "w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold",
        estUtilisateur ? "bg-ocre text-ardoise" : "bg-lagune text-white",
      )}>
        {estUtilisateur ? (prenom?.[0]?.toUpperCase() || "U") : <IconeChat className="w-4 h-4" />}
      </div>
      <div className={clsx(
        "max-w-xl rounded-2xl px-4 py-3",
        estUtilisateur
          ? "bg-lagune text-white rounded-tr-sm"
          : "bg-sable-clair border border-ardoise-clair/10 text-ardoise rounded-tl-sm",
      )}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.contenu}</p>
      </div>
    </div>
  );
}

function BulleReflexion() {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-full bg-lagune text-white flex items-center justify-center">
        <IconeChat className="w-4 h-4" />
      </div>
      <div className="bg-sable-clair border border-ardoise-clair/10 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
        <span className="w-2 h-2 bg-ardoise-clair rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-ardoise-clair rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
        <span className="w-2 h-2 bg-ardoise-clair rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
      </div>
    </div>
  );
}
