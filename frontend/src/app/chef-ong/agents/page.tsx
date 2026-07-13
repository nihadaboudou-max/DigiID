"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { listerAgentsONG, type AgentResponse } from "@/services/chefs";

export default function ChefOngAgentsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur", "admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");

  useEffect(() => { 
    charger(); 
  }, []);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      // ✅ CORRECTION : Utilisation du service qui gère l'authentification automatiquement
      const data = await listerAgentsONG({ par_page: 100 });
      setAgents(data.agents || []);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des agents");
    } finally {
      setChargement(false);
    }
  }

  const agentsFiltres = agents.filter((agent) => {
    const search = recherche.toLowerCase();
    return (
      agent.email.toLowerCase().includes(search) ||
      `${agent.prenom} ${agent.nom}`.toLowerCase().includes(search)
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
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">Gestion</p>
        <h1 className="mt-1 text-2xl">Agents ONG</h1>
        <p className="text-ardoise-clair mt-1 text-sm">Gérez votre équipe d'agents ONG</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Rechercher par nom ou email..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="flex-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocre/30"
        />
        <Link href="/chef-ong/invitations">
          <Bouton variante="primaire">✉️ Inviter</Bouton>
        </Link>
      </div>

      {chargement ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-ocre border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-ardoise-clair italic">Chargement...</p>
        </div>
      ) : agentsFiltres.length === 0 ? (
        <Carte>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-ardoise-clair italic">Aucun agent trouvé.</p>
            {agents.length === 0 && (
              <Link href="/chef-ong/invitations">
                <Bouton variante="primaire" className="mt-4">
                  Inviter un agent
                </Bouton>
              </Link>
            )}
          </div>
        </Carte>
      ) : (
        <div className="space-y-2">
          {agentsFiltres.map((agent) => (
            <div key={agent.id} className="carte p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ocre/10 flex items-center justify-center text-ocre font-bold">
                    {agent.prenom.charAt(0)}{agent.nom.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-ardoise">{agent.prenom} {agent.nom}</p>
                    <p className="text-xs text-ardoise-clair">{agent.email}</p>
                    {agent.ville && <p className="text-xs text-ardoise-clair">📍 {agent.ville}</p>}
                  </div>
                </div>
                <Badge variante={agent.est_actif ? "succes" : "lagune"}>
                  {agent.est_actif ? "Actif" : "Inactif"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/chef-ong">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}