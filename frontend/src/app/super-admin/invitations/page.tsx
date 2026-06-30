"use client";

import { useEffect, useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { Modal } from "@/composants/commun/Modal";
import { Tableau, type Colonne } from "@/composants/commun/Tableau";
import { useNotifications } from "@/contextes/notifications";
import { clientAPI, ErreurAPI } from "@/services/client_api";

interface Invitation {
  id: string;
  email: string;
  role: string;
  domaine_id: string | null;
  departement_id: string | null;
  statut: string;
  message: string | null;
  cree_par: string;
  date_creation: string;
  date_expiration: string;
  date_acceptation: string | null;
}

export default function PageInvitations() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [formCreation, setFormCreation] = useState({ email: "", role: "admin_domaine", message: "" });
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await clientAPI.get<{ invitations: Invitation[] }>("/api/v1/invitations", { authentifie: true });
      setInvitations(data.invitations || []);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const invitationsFiltrees = invitations.filter((i) => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return i.email.toLowerCase().includes(q) || i.role.toLowerCase().includes(q) || i.statut.toLowerCase().includes(q);
  });

  const gererCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreurCreation(null);
    setCreationEnCours(true);
    try {
      await clientAPI.post("/api/v1/invitations", formCreation, { authentifie: true });
      notifier("Invitation envoyée avec succès !", "succes");
      setModaleOuverte(false);
      setFormCreation({ email: "", role: "admin_domaine", message: "" });
      charger();
    } catch (e) {
      setErreurCreation(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de création");
    } finally {
      setCreationEnCours(false);
    }
  };

  const gererRenvoi = async (id: string) => {
    if (!confirm("Renvoyer cette invitation ?")) return;
    try {
      await clientAPI.post(`/api/v1/invitations/${id}/renvoyer`, {}, { authentifie: true });
      notifier("Invitation renvoyée", "succes");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    }
  };

  const gererAnnulation = async (id: string) => {
    if (!confirm("Annuler cette invitation ?")) return;
    try {
      await clientAPI.delete(`/api/v1/invitations/${id}`, { authentifie: true });
      notifier("Invitation annulée", "succes");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur", "erreur");
    }
  };

  const colonnes: Colonne<Invitation>[] = [
    {
      cle: "email",
      libelle: "Email",
      rendu: (i) => <p className="font-medium text-ardoise">{i.email}</p>,
    },
    {
      cle: "role",
      libelle: "Rôle",
      rendu: (i) => <Badge variante="lagune">{i.role}</Badge>,
    },
    {
      cle: "statut",
      libelle: "Statut",
      alignement: "centre",
      rendu: (i) => {
        if (i.statut === "acceptee") return <Badge variante="succes">Acceptée</Badge>;
        if (i.statut === "expiree") return <Badge variante="terre">Expirée</Badge>;
        return <Badge variante="ocre">En attente</Badge>;
      },
    },
    {
      cle: "date_creation",
      libelle: "Créée le",
      rendu: (i) => <span className="text-xs text-ardoise-clair">{new Date(i.date_creation).toLocaleDateString("fr-FR")}</span>,
    },
    {
      cle: "actions",
      libelle: "",
      alignement: "droite",
      rendu: (i) => (
        <div className="flex gap-1">
          {i.statut === "en_attente" && <Bouton variante="ghost" taille="petit" onClick={() => gererRenvoi(i.id)}>Renvoyer</Bouton>}
          {i.statut === "en_attente" && <Bouton variante="danger" taille="petit" onClick={() => gererAnnulation(i.id)}>Annuler</Bouton>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl">Gestion des Invitations</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Envoie des invitations pour créer des comptes administrateurs.
        </p>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm text-ardoise-clair">
            <strong className="text-lagune">{invitationsFiltrees.length}</strong> invitation{invitationsFiltrees.length > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <input type="text" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher..." className="flex-grow sm:w-64 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm" />
            <Bouton variante="primaire" taille="petit" onClick={() => setModaleOuverte(true)}>+ Nouvelle Invitation</Bouton>
          </div>
        </div>

        {chargement ? (
          <p className="text-center text-ardoise-clair italic py-6">Chargement...</p>
        ) : (
          <Tableau colonnes={colonnes} donnees={invitationsFiltrees} cleLigne={(i) => i.id} vide="Aucune invitation trouvée." />
        )}
      </Carte>

      {/* Modale Création */}
      <Modal ouvert={modaleOuverte} surFermeture={() => setModaleOuverte(false)} titre="Nouvelle Invitation" taille="moyen">
        <form onSubmit={gererCreation} className="space-y-3">
          {erreurCreation && <Alerte variante="erreur">{erreurCreation}</Alerte>}
          <ChampSaisie libelle="Email" type="email" value={formCreation.email} onChange={(e) => setFormCreation({ ...formCreation, email: e.target.value })} required />
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Rôle</label>
            <select value={formCreation.role} onChange={(e) => setFormCreation({ ...formCreation, role: e.target.value })} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm">
              <option value="admin_domaine">Admin Domaine</option>
              <option value="chef_police">Chef Police</option>
              <option value="chef_medical">Chef Médical</option>
              <option value="chef_ong">Chef ONG</option>
              <option value="chef_agent">Chef Agent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Message (optionnel)</label>
            <textarea value={formCreation.message} onChange={(e) => setFormCreation({ ...formCreation, message: e.target.value })} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm" rows={3} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Bouton variante="ghost" onClick={() => setModaleOuverte(false)}>Annuler</Bouton>
            <Bouton type="submit" variante="primaire" chargement={creationEnCours}>Envoyer</Bouton>
          </div>
        </form>
      </Modal>
    </div>
  );
}