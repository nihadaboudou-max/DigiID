"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { listerDossiers } from "@/services/medical";
import type { DossierMedical } from "@/services/medical";

export default function SuiviDossiers() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [dossiers, setDossiers] = useState<DossierMedical[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState<"tous" | "ouverts" | "archives">("tous");
  const [recherche, setRecherche] = useState("");

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    try {
      const data = await listerDossiers(filtre === "tous" ? undefined : filtre, recherche || undefined);
      setDossiers(data);
    } catch { /* silencieux */ }
    finally { setChargement(false); }
  }

  useEffect(() => { charger(); }, [filtre]);

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre transition-colors">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Dossiers medicaux</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace medical</p>
          <h1 className="mt-1">Suivi des dossiers</h1>
          <p className="text-ardoise-clair mt-2">{dossiers.length} dossier(s)</p>
        </div>
        <Link href="/medecin/nouveau-dossier">
          <Bouton variante="primaire">+ Nouveau dossier</Bouton>
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["tous", "ouverts", "archives"] as const).map((f) => (
          <button key={f} onClick={() => setFiltre(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filtre === f ? "bg-ocre text-white" : "text-ardoise-clair hover:text-ardoise bg-sable"}`}>
            {f === "tous" ? "Tous" : f === "ouverts" ? "Ouverts" : "Archives"}
          </button>
        ))}
      </div>

      <ChampRecherche placeholder="Rechercher par nom ou DigiID..." value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") charger(); }} />

      {chargement ? (
        <Carte><p className="text-ardoise-clair italic text-center py-8">Chargement...</p></Carte>
      ) : dossiers.length === 0 ? (
        <Carte><p className="text-ardoise-clair italic text-center py-8">Aucun dossier trouve.</p></Carte>
      ) : (
        <div className="space-y-3">
          {dossiers.map((dossier) => (
            <div key={dossier.id} className="carte flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-ardoise">{dossier.patient_nom}</h3>
                  <Badge variante={dossier.statut === "ouvert" ? "succes" : "lagune"}>
                    {dossier.statut === "ouvert" ? "Ouvert" : "Archive"}
                  </Badge>
                </div>
                <p className="text-xs text-ardoise-clair mt-1">{dossier.patient_digiid} · {dossier.motif}</p>
                <p className="text-xs text-ardoise-clair">{dossier.consultations_count} consultation(s) · Cree le {new Date(dossier.date_creation).toLocaleDateString("fr-FR")}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/medecin/dossiers/${dossier.id}`}>
                  <Bouton variante="secondaire" taille="petit">Details</Bouton>
                </Link>
                {dossier.statut === "ouvert" && (
                  <button onClick={async () => {
                    await import("@/services/medical").then(m => m.modifierDossier(dossier.id, { statut: "archive" }));
                    charger();
                  }}>
                    <Bouton variante="primaire" taille="petit">Archiver</Bouton>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/medecin/dashboard"><Bouton variante="ghost">← Retour au tableau de bord</Bouton></Link>
    </div>
  );
}
