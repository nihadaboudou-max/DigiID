"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI } from "@/services/client_api";

interface AgentResponse {
  id: string;
  digiid_public: string;
  email: string;
  prenom: string;
  nom: string;
  role: string;
  domaine_id: string | null;
  departement_id: string | null;
  est_actif: boolean;
  ville: string | null;
  telephone: string | null;
  date_creation: string;
}

export default function ChefOngAgentsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [modeEdition, setModeEdition] = useState(false);
  const [agentEnCours, setAgentEnCours] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    prenom: "",
    nom: "",
    telephone: "",
    ville: "",
    mission: "",
  });

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const data: any = await clientAPI.get("/api/v1/chefs/ong/agents?par_page=1000", {
        authentifie: true,
      });
      setAgents(data.agents || []);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des agents");
    } finally {
      setChargement(false);
    }
  }

  async function handleCreer() {
    if (!formData.email || !formData.prenom || !formData.nom) {
      setErreur("Email, prénom et nom sont obligatoires.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await clientAPI.post("/api/v1/ong/agents", {
        email: formData.email,
        prenom: formData.prenom,
        nom: formData.nom,
        telephone: formData.telephone || null,
        ville: formData.ville || null,
      }, { authentifie: true });
      
      await charger();
      reinitialiserFormulaire();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la création");
    } finally {
      setEnvoi(false);
    }
  }

  async function handleModifier() {
    if (!agentEnCours || !formData.email || !formData.prenom || !formData.nom) {
      setErreur("Email, prénom et nom sont obligatoires.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await clientAPI.patch(`/api/v1/chefs/agents/${agentEnCours}`, {
        email: formData.email,
        prenom: formData.prenom,
        nom: formData.nom,
        telephone: formData.telephone || null,
        ville: formData.ville || null,
      }, { authentifie: true });
      
      await charger();
      reinitialiserFormulaire();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la modification");
    } finally {
      setEnvoi(false);
    }
  }

  async function handleSuspendre(agentId: string) {
    if (!confirm("Suspendre cet agent ?")) return;
    try {
      await clientAPI.patch(`/api/v1/chefs/agents/${agentId}/suspendre`, {}, {
        authentifie: true,
      });
      await charger();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la suspension");
    }
  }

  async function handleReactiver(agentId: string) {
    try {
      await clientAPI.patch(`/api/v1/chefs/agents/${agentId}/reactiver`, {}, {
        authentifie: true,
      });
      await charger();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la réactivation");
    }
  }

  async function handleSupprimer(agentId: string) {
    if (!confirm("Supprimer définitivement cet agent ?")) return;
    try {
      await clientAPI.delete(`/api/v1/chefs/agents/${agentId}`, {
        authentifie: true,
      });
      await charger();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la suppression");
    }
  }

  function ouvrirFormulaireEdition(agent: AgentResponse) {
    setAgentEnCours(agent.id);
    setFormData({
      email: agent.email,
      prenom: agent.prenom,
      nom: agent.nom,
      telephone: agent.telephone || "",
      ville: agent.ville || "",
      mission: "",
    });
    setModeEdition(true);
    setAfficherFormulaire(true);
  }

  function reinitialiserFormulaire() {
    setAgentEnCours(null);
    setFormData({
      email: "",
      prenom: "",
      nom: "",
      telephone: "",
      ville: "",
      mission: "",
    });
    setAfficherFormulaire(false);
    setModeEdition(false);
    setErreur(null);
  }

  const agentsFiltres = agents.filter((agent) => {
    const search = recherche.toLowerCase();
    return (
      agent.email.toLowerCase().includes(search) ||
      `${agent.prenom} ${agent.nom}`.toLowerCase().includes(search) ||
      (agent.digiid_public || "").toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6 apparition">
      <nav className="text-sm text-ardoise-clair">
        <Link href="/chef-ong" className="hover:text-ocre">Tableau de bord</Link>
        <span className="mx-2">/</span>
        <span className="text-ardoise font-semibold">Agents ONG</span>
      </nav>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div>
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">GESTION</p>
        <h1 className="mt-1 text-2xl font-bold text-ardoise">Agents ONG</h1>
        <p className="text-ardoise-clair mt-1 text-sm">Gérez votre équipe d'agents ONG</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Rechercher par nom ou email..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="flex-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
        />
        <Bouton variante="primaire" onClick={() => { setModeEdition(false); setAfficherFormulaire(true); }}>
          ✉️ Inviter
        </Bouton>
      </div>

      {chargement ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-ardoise-clair italic">Chargement...</p>
        </div>
      ) : agentsFiltres.length === 0 ? (
        <Carte>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-ardoise-clair italic">Aucun agent trouvé.</p>
            {agents.length === 0 && (
              <Bouton variante="primaire" className="mt-4" onClick={() => setAfficherFormulaire(true)}>
                + Créer votre premier agent
              </Bouton>
            )}
          </div>
        </Carte>
      ) : (
        <div className="space-y-2">
          {agentsFiltres.map((agent) => (
            <div key={agent.id} className="carte p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold flex-shrink-0">
                    {(agent.prenom?.[0] || "") + (agent.nom?.[0] || "")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ardoise truncate">{agent.prenom} {agent.nom}</p>
                    <p className="text-sm text-ardoise-clair truncate">{agent.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variante={agent.est_actif ? "succes" : "terre"} taille="petit">
                        {agent.est_actif ? "Actif" : "Inactif"}
                      </Badge>
                      {agent.ville && <span className="text-xs text-ardoise-clair">📍 {agent.ville}</span>}
                      {agent.digiid_public && <span className="text-xs text-ardoise-clair font-mono">{agent.digiid_public}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <button
                    onClick={() => ouvrirFormulaireEdition(agent)}
                    className="px-3 py-1 text-xs bg-lagune text-white rounded hover:bg-lagune/90 transition-colors"
                  >
                    ✏️ Modifier
                  </button>
                  {agent.est_actif ? (
                    <button
                      onClick={() => handleSuspendre(agent.id)}
                      className="px-3 py-1 text-xs bg-ocre text-white rounded hover:bg-ocre/90 transition-colors"
                    >
                      ⏸️ Suspendre
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactiver(agent.id)}
                      className="px-3 py-1 text-xs bg-succes text-white rounded hover:bg-succes/90 transition-colors"
                    >
                      ✅ Réactiver
                    </button>
                  )}
                  <button
                    onClick={() => handleSupprimer(agent.id)}
                    className="px-3 py-1 text-xs bg-terre text-white rounded hover:bg-terre/90 transition-colors"
                  >
                    🗑️ Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Création/Édition */}
      {afficherFormulaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-ardoise-clair/10 p-6 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-ardoise">
                  {modeEdition ? "✏️ Modifier l'agent" : "✉️ Inviter un agent"}
                </h2>
                <button
                  onClick={reinitialiserFormulaire}
                  className="text-ardoise-clair hover:text-ardoise transition-colors text-2xl leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <ChampSaisie 
                libelle="Email *" 
                type="email" 
                value={formData.email} 
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                placeholder="agent@exemple.com" 
                required 
              />
              
              <div className="grid grid-cols-2 gap-3">
                <ChampSaisie 
                  libelle="Prénom *" 
                  value={formData.prenom} 
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} 
                  placeholder="Prénom" 
                  required 
                />
                <ChampSaisie 
                  libelle="Nom *" 
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

              <div className="flex gap-3 pt-4 border-t border-ardoise-clair/10">
                <Bouton 
                  variante="primaire" 
                  disabled={!formData.email || !formData.prenom || !formData.nom || envoi} 
                  onClick={modeEdition ? handleModifier : handleCreer} 
                  chargement={envoi}
                  className="flex-1"
                >
                  {envoi ? "Enregistrement..." : (modeEdition ? "Modifier" : "Inviter")}
                </Bouton>
                <Bouton variante="ghost" onClick={reinitialiserFormulaire}>
                  Annuler
                </Bouton>
              </div>
            </div>
          </div>
        </div>
      )}

      <Link href="/chef-ong">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}