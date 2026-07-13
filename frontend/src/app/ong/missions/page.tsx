"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";

interface Mission {
  id: string;
  programme_id: string | null;
  titre: string;
  zone: string | null;
  date_depart: string;
  date_retour: string | null;
  objectifs: string | null;
  statut: string;
}

export default function MissionsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong", "ong", "chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await fetch("/api/v1/ong/missions", { credentials: "include" });
      if (!reponse.ok) throw new Error("Erreur de chargement");
      const data = await reponse.json();
      setMissions(data);
    } catch (error) {
      setErreur("Erreur de chargement des missions");
      console.error(error);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="space-y-6 apparition">
      <nav className="text-sm text-ardoise-clair">
        <Link href="/ong" className="hover:text-ocre">Tableau de bord</Link>
        <span className="mx-2">/</span>
        <span className="text-ardoise font-semibold">Missions</span>
      </nav>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div>
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">Agent ONG</p>
        <h1 className="mt-1 text-2xl">Missions</h1>
        <p className="text-ardoise-clair mt-1 text-sm">{missions.length} mission(s)</p>
      </div>

      {chargement ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-ocre border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-ardoise-clair italic">Chargement...</p>
        </div>
      ) : missions.length === 0 ? (
        <Carte>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-ardoise-clair italic">Aucune mission.</p>
            <p className="text-xs text-ardoise-clair mt-2">Les missions vous seront assignées par votre chef ONG.</p>
          </div>
        </Carte>
      ) : (
        <div className="space-y-2">
          {missions.map((m) => (
            <div key={m.id} className="carte p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-bold text-ardoise">{m.titre}</h3>
                  <p className="text-xs text-ardoise-clair mt-1">{m.zone || "Zone non spécifiée"}</p>
                  <p className="text-xs text-ardoise-clair">
                    Du {new Date(m.date_depart).toLocaleDateString("fr-FR")}
                    {m.date_retour ? ` au ${new Date(m.date_retour).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                  {m.objectifs && (
                    <p className="text-xs text-ardoise-clair mt-2 italic">{m.objectifs}</p>
                  )}
                </div>
                <Badge 
                  variante={
                    m.statut === "en_cours" ? "succes" : 
                    m.statut === "planifiee" ? "ocre" : "lagune"
                  }
                >
                  {m.statut === "en_cours" ? "En cours" : 
                   m.statut === "planifiee" ? "Planifiée" : "Terminée"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/ong">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}