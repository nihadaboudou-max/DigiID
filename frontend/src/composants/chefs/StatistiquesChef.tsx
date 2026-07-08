"use client";

import { useState, useEffect } from "react";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { Alerte } from "@/composants/commun/Alerte";
import {
  obtenirStatistiquesChef,
  listerEquipe,
  type StatistiquesChefResponse,
  type AgentResponse,
} from "@/services/chefs";

interface StatistiquesChefProps {
  titre: string;
  sousTitre: string;
  typeOrganisation: "police" | "medical" | "ong" | "enrolement";
}

export default function StatistiquesChef({
  titre,
  sousTitre,
  typeOrganisation,
}: StatistiquesChefProps) {
  const [stats, setStats] = useState<StatistiquesChefResponse | null>(null);
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [derniereMAJ, setDerniereMAJ] = useState<Date | null>(null);

  useEffect(() => {
    chargerDonnees();
    // Rafraîchissement automatique toutes les 60 secondes
    const interval = setInterval(chargerDonnees, 60000);
    return () => clearInterval(interval);
  }, [typeOrganisation]);

  async function chargerDonnees() {
    setChargement(true);
    setErreur("");
    try {
      const [statsData, equipeData] = await Promise.all([
        obtenirStatistiquesChef(),
        listerEquipe({ par_page: 100 }),
      ]);
      setStats(statsData);
      setAgents(equipeData.agents || []);
      setDerniereMAJ(new Date());
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des statistiques");
    } finally {
      setChargement(false);
    }
  }

  const getTypeLabel = () => {
    const labels = {
      police: "Police",
      medical: "Médical",
      ong: "ONG",
      enrolement: "Enrôlement",
    };
    return labels[typeOrganisation];
  };

  // Calculs dynamiques
  const tauxActivite = stats?.total_agents
    ? (stats.agents_actifs / stats.total_agents) * 100
    : 0;

  const agentsParVille = agents.reduce((acc, agent) => {
    const ville = agent.ville || "Non spécifié";
    acc[ville] = (acc[ville] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topVilles = Object.entries(agentsParVille)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const agentsRecents30j = agents.filter((agent) => {
    const dateCreation = new Date(agent.date_creation);
    const trenteJoursAvant = new Date();
    trenteJoursAvant.setDate(trenteJoursAvant.getDate() - 30);
    return dateCreation >= trenteJoursAvant;
  }).length;

  return (
    <div className="space-y-6 apparition">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            📊 Statistiques
          </p>
          <h1>{titre}</h1>
          <p className="text-ardoise-clair mt-2">{sousTitre}</p>
          {derniereMAJ && (
            <p className="text-xs text-ardoise-clair mt-1">
              Dernière mise à jour : {derniereMAJ.toLocaleTimeString("fr-FR")}
            </p>
          )}
        </div>
        <button
          onClick={chargerDonnees}
          disabled={chargement}
          className="mt-4 md:mt-0 px-4 py-2 bg-lagune text-white rounded-lg hover:bg-lagune/90 transition-colors text-sm font-semibold disabled:opacity-50"
        >
          {chargement ? "Actualisation..." : "🔄 Actualiser"}
        </button>
      </div>

      {/* Erreur */}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Statistiques principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Carte className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl font-bold text-lagune mb-2">
            {chargement ? "..." : stats?.total_agents || 0}
          </div>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Total {getTypeLabel()}
          </p>
          <div className="mt-3">
            <Badge variante="lagune" taille="petit">
              +{agentsRecents30j} ce mois
            </Badge>
          </div>
        </Carte>

        <Carte className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl font-bold text-succes mb-2">
            {chargement ? "..." : stats?.agents_actifs || 0}
          </div>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Agents actifs
          </p>
          <div className="mt-3">
            <BarreProgression
              valeur={tauxActivite}
              couleur="succes"
            />
            <p className="text-xs text-ardoise-clair mt-1">
              {tauxActivite.toFixed(1)}% d'activité
            </p>
          </div>
        </Carte>

        <Carte className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl font-bold text-ocre mb-2">
            {chargement ? "..." : stats?.agents_crees_aujourdhui || 0}
          </div>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Aujourd'hui
          </p>
          <div className="mt-3">
            <Badge variante="ocre" taille="petit">
              {stats?.agents_crees_aujourdhui === 0 ? "Aucun" : "Nouveau"}
            </Badge>
          </div>
        </Carte>

        <Carte className="text-center p-6 hover:shadow-lg transition-shadow">
          <div className="text-4xl font-bold text-terre mb-2">
            {chargement ? "..." : stats?.agents_inactifs || 0}
          </div>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Inactifs
          </p>
          <div className="mt-3">
            <Badge
              variante={stats?.agents_inactifs === 0 ? "succes" : "terre"}
              taille="petit"
            >
              {stats?.agents_inactifs === 0 ? "Parfait" : "Action requise"}
            </Badge>
          </div>
        </Carte>
      </div>

      {/* Répartition par ville */}
      {topVilles.length > 0 && (
        <Carte titre="📍 Répartition par ville">
          <div className="space-y-3">
            {topVilles.map(([ville, nombre]) => (
              <div key={ville} className="flex items-center gap-3">
                <div className="w-32 text-sm text-ardoise truncate">{ville}</div>
                <div className="flex-1">
                  <BarreProgression
                    valeur={(nombre / agents.length) * 100}
                    couleur="lagune"
                  />
                </div>
                <div className="w-16 text-right text-sm font-semibold text-ardoise">
                  {nombre}
                </div>
              </div>
            ))}
          </div>
        </Carte>
      )}

      {/* Évolution */}
      <div className="grid md:grid-cols-2 gap-4">
        <Carte titre="📈 Croissance de l'équipe">
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-ardoise">Ce mois-ci</span>
                <span className="font-semibold text-ardoise">
                  +{agentsRecents30j} agents
                </span>
              </div>
              <BarreProgression
                valeur={
                  stats?.total_agents
                    ? (agentsRecents30j / stats.total_agents) * 100
                    : 0
                }
                couleur="lagune"
              />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-ardoise">Aujourd'hui</span>
                <span className="font-semibold text-ardoise">
                  +{stats?.agents_crees_aujourdhui || 0} agents
                </span>
              </div>
              <BarreProgression
                valeur={
                  stats?.total_agents
                    ? ((stats.agents_crees_aujourdhui || 0) / stats.total_agents) * 100
                    : 0
                }
                couleur="ocre"
              />
            </div>
          </div>
        </Carte>

        <Carte titre=" Taux d'activité">
          <div className="text-center py-4">
            <div className="text-5xl font-bold text-succes mb-2">
              {tauxActivite.toFixed(1)}%
            </div>
            <p className="text-sm text-ardoise-clair">
              {stats?.agents_actifs || 0} actifs sur {stats?.total_agents || 0}{" "}
              agents
            </p>
            <div className="mt-4">
              <BarreProgression valeur={tauxActivite} couleur="succes" />
            </div>
          </div>
        </Carte>
      </div>

      {/* Dernier agent créé */}
      {stats?.dernier_agent_cree && (
        <Carte titre="👤 Dernier agent créé">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-lagune/10 flex items-center justify-center text-lagune text-2xl font-bold">
              {(stats.dernier_agent_cree.prenom[0] || "") +
                (stats.dernier_agent_cree.nom[0] || "")}
            </div>
            <div className="flex-1">
              <p className="font-bold text-ardoise text-lg">
                {stats.dernier_agent_cree.prenom}{" "}
                {stats.dernier_agent_cree.nom}
              </p>
              <p className="text-sm text-ardoise-clair">
                {stats.dernier_agent_cree.email}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variante="lagune" taille="petit">
                  {stats.dernier_agent_cree.digiid_public}
                </Badge>
                <span className="text-xs text-ardoise-clair">
                  Créé le{" "}
                  {new Date(
                    stats.dernier_agent_cree.date_creation
                  ).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </div>
          </div>
        </Carte>
      )}
    </div>
  );
}