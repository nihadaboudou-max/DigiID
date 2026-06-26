"use client";

/**
 * Page d'historique des activités police.
 * Affiche l'ensemble des actions tracées : vérifications, signalements, notes, alertes.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { obtenirHistorique, listerVerifications } from "@/services/police";
import type { VerificationPolice } from "@/services/police";

export default function PageHistorique() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [verifications, setVerifications] = useState<VerificationPolice[]>([]);
  const [filtre, setFiltre] = useState<string>("tous");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const data = await listerVerifications({ limite: 100 });
      setVerifications(data || []);
    } catch {
      setErreur("Impossible de charger l'historique.");
    } finally {
      setChargement(false);
    }
  }

  const verificationsFiltrees = verifications.filter((v) => {
    if (filtre === "fraude") return v.est_signalement_fraude;
    if (filtre === "aujourdhui") {
      return new Date(v.date_verification).toDateString() === new Date().toDateString();
    }
    return true;
  });

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Historique</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>
          <h1 className="mt-1">Historique des activités</h1>
          <p className="text-ardoise-clair mt-1">Consulte l'ensemble des actions tracées.</p>
        </div>
        <Bouton variante="ghost" taille="petit" onClick={charger} chargement={chargement}>
          🔄 Actualiser
        </Bouton>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "tous", label: "Toutes" },
          { id: "aujourdhui", label: "Aujourd'hui" },
          { id: "fraude", label: "Signalements fraude" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltre(f.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filtre === f.id
                ? "bg-lagune text-white"
                : "bg-sable text-ardoise-clair hover:bg-sable/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">{verifications.length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Total vérifications</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-ocre">{verifications.filter(v => v.est_signalement_fraude).length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Signalements</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">{verifications.filter(v => v.resultat === "confirme").length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Confirmées</p>
        </div>
      </div>

      {/* Liste */}
      <Carte titre={`${verificationsFiltrees.length} activité(s)`}>
        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
        ) : erreur ? (
          <div className="text-center py-8">
            <p className="text-terre text-sm mb-3">{erreur}</p>
            <Bouton variante="ghost" taille="petit" onClick={charger}>Réessayer</Bouton>
          </div>
        ) : verificationsFiltrees.length === 0 ? (
          <p className="text-ardoise-clair italic text-center py-8">Aucune activité trouvée.</p>
        ) : (
          <div className="space-y-2">
            {verificationsFiltrees.map((verif) => (
              <div key={verif.id} className="flex items-center justify-between p-3 bg-sable rounded-lg hover:bg-sable/80 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg flex-shrink-0">
                    {verif.est_signalement_fraude ? "🚨" : verif.type_verification === "controle_routier" ? "🚔" : "🔍"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ardoise truncate">
                      {verif.type_verification || "Vérification"}
                      {verif.personne_digiid && ` · ${verif.personne_digiid}`}
                    </p>
                    <p className="text-xs text-ardoise-clair">
                      {new Date(verif.date_verification).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {verif.personne_nom && ` · ${verif.personne_nom}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge
                    variante={
                      verif.resultat === "confirme" ? "succes"
                      : verif.resultat === "infirme" ? "terre"
                      : "ocre"
                    }
                    taille="petit"
                  >
                    {verif.resultat || "En attente"}
                  </Badge>
                  {verif.est_signalement_fraude && (
                    <span className="text-xs text-terre" title="Signalement fraude">⚠️</span>
                  )}
                  <Link
                    href={`/police/profil/${verif.personne_digiid}`}
                    className="text-xs text-ocre hover:underline"
                  >
                    Détail →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      <Link href="/police/dashboard">
        <Bouton variante="ghost">← Retour au dashboard</Bouton>
      </Link>
    </div>
  );
}
