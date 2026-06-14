"use client";

/**
 * Tableau de bord administrateur — design épuré.
 * KPIs en haut, cartes technologies en grille.
 * Réservé aux rôles administrateur et super_administrateur.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { obtenirStatistiquesAdmin, type StatsAdmin } from "@/services/admin";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import {
  IconeUtilisateur, IconeBouclier, IconeStatistique,
  IconeAlerte, IconeJournal, IconeParametres,
} from "@/composants/commun/Icones";
import { obtenirResumeMonitoring, type ResumeMonitoring } from "@/services/admin";

interface TableauDeBord {
  message: string;
  statistiques: {
    utilisateurs_actifs: number;
    comptes_verrouilles: number;
    evenements_aujourdhui: number;
  };
}

interface TechnologieCard {
  id: string;
  titre: string;
  description: string;
  href: string;
  Icone: React.ComponentType<{ className?: string }>;
  couleur: string;
  technologies: string[];
}

const CARTES_TECHNOLOGIES: TechnologieCard[] = [
  {
    id: "utilisateurs", titre: "Utilisateurs",
    description: "Comptes, rôles RBAC, statuts et vérifications",
    href: "/admin/utilisateurs", Icone: IconeUtilisateur,
    couleur: "from-lagune/10 to-lagune/5 border-lagune/20",
    technologies: ["RBAC", "Profils", "Scores"],
  },
  {
    id: "droits", titre: "Droits & permissions",
    description: "Matrice des accès par rôle et technologie",
    href: "/admin/droits", Icone: IconeBouclier,
    couleur: "from-ocre/10 to-ocre/5 border-ocre/20",
    technologies: ["RBAC", "Permissions"],
  },
  {
    id: "alertes", titre: "Alertes",
    description: "Détection de fraudes et événements suspects",
    href: "/admin/alertes", Icone: IconeAlerte,
    couleur: "from-terre/10 to-terre/5 border-terre/20",
    technologies: ["Détection", "ML", "Règles"],
  },
  {
    id: "statistiques", titre: "Statistiques",
    description: "Métriques système et indicateurs de santé",
    href: "/admin/statistiques", Icone: IconeStatistique,
    couleur: "from-lagune/10 to-lagune/5 border-lagune/20",
    technologies: ["KPIs", "Graphiques"],
  },
];

export default function TableauDeBordAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [dashboard, setDashboard] = useState<TableauDeBord | null>(null);
  const [stats, setStats] = useState<StatsAdmin | null>(null);
  const [monitoring, setMonitoring] = useState<ResumeMonitoring | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    const charger = async () => {
      try {
        const [d, s, m] = await Promise.all([
          clientAPI.get<TableauDeBord>("/api/v1/admin/tableau-de-bord", { authentifie: true }),
          obtenirStatistiquesAdmin(),
          obtenirResumeMonitoring(),
        ]);
        if (actif) { setDashboard(d); setStats(s); setMonitoring(m); }
      } catch (e) {
        if (actif) {
          setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
        }
      } finally {
        if (actif) setChargement(false);
      }
    };
    charger();
    const intervalle = setInterval(charger, 15000);
    return () => { actif = false; clearInterval(intervalle); };
  }, []);

  if (chargement) {
    return (
      <div className="apparition">
        <HeaderSection />
        <div className="grille-kpi mt-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="carte h-24 animate-pulse bg-sable-clair/50" />
          ))}
        </div>
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="apparition">
        <HeaderSection />
        <Alerte variante="erreur" titre="Erreur de chargement">{erreur}</Alerte>
      </div>
    );
  }

  return (
    <div className="apparition space-y-8">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="section-header">
          <p className="text-terre">Espace administrateur</p>
          <h1>Tableau de bord</h1>
          <p className="text-ardoise-clair/70 text-sm mt-1">
            Vue d&apos;ensemble du système et accès rapide aux fonctionnalités.
          </p>
        </div>
        <Link href="/admin/droits">
          <Bouton variante="primaire">
            <IconeBouclier className="w-4 h-4 mr-1.5" />
            Gestion des droits
          </Bouton>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grille-kpi">
        {dashboard && (
          <>
            <CarteKPI libelle="Utilisateurs actifs" valeur={dashboard.statistiques.utilisateurs_actifs} icone="👥" couleur="lagune" />
            <CarteKPI libelle="Comptes verrouillés" valeur={dashboard.statistiques.comptes_verrouilles} icone="🔒" couleur="terre" />
            <CarteKPI libelle="Événements aujourd'hui" valeur={dashboard.statistiques.evenements_aujourdhui} icone="📊" couleur="ocre" />
          </>
        )}
        {stats && (
          <CarteKPI libelle="Score moyen" valeur={`${stats.score_moyen}/100`} icone="⭐" couleur="succes" />
        )}
        {monitoring && (
          <CarteKPI libelle="Connectés maintenant" valeur={monitoring.utilisateurs_connectes} icone="🟢" couleur="succes" />
        )}
      </div>

      {/* Modules */}
      <section>
        <div className="section-header">
          <h2>Modules d'administration</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {CARTES_TECHNOLOGIES.map((tech, i) => (
            <LienTechnologie key={tech.id} tech={tech} delai={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ---- Sous-composants ----

function HeaderSection() {
  return (
    <div className="section-header">
      <p className="text-terre">Espace administrateur</p>
      <h1>Tableau de bord</h1>
    </div>
  );
}

function CarteKPI({ libelle, valeur, icone, couleur }: {
  libelle: string; valeur: number | string; icone: string;
  couleur: "lagune" | "ocre" | "terre" | "succes";
}) {
  const classes = {
    lagune: "carte-lagune",
    ocre: "carte-accent",
    terre: "carte-terre",
    succes: "carte-succes",
  };
  const couleursTexte = {
    lagune: "text-lagune",
    ocre: "text-ocre",
    terre: "text-terre",
    succes: "text-green-600",
  };

  return (
    <div className={`${classes[couleur]} hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs uppercase text-ardoise-clair/60 font-semibold tracking-wider">
          {libelle}
        </p>
        <span className="text-lg">{icone}</span>
      </div>
      <p className={`text-2xl md:text-3xl font-bold ${couleursTexte[couleur]}`}>{valeur}</p>
    </div>
  );
}

function LienTechnologie({ tech, delai }: { tech: TechnologieCard; delai: number }) {
  return (
    <Link
      href={tech.href}
      className={`block groupe carte-hover apparition-echelle delai-${delai + 1}`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tech.couleur} border flex items-center justify-center flex-shrink-0`}>
          <tech.Icone className="w-5 h-5 text-lagune" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ardoise group-hover:text-lagune transition-colors">
            {tech.titre}
          </h3>
          <p className="text-sm text-ardoise-clair/70 mt-0.5">{tech.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tech.technologies.map(t => (
              <span key={t} className="text-[11px] px-2 py-0.5 bg-sable-clair rounded-md text-ardoise-clair/70">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="text-lagune/40 group-hover:text-lagune group-hover:translate-x-1 transition-all">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
