"use client";

/**
 * Tableau de bord super administrateur — version améliorée.
 * KPIs + cartes technologies rectangulaires pour chaque domaine.
 * Réservé exclusivement au rôle super_administrateur.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { obtenirStatistiques, type StatistiquesCompletes } from "@/services/super_admin_v2";
import { ErreurAPI } from "@/services/client_api";

// ---- Cartes technologies ----

interface TechnologieCard {
  id: string;
  titre: string;
  description: string;
  icone: string;
  href: string;
  statut: "actif" | "inactif" | "attention";
  technologies: string[];
}

const CARTES_TECHNOLOGIES: TechnologieCard[] = [
  // ─── NOUVEAU : Gestion organisationnelle ───
  {
    id: "domaines",
    titre: "Domaines",
    description: "Créer et gérer les domaines organisationnels",
    icone: "🏢",
    href: "/super-admin/domaines",
    statut: "actif",
    technologies: ["CRUD", "Organisation", "Multi-tenant"],
  },
  {
    id: "departements",
    titre: "Départements",
    description: "Structurer les départements par domaine",
    icone: "🏛️",
    href: "/super-admin/departements",
    statut: "actif",
    technologies: ["Hiérarchie", "Cloisonnement", "Rôles"],
  },
  {
    id: "invitations",
    titre: "Invitations",
    description: "Inviter des administrateurs et chefs de département",
    icone: "✉️",
    href: "/super-admin/invitations",
    statut: "actif",
    technologies: ["Email", "Tokens", "Sécurité"],
  },
  {
    id: "equipes",
    titre: "Équipes",
    description: "Créer et gérer les équipes par département",
    icone: "👥",
    href: "/super-admin/equipes",
    statut: "actif",
    technologies: ["Membres", "Rôles", "Collaboration"],
  },
  // ─── EXISTANT : Administration ───
  {
    id: "administrateurs",
    titre: "Administrateurs",
    description: "Créer, suspendre, réactiver des comptes administrateurs",
    icone: "👤",
    href: "/super-admin/administrateurs",
    statut: "actif",
    technologies: ["CRUD", "RBAC", "Sessions"],
  },
  {
    id: "droits",
    titre: "Gestion des droits",
    description: "Matrice RBAC complète, rôles, permissions par technologie",
    icone: "🛡️",
    href: "/super-admin/droits",
    statut: "actif",
    technologies: ["RBAC", "Permissions", "Rôles"],
  },
  {
    id: "droits-ui",
    titre: "Matrice des droits UI",
    description: "Configuration fine des modules UI accessibles par chaque rôle",
    icone: "🎛️",
    href: "/super-admin/droits-ui",
    statut: "actif",
    technologies: ["Modules UI", "Toggle", "Overrides"],
  },
  {
    id: "statistiques",
    titre: "Statistiques système",
    description: "Métriques détaillées, KPIs, santé du système",
    icone: "📊",
    href: "/super-admin/statistiques",
    statut: "actif",
    technologies: ["Métriques", "Analyse", "CSV"],
  },
  {
    id: "monitoring",
    titre: "Monitoring temps réel",
    description: "Sessions actives, déconnexion forcée, alertes sécurité",
    icone: "📡",
    href: "/super-admin/monitoring",
    statut: "actif",
    technologies: ["Temps réel", "Sessions", "Alertes"],
  },
  {
    id: "audit",
    titre: "Journal d'audit",
    description: "Toutes les actions tracées de manière immuable",
    icone: "📜",
    href: "/super-admin/audit",
    statut: "actif",
    technologies: ["Audit", "Traçabilité", "Filtres"],
  },
  {
    id: "configuration",
    titre: "Configuration système",
    description: "Feature flags, paramètres système, bascules en ligne",
    icone: "⚙️",
    href: "/super-admin/configuration",
    statut: "actif",
    technologies: ["Flags", "Config", "Système"],
  },
  {
    id: "reconnaissance-faciale",
    titre: "Reconnaissance faciale",
    description: "Vérification visuelle, liveness, matching biométrique",
    icone: "📸",
    href: "/super-admin/statistiques",
    statut: "actif",
    technologies: ["Face API", "Liveness", "Matching"],
  },
  {
    id: "ocr-cni",
    titre: "OCR & CNI",
    description: "Scan de CNI, extraction MRZ, validation documents",
    icone: "🪪",
    href: "/super-admin/statistiques",
    statut: "actif",
    technologies: ["OCR", "MRZ", "Documents"],
  },
  {
    id: "mon-profil",
    titre: "Mon profil",
    description: "Modifier mes informations, mot de passe, exporter données",
    icone: "👤",
    href: "/super-admin/mon-profil",
    statut: "actif",
    technologies: ["Profil", "Sécurité", "Export"],
  },
];

// ---- Page ----

export default function TableauDeBordSuperAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [stats, setStats] = useState<StatistiquesCompletes | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;

    const charger = async () => {
      try {
        const d = await obtenirStatistiques();
        if (actif) setStats(d);
      } catch (e) {
        if (actif) setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur inconnue");
      } finally {
        if (actif) setChargement(false);
      }
    };

    charger();
    const intervalle = setInterval(charger, 10000);
    return () => {
      actif = false;
      clearInterval(intervalle);
    };
  }, []);

  if (chargement) {
    return (
      <div className="space-y-4">
        <header>
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
          <h1 className="mt-1 text-2xl">Tableau de bord</h1>
        </header>
        <p className="text-ardoise-clair italic text-center py-6">Chargement du système...</p>
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="space-y-4">
        <header>
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
          <h1 className="mt-1 text-2xl">Tableau de bord</h1>
        </header>
        <div className="bg-terre/10 border-l-4 border-terre p-3 rounded">
          <p className="text-sm text-terre">{erreur}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { utilisateurs, sessions, scores } = stats;

  return (
    <div className="space-y-4">
      {/* En-tête compact */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">
            Super administration
          </p>
          <h1 className="mt-1 text-2xl">Vue système</h1>
          <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
            Accès maximum au système DigiID. Chaque technologie est accessible
            via les cartes ci-dessous.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/super-admin/droits">
            <Bouton variante="primaire" taille="petit">Gestion des droits</Bouton>
          </Link>
          <Link href="/super-admin/audit">
            <Bouton variante="ghost" taille="petit">Journal d'audit</Bouton>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <KPI libelle="Utilisateurs" valeur={utilisateurs.total_utilisateurs} couleur="lagune" />
        <KPI libelle="Actifs" valeur={utilisateurs.total_actifs} couleur="succes" />
        <KPI libelle="2FA activée" valeur={utilisateurs.total_2fa_actif} couleur="ocre" />
        <KPI libelle="Sessions" valeur={sessions.sessions_actives} couleur="lagune" />
        <KPI libelle="Audits aujourd'hui" valeur={stats.evenements_aujourd_hui} couleur="terre" />
      </div>

      {/* Cartes technologies */}
      <section className="space-y-2">
        <h2 className="text-base font-bold text-ardoise">Gestion des technologies</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CARTES_TECHNOLOGIES.map((tech) => (
            <Link key={tech.id} href={tech.href} className="block group">
              <div className="carte cursor-pointer hover:shadow-doux transition-all duration-200 h-full flex flex-col p-3">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{tech.icone}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    tech.statut === "actif"
                      ? "bg-green-100 text-green-700"
                      : tech.statut === "attention"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {tech.statut === "actif" ? "✓ Actif" : tech.statut === "attention" ? "⚠ Attention" : "— Inactif"}
                  </span>
                </div>
                <h3 className="font-bold text-ardoise text-sm mb-0.5 group-hover:text-ocre transition-colors">
                  {tech.titre}
                </h3>
                <p className="text-xs text-ardoise-clair flex-1">{tech.description}</p>
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-ardoise-clair/10">
                  {tech.technologies.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 bg-sable rounded-full text-ardoise-clair">
                      {t}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-ocre font-semibold mt-2 group-hover:translate-x-1 transition-transform">
                  Accéder →
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---- Sous-composants ----

function KPI({ libelle, valeur, couleur }: { libelle: string; valeur: number | string; couleur: string }) {
  const couleurVars: Record<string, string> = {
    lagune: "var(--couleur-lagune)", succes: "#22c55e", ocre: "var(--couleur-ocre)", terre: "var(--couleur-terre)"
  };
  return (
    <div className="carte text-center hover:shadow-doux transition-shadow p-3">
      <p className="text-2xl md:text-3xl font-bold mb-1" style={{ color: couleurVars[couleur] || "var(--couleur-lagune)" }}>
        {valeur}
      </p>
      <p className="text-[10px] uppercase text-ardoise-clair font-semibold tracking-wide">{libelle}</p>
    </div>
  );
}