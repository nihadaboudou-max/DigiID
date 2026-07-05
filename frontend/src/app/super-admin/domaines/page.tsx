"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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

interface Domaine {
  id: string;
  nom: string;
  code: string;
  description: string | null;
  region: string | null;
  admin_id: string | null;
  admin_nom: string | null; // NOUVEAU
  est_actif: boolean;
  date_creation: string;
}

interface AdminDisponible {
  id: string;
  nom: string;
  role: string;
}

export default function PageDomaines() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur", "super_admin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [domaines, setDomaines] = useState<Domaine[]>([]);
  const [adminsDisponibles, setAdminsDisponibles] = useState<AdminDisponible[]>([]); // NOUVEAU
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [modaleEdition, setModaleEdition] = useState(false);
  const [modaleDetails, setModaleDetails] = useState<Domaine | null>(null);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [editionEnCours, setEditionEnCours] = useState(false);
  const [domaineSelectionne, setDomaineSelectionne] = useState<Domaine | null>(null);
  const [formCreation, setFormCreation] = useState({ nom: "", code: "", region: "", description: "", admin_id: "" });
  const [formEdition, setFormEdition] = useState({ nom: "", code: "", region: "", description: "", admin_id: "" });
  const [erreurCreation, setErreurCreation] = useState<string | null>(null);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [doms, admins] = await Promise.all([
        clientAPI.get<{ domaines: Domaine[] }>("/api/v1/domaines", { authentifie: true }),
        clientAPI.get<{ admins: AdminDisponible[] }>("/api/v1/utilisateurs?role=admin_domaine", { authentifie: true }).catch(() => ({ admins: [] })),
      ]);
      setDomaines(doms.domaines || []);
      setAdminsDisponibles(admins.admins || []);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const domainesFiltres = domaines.filter((d) => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return d.nom.toLowerCase().includes(q) || d.code.toLowerCase().includes(q) || (d.region && d.region.toLowerCase().includes(q));
  });

  const gererCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreurCreation(null);
    setCreationEnCours(true);
    try {
      await clientAPI.post("/api/v1/domaines", formCreation, { authentifie: true });
      notifier("Domaine créé avec succès !", "succes");
      setModaleOuverte(false);
      setFormCreation({ nom: "", code: "", region: "", description: "", admin_id: "" });
      charger();
    } catch (e) {
      setErreurCreation(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de création");
    } finally {
      setCreationEnCours(false);
    }
  };

  const gererEdition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domaineSelectionne) return;
    setErreurEdition(null);
    setEditionEnCours(true);
    try {
      await clientAPI.patch(`/api/v1/domaines/${domaineSelectionne.id}`, formEdition, { authentifie: true });
      notifier("Domaine modifié avec succès !", "succes");
      setModaleEdition(false);
      charger();
    } catch (e) {
      setErreurEdition(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de modification");
    } finally {
      setEditionEnCours(false);
    }
  };

  const gererSuppression = async (id: string) => {
    if (!confirm("Supprimer ce domaine ? Cette action est irréversible.")) return;
    try {
      await clientAPI.delete(`/api/v1/domaines/${id}`, { authentifie: true });
      notifier("Domaine supprimé", "succes");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de suppression", "erreur");
    }
  };

  const ouvrirEdition = (d: Domaine) => {
    setDomaineSelectionne(d);
    setFormEdition({ nom: d.nom, code: d.code, region: d.region || "", description: d.description || "", admin_id: d.admin_id || "" });
    setModaleEdition(true);
  };

  const colonnes: Colonne<Domaine>[] = [
    {
      cle: "nom",
      libelle: "Nom",
      rendu: (d) => (
        <div>
          <p className="font-medium text-ardoise">{d.nom}</p>
          <p className="text-xs text-ardoise-clair font-mono">{d.code}</p>
        </div>
      ),
    },
    {
      cle: "region",
      libelle: "Région",
      rendu: (d) => <span className="text-sm text-ardoise-clair">{d.region || "—"}</span>,
    },
    {
      cle: "admin",
      libelle: "Admin",
      rendu: (d) => <span className="text-sm text-ardoise-clair">{d.admin_nom || "—"}</span>,
    },
    {
      cle: "statut",
      libelle: "Statut",
      alignement: "centre",
      rendu: (d) => d.est_actif ? <Badge variante="succes">Actif</Badge> : <Badge variante="neutre">Inactif</Badge>,
    },
    {
      cle: "date_creation",
      libelle: "Créé le",
      rendu: (d) => <span className="text-xs text-ardoise-clair">{new Date(d.date_creation).toLocaleDateString("fr-FR")}</span>,
    },
    {
      cle: "actions",
      libelle: "",
      alignement: "droite",
      rendu: (d) => (
        <div className="flex gap-1">
          <Bouton variante="ghost" taille="petit" onClick={() => setModaleDetails(d)}>Voir</Bouton>
          <Bouton variante="ghost" taille="petit" onClick={() => ouvrirEdition(d)}>Modifier</Bouton>
          <Bouton variante="danger" taille="petit" onClick={() => gererSuppression(d.id)}>Supprimer</Bouton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl">Gestion des Domaines</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Crée et gère les domaines organisationnels du système. Assigne un admin à chaque domaine.
        </p>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm text-ardoise-clair">
            <strong className="text-lagune">{domainesFiltres.length}</strong> domaine{domainesFiltres.length > 1 ? "s" : ""}
          </p>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher..."
              className="flex-grow sm:w-64 px-3 py-1.5 border border-ardoise-clair/20 rounded-lg text-sm"
            />
            <Bouton variante="primaire" taille="petit" onClick={() => setModaleOuverte(true)}>
              + Nouveau Domaine
            </Bouton>
          </div>
        </div>
        {chargement ? (
          <p className="text-center text-ardoise-clair italic py-6">Chargement...</p>
        ) : (
          <Tableau colonnes={colonnes} donnees={domainesFiltres} cleLigne={(d) => d.id} vide="Aucun domaine trouvé." />
        )}
      </Carte>

      {/* Modale Création */}
      <Modal ouvert={modaleOuverte} surFermeture={() => setModaleOuverte(false)} titre="Nouveau Domaine" taille="moyen">
        <form onSubmit={gererCreation} className="space-y-3">
          {erreurCreation && <Alerte variante="erreur">{erreurCreation}</Alerte>}
          <ChampSaisie libelle="Nom" value={formCreation.nom} onChange={(e) => setFormCreation({ ...formCreation, nom: e.target.value })} required />
          <ChampSaisie libelle="Code" value={formCreation.code} onChange={(e) => setFormCreation({ ...formCreation, code: e.target.value.toUpperCase() })} required />
          <ChampSaisie libelle="Région" value={formCreation.region} onChange={(e) => setFormCreation({ ...formCreation, region: e.target.value })} />
          {/* NOUVEAU : Sélection de l'admin */}
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Admin du domaine (optionnel)</label>
            <select value={formCreation.admin_id} onChange={(e) => setFormCreation({ ...formCreation, admin_id: e.target.value })} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm">
              <option value="">Aucun admin assigné</option>
              {adminsDisponibles.map((a) => (
                <option key={a.id} value={a.id}>{a.nom}</option>
              ))}
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
      <Modal ouvert={modaleEdition} surFermeture={() => setModaleEdition(false)} titre="Modifier le Domaine" taille="moyen">
        <form onSubmit={gererEdition} className="space-y-3">
          {erreurEdition && <Alerte variante="erreur">{erreurEdition}</Alerte>}
          <ChampSaisie libelle="Nom" value={formEdition.nom} onChange={(e) => setFormEdition({ ...formEdition, nom: e.target.value })} required />
          <ChampSaisie libelle="Code" value={formEdition.code} onChange={(e) => setFormEdition({ ...formEdition, code: e.target.value.toUpperCase() })} required />
          <ChampSaisie libelle="Région" value={formEdition.region} onChange={(e) => setFormEdition({ ...formEdition, region: e.target.value })} />
          {/* NOUVEAU : Sélection de l'admin */}
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Admin du domaine</label>
            <select value={formEdition.admin_id} onChange={(e) => setFormEdition({ ...formEdition, admin_id: e.target.value })} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm">
              <option value="">Aucun admin assigné</option>
              {adminsDisponibles.map((a) => (
                <option key={a.id} value={a.id}>{a.nom}</option>
              ))}
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
        <Modal ouvert={true} surFermeture={() => setModaleDetails(null)} titre="Détails du Domaine" taille="moyen">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-ardoise-clair">Nom</p><p className="font-semibold">{modaleDetails.nom}</p></div>
              <div><p className="text-xs text-ardoise-clair">Code</p><p className="font-mono text-ocre">{modaleDetails.code}</p></div>
              <div><p className="text-xs text-ardoise-clair">Région</p><p>{modaleDetails.region || "—"}</p></div>
              <div><p className="text-xs text-ardoise-clair">Admin</p><p>{modaleDetails.admin_nom || "—"}</p></div>
              <div><p className="text-xs text-ardoise-clair">Statut</p>{modaleDetails.est_actif ? <Badge variante="succes">Actif</Badge> : <Badge variante="neutre">Inactif</Badge>}</div>
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