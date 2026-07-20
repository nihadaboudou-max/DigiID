"use client";

/**
 * Page Chatbot — Phase 3 : vraie conversation avec mémoire + documents.
 * Branchée sur /api/v1/utilisateur/chatbot/*
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
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
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const { notifier } = useNotifications();

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

  // --- Envoyer un message ---
  async function gererEnvoi(evt: React.FormEvent) {
    evt.preventDefault();
    const texte = saisie.trim();
    if (!texte || envoiEnCours || !actuelle) return;

    // Si pas de conversation ouverte, en créer une d'abord
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

    setSaisie("");
    setEnvoiEnCours(true);

    try {
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
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            Assistant DigiID
          </p>
          <h1 className="mt-1">Discute avec ton assistant</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Pose-lui des questions sur DigiID ou sur tes documents.
            Il se souvient de ce que vous avez déjà dit.
          </p>
        </div>
        <Link href="/documents">
          <Bouton variante="ghost" taille="petit">
            Mes documents
          </Bouton>
        </Link>
      </header>

      <Carte className="!p-0 overflow-hidden">
        <div className="grid md:grid-cols-[260px_1fr] min-h-[600px]">
          {/* Panneau gauche : liste des conversations */}
          <aside className="border-r border-ardoise-clair/10 bg-sable-clair/50 flex flex-col">
            <div className="p-4 border-b border-ardoise-clair/10">
              <Bouton
                variante="primaire"
                onClick={gererNouvelleConversation}
                className="w-full !py-2"
              >
                + Nouvelle conversation
              </Bouton>
            </div>
            <div className="flex-grow overflow-y-auto p-2 space-y-1 max-h-[500px]">
              {chargementListe ? (
                <p className="text-xs text-ardoise-clair italic p-3">Chargement...</p>
              ) : conversations.length === 0 ? (
                <p className="text-xs text-ardoise-clair italic p-3">
                  Aucune conversation. Lance la première !
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
              // Aucune conversation ouverte
              <div className="flex-grow flex items-center justify-center p-8">
                <div className="text-center max-w-sm">
                  <div className="w-16 h-16 bg-lagune/10 text-lagune rounded-full flex items-center justify-center mx-auto mb-4">
                    <IconeChat />
                  </div>
                  <h3 className="mb-2">Bienvenue {utilisateur?.prenom || ""}</h3>
                  <p className="text-sm text-ardoise-clair mb-4">
                    Crée une nouvelle conversation pour commencer à discuter.
                    L'assistant peut aussi répondre sur des documents que tu auras uploadés.
                  </p>
                  <Bouton variante="primaire" onClick={gererNouvelleConversation}>
                    Commencer
                  </Bouton>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-white max-h-[500px]">
                  {actuelle.messages.length === 0 ? (
                    <Alerte variante="info">
                      Conversation vide. Pose ta première question — l'assistant te répondra.
                    </Alerte>
                  ) : (
                    actuelle.messages.map((m) => (
                      <Bulle key={m.id} message={m} prenom={utilisateur?.prenom} />
                    ))
                  )}
                  {envoiEnCours && <BulleReflexion />}
                  <div ref={refFin} />
                </div>

                {/* Zone de saisie */}
                <form onSubmit={gererEnvoi} className="border-t border-ardoise-clair/10 p-4 bg-white flex gap-3">
                  <input
                    type="text"
                    value={saisie}
                    onChange={(e) => setSaisie(e.target.value)}
                    placeholder="Tape ta question..."
                    className="champ-saisie flex-grow !py-2.5"
                    disabled={envoiEnCours}
                    autoFocus
                  />
                  <Bouton
                    type="submit"
                    variante="primaire"
                    disabled={!saisie.trim() || envoiEnCours}
                    taille="moyen"
                    className="!px-4"
                  >
                    <IconeEnvoyer />
                  </Bouton>
                </form>
              </>
            )}
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
