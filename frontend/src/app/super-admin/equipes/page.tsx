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

interface Equipe {
  id: string;
  nom: string;
  description: string | null;
  departement_id: string;
  departement_nom: string | null;
  chef_id: string | null;
  chef_nom: string | null;
  est_actif: boolean;
  date_creation: string;
}

interface DepartementSimple {
  id: string;
  nom: string;
}

export default function PageEquipes() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [departements, setDepartements] = useState<DepartementSimple[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [modaleEdition, setModaleEdition] = useState(false);
  const [modaleDetails, setModaleDetails] = useState<Equipe | null>(null);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [editionEnCours, setEditionEnCours] = useState(false);
  const [equipeSelectionnee, setEquipeSelectionnee] = useState<Equipe | null>(null);
  const [formCreation, setFormCreation] = useState({ nom: "", departement_id: "", description: "" });
  const [formEdition, setFormEdition] = useState({ nom: "", departement_id: "", description: "" });
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [eqs, deps] = await Promise.all([
        clientAPI.get<{ equipes: Equipe[] }>("/api/v1/equipes", { authentifie: true }),
        clientAPI.get<{ departements: DepartementSimple[] }>("/api/v1/departements", { authentifie: true }),
      ]);
      setEquipes(eqs.equipes || []);
      setDepartements(deps.departements || []);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const equipesFiltrees = equipes.filter((e) => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return e.nom.toLowerCase().includes(q) || (e.departement_nom && e.departement_nom.toLowerCase().includes(q));
  });

  const gererCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreurCreation(null);
    setCreationEnCours(true);
    try {
      await clientAPI.post("/api/v1/equipes", formCreation, { authentifie: true });
      notifier("Équipe créée avec succès !", "succes");
      setModaleOuverte(false);
      setFormCreation({ nom: "", departement_id: "", description: "" });
      charger();
    } catch (e) {
      setErreurCreation(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de création");
    } finally {
      setCreationEnCours(false);
    }
  };

  const gererEdition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipeSelectionnee) return;
    setErreurEdition(null);
    setEditionEnCours(true);
    try {
      await clientAPI.patch(`/api/v1/equipes/${equipeSelectionnee.id}`, formEdition, { authentifie: true });
      notifier("Équipe modifiée avec succès !", "succes");
      setModaleEdition(false);
      charger();
    } catch (e) {
      setErreurEdition(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de modification");
    } finally {
      setEditionEnCours(false);
    }
  };

  const gererSuppression = async (id: string) => {
    if (!confirm("Supprimer cette équipe ?")) return;
    try {
      await clientAPI.delete(`/api/v1/equipes/${id}`, { authentifie: true });
      notifier("Équipe supprimée", "succes");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de suppression", "erreur");
    }
  };

  const ouvrirEdition = (e: Equipe) => {
    setEquipeSelectionnee(e);
    setFormEdition({ nom: e.nom, departement_id: e.departement_id, description: e.description || "" });
    setModaleEdition(true);
  };

  const colonnes: Colonne<Equipe>[] = [
    {
      cle: "nom",
      libelle: "Nom",
      rendu: (e) => <p className="font-medium text-ardoise">{e.nom}</p>,
    },
    {
      cle: "departement",
      libelle: "Département",
      rendu: (e) => <span className="text-sm text-ardoise-clair">{e.departement_nom || "—"}</span>,
    },
    {
      cle: "chef",
      libelle: "Chef",
      rendu: (e) => <span className="text-sm text-ardoise-clair">{e.chef_nom || "—"}</span>,
    },
    {
      cle: "statut",
      libelle: "Statut",
      alignement: "centre",
      rendu: (e) => e.est_actif ? <Badge variante="succes">Active</Badge> : <Badge variante="neutre">Inactive</Badge>,
    },
    {
      cle: "actions",
      libelle: "",
      alignement: "droite",
      rendu: (e) => (
        <div className="flex gap-1">
          <Bouton variante="ghost" taille="petit" onClick={() => setModaleDetails(e)}>Voir</Bouton>
          <Bouton variante="ghost" taille="petit" onClick={() => ouvrirEdition(e)}>Modifier</Bouton>
          <Bouton variante="danger" taille="petit" onClick={() => gererSuppression(e.id)}>Supprimer</Bouton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl">Gestion des Équipes</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Crée et gère les équipes par département.
        </p>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm text-ardoise-clair">
            <strong className="text-lagune">{equipesFiltrees.length}</strong> équipe{equipesFiltrees.length > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <input type="text" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher..." className="flex-grow sm:w-64 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm" />
            <Bouton variante="primaire" taille="petit" onClick={() => setModaleOuverte(true)}>+ Nouvelle Équipe</Bouton>
          </div>
        </div>

        {chargement ? (
          <p className="text-center text-ardoise-clair italic py-6">Chargement...</p>
        ) : (
          <Tableau colonnes={colonnes} donnees={equipesFiltrees} cleLigne={(e) => e.id} vide="Aucune équipe trouvée." />
        )}
      </Carte>

      {/* Modale Création */}
      <Modal ouvert={modaleOuverte} surFermeture={() => setModaleOuverte(false)} titre="Nouvelle Équipe" taille="moyen">
        <form onSubmit={gererCreation} className="space-y-3">
          {erreurCreation && <Alerte variante="erreur">{erreurCreation}</Alerte>}
          <ChampSaisie libelle="Nom" value={formCreation.nom} onChange={(e) => setFormCreation({ ...formCreation, nom: e.target.value })} required />
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Département</label>
            <select value={formCreation.departement_id} onChange={(e) => setFormCreation({ ...formCreation, departement_id: e.target.value })} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm" required>
              <option value="">Sélectionner un département</option>
              {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Description</label>
            <textarea value={formCreation.description} onChange={(e) => setFormCreation({ ...formCreation, description: e.target.value })} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm" rows={3} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Bouton variante="ghost" onClick={() => setModaleOuverte(false)}>Annuler</Bouton>
            <Bouton type="submit" variante="primaire" chargement={creationEnCours}>Créer</Bouton>
          </div>
        </form>
      </Modal>

      {/* Modale Édition */}
      <Modal ouvert={modaleEdition} surFermeture={() => setModaleEdition(false)} titre="Modifier l'Équipe" taille="moyen">
        <form onSubmit={gererEdition} className="space-y-3">
          {erreurEdition && <Alerte variante="erreur">{erreurEdition}</Alerte>}
          <ChampSaisie libelle="Nom" value={formEdition.nom} onChange={(e) => setFormEdition({ ...formEdition, nom: e.target.value })} required />
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Département</label>
            <select value={formEdition.departement_id} onChange={(e) => setFormEdition({ ...formEdition, departement_id: e.target.value })} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm" required>
              <option value="">Sélectionner un département</option>
              {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Description</label>
            <textarea value={formEdition.description} onChange={(e) => setFormEdition({ ...formEdition, description: e.target.value })} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm" rows={3} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Bouton variante="ghost" onClick={() => setModaleEdition(false)}>Annuler</Bouton>
            <Bouton type="submit" variante="primaire" chargement={editionEnCours}>Enregistrer</Bouton>
          </div>
        </form>
      </Modal>

      {/* Modale Détails */}
      {modaleDetails && (
        <Modal ouvert={true} surFermeture={() => setModaleDetails(null)} titre="Détails de l'Équipe" taille="moyen">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-ardoise-clair">Nom</p><p className="font-semibold">{modaleDetails.nom}</p></div>
              <div><p className="text-xs text-ardoise-clair">Département</p><p>{modaleDetails.departement_nom || "—"}</p></div>
              <div><p className="text-xs text-ardoise-clair">Chef</p><p>{modaleDetails.chef_nom || "—"}</p></div>
              <div><p className="text-xs text-ardoise-clair">Statut</p>{modaleDetails.est_actif ? <Badge variante="succes">Active</Badge> : <Badge variante="neutre">Inactive</Badge>}</div>
              <div className="col-span-2"><p className="text-xs text-ardoise-clair">Description</p><p>{modaleDetails.description || "—"}</p></div>
              <div><p className="text-xs text-ardoise-clair">Créé le</p><p>{new Date(modaleDetails.date_creation).toLocaleDateString("fr-FR")}</p></div>
            </div>
            <div className="flex gap-2 justify-end pt-3 border-t border-ardoise-clair/10">
              <Bouton variante="ghost" onClick={() => setModaleDetails(null)}>Fermer</Bouton>
              <Bouton variante="primaire" onClick={() => { setModaleDetails(null); ouvrirEdition(modaleDetails); }}>Modifier</Bouton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}