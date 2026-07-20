"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { listerAgentsONG } from "@/services/chefs";
import type { AgentResponse } from "@/services/chefs";

export default function AgentOngDetailPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur", "admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const params = useParams();
  const agentId = params.id as string;
  const [agent, setAgent] = useState<AgentResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    chargerAgent();
  }, [agentId]);

  async function chargerAgent() {
    setChargement(true);
    setErreur("");
    try {
      const data = await listerAgentsONG({ par_page: 1000 });
      const agentTrouve = data.agents?.find((a) => a.id === agentId);
      if (agentTrouve) {
        setAgent(agentTrouve);
      } else {
        setErreur("Agent ONG introuvable.");
      }
    } catch (error: any) {
      setErreur("Erreur de chargement des données.");
    } finally {
      setChargement(false);
    }
  }

  if (chargement) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-ocre border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (erreur || !agent) {
    return (
      <div className="space-y-6">
        <Carte>
          <p className="text-center text-terre">{erreur || "Agent ONG introuvable"}</p>
        </Carte>
        <Link href="/chef-ong/equipe">
          <Bouton variante="ghost">← Retour à l'équipe</Bouton>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 apparition pb-20">
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/chef-ong" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <Link href="/chef-ong/equipe" className="hover:text-ocre">Agents ONG</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Profil</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Profil agent ONG</p>
        <h1>{agent.prenom} {agent.nom}</h1>
      </div>

      <Carte>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-ocre/10 flex items-center justify-center text-ocre text-3xl font-bold flex-shrink-0">
            {(agent.prenom[0] || "") + (agent.nom[0] || "")}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-2xl font-bold text-ardoise">{agent.prenom} {agent.nom}</h2>
            <p className="text-sm text-ardoise-clair">{agent.email}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variante="ocre" taille="petit">Agent ONG</Badge>
              <Badge variante={agent.est_actif ? "succes" : "terre"} taille="petit">
                {agent.est_actif ? "Actif" : "Inactif"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-ardoise-clair/10">
          <div className="space-y-3">
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Coordonnées</p>
            <div>
              <span className="text-sm text-ardoise-clair">Email :</span>
              <span className="text-sm text-ardoise ml-2">{agent.email}</span>
            </div>
            <div>
              <span className="text-sm text-ardoise-clair">DigiID :</span>
              <span className="text-sm text-ardoise ml-2 font-mono">{agent.digiid_public}</span>
            </div>
            {agent.ville && (
              <div>
                <span className="text-sm text-ardoise-clair">Ville :</span>
                <span className="text-sm text-ardoise ml-2">{agent.ville}</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Informations</p>
            <div>
              <span className="text-sm text-ardoise-clair">Créé le :</span>
              <span className="text-sm text-ardoise ml-2">
                {new Date(agent.date_creation).toLocaleDateString("fr-FR")}
              </span>
            </div>
            <div>
              <span className="text-sm text-ardoise-clair">Rôle :</span>
              <span className="text-sm text-ardoise ml-2">{agent.role}</span>
            </div>
          </div>
        </div>
      </Carte>

      <div className="flex flex-wrap gap-3">
        <Link href="/chef-ong/equipe">
          <Bouton variante="ghost">← Retour à l'équipe</Bouton>
        </Link>
      </div>
    </div>
  );
}