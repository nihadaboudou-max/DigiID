"use client";

import { useState, useEffect } from "react";
import { Carte } from "@/composants/commun/Carte";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { Alerte } from "@/composants/commun/Alerte";

interface StatistiquesChefProps {
  titre: string;
  sousTitre: string;
  typeOrganisation: string;
}

export default function StatistiquesChef({
  titre,
  sousTitre,
  typeOrganisation,
}: StatistiquesChefProps) {
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    chargerStats();
  }, []);

  async function chargerStats() {
    setChargement(true);
    // Simulation - à remplacer par un appel API réel
    setTimeout(() => {
      setStats({
        total_agents: 12,
        agents_actifs: 10,
        agents_inactifs: 2,
        missions_en_cours: 3,
        missions_terminees: 15,
        beneficiaires: 450,
      });
      setChargement(false);
    }, 500);
  }

  if (chargement) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-ardoise-clair italic">Chargement des statistiques...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 apparition">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Statistiques</p>
        <h1>{titre}</h1>
        <p className="text-ardoise-clair mt-2">{sousTitre}</p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Statistiques principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Carte className="text-center p-6">
          <p className="text-4xl font-bold text-lagune mb-2">{stats?.total_agents || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Total agents</p>
        </Carte>
        <Carte className="text-center p-6">
          <p className="text-4xl font-bold text-succes mb-2">{stats?.agents_actifs || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Agents actifs</p>
        </Carte>
        <Carte className="text-center p-6">
          <p className="text-4xl font-bold text-terre mb-2">{stats?.agents_inactifs || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Agents inactifs</p>
        </Carte>
        <Carte className="text-center p-6">
          <p className="text-4xl font-bold text-ocre mb-2">{stats?.missions_en_cours || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Missions en cours</p>
        </Carte>
        <Carte className="text-center p-6">
          <p className="text-4xl font-bold text-lagune mb-2">{stats?.missions_terminees || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Missions terminées</p>
        </Carte>
        <Carte className="text-center p-6">
          <p className="text-4xl font-bold text-jaune mb-2">{stats?.beneficiaires || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Bénéficiaires</p>
        </Carte>
      </div>

      {/* Progression */}
      <Carte titre="Progression des missions">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-ardoise">Missions complétées</span>
              <span className="font-semibold text-ardoise">
                {stats?.missions_terminees || 0} / {(stats?.missions_terminees || 0) + (stats?.missions_en_cours || 0)}
              </span>
            </div>
            <BarreProgression
              valeur={
                ((stats?.missions_terminees || 0) /
                  ((stats?.missions_terminees || 0) + (stats?.missions_en_cours || 0) || 1)) *
                100
              }
              couleur="lagune"
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-ardoise">Taux d'activité des agents</span>
              <span className="font-semibold text-ardoise">
                {stats?.agents_actifs || 0} / {stats?.total_agents || 0}
              </span>
            </div>
            <BarreProgression
              valeur={((stats?.agents_actifs || 0) / (stats?.total_agents || 1)) * 100}
              couleur="succes"
            />
          </div>
        </div>
      </Carte>
    </div>
  );
}