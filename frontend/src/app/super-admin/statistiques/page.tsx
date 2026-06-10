"use client";

/**
 * Page statistiques détaillées — analyse complète du système.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { obtenirStatistiques, type StatistiquesCompletes } from "@/services/super_admin_v2";
import { ErreurAPI } from "@/services/client_api";

export default function PageStatistiques() {
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
        if (actif) {
          setStats(d);
        }
      } catch (e) {
        if (actif) {
          setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur");
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
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            Super administration
          </p>
          <h1 className="mt-1">Statistiques détaillées</h1>
        </header>
        <p className="text-ardoise-clair italic text-center py-12">Chargement des statistiques...</p>
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="space-y-8 apparition">
        <header>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            Super administration
          </p>
          <h1 className="mt-1">Statistiques détaillées</h1>
        </header>
        <Alerte variante="erreur">{erreur}</Alerte>
      </div>
    );
  }

  if (!stats) return null;

  const { utilisateurs, administrateurs, sessions, scores } = stats;
  const tauxActivite = Math.round((utilisateurs.total_actifs / (utilisateurs.total_utilisateurs || 1)) * 100);
  const inactifs = utilisateurs.total_inactifs;

  return (
    <div className="space-y-8 apparition">
      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            Super administration
          </p>
          <h1 className="mt-1">Statistiques détaillées</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Analyse en profondeur de l'activité et de la santé du système.
          </p>
        </div>
          <Link href="/super-admin/tableau-de-bord">
            <Bouton variante="ghost">← Retour</Bouton>
          </Link>
          <Bouton variante="ghost" onClick={() => {
            const lignes = [["Metrique", "Valeur"]];
            lignes.push(["Total utilisateurs", String(utilisateurs.total_utilisateurs)]);
            lignes.push(["Actifs", String(utilisateurs.total_actifs)]);
            lignes.push(["Inactifs", String(inactifs)]);
            lignes.push(["2FA activee", String(utilisateurs.total_2fa_actif)]);
            lignes.push(["Taux 2FA", Math.round(utilisateurs.taux_activation_2fa) + "%"]);
            lignes.push(["Emails verifies", String(utilisateurs.total_verifies_email)]);
            lignes.push(["Taux email", Math.round(utilisateurs.taux_verification_email) + "%"]);
            lignes.push(["Admins", String(administrateurs.total_admins)]);
            lignes.push(["Sessions actives", String(sessions.sessions_actives)]);
            lignes.push(["Score moyen", String(Math.round(scores.score_moyen))]);
            lignes.push(["Evenements audit", String(stats.total_evenements_audit)]);
            const csv = lignes.map((l) => l.join(",")).join("\n");
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "digiid-statistiques-" + new Date().toISOString().split("T")[0] + ".csv";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}>Exporter en CSV</Bouton>
      </div>

      {/* Utilisateurs */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ardoise">Utilisateurs</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <Carte titre="Vue d'ensemble">
            <StatLigne libelle="Total utilisateurs" valeur={utilisateurs.total_utilisateurs} couleur="lagune" />
            <StatLigne libelle="Actifs" valeur={utilisateurs.total_actifs} couleur="succes" />
            <StatLigne libelle="Inactifs" valeur={inactifs} couleur="terre" />
            <StatLigne libelle="Supprimes" valeur={utilisateurs.total_supprimes} couleur="neutre" />
          </Carte>
          <Carte titre="Repartition par role">
            <StatLigne libelle="Utilisateurs" valeur={utilisateurs.total_utilisateurs - administrateurs.total_admins} couleur="lagune" />
            <StatLigne libelle="Administrateurs" valeur={administrateurs.total_admins} couleur="ocre" />
          </Carte>
        </div>
      </section>

      {/* Sécurité */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ardoise">Sécurité</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <Carte titre="Double authentification (2FA)">
            <StatLigne libelle="2FA activee" valeur={utilisateurs.total_2fa_actif} couleur="ocre" />
            <StatLigne libelle="2FA desactivee" valeur={utilisateurs.total_2fa_inactif} couleur="terre" />
            <StatLigne libelle="Taux 2FA" valeur={Math.round(utilisateurs.taux_activation_2fa) + "%"} couleur="ocre" />
          </Carte>
          <Carte titre="Verification email">
            <StatLigne libelle="Emails verifies" valeur={utilisateurs.total_verifies_email} couleur="lagune" />
            <StatLigne libelle="Non verifies" valeur={utilisateurs.total_non_verifies_email} couleur="neutre" />
            <StatLigne libelle="Taux verification" valeur={Math.round(utilisateurs.taux_verification_email) + "%"} couleur="lagune" />
          </Carte>
        </div>
      </section>

      {/* Audit */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ardoise">Activité d'audit</h2>

        <Carte>
          <div className="grid sm:grid-cols-2 gap-4">
            <StatLigne libelle="Total evenements" valeur={stats.total_evenements_audit} couleur="terre" />
            <StatLigne libelle="Evenements aujourd'hui" valeur={stats.evenements_aujourd_hui} couleur="lagune" />
          </div>
        </Carte>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ardoise">Sessions</h2>
        <Carte>
          <div className="grid sm:grid-cols-2 gap-4">
            <StatLigne libelle="Actives" valeur={sessions.sessions_actives} couleur="succes" />
            <StatLigne libelle="Expirees" valeur={sessions.sessions_expirees} couleur="neutre" />
            <StatLigne libelle="Revoquees" valeur={sessions.sessions_revoquees} couleur="terre" />
            <StatLigne libelle="Aujourd'hui" valeur={sessions.sessions_aujourd_hui} couleur="lagune" />
          </div>
        </Carte>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ardoise">Scores de confiance</h2>
        <Carte>
          <div className="grid sm:grid-cols-3 gap-4">
            <StatLigne libelle="Score moyen" valeur={Math.round(scores.score_moyen) + "/100"} couleur="lagune" />
            <StatLigne libelle="Minimum" valeur={scores.score_min != null ? scores.score_min + "/100" : "N/A"} couleur="terre" />
            <StatLigne libelle="Maximum" valeur={scores.score_max != null ? scores.score_max + "/100" : "N/A"} couleur="succes" />
          </div>
        </Carte>
      </section>

      {/* Recommandations */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ardoise">Recommandations</h2>

        <Carte>
          <ul className="space-y-3">
            {utilisateurs.taux_activation_2fa < 80 && (
              <li className="flex gap-3 p-3 bg-ocre/10 rounded-lg border border-ocre/20">
                <div className="text-sm">
                  <p className="font-semibold text-ocre">Augmenter l'activation 2FA</p>
                  <p className="text-ardoise-clair text-xs mt-1">Seulement {Math.round(utilisateurs.taux_activation_2fa)}% des utilisateurs ont 2FA active.</p>
                </div>
              </li>
            )}
            {utilisateurs.taux_verification_email < 70 && (
              <li className="flex gap-3 p-3 bg-lagune/10 rounded-lg border border-lagune/20">
                <div className="text-sm">
                  <p className="font-semibold text-lagune">Ameliorer la verification email</p>
                  <p className="text-ardoise-clair text-xs mt-1">{100 - Math.round(utilisateurs.taux_verification_email)}% des utilisateurs n'ont pas verifie leur email.</p>
                </div>
              </li>
            )}
            {tauxActivite < 60 && (
              <li className="flex gap-3 p-3 bg-terre/10 rounded-lg border border-terre/20">
                <div className="text-sm">
                  <p className="font-semibold text-terre">Faible activite utilisateurs</p>
                  <p className="text-ardoise-clair text-xs mt-1">{inactifs} utilisateurs sont inactifs.</p>
                </div>
              </li>
            )}
            {utilisateurs.taux_activation_2fa >= 80 && utilisateurs.taux_verification_email >= 70 && tauxActivite >= 60 && (
              <li className="flex gap-3 p-3 bg-green-100 rounded-lg border border-green-300">
                <div className="text-sm">
                  <p className="font-semibold text-green-900">Excellent etat du systeme</p>
                  <p className="text-green-800 text-xs mt-1">Tous les indicateurs sont au vert.</p>
                </div>
              </li>
            )}
          </ul>
        </Carte>
      </section>
    </div>
  );
}

/**
 * Composants utilitaires
 */

function StatLigne({
  libelle,
  valeur,
  pourcentage,
  couleur,
}: {
  libelle: string;
  valeur: number | string;
  pourcentage?: number;
  couleur: "lagune" | "ocre" | "terre" | "succes" | "neutre";
}) {
  const couleurClasses: Record<string, string> = {
    lagune: "text-lagune",
    ocre: "text-ocre",
    terre: "text-terre",
    succes: "text-green-600",
    neutre: "text-ardoise-clair",
  };

  return (
    <div className="p-4 bg-sable rounded-lg">
      <p className="text-xs uppercase text-ardoise-clair font-semibold mb-2">
        {libelle}
      </p>
      <div className="flex justify-between items-baseline">
        <p className={`text-3xl font-bold ${couleurClasses[couleur]}`}>
          {valeur}
        </p>
        {pourcentage !== undefined && (
          <p className={`text-lg font-semibold ${couleurClasses[couleur]}`}>
            {pourcentage}%
          </p>
        )}
      </div>
    </div>
  );
}

function BarreProgression({
  pourcentage,
  couleur,
  hauteur = "h-4",
}: {
  pourcentage: number;
  couleur: "lagune" | "ocre" | "terre" | "succes";
  hauteur?: string;
}) {
  const couleurClasses: Record<string, string> = {
    lagune: "bg-lagune",
    ocre: "bg-ocre",
    terre: "bg-terre",
    succes: "bg-green-600",
  };

  return (
    <div className={`w-full bg-sable rounded-full overflow-hidden ${hauteur}`}>
      <div
        className={`${couleurClasses[couleur]} h-full transition-all`}
        style={{ width: `${Math.min(pourcentage, 100)}%` }}
      />
    </div>
  );
}
