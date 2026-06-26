"use client";

/**
 * Page des alertes police — temps réel.
 * Liste des alertes de sécurité, signalements, personnes recherchées.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { listerAlertes, marquerAlerteLue } from "@/services/police";
import type { AlertePolice } from "@/services/police";

export default function PageAlertes() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [alertes, setAlertes] = useState<AlertePolice[]>([]);
  const [total, setTotal] = useState(0);
  const [nonLues, setNonLues] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [filtreNonLues, setFiltreNonLues] = useState(false);

  useEffect(() => {
    charger();
    const interval = setInterval(charger, 15000); // rafraîchir toutes les 15s
    return () => clearInterval(interval);
  }, []);

  async function charger() {
    try {
      const data = await listerAlertes({ non_lues_seulement: filtreNonLues });
      setAlertes(data.alertes || []);
      setTotal(data.total || 0);
      setNonLues(data.non_lues || 0);
    } catch {
      setErreur("Impossible de charger les alertes.");
    } finally {
      setChargement(false);
    }
  }

  async function handleMarquerLue(alerteId: string) {
    try {
      await marquerAlerteLue(alerteId);
      charger();
    } catch {
      // Silencieux
    }
  }

  async function handleToutMarquerLue() {
    for (const alerte of alertes.filter((a) => !a.est_lue)) {
      try {
        await marquerAlerteLue(alerte.id);
      } catch {
        // continue
      }
    }
    charger();
  }

  const niveauClasses: Record<string, string> = {
    critique: "border-l-terre bg-terre/5",
    eleve: "border-l-ocre bg-ocre/5",
    moyen: "border-l-jaune bg-jaune/5",
    faible: "border-l-lagune bg-lagune/5",
    info: "border-l-ardoise-clair bg-sable",
  };

  const niveauIcones: Record<string, string> = {
    critique: "🔴",
    eleve: "🟠",
    moyen: "🟡",
    faible: "🔵",
    info: "ℹ️",
  };

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Alertes</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>
          <h1 className="mt-1">Alertes{nonLues > 0 ? ` (${nonLues} non lues)` : ""}</h1>
          <p className="text-ardoise-clair mt-1">Alertes de sécurité, signalements et notifications.</p>
        </div>
        <div className="flex gap-3">
          {nonLues > 0 && (
            <Bouton variante="primaire" taille="petit" onClick={handleToutMarquerLue}>
              ✅ Tout marquer lu
            </Bouton>
          )}
          <Bouton variante="ghost" taille="petit" onClick={charger} chargement={chargement}>
            🔄 Actualiser
          </Bouton>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">{total}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Total alertes</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">{nonLues}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Non lues</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">{total - nonLues}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Lues</p>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex gap-2">
        <button
          onClick={() => setFiltreNonLues(false)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !filtreNonLues ? "bg-lagune text-white" : "bg-sable text-ardoise-clair"
          }`}
        >
          Toutes
        </button>
        <button
          onClick={() => setFiltreNonLues(true)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            filtreNonLues ? "bg-lagune text-white" : "bg-sable text-ardoise-clair"
          }`}
        >
          Non lues uniquement
        </button>
      </div>

      {/* Liste des alertes */}
      <div className="space-y-3">
        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-12">Chargement des alertes...</p>
        ) : erreur ? (
          <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
            <p className="text-sm text-terre">{erreur}</p>
          </div>
        ) : alertes.length === 0 ? (
          <Carte>
            <div className="text-center py-8">
              <p className="text-4xl mb-3">🔔</p>
              <p className="text-ardoise-clair italic">
                {filtreNonLues ? "Aucune alerte non lue." : "Aucune alerte pour le moment."}
              </p>
            </div>
          </Carte>
        ) : (
          alertes.map((alerte) => (
            <div
              key={alerte.id}
              className={`border-l-4 rounded-lg p-4 transition-all ${
                !alerte.est_lue ? "shadow-md" : ""
              } ${niveauClasses[alerte.niveau] || niveauClasses.info}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="text-xl flex-shrink-0">{niveauIcones[alerte.niveau] || "ℹ️"}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className={`text-sm font-semibold ${!alerte.est_lue ? "text-ardoise" : "text-ardoise-clair"}`}>
                        {alerte.titre}
                      </p>
                      {!alerte.est_lue && <span className="w-2 h-2 bg-lagune rounded-full" title="Non lue" />}
                      <Badge
                        variante={
                          alerte.niveau === "critique" ? "terre"
                          : alerte.niveau === "eleve" ? "ocre"
                          : "lagune"
                        }
                        taille="petit"
                      >
                        {alerte.niveau}
                      </Badge>
                      <Badge variante="lagune" taille="petit">{alerte.type_alerte}</Badge>
                    </div>
                    <p className="text-sm text-ardoise-clair">{alerte.message}</p>
                    <p className="text-xs text-ardoise-clair/60 mt-1">
                      {new Date(alerte.date_creation).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {alerte.date_lecture && ` · Lu le ${new Date(alerte.date_lecture).toLocaleDateString("fr-FR")}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!alerte.est_lue && (
                    <button
                      onClick={() => handleMarquerLue(alerte.id)}
                      className="text-xs text-lagune hover:underline whitespace-nowrap"
                    >
                      Marquer lue
                    </button>
                  )}
                  <Link
                    href={`/police/profil/${(alerte.donnees_liees as any)?.digiid || ""}`}
                    className="text-xs text-ocre hover:underline"
                  >
                    Détail →
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Link href="/police/dashboard">
        <Bouton variante="ghost">← Retour au dashboard</Bouton>
      </Link>
    </div>
  );
}
