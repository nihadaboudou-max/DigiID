"use client";

/**
 * Tableau de bord Admin Domaine — Vue restreinte à son domaine.
 * L'admin de domaine voit seulement les métriques et actions
 * concernant ses propres départements, chefs et agents.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { useAuthentification } from "@/contextes/authentification";
import {
  IconeUtilisateur, IconeBouclier, IconeStatistique,
  IconeEnvoyer, IconeJournal,
} from "@/composants/commun/Icones";

interface StatsDomaine {
  chefs_actifs: number;
  agents_total: number;
  departements_actifs: number;
  invitations_en_attente: number;
}

const CARTES_RAPIDES = [
  {
    id: "chefs", titre: "Chefs de département",
    description: "Gère les chefs de ton domaine",
    href: "/admin-domaine/chefs", Icone: IconeBouclier,
    couleur: "from-ocre/10 to-ocre/5 border-ocre/20",
  },
  {
    id: "invitations", titre: "Invitations",
    description: "Invite de nouveaux chefs",
    href: "/admin-domaine/invitations", Icone: IconeEnvoyer,
    couleur: "from-lagune/10 to-lagune/5 border-lagune/20",
  },
  {
    id: "departements", titre: "Départements",
    description: "Consulte les départements du domaine",
    href: "/admin-domaine/departements", Icone: IconeStatistique,
    couleur: "from-terre/10 to-terre/5 border-terre/20",
  },
  {
    id: "statistiques", titre: "Statistiques",
    description: "Métriques du domaine",
    href: "/admin-domaine/statistiques", Icone: IconeStatistique,
    couleur: "from-lagune/10 to-lagune/5 border-lagune/20",
  },
];

export default function PageTableauDeBordAdminDomaine() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [stats, setStats] = useState<StatsDomaine | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;
    const charger = async () => {
      try {
        const data = await clientAPI.get<StatsDomaine>(
          `/api/v1/admin-domaine/tableau-de-bord?domaine_id=${utilisateur?.domaine_id || ""}`,
          { authentifie: true }
        );
        if (actif) setStats(data);
      } catch (e) {
        if (actif) setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
      } finally {
        if (actif) setChargement(false);
      }
    };
    charger();
    return () => { actif = false; };
  }, [utilisateur?.domaine_id]);

  if (chargement) {
    return (
      <div className="apparition space-y-6">
        <HeaderSection />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse bg-sable-clair/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="apparition space-y-8">
      <HeaderSection />

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {/* KPIs du domaine */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <CarteKPI
            libelle="Chefs actifs"
            valeur={stats.chefs_actifs}
            icone="👮"
            couleur="ocre"
          />
          <CarteKPI
            libelle="Agents"
            valeur={stats.agents_total}
            icone="👥"
            couleur="lagune"
          />
          <CarteKPI
            libelle="Départements"
            valeur={stats.departements_actifs}
            icone="🏛️"
            couleur="lagune"
          />
          <CarteKPI
            libelle="Invitations en attente"
            valeur={stats.invitations_en_attente}
            icone="📨"
            couleur="terre"
          />
        </div>
      )}

      {/* Accès rapide */}
      <section>
        <div className="section-header">
          <h2 className="text-lg font-semibold text-ardoise">Accès rapide</h2>
          <p className="text-sm text-ardoise-clair/70">
            Gère les chefs, les invitations et les départements de ton domaine.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          {CARTES_RAPIDES.map((carte) => (
            <Link
              key={carte.id}
              href={carte.href}
              className="block groupe carte-hover apparition-echelle"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${carte.couleur} border flex items-center justify-center flex-shrink-0`}>
                  <carte.Icone className="w-5 h-5 text-lagune" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-ardoise group-hover:text-lagune transition-colors">
                    {carte.titre}
                  </h3>
                  <p className="text-sm text-ardoise-clair/70 mt-0.5">{carte.description}</p>
                </div>
                <div className="text-lagune/40 group-hover:text-lagune group-hover:translate-x-1 transition-all">
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Journal d'audit & Monitoring */}
      <section>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/admin-domaine/audit"
            className="block groupe carte-hover"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-lagune/10 to-lagune/5 border border-lagune/20 flex items-center justify-center flex-shrink-0">
                <IconeJournal className="w-5 h-5 text-lagune" />
              </div>
              <div>
                <h3 className="font-semibold text-ardoise group-hover:text-lagune transition-colors">
                  Journal d'audit
                </h3>
                <p className="text-sm text-ardoise-clair/70 mt-0.5">
                  Actions récentes dans ton domaine
                </p>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}

function HeaderSection() {
  return (
    <div className="section-header">
      <p className="text-ocre">Admin de Domaine</p>
      <h1>Tableau de bord</h1>
      <p className="text-ardoise-clair/70 text-sm mt-1">
        Vue d&apos;ensemble de ton domaine et accès rapide aux fonctionnalités.
      </p>
    </div>
  );
}

function CarteKPI({ libelle, valeur, icone, couleur }: {
  libelle: string; valeur: number | string; icone: string;
  couleur: "ocre" | "lagune" | "terre" | "succes";
}) {
  const classes = {
    ocre: "carte-accent",
    lagune: "carte-lagune",
    terre: "carte-terre",
    succes: "carte-succes",
  };
  const couleursTexte = {
    ocre: "text-ocre",
    lagune: "text-lagune",
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
