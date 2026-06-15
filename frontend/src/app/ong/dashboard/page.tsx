"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { useRoleUI } from "@/crochets/useRoleUI";
import { obtenirStats, listerBeneficiaires, listerMissions } from "@/services/ong";
import type { StatsONG, BeneficiaireONG, MissionTerrain } from "@/services/ong";

export default function OngDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["ong"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can, chargement } = useRoleUI();
  const [stats, setStats] = useState<StatsONG | null>(null);
  const [beneficiaires, setBeneficiaires] = useState<BeneficiaireONG[]>([]);
  const [missions, setMissions] = useState<MissionTerrain[]>([]);
  const [chargementStats, setChargementStats] = useState(true);

  useEffect(() => { toutCharger(); }, []);

  async function toutCharger() {
    setChargementStats(true);
    try {
      const [s, b, m] = await Promise.all([
        obtenirStats(), listerBeneficiaires(), listerMissions()
      ]);
      setStats(s); setBeneficiaires(b); setMissions(m);
    } catch {}
    finally { setChargementStats(false); }
  }

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">ONG Partenaire</p>
        <h1>Tableau de bord</h1>
        <p className="text-ardoise-clair italic py-12">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">ONG Partenaire</p>
          <h1 className="mt-1">Gestion des beneficiaires</h1>
          <p className="text-ardoise-clair mt-2">Suis les programmes d aide humanitaire et les beneficiaires.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/ong/beneficiaires"><Bouton variante="primaire">+ Nouveau beneficiaire</Bouton></Link>
          <Link href="/ong/programme"><Bouton variante="secondaire" taille="petit">Nouveau programme</Bouton></Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">{chargementStats ? "..." : stats?.nb_beneficiaires || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Beneficiaires</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-ocre">{chargementStats ? "..." : stats?.nb_programmes || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Programmes</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">{chargementStats ? "..." : stats?.nb_missions || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Missions</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">{stats?.zones?.length || 0}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Zones actives</p>
        </div>
      </div>

      {can.viewBeneficiaries && beneficiaires.length > 0 && (
        <Carte titre="Derniers beneficiaires inscrits">
          <div className="space-y-2">
            {beneficiaires.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-sable rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600 font-bold">
                    {b.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ardoise">{b.nom}</p>
                    <p className="text-xs text-ardoise-clair">{b.programme} · {b.zone || "Zone non specifiee"}</p>
                  </div>
                </div>
                <Badge variante={b.statut === "actif" ? "succes" : "lagune"}>
                  {b.statut === "actif" ? "Actif" : "Inactif"}
                </Badge>
              </div>
            ))}
          </div>
        </Carte>
      )}

      {can.manageMissions && missions.length > 0 && (
        <Carte titre="Missions en cours">
          <div className="space-y-2">
            {missions.filter(m => m.statut === "en_cours" || m.statut === "planifiee").slice(0, 3).map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-sable rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-ardoise">{m.titre}</p>
                  <p className="text-xs text-ardoise-clair">{m.zone} · {new Date(m.date_depart).toLocaleDateString("fr-FR")}</p>
                </div>
                <Badge variante={m.statut === "en_cours" ? "succes" : "ocre"}>
                  {m.statut === "en_cours" ? "En cours" : "Planifiee"}
                </Badge>
              </div>
            ))}
          </div>
        </Carte>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {can.viewBeneficiaries && <CarteAction titre="Beneficiaires" description="Gerer les inscrits" href="/ong/beneficiaires" icone="👥" />}
        {can.manageProgram && <CarteAction titre="Programmes" description="Gerer les programmes" href="/ong/programme" icone="📋" />}
        {can.manageMissions && <CarteAction titre="Missions terrain" description="Planifier et suivre" href="/ong/missions" icone="🌍" />}
      </div>

      {beneficiaires.length === 0 && !chargementStats && (
        <div className="bg-teal-500/10 border-l-4 border-teal-500 p-4 rounded">
          <p className="text-sm text-teal-700">Bienvenue ! Commencez par ajouter vos premiers beneficiaires et programmes.</p>
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
        <p className="text-xs text-ocre font-semibold mt-3 group-hover:translate-x-1 transition-transform">Acceder →</p>
      </div>
    </Link>
  );
}

