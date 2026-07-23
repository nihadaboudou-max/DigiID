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
import type { BadgeVariante } from "@/composants/commun/Badge";

interface Departement {
  id: string;
  nom: string;
  type_departement: string;
  description: string | null;
  capacite_max: number;
  domaine_id: string;
  domaine_nom: string | null;
  chef_id: string | null;
  chef_nom: string | null;
  est_actif: boolean;
  date_creation: string;
}

interface DomaineSimple {
  id: string;
  nom: string;
}

interface ChefDisponible {
  id: string;
  nom: string;
  role: string;
}

// Types pour les départements
type TypeDepartement = "police" | "medical" | "ong" | "agent";

const TYPES_DEPARTEMENT: Record<TypeDepartement, { label: string; icone: string; couleur: BadgeVariante }> = {
  police: { label: "Police", icone: "👮", couleur: "terre" },
  medical: { label: "Médical", icone: "🏥", couleur: "lagune" },
  ong: { label: "ONG", icone: "🤝", couleur: "ocre" },
  agent: { label: "Enrôlement", icone: "📋", couleur: "lagune" },
};

// Remplacez cette ligne :
export default function PageDepartementsAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [domaines, setDomaines] = useState<DomaineSimple[]>([]);
  const [chefsDisponibles, setChefsDisponibles] = useState<ChefDisponible[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [modaleEdition, setModaleEdition] = useState(false);
  const [modaleDetails, setModaleDetails] = useState<Departement | null>(null);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [editionEnCours, setEditionEnCours] = useState(false);
  const [departementSelectionne, setDepartementSelectionne] = useState<Departement | null>(null);
  const [formCreation, setFormCreation] = useState({
    nom: "",
    type_departement: "police" as TypeDepartement,
    domaine_id: "",
    description: "",
    capacite_max: 50,
    chef_id: "",
  });
  const [formEdition, setFormEdition] = useState({
    nom: "",
    type_departement: "police" as TypeDepartement,
    domaine_id: "",
    description: "",
    capacite_max: 50,
    chef_id: "",
  });
    const [erreurCreation, setErreurCreation] = useState<string | null>(null);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);

  /** Convertit les chaînes vides en null pour les IDs */
  const nettoyerFormulaire = (form: typeof formCreation) => ({
    ...form,
    chef_id: form.chef_id || null,
    domaine_id: form.domaine_id || null,
  });

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
            const [deps, doms, chefs] = await Promise.all([
        clientAPI.get<{ departements: Departement[] }>("/api/v1/departements", { authentifie: true }),
        clientAPI.get<{ domaines: DomaineSimple[] }>("/api/v1/domaines", { authentifie: true }),
        // Utiliser l'endpoint chefs-liste qui retourne les chefs formatés
        clientAPI
          .get<{ id: string; prenom_initiale: string | null; nom_initiale: string | null; email_masque: string; role: string }[]>(
            "/api/v1/admin/chefs-liste",
            { authentifie: true }
          )
          .catch(() => []),
      ]);
      setDepartements(deps.departements || []);
      setDomaines(doms.domaines || []);
            // Transformer en format ChefDisponible
      const chefsFormates: ChefDisponible[] = (Array.isArray(chefs) ? chefs : []).map((c: any) => ({
        id: c.id,
        nom: [c.prenom_initiale || "", c.nom_initiale || ""].filter(Boolean).join(" ") || "Sans nom",
        role: c.role,
      }));
      setChefsDisponibles(chefsFormates);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const departementsFiltres = departements.filter((d) => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return (
      d.nom.toLowerCase().includes(q) ||
      d.type_departement.toLowerCase().includes(q) ||
      (d.domaine_nom && d.domaine_nom.toLowerCase().includes(q))
    );
  });

  const gererCreation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreurCreation(null);
    setCreationEnCours(true);
    try {
      await clientAPI.post("/api/v1/departements", nettoyerFormulaire(formCreation), { authentifie: true });
      notifier("Département créé avec succès !", "succes");
      setModaleOuverte(false);
      setFormCreation({
        nom: "",
        type_departement: "police",
        domaine_id: "",
        description: "",
        capacite_max: 50,
        chef_id: "",
      });
      charger();
    } catch (e) {
      setErreurCreation(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de création");
    } finally {
      setCreationEnCours(false);
    }
  };

  const gererEdition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!departementSelectionne) return;
    setErreurEdition(null);
    setEditionEnCours(true);
    try {
      await clientAPI.patch(`/api/v1/departements/${departementSelectionne.id}`, nettoyerFormulaire(formEdition), { authentifie: true });
      notifier("Département modifié avec succès !", "succes");
      setModaleEdition(false);
      charger();
    } catch (e) {
      setErreurEdition(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de modification");
    } finally {
      setEditionEnCours(false);
    }
  };

  const gererSuppression = async (id: string) => {
    if (!confirm("Supprimer ce département ?")) return;
    try {
      await clientAPI.delete(`/api/v1/departements/${id}`, { authentifie: true });
      notifier("Département supprimé", "succes");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de suppression", "erreur");
    }
  };

  const ouvrirEdition = (d: Departement) => {
    setDepartementSelectionne(d);
    setFormEdition({
      nom: d.nom,
      type_departement: d.type_departement as TypeDepartement,
      domaine_id: d.domaine_id,
      description: d.description || "",
      capacite_max: d.capacite_max,
      chef_id: d.chef_id || "",
    });
    setModaleEdition(true);
  };

  // Fonctions utilitaires avec typage correct
  const obtenirCouleurType = (type: string): BadgeVariante => {
    const config = TYPES_DEPARTEMENT[type as TypeDepartement];
    return config?.couleur || "lagune";
  };

  const obtenirIconeType = (type: string): string => {
    const config = TYPES_DEPARTEMENT[type as TypeDepartement];
    return config?.icone || "📁";
  };

  const obtenirLabelType = (type: string): string => {
    const config = TYPES_DEPARTEMENT[type as TypeDepartement];
    return config?.label || type;
  };

  const colonnes: Colonne<Departement>[] = [
    {
      cle: "nom",
      libelle: "Nom",
      rendu: (d) => (
        <div>
          <p className="font-medium text-ardoise">{d.nom}</p>
          <p className="text-xs text-ardoise-clair">{d.type_departement}</p>
        </div>
      ),
    },
    {
      cle: "domaine",
      libelle: "Domaine",
      rendu: (d) => <span className="text-sm text-ardoise-clair">{d.domaine_nom || "—"}</span>,
    },
    {
      cle: "chef",
      libelle: "Chef",
      rendu: (d) => <span className="text-sm text-ardoise-clair">{d.chef_nom || "—"}</span>,
    },
    {
      cle: "statut",
      libelle: "Statut",
      alignement: "centre",
      rendu: (d) => (d.est_actif ? <Badge variante="succes">Actif</Badge> : <Badge variante="neutre">Inactif</Badge>),
    },
    {
      cle: "actions",
      libelle: "",
      alignement: "droite",
      rendu: (d) => (
        <div className="flex gap-1">
          <Bouton variante="ghost" taille="petit" onClick={() => setModaleDetails(d)}>
            Voir
          </Bouton>
          <Bouton variante="ghost" taille="petit" onClick={() => ouvrirEdition(d)}>
            Modifier
          </Bouton>
          <Bouton variante="danger" taille="petit" onClick={() => gererSuppression(d.id)}>
            Supprimer
          </Bouton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl">Gestion des Départements</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Crée et gère les départements par domaine. Assigne un chef à chaque département.
        </p>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm text-ardoise-clair">
            <strong className="text-lagune">{departementsFiltres.length}</strong> département
            {departementsFiltres.length > 1 ? "s" : ""}
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
              + Nouveau Département
            </Bouton>
          </div>
        </div>
        {chargement ? (
          <p className="text-center text-ardoise-clair italic py-6">Chargement...</p>
        ) : (
          <Tableau colonnes={colonnes} donnees={departementsFiltres} cleLigne={(d) => d.id} vide="Aucun département trouvé." />
        )}
      </Carte>

      {/* Modale Création */}
      <Modal ouvert={modaleOuverte} surFermeture={() => setModaleOuverte(false)} titre="Nouveau Département" taille="moyen">
        <form onSubmit={gererCreation} className="space-y-3">
          {erreurCreation && <Alerte variante="erreur">{erreurCreation}</Alerte>}
          <ChampSaisie libelle="Nom" value={formCreation.nom} onChange={(e) => setFormCreation({ ...formCreation, nom: e.target.value })} required />
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Type</label>
            <select
              value={formCreation.type_departement}
              onChange={(e) => setFormCreation({ ...formCreation, type_departement: e.target.value as TypeDepartement })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              <option value="police">Police</option>
              <option value="medical">Médical</option>
              <option value="ong">ONG</option>
              <option value="agent">Agent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Domaine</label>
            <select
              value={formCreation.domaine_id}
              onChange={(e) => setFormCreation({ ...formCreation, domaine_id: e.target.value })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              required
            >
              <option value="">Sélectionner un domaine</option>
              {domaines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Chef de département (optionnel)</label>
            <select
              value={formCreation.chef_id}
              onChange={(e) => setFormCreation({ ...formCreation, chef_id: e.target.value })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              <option value="">Aucun chef assigné</option>
              {chefsDisponibles
                .filter((c) => c.role === `chef_${formCreation.type_departement}`)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Description</label>
            <textarea
              value={formCreation.description}
              onChange={(e) => setFormCreation({ ...formCreation, description: e.target.value })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Bouton variante="ghost" onClick={() => setModaleOuverte(false)}>
              Annuler
            </Bouton>
            <Bouton type="submit" variante="primaire" chargement={creationEnCours}>
              Créer
            </Bouton>
          </div>
        </form>
      </Modal>

      {/* Modale Édition */}
      <Modal ouvert={modaleEdition} surFermeture={() => setModaleEdition(false)} titre="Modifier le Département" taille="moyen">
        <form onSubmit={gererEdition} className="space-y-3">
          {erreurEdition && <Alerte variante="erreur">{erreurEdition}</Alerte>}
          <ChampSaisie libelle="Nom" value={formEdition.nom} onChange={(e) => setFormEdition({ ...formEdition, nom: e.target.value })} required />
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Type</label>
            <select
              value={formEdition.type_departement}
              onChange={(e) => setFormEdition({ ...formEdition, type_departement: e.target.value as TypeDepartement })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              <option value="police">Police</option>
              <option value="medical">Médical</option>
              <option value="ong">ONG</option>
              <option value="agent">Agent</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Domaine</label>
            <select
              value={formEdition.domaine_id}
              onChange={(e) => setFormEdition({ ...formEdition, domaine_id: e.target.value })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              required
            >
              <option value="">Sélectionner un domaine</option>
              {domaines.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Chef de département</label>
            <select
              value={formEdition.chef_id}
              onChange={(e) => setFormEdition({ ...formEdition, chef_id: e.target.value })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
            >
              <option value="">Aucun chef assigné</option>
              {chefsDisponibles
                .filter((c) => c.role === `chef_${formEdition.type_departement}`)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Description</label>
            <textarea
              value={formEdition.description}
              onChange={(e) => setFormEdition({ ...formEdition, description: e.target.value })}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Bouton variante="ghost" onClick={() => setModaleEdition(false)}>
              Annuler
            </Bouton>
            <Bouton type="submit" variante="primaire" chargement={editionEnCours}>
              Enregistrer
            </Bouton>
          </div>
        </form>
      </Modal>

      {/* Modale Détails */}
      {modaleDetails && (
        <Modal ouvert={true} surFermeture={() => setModaleDetails(null)} titre="Détails du Département" taille="moyen">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-ardoise-clair">Nom</p>
                <p className="font-semibold">{modaleDetails.nom}</p>
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Type</p>
                <div className="flex items-center gap-1.5">
                  <span>{obtenirIconeType(modaleDetails.type_departement)}</span>
                  <Badge variante={obtenirCouleurType(modaleDetails.type_departement)}>
                    {obtenirLabelType(modaleDetails.type_departement)}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Domaine</p>
                <p>{modaleDetails.domaine_nom || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Chef</p>
                <p>{modaleDetails.chef_nom || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Statut</p>
                {modaleDetails.est_actif ? (
                  <Badge variante="succes">Actif</Badge>
                ) : (
                  <Badge variante="neutre">Inactif</Badge>
                )}
              </div>
              <div className="col-span-2">
                <p className="text-xs text-ardoise-clair">Description</p>
                <p>{modaleDetails.description || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Capacité max</p>
                <p>{modaleDetails.capacite_max}</p>
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Créé le</p>
                <p>{new Date(modaleDetails.date_creation).toLocaleDateString("fr-FR")}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-3 border-t border-ardoise-clair/10">
              <Bouton variante="ghost" onClick={() => setModaleDetails(null)}>
                Fermer
              </Bouton>
              <Bouton variante="primaire" onClick={() => { setModaleDetails(null); ouvrirEdition(modaleDetails); }}>
                Modifier
              </Bouton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}