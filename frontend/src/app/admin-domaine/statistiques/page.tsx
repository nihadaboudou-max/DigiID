"use client";

/**
 * Page Admin Domaine — Statistiques du domaine.
 * Métriques spécifiques au domaine de l'admin (pas de stats globales).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { useAuthentification } from "@/contextes/authentification";

interface StatsDomaine {
  total_chefs: number;
  chefs_par_type: Record<string, number>;
  total_departements: number;
  departements_par_type: Record<string, number>;
  total_agents: number;
  invitations_envoyees: number;
  invitations_acceptees: number;
  taux_acceptation: number;
}

export default function PageStatistiquesDomaine() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [stats, setStats] = useState<StatsDomaine | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    const charger = async () => {
      try {
        const data = await clientAPI.get<StatsDomaine>(
          `/api/v1/admin-domaine/statistiques`,
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

  return (
    <div className="apparition space-y-6">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/admin-domaine/tableau-de-bord" className="hover:text-lagune">
          Tableau de bord
        </Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Statistiques</span>
      </nav>

      <div className="section-header">
        <p className="text-ocre">Admin de Domaine</p>
        <h1>Statistiques du domaine</h1>
        <p className="text-ardoise-clair/70 text-sm mt-1">
          Métriques clés de ton domaine.
        </p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {chargement ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse bg-sable-clair/50 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="carte-lagune">
              <p className="text-xs uppercase text-ardoise-clair/60 font-semibold">Chefs</p>
              <p className="text-3xl font-bold text-lagune mt-2">{stats.total_chefs}</p>
            </div>
            <div className="carte-accent">
              <p className="text-xs uppercase text-ardoise-clair/60 font-semibold">Départements</p>
              <p className="text-3xl font-bold text-ocre mt-2">{stats.total_departements}</p>
            </div>
            <div className="carte-terre">
              <p className="text-xs uppercase text-ardoise-clair/60 font-semibold">Agents</p>
              <p className="text-3xl font-bold text-terre mt-2">{stats.total_agents}</p>
            </div>
            <div className="carte-succes">
              <p className="text-xs uppercase text-ardoise-clair/60 font-semibold">Taux d&apos;acceptation</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.taux_acceptation}%</p>
            </div>
          </div>

          {/* Répartition par type */}
          <div className="grid sm:grid-cols-2 gap-6">
            <Carte titre="Chefs par type de département">
              <div className="space-y-3 mt-2">
                {Object.entries(stats.chefs_par_type).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{type.replace("_", " ")}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-sable-clair rounded-full overflow-hidden">
                        <div
                          className="h-full bg-lagune rounded-full"
                          style={{
                            width: `${stats.total_chefs > 0 ? (count / stats.total_chefs) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-ardoise w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
                {Object.keys(stats.chefs_par_type).length === 0 && (
                  <p className="text-sm text-ardoise-clair italic">Aucun chef</p>
                )}
              </div>
            </Carte>

            <Carte titre="Départements par type">
              <div className="space-y-3 mt-2">
                {Object.entries(stats.departements_par_type).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-sable-clair rounded-full overflow-hidden">
                        <div
                          className="h-full bg-ocre rounded-full"
                          style={{
                            width: `${stats.total_departements > 0 ? (count / stats.total_departements) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-ardoise w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
                {Object.keys(stats.departements_par_type).length === 0 && (
                  <p className="text-sm text-ardoise-clair italic">Aucun département</p>
                )}
              </div>
            </Carte>
          </div>

          {/* Invitations */}
          <Carte titre="Invitations">
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <p className="text-xs text-ardoise-clair">Envoyées</p>
                <p className="text-2xl font-bold text-ardoise">{stats.invitations_envoyees}</p>
              </div>
              <div>
                <p className="text-xs text-ardoise-clair">Acceptées</p>
                <p className="text-2xl font-bold text-ardoise">{stats.invitations_acceptees}</p>
              </div>
            </div>
          </Carte>
        </>
      ) : (
        <p className="text-center text-ardoise-clair italic py-12">
          Aucune donnée disponible pour ce domaine.
        </p>
      )}
    </div>
  );
}
