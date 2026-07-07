"use client";

import { useState, useEffect } from "react";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Modal } from "@/composants/commun/Modal";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";

interface Agent {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  telephone?: string;
  ville?: string;
  est_actif: boolean;
  digiid_public: string;
  date_creation: string;
  [key: string]: any;
}

interface GestionAgentsChefProps {
  titre: string;
  sousTitre: string;
  typeAgent: string;
  creerAgent: (data: any) => Promise<any>;
  listerAgents: (params?: any) => Promise<{ agents: Agent[]; total: number }>;
  champsSupplementaires?: Array<{
    nom: string;
    label: string;
    type: string;
    required?: boolean;
  }>;
}

export default function GestionAgentsChef({
  titre,
  sousTitre,
  typeAgent,
  creerAgent,
  listerAgents,
  champsSupplementaires = [],
}: GestionAgentsChefProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<"tous" | "actif" | "inactif">("tous");

  // Formulaire
  const [formData, setFormData] = useState<any>({
    email: "",
    prenom: "",
    nom: "",
    telephone: "",
    ville: "",
  });

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const data = await listerAgents({ par_page: 100 });
      setAgents(data.agents || []);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement.");
    } finally {
      setChargement(false);
    }
  }

  function ouvrirFormulaire() {
    setFormData({
      email: "",
      prenom: "",
      nom: "",
      telephone: "",
      ville: "",
    });
    setAfficherFormulaire(true);
  }

  async function handleCreer() {
    if (!formData.email || !formData.prenom || !formData.nom) return;
    setSauvegarde(true);
    try {
      await creerAgent(formData);
      setAfficherFormulaire(false);
      charger();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la création.");
    } finally {
      setSauvegarde(false);
    }
  }

  const agentsFiltres = agents.filter((agent) => {
    const matchRecherche =
      agent.email.toLowerCase().includes(recherche.toLowerCase()) ||
      `${agent.prenom} ${agent.nom}`.toLowerCase().includes(recherche.toLowerCase());
    const matchStatut =
      filtreStatut === "tous" ||
      (filtreStatut === "actif" && agent.est_actif) ||
      (filtreStatut === "inactif" && !agent.est_actif);
    return matchRecherche && matchStatut;
  });

  return (
    <div className="space-y-6 apparition">
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Gestion</p>
        <h1>{titre}</h1>
        <p className="text-ardoise-clair mt-2">{sousTitre}</p>
      </div>

      {/* Erreur */}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Filtres et actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Rechercher un agent..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="flex-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
        />
        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value as any)}
          className="px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
        >
          <option value="tous">Tous les statuts</option>
          <option value="actif">Actifs</option>
          <option value="inactif">Inactifs</option>
        </select>
        <Bouton variante="primaire" onClick={ouvrirFormulaire}>
          + Nouvel agent
        </Bouton>
      </div>

      {/* Liste des agents */}
      <Carte titre={`${agentsFiltres.length} agent(s)`}>
        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
        ) : agentsFiltres.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-ardoise-clair italic">Aucun agent trouvé.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agentsFiltres.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-4 bg-sable rounded-lg hover:bg-sable/80 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold flex-shrink-0">
                    {(agent.prenom[0] || "") + (agent.nom[0] || "")}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-ardoise truncate">
                      {agent.prenom} {agent.nom}
                    </p>
                    <p className="text-sm text-ardoise-clair truncate">{agent.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variante={agent.est_actif ? "succes" : "terre"} taille="petit">
                        {agent.est_actif ? "Actif" : "Inactif"}
                      </Badge>
                      <span className="text-xs text-ardoise-clair font-mono">
                        {agent.digiid_public}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-ardoise-clair flex-shrink-0 ml-4">
                  <p>Créé le</p>
                  <p className="font-medium">
                    {new Date(agent.date_creation).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {/* Modal de création */}
      {afficherFormulaire && (
        <Modal
          ouvert={true}
          titre={`Créer un nouvel agent ${typeAgent}`}
          surFermeture={() => setAfficherFormulaire(false)}
        >
          <div className="space-y-4">
            <ChampSaisie
              libelle="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="agent@exemple.com"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <ChampSaisie
                libelle="Prénom"
                value={formData.prenom}
                onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                placeholder="Prénom"
                required
              />
              <ChampSaisie
                libelle="Nom"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                placeholder="Nom"
                required
              />
            </div>
            <ChampSaisie
              libelle="Téléphone"
              value={formData.telephone}
              onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
              placeholder="+221 77 123 45 67"
            />
            <ChampSaisie
              libelle="Ville"
              value={formData.ville}
              onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
              placeholder="Dakar"
            />
            {champsSupplementaires.map((champ) => (
              <ChampSaisie
                key={champ.nom}
                libelle={champ.label}
                type={champ.type}
                value={formData[champ.nom] || ""}
                onChange={(e) => setFormData({ ...formData, [champ.nom]: e.target.value })}
                placeholder={champ.label}
                required={champ.required}
              />
            ))}
            <div className="flex gap-3 pt-2">
              <Bouton variante="primaire" chargement={sauvegarde} onClick={handleCreer}>
                Créer l'agent
              </Bouton>
              <Bouton variante="ghost" onClick={() => setAfficherFormulaire(false)}>
                Annuler
              </Bouton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}