"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { BarreProgression } from "@/composants/commun/BarreProgression";
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
  superieur_id: string | null;
  est_actif: boolean;
  ville: string | null;
  date_creation: string;
}

interface DashboardChefProps {
  titre: string;
  sousTitre: string;
  typeAgent: "police" | "medical" | "ong" | "enrolement";
  iconeDashboard: string;
}

export default function DashboardChef({
  titre,
  sousTitre,
  typeAgent,
  iconeDashboard,
}: DashboardChefProps) {
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    chargerAgents();
    const interval = setInterval(chargerAgents, 30000);
    return () => clearInterval(interval);
  }, [typeAgent]);

  async function chargerAgents() {
    try {
      if (!agents.length) setChargement(true);
      
      // ✅ CORRECTION : Endpoint dynamique selon le type d'agent
      let endpoint = `/api/v1/chefs/${typeAgent}/agents`;
      if (typeAgent === "medical") {
        endpoint = `/api/v1/chefs/medical/medecins`;
      }
      
      const data: any = await clientAPI.get(`${endpoint}?par_page=5`, {
        authentifie: true,
      });
      
      setAgents(data.agents || []);
      setErreur("");
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des données");
    } finally {
      setChargement(false);
    }
  }

  async function handleSuspendre(agentId: string) {
    if (!confirm("Suspendre cet agent ?")) return;
    try {
      await clientAPI.patch(`/api/v1/chefs/agents/${agentId}/suspendre`, {}, {
        authentifie: true,
      });
      await chargerAgents();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la suspension");
    }
  }

  async function handleReactiver(agentId: string) {
    try {
      await clientAPI.patch(`/api/v1/chefs/agents/${agentId}/reactiver`, {}, {
        authentifie: true,
      });
      await chargerAgents();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la réactivation");
    }
  }

  const getTypeLabel = () => {
    const labels: Record<string, string> = {
      police: "Police",
      medical: "Médical",
      ong: "ONG",
      enrolement: "Enrôlement",
    };
    return labels[typeAgent] || "Agents";
  };

  const stats = {
    total: agents.length,
    actifs: agents.filter(a => a.est_actif).length,
    inactifs: agents.filter(a => !a.est_actif).length,
    aujourdhui: agents.filter(a => {
      const dateCreation = new Date(a.date_creation);
      const aujourdhui = new Date();
      return dateCreation.toDateString() === aujourdhui.toDateString();
    }).length,
  };

  return (
    <div className="space-y-6 apparition">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            {iconeDashboard} {titre}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-ardoise">{sousTitre}</h1>
          <p className="text-ardoise-clair mt-2">
            Tableau de bord en temps réel
          </p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
          <Link href={`/chef-${typeAgent}/agents`}>
            <button className="px-4 py-2 bg-lagune text-white rounded-lg hover:bg-lagune/90 transition-colors text-sm font-semibold">
              + Nouvel agent
            </button>
          </Link>
          <Link href={`/chef-${typeAgent}/missions`}>
            <button className="px-4 py-2 bg-ocre text-white rounded-lg hover:bg-ocre/90 transition-colors text-sm font-semibold">
              + Mission
            </button>
          </Link>
        </div>
      </div>

      {/* Erreur */}
      {erreur && (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre font-medium">{erreur}</p>
        </div>
      )}

      {/* Statistiques en temps réel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Carte className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl font-bold text-lagune mb-2">
            {chargement && !agents.length ? "..." : stats.total}
          </div>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Total {getTypeLabel()}
          </p>
          <div className="mt-3">
            <Badge variante="lagune" taille="petit">
              Effectif
            </Badge>
          </div>
        </Carte>

        <Carte className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl font-bold text-succes mb-2">
            {chargement && !agents.length ? "..." : stats.actifs}
          </div>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Agents actifs
          </p>
          <div className="mt-3">
            <BarreProgression
              valeur={stats.total > 0 ? (stats.actifs / stats.total) * 100 : 0}
              couleur="succes"
            />
          </div>
        </Carte>

        <Carte className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl font-bold text-ocre mb-2">
            {chargement && !agents.length ? "..." : stats.aujourdhui}
          </div>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Aujourd'hui
          </p>
          <div className="mt-3">
            <Badge variante="ocre" taille="petit">
              +{agents.length} ce mois
            </Badge>
          </div>
        </Carte>

        <Carte className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl font-bold text-terre mb-2">
            {chargement && !agents.length ? "..." : stats.inactifs}
          </div>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Inactifs
          </p>
          <div className="mt-3">
            <Badge variante="terre" taille="petit">
              Nécessite action
            </Badge>
          </div>
        </Carte>
      </div>

      {/* Agents récents */}
      <Carte titre="Derniers agents créés">
        {chargement && !agents.length ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-lagune border-t-transparent rounded-full mx-auto"></div>
            <p className="text-ardoise-clair mt-2">Chargement...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-ardoise-clair italic mb-4">
              Aucun agent dans votre équipe.
            </p>
            <Link href={`/chef-${typeAgent}/agents`}>
              <button className="px-4 py-2 bg-lagune text-white rounded-lg hover:bg-lagune/90 transition-colors text-sm font-semibold">
                + Créer votre premier agent
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-4 bg-sable rounded-lg hover:bg-sable/80 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold flex-shrink-0">
                    {(agent.prenom?.[0] || "") + (agent.nom?.[0] || "")}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-ardoise truncate">
                      {agent.prenom} {agent.nom}
                    </p>
                    <p className="text-sm text-ardoise-clair truncate">
                      {agent.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variante={agent.est_actif ? "succes" : "terre"}
                        taille="petit"
                      >
                        {agent.est_actif ? "Actif" : "Inactif"}
                      </Badge>
                      <span className="text-xs text-ardoise-clair font-mono">
                        {agent.digiid_public}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-xs text-ardoise-clair flex-shrink-0 ml-4 text-right">
                    <p>Créé le</p>
                    <p className="font-medium">
                      {new Date(agent.date_creation).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  {agent.est_actif ? (
                    <button
                      onClick={() => handleSuspendre(agent.id)}
                      className="ml-2 px-3 py-1 text-xs bg-ocre text-white rounded hover:bg-ocre/90 transition-colors"
                    >
                      ⏸️ Suspendre
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReactiver(agent.id)}
                      className="ml-2 px-3 py-1 text-xs bg-succes text-white rounded hover:bg-succes/90 transition-colors"
                    >
                      ✅ Réactiver
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {/* Actions rapides */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link href={`/chef-${typeAgent}/agents`}>
          <Carte className="cursor-pointer hover:shadow-lg transition-all p-6 h-full">
            <div className="text-3xl mb-3">👥</div>
            <h3 className="font-bold text-ardoise mb-1">Gérer les agents</h3>
            <p className="text-sm text-ardoise-clair">
              Inviter, créer et gérer votre équipe
            </p>
          </Carte>
        </Link>

        <Link href={`/chef-${typeAgent}/missions`}>
          <Carte className="cursor-pointer hover:shadow-lg transition-all p-6 h-full">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="font-bold text-ardoise mb-1">Missions</h3>
            <p className="text-sm text-ardoise-clair">
              Planifier et suivre les missions
            </p>
          </Carte>
        </Link>

        <Link href={`/chef-${typeAgent}/rapports`}>
          <Carte className="cursor-pointer hover:shadow-lg transition-all p-6 h-full">
            <div className="text-3xl mb-3"></div>
            <h3 className="font-bold text-ardoise mb-1">Rapports</h3>
            <p className="text-sm text-ardoise-clair">
              Consulter et générer les rapports
            </p>
          </Carte>
        </Link>
      </div>
    </div>
  );
}