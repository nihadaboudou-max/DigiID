"use client";

/**
 * Page d'export de rapports police.
 * Génération de rapports PDF/CSV pour les vérifications, signalements, activités.
 */
import { useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { genererRapport } from "@/services/police";

export default function PageExport() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dateFin, setDateFin] = useState(() => new Date().toISOString().split("T")[0]);
  const [format, setFormat] = useState("pdf");
  const [typeDonnees, setTypeDonnees] = useState<string[]>(["verifications"]);
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState<Record<string, unknown> | null>(null);
  const [erreur, setErreur] = useState("");

  function toggleType(type: string) {
    setTypeDonnees((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  async function handleGenerer() {
    if (typeDonnees.length === 0) {
      setErreur("Sélectionne au moins un type de données.");
      return;
    }

    setChargement(true);
    setErreur("");
    setResultat(null);

    try {
      const data = await genererRapport({
        date_debut: dateDebut,
        date_fin: dateFin,
        format,
        type_donnees: typeDonnees,
      });
      setResultat(data);
    } catch {
      setErreur("Erreur lors de la génération du rapport.");
    } finally {
      setChargement(false);
    }
  }

  const typesData = [
    { id: "verifications", label: "Vérifications d'identité", icone: "🔍" },
    { id: "signalements", label: "Signalements de fraude", icone: "🚨" },
    { id: "alertes", label: "Alertes", icone: "🔔" },
    { id: "notes", label: "Notes internes", icone: "📝" },
    { id: "activites", label: "Activités quotidiennes", icone: "📊" },
  ];

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Export de rapports</span>
      </nav>

      <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>
      <h1>Export de rapports</h1>
      <p className="text-ardoise-clair max-w-2xl">
        Génère des rapports PDF ou CSV pour les vérifications, signalements et activités
        de la période sélectionnée.
      </p>

      {erreur && (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">{erreur}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Période */}
        <Carte titre="Période">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ardoise mb-1">Date début</label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ardoise mb-1">Date fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/50"
              />
            </div>
          </div>
        </Carte>

        {/* Format et types */}
        <Carte titre="Configuration">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ardoise mb-2">Format</label>
              <div className="flex gap-3">
                {[
                  { id: "pdf", label: "📄 PDF" },
                  { id: "csv", label: "📊 CSV" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      format === f.id
                        ? "bg-lagune text-white"
                        : "bg-sable text-ardoise-clair hover:bg-sable/80"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ardoise mb-2">Types de données</label>
              <div className="space-y-2">
                {typesData.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-sable/50">
                    <input
                      type="checkbox"
                      checked={typeDonnees.includes(t.id)}
                      onChange={() => toggleType(t.id)}
                      className="rounded border-ardoise-clair/30"
                    />
                    <span className="text-sm text-ardoise">{t.icone} {t.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Carte>
      </div>

      {/* Bouton générer */}
      <div className="text-center">
        <Bouton
          variante="primaire"
          chargement={chargement}
          disabled={chargement || typeDonnees.length === 0}
          onClick={handleGenerer}
          className="px-8"
        >
          {chargement ? "Génération en cours..." : "📥 Générer le rapport"}
        </Bouton>
      </div>

      {/* Résultat */}
      {resultat && (
        <Carte titre="Rapport généré">
          <div className="text-center py-4">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-lg font-bold text-succes mb-2">Rapport généré avec succès !</p>
            <p className="text-sm text-ardoise-clair mb-4">
              Période : du {new Date(dateDebut).toLocaleDateString("fr-FR")} au {new Date(dateFin).toLocaleDateString("fr-FR")}
            </p>
            <div className="flex justify-center gap-3">
              <Bouton variante="primaire" onClick={() => window.print()}>
                📥 Télécharger ({format.toUpperCase()})
              </Bouton>
              <Bouton variante="ghost" onClick={() => setResultat(null)}>
                Nouveau rapport
              </Bouton>
            </div>
          </div>
          <details className="mt-4">
            <summary className="text-sm text-ardoise-clair cursor-pointer hover:text-ardoise">
              Voir les détails techniques
            </summary>
            <pre className="text-xs text-ardoise-clair bg-sable p-3 rounded mt-2 overflow-auto max-h-60">
              {JSON.stringify(resultat, null, 2)}
            </pre>
          </details>
        </Carte>
      )}

      <Link href="/police/dashboard">
        <Bouton variante="ghost">← Retour au dashboard</Bouton>
      </Link>
    </div>
  );
}
