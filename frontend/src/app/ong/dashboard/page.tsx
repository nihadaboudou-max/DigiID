"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";

interface Stats {
  nb_beneficiaires: number;
  nb_programmes: number;
  nb_missions: number;
  zones: string[];
}

interface Beneficiaire {
  id: string;
  nom: string;
  programme: string;
  zone: string | null;
  statut: string;
  date_inscription: string;
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
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong", "chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => { toutCharger(); }, []);

  async function toutCharger() {
    setChargement(true);
    setErreur(null);
    try {
      const [statsRes, benefRes, missionsRes] = await Promise.all([
        fetch("/api/v1/ong/stats", { credentials: "include" }),
        fetch("/api/v1/ong/beneficiaires", { credentials: "include" }),
        fetch("/api/v1/ong/missions", { credentials: "include" }),
      ]);

      if (!statsRes.ok || !benefRes.ok || !missionsRes.ok) {
        throw new Error("Erreur de chargement des données");
      }

      const [statsData, benefData, missionsData] = await Promise.all([
        statsRes.json(),
        benefRes.json(),
        missionsRes.json(),
      ]);

      setStats(statsData);
      setBeneficiaires(benefData);
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
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">ONG Partenaire</p>
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
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">ONG Partenaire</p>
        <h1 className="mt-1 text-2xl">Tableau de bord</h1>
        <p className="text-ardoise-clair mt-1 text-sm">Gérez vos programmes d'aide humanitaire et vos bénéficiaires.</p>
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
          <p className="text-xs uppercase text-ardoise-clair font-semibold mt-1">Zones actives</p>
        </Carte>
      </div>

      {/* Actions rapides */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CarteAction 
          titre="Bénéficiaires" 
          description="Gérer les bénéficiaires inscrits" 
          href="/ong/beneficiaires" 
          icone="" 
        />
        <CarteAction 
          titre="Programmes" 
          description="Gérer les programmes d'aide" 
          href="/ong/programme" 
          icone="📋" 
        />
        <CarteAction 
          titre="Missions terrain" 
          description="Planifier et suivre les missions" 
          href="/ong/missions" 
          icone="🌍" 
        />
        <CarteAction 
          titre="Attestations" 
          description="Certificats communautaires" 
          href="/ong/attestations" 
          icone="📜" 
        />
      </div>

      {/* Derniers bénéficiaires */}
      {beneficiaires.length > 0 && (
        <Carte titre="Derniers bénéficiaires inscrits">
          <div className="space-y-2">
            {beneficiaires.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 bg-sable rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ocre/10 flex items-center justify-center text-ocre font-bold">
                    {b.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ardoise">{b.nom}</p>
                    <p className="text-xs text-ardoise-clair">{b.programme} · {b.zone || "Zone non spécifiée"}</p>
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

      {/* Missions en cours */}
      {missions.length > 0 && (
        <Carte titre="Missions en cours">
          <div className="space-y-2">
            {missions.filter(m => m.statut === "en_cours" || m.statut === "planifiee").slice(0, 3).map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 bg-sable rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-ardoise">{m.titre}</p>
                  <p className="text-xs text-ardoise-clair">{m.zone || "Zone non spécifiée"} · {new Date(m.date_depart).toLocaleDateString("fr-FR")}</p>
                </div>
                <Badge variante={m.statut === "en_cours" ? "succes" : "ocre"}>
                  {m.statut === "en_cours" ? "En cours" : "Planifiée"}
                </Badge>
              </div>
            ))}
          </div>
        </Carte>
      )}

      {/* Message de bienvenue si vide */}
      {beneficiaires.length === 0 && missions.length === 0 && (
        <div className="bg-ocre/10 border-l-4 border-ocre p-4 rounded">
          <p className="text-sm text-ardoise">
            <strong>Bienvenue sur DigiID ONG !</strong> Commencez par ajouter vos premiers bénéficiaires et programmes pour suivre vos activités humanitaires.
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