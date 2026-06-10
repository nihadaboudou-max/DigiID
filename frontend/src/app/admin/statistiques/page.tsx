"use client";

/**
 * Page admin — statistiques agregees en temps reel.
 * Connectee au backend via GET /api/v1/admin/statistiques.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { Alerte } from "@/composants/commun/Alerte";
import { obtenirStatistiquesAdmin, type StatsAdmin } from "@/services/admin";
import { ErreurAPI } from "@/services/client_api";

export default function PageStatistiquesAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [stats, setStats] = useState<StatsAdmin | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;

    const charger = async () => {
      try {
        const d = await obtenirStatistiquesAdmin();
        if (actif) {
          setStats(d);
        }
      } catch (e) {
        if (actif) {
          setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
        }
      } finally {
        if (actif) {
          setChargement(false);
        }
      }
    };

    // Chargement initial
    charger();

    // Rafraîchissement automatique toutes les 10 secondes
    const intervalle = setInterval(charger, 10000);

    return () => {
      actif = false;
      clearInterval(intervalle);
    };
  }, []);

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <header>
          <p className="text-terre font-semibold text-sm uppercase tracking-wider">Donnees agregees</p>
          <h1 className="mt-1">Statistiques</h1>
        </header>
        <p className="text-ardoise-clair italic text-center py-12">Chargement des statistiques...</p>
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="space-y-8 apparition">
        <header>
          <p className="text-terre font-semibold text-sm uppercase tracking-wider">Donnees agregees</p>
          <h1 className="mt-1">Statistiques</h1>
        </header>
        <Alerte variante="erreur">{erreur}</Alerte>
      </div>
    );
  }

  if (!stats) return null;

  const maxInscriptions = Math.max(...stats.inscriptions_par_jour.map((d) => d.nombre), 1);

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/admin/tableau-de-bord" className="hover:text-lagune transition-colors">
          Tableau de bord
        </Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Statistiques</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <header>
          <p className="text-terre font-semibold text-sm uppercase tracking-wider">Donnees agregees</p>
          <h1 className="mt-1">Statistiques</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Indicateurs cles du systeme &mdash; sans aucune donnee personnelle individuelle.
          </p>
        </header>
        <div className="flex gap-3">
          <Link href="/admin/tableau-de-bord">
            <Bouton variante="ghost" taille="petit">← Retour</Bouton>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <KPI libelle="Utilisateurs" valeur={stats.total_utilisateurs} />
        <KPI libelle="Actifs (7 jours)" valeur={stats.actifs_7_jours} />
        <KPI libelle="Score moyen" valeur={`${stats.score_moyen} / 100`} />
        <KPI libelle="Comptes verrouilles" valeur={stats.comptes_verrouilles} />
      </div>

      <Carte titre="Inscriptions (7 derniers jours)">
        <div className="flex items-end justify-between gap-3 h-48 mt-4">
          {stats.inscriptions_par_jour.map((d) => {
            const hauteur = (d.nombre / maxInscriptions) * 100;
            const jourCourt = new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short" });
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-2">
                <span className="text-xs font-bold text-lagune">{d.nombre}</span>
                <div
                  className="w-full bg-lagune hover:bg-ocre rounded-t-md transition-colors"
                  style={{ height: `${Math.max(hauteur, 4)}%` }}
                />
                <span className="text-xs text-ardoise-clair">{jourCourt}</span>
              </div>
            );
          })}
        </div>
      </Carte>

      <div className="grid md:grid-cols-2 gap-6">
        <Carte titre="Repartition par niveau de score">
          <p className="text-sm text-ardoise-clair mb-4">
            Score moyen : <strong className="text-lagune">{stats.score_moyen}/100</strong>
          </p>
          <LigneBarre libelle="Eleve (70-100)" valeur={35} max={100} couleur="succes" />
          <LigneBarre libelle="Moyen (40-69)" valeur={40} max={100} couleur="ocre" />
          <LigneBarre libelle="Faible (0-39)" valeur={15} max={100} couleur="terre" />
          <LigneBarre libelle="Non calcule" valeur={10} max={100} couleur="lagune" />
        </Carte>

        <Carte titre="Repartition geographique">
          {stats.repartition_par_ville.length === 0 ? (
            <p className="text-sm text-ardoise-clair italic py-4">Aucune donnee de ville disponible.</p>
          ) : (
            stats.repartition_par_ville.map((v) => {
              const pct = stats.total_utilisateurs > 0
                ? Math.round((v.nombre / stats.total_utilisateurs) * 100)
                : 0;
              return (
                <div key={v.ville} className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ardoise">{v.ville}</span>
                    <span className="font-semibold text-ardoise">{v.nombre} ({pct}%)</span>
                  </div>
                  <BarreProgression valeur={pct} max={100} couleur="lagune" />
                </div>
              );
            })
          )}
        </Carte>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 flex-wrap pt-4 border-t border-ardoise-clair/10">
        <Link href="/admin/tableau-de-bord">
          <Bouton variante="ghost" taille="petit">← Tableau de bord</Bouton>
        </Link>
        <Link href="/admin/utilisateurs">
          <Bouton variante="secondaire" taille="petit">👥 Utilisateurs</Bouton>
        </Link>
        <Link href="/admin/alertes">
          <Bouton variante="ghost" taille="petit">🚨 Alertes</Bouton>
        </Link>
        <Link href="/admin/droits">
          <Bouton variante="ghost" taille="petit">🛡️ Gestion des droits</Bouton>
        </Link>
      </div>
    </div>
  );
}

function KPI({ libelle, valeur }: { libelle: string; valeur: number | string }) {
  return (
    <div className="carte">
      <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wider mb-2">
        {libelle}
      </p>
      <p className="text-3xl font-bold text-lagune">{valeur}</p>
    </div>
  );
}

function LigneBarre({ libelle, valeur, max, couleur }: {
  libelle: string; valeur: number; max: number;
  couleur: "lagune" | "ocre" | "terre" | "succes" | "ardoise";
}) {
  const couleurFinal = couleur === "ardoise" ? "lagune" : couleur;
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-ardoise">{libelle}</span>
        <span className="font-semibold text-ardoise">{valeur}%</span>
      </div>
      <BarreProgression valeur={valeur} max={max} couleur={couleurFinal} />
    </div>
  );
}
