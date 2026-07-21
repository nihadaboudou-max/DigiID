"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { listerAgentsEnrolement } from "@/services/chefs";
import type { AgentResponse } from "@/services/chefs";
import { Alerte } from "@/composants/commun/Alerte";

export default function ChefEnrolementActivitesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => { chargerActivites(); }, []);

  async function chargerActivites() {
    setChargement(true); setErreur("");
    try {
      const data = await listerAgentsEnrolement({ par_page: 100 });
      setAgents(data.agents || []);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des activités");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="min-h-screen space-y-6 apparition pb-20">
      <div>
        <p className="text-terre font-semibold text-sm uppercase tracking-wider">📊 Activités</p>
        <h1>Activités de l'équipe d'enrôlement</h1>
        <p className="text-ardoise-clair mt-2">Suivez l'activité et les performances de vos agents de terrain</p>
      </div>
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}
      {chargement ? (
        <div className="text-center py-12"><div className="animate-spin w-8 h-8 border-4 border-terre border-t-transparent rounded-full mx-auto mb-3"></div><p className="text-ardoise-clair">Chargement...</p></div>
      ) : (
        <div className="space-y-4">
          <Carte titre={`Activité des ${agents.length} agents`}>
            <div className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-4 bg-sable rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-terre/10 flex items-center justify-center text-terre font-bold">{(agent.prenom[0] || "") + (agent.nom[0] || "")}</div>
                    <div>
                      <p className="font-bold text-ardoise">{agent.prenom} {agent.nom}</p>
                      <p className="text-sm text-ardoise-clair">{agent.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variante={agent.est_actif ? "succes" : "terre"} taille="petit">{agent.est_actif ? "Actif" : "Inactif"}</Badge>
                        <span className="text-xs text-ardoise-clair">Créé le {new Date(agent.date_creation).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-terre">Dernière activité</p>
                    <p className="text-xs text-ardoise-clair">Il y a 2 heures</p>
                  </div>
                </div>
              ))}
            </div>
          </Carte>
          <div className="grid md:grid-cols-3 gap-4">
            <Carte className="text-center p-6"><p className="text-3xl font-bold text-terre">{agents.filter(a => a.est_actif).length}</p><p className="text-xs text-ardoise-clair mt-2">Agents actifs aujourd'hui</p></Carte>
            <Carte className="text-center p-6"><p className="text-3xl font-bold text-succes">100%</p><p className="text-xs text-ardoise-clair mt-2">Taux d'activité</p></Carte>
            <Carte className="text-center p-6"><p className="text-3xl font-bold text-ocre">{agents.length}</p><p className="text-xs text-ardoise-clair mt-2">Total agents</p></Carte>
          </div>
        </div>
      )}
      <Link href="/chef-enrolement"><Bouton variante="ghost">← Retour au tableau de bord</Bouton></Link>
    </div>
  );
}
