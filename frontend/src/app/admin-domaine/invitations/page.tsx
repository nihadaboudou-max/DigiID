"use client";

/**
 * Page Admin Domaine — Gestion des invitations.
 * Version simplifiée : seules les invitations du domaine de l'admin.
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Tableau, type Colonne } from "@/composants/commun/Tableau";
import { Badge } from "@/composants/commun/Badge";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { useNotifications } from "@/contextes/notifications";
import { useAuthentification } from "@/contextes/authentification";
import {
  listerInvitations,
  creerInvitation,
  annulerInvitation,
  type Invitation,
} from "@/services/invitations";
import { ErreurAPI } from "@/services/client_api";

interface InvitationAvecIndex extends Invitation {
  index?: number;
}

export default function PageInvitationsDomaine() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const { notifier } = useNotifications();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [formCreation, setFormCreation] = useState({
    email: "",
    role: "chef_police" as string,
    message: "",
  });
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);
  const [creationEnCours, setCreationEnCours] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await listerInvitations({
        domaine_id: utilisateur?.domaine_id || undefined,
      });
      setInvitations(data.invitations || []);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }, [utilisateur?.domaine_id]);

  useEffect(() => { charger(); }, [charger]);

  const gererCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreurCreation(null);
    setCreationEnCours(true);
    try {
      await creerInvitation({
        email: formCreation.email,
        role: formCreation.role,
        domaine_id: utilisateur?.domaine_id || undefined,
        message: formCreation.message || undefined,
      });
      notifier("Invitation envoyée avec succès !", "succes");
      setModaleOuverte(false);
      setFormCreation({ email: "", role: "chef_police", message: "" });
      charger();
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de création";
      setErreurCreation(msg);
      notifier(msg, "erreur");
    } finally {
      setCreationEnCours(false);
    }
  };

  const gererAnnulation = async (id: string) => {
    if (!confirm("Annuler cette invitation ?")) return;
    try {
      await annulerInvitation(id);
      notifier("Invitation annulée", "succes");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    }
  };

  const statutRestant = (dateExpiration: string): string => {
    const diff = new Date(dateExpiration).getTime() - Date.now();
    if (diff <= 0) return "Expirée";
    const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (jours > 0) return `${jours}j restant`;
    const heures = Math.floor(diff / (1000 * 60 * 60));
    return `${heures}h restant`;
  };

  const colonnes: Colonne<Invitation>[] = [
    {
      cle: "email",
      libelle: "Email",
      rendu: (inv) => <span className="text-sm font-medium text-ardoise">{inv.email}</span>,
    },
    {
      cle: "role",
      libelle: "Rôle",
      rendu: (inv) => {
        const couleurs: Record<string, "ocre" | "lagune" | "terre"> = {
          chef_police: "terre",
          chef_medical: "lagune",
          chef_ong: "ocre",
          chef_agent: "lagune",
        };
        return <Badge variante={couleurs[inv.role] || "lagune"}>{inv.role.replace("_", " ")}</Badge>;
      },
    },
    {
      cle: "statut",
      libelle: "Statut",
      alignement: "centre",
      rendu: (inv) => {
        if (inv.statut === "en_attente")
          return <Badge variante="ocre">En attente</Badge>;
        if (inv.statut === "acceptee")
          return <Badge variante="succes">Acceptée</Badge>;
        if (inv.statut === "expiree")
          return <Badge variante="neutre">Expirée</Badge>;
        return <Badge variante="terre">Annulée</Badge>;
      },
    },
    {
      cle: "date_expiration",
      libelle: "Expire",
      rendu: (inv) => (
        <span className="text-sm text-ardoise-clair">
          {new Date(inv.date_expiration).toLocaleDateString("fr-FR")}
          {inv.statut === "en_attente" && (
            <span className="text-xs ml-1">({statutRestant(inv.date_expiration)})</span>
          )}
        </span>
      ),
    },
    {
      cle: "actions",
      libelle: "",
      alignement: "droite",
      rendu: (inv) =>
        inv.statut === "en_attente" ? (
          <Bouton variante="danger" taille="petit" onClick={() => gererAnnulation(inv.id)}>
            Annuler
          </Bouton>
        ) : null,
    },
  ];

  return (
    <div className="apparition space-y-6">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/admin-domaine/tableau-de-bord" className="hover:text-lagune">
          Tableau de bord
        </Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Invitations</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="section-header">
          <p className="text-ocre">Admin de Domaine</p>
          <h1>Invitations</h1>
          <p className="text-ardoise-clair/70 text-sm mt-1">
            Invite de nouveaux chefs de département dans ton domaine.
          </p>
        </div>
        <Bouton variante="primaire" onClick={() => setModaleOuverte(true)}>
          + Nouvelle invitation
        </Bouton>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte>
        <p className="text-sm text-ardoise-clair mb-4">
          <strong className="text-lagune">{invitations.length}</strong> invitation
          {invitations.length > 1 ? "s" : ""}
        </p>

        {chargement ? (
          <p className="text-center text-ardoise-clair italic py-6">Chargement...</p>
        ) : (
          <Tableau
            colonnes={colonnes}
            donnees={invitations}
            cleLigne={(inv) => inv.id}
            vide="Aucune invitation dans ton domaine."
          />
        )}
      </Carte>

      {/* Modale création */}
      <Modal
        ouvert={modaleOuverte}
        surFermeture={() => setModaleOuverte(false)}
        titre="Inviter un chef de département"
      >
        <form onSubmit={gererCreation} className="space-y-4">
          {erreurCreation && <Alerte variante="erreur">{erreurCreation}</Alerte>}

          <ChampSaisie
            libelle="Email du destinataire"
            type="email"
            value={formCreation.email}
            onChange={(e) => setFormCreation({ ...formCreation, email: e.target.value })}
            required
            placeholder="chef@exemple.com"
          />

          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
              Rôle proposé
            </label>
            <select
              value={formCreation.role}
              onChange={(e) => setFormCreation({ ...formCreation, role: e.target.value })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              <option value="chef_police">Chef Police</option>
              <option value="chef_medical">Chef Médical</option>
              <option value="chef_ong">Chef ONG</option>
              <option value="chef_agent">Chef Enrôlement</option>
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
              Message personnalisé (optionnel)
            </label>
            <textarea
              value={formCreation.message}
              onChange={(e) => setFormCreation({ ...formCreation, message: e.target.value })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              rows={3}
              placeholder="Explique pourquoi tu invites cette personne..."
            />
          </div>

          {utilisateur?.domaine_id && (
            <div className="p-3 bg-sable rounded-lg text-xs text-ardoise-clair">
              L&apos;invitation sera liée à ton domaine.
              Le chef invité pourra gérer les départements de ce domaine.
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Bouton variante="ghost" onClick={() => setModaleOuverte(false)}>
              Annuler
            </Bouton>
            <Bouton type="submit" variante="primaire" chargement={creationEnCours}>
              Envoyer l&apos;invitation
            </Bouton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
