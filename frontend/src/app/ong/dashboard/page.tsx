"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";

interface Stats {
  nb_beneficiaires: number;
  nb_programmes: number;
  nb_missions: number;
  zones: string[];
}

interface Mission {
  id: string;
  titre: string;
  zone: string | null;
  date_depart: string;
  statut: string;
}

export default function OngDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong", "ong", "chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => { toutCharger(); }, []);

  async function toutCharger() {
    setChargement(true);
    setErreur(null);
    try {
      const [statsRes, missionsRes] = await Promise.all([
        fetch("/api/v1/ong/stats", { credentials: "include" }),
        fetch("/api/v1/ong/missions", { credentials: "include" }),
      ]);

      if (!statsRes.ok || !missionsRes.ok) {
        throw new Error("Erreur de chargement");
      }

      const [statsData, missionsData] = await Promise.all([
        statsRes.json(),
        missionsRes.json(),
      ]);

      setStats(statsData);
      setMissions(missionsData);
    } catch (error) {
      setErreur("Erreur de chargement du tableau de bord");
      console.error(error);
    } finally {
      setChargement(false);
    }
  }

  if (chargement) {
    return (
      <div className="space-y-6 apparition">
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">Agent ONG</p>
        <h1 className="text-2xl">Tableau de bord</h1>
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-ocre border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-ardoise-clair italic">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 apparition">
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div>
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">Agent ONG</p>
        <h1 className="mt-1 text-2xl">Tableau de bord</h1>
        <p className="text-ardoise-clair mt-1 text-sm">Gérez vos bénéficiaires et consultez vos missions.</p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-lagune">{stats?.nb_beneficiaires || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold mt-1">Bénéficiaires</p>
        </Carte>
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-ocre">{stats?.nb_programmes || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold mt-1">Programmes</p>
        </Carte>
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-succes">{stats?.nb_missions || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold mt-1">Missions</p>
        </Carte>
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-terre">{stats?.zones?.length || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold mt-1">Zones</p>
        </Carte>
      </div>

      {/* Actions rapides */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CarteAction 
          titre="Bénéficiaires" 
          description="Enregistrer et gérer les bénéficiaires" 
          href="/ong/beneficiaires" 
          icone="👥" 
        />
        <CarteAction 
          titre="Programmes" 
          description="Consulter les programmes actifs" 
          href="/ong/programme" 
          icone="📋" 
        />
        <CarteAction 
          titre="Missions" 
          description="Voir mes missions assignées" 
          href="/ong/missions" 
          icone="🌍" 
        />
        <CarteAction 
          titre="Attestations" 
          description="Mes attestations reçues" 
          href="/ong/attestations" 
          icone="📜" 
        />
      </div>

      {/* Missions récentes */}
      {missions.length > 0 && (
        <Carte titre="Missions récentes">
          <div className="space-y-2">
            {missions.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-sable rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-ardoise">{m.titre}</p>
                  <p className="text-xs text-ardoise-clair">{m.zone || "Zone non spécifiée"} · {new Date(m.date_depart).toLocaleDateString("fr-FR")}</p>
                </div>
                <Badge variante={m.statut === "en_cours" ? "succes" : m.statut === "planifiee" ? "ocre" : "lagune"}>
                  {m.statut === "en_cours" ? "En cours" : m.statut === "planifiee" ? "Planifiée" : "Terminée"}
                </Badge>
              </div>
            ))}
          </div>
        </Carte>
      )}

      {missions.length === 0 && (
        <div className="bg-ocre/10 border-l-4 border-ocre p-4 rounded">
          <p className="text-sm text-ardoise">
            <strong>Bienvenue !</strong> Commencez par enregistrer vos premiers bénéficiaires.
          </p>
        </div>
      )}
    </div>
  );
}

function CarteAction({ titre, description, href, icone }: { titre: string; description: string; href: string; icone: string }) {
  return (
    <Link href={href} className="block group">
      <div className="carte cursor-pointer hover:shadow-lg transition-all h-full">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{icone}</span>
          <div>
            <h3 className="font-bold text-ardoise group-hover:text-ocre transition-colors">{titre}</h3>
            <p className="text-sm text-ardoise-clair mt-1">{description}</p>
          </div>
        </div>
        <p className="text-xs text-ocre font-semibold mt-3 group-hover:translate-x-1 transition-transform">Accéder →</p>
      </div>
    </Link>
  );
}