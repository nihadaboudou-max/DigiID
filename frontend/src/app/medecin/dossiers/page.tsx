"use client";

/**
 * Suivi des dossiers médicaux — Liste des patients avec timeline.
 */
import Link from "next/link";
import { useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";

export default function SuiviDossiers() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

const DOSSIERS = [
  { id: "DOS-001", patient: "Fatou Diallo", digiid: "DIG-A1B2C3D4E5F6", motif: "Consultation générale", date: "2026-06-10", statut: "ouvert" as const, consultations: 3 },
  { id: "DOS-002", patient: "Oumar Sall", digiid: "DIG-F6E5D4C3B2A1", motif: "Suivi diabète", date: "2026-06-09", statut: "ouvert" as const, consultations: 8 },
  { id: "DOS-003", patient: "Aïcha Ba", digiid: "DIG-A3B4C5D6E7F8", motif: "Bilan annuel", date: "2026-05-15", statut: "archive" as const, consultations: 12 },
  { id: "DOS-004", patient: "Moussa Ndiaye", digiid: "DIG-M1N2O3P4Q5R6", motif: "Consultation pédiatrique", date: "2026-06-07", statut: "ouvert" as const, consultations: 2 },
  { id: "DOS-005", patient: "Ramatoulaye Seck", digiid: "DIG-R1S2T3U4V5W6", motif: "Suivi prénatal", date: "2026-06-06", statut: "ouvert" as const, consultations: 6 },
];

function Contenu() {
  const [filtre, setFiltre] = useState<"tous" | "ouverts" | "archives">("tous");
  const [recherche, setRecherche] = useState("");

  const dossiersFiltres = DOSSIERS.filter((d) => {
    if (filtre === "ouverts" && d.statut !== "ouvert") return false;
    if (filtre === "archives" && d.statut !== "archive") return false;
    if (recherche && !d.patient.toLowerCase().includes(recherche.toLowerCase()) && !d.digiid.toLowerCase().includes(recherche.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre transition-colors">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Dossiers médicaux</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace médical</p>
          <h1 className="mt-1">Suivi des dossiers</h1>
          <p className="text-ardoise-clair mt-2">{dossiersFiltres.length} dossier(s)</p>
        </div>
        <Link href="/medecin/nouveau-dossier">
          <Bouton variante="primaire">+ Nouveau dossier</Bouton>
        </Link>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {(["tous", "ouverts", "archives"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtre === f
                ? "bg-ocre text-white"
                : "text-ardoise-clair hover:text-ardoise bg-sable"
            }`}
          >
            {f === "tous" ? "Tous" : f === "ouverts" ? "Ouverts" : "Archivés"}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <ChampRecherche
        placeholder="Rechercher par nom ou DigiID..."
        onRechercher={setRecherche}
      />

      {/* Liste des dossiers */}
      {dossiersFiltres.length === 0 ? (
        <Carte>
          <p className="text-ardoise-clair italic text-center py-8">Aucun dossier trouvé.</p>
        </Carte>
      ) : (
        <div className="space-y-3">
          {dossiersFiltres.map((dossier) => (
            <div
              key={dossier.id}
              className="carte flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-ardoise">{dossier.patient}</h3>
                  <Badge variante={dossier.statut === "ouvert" ? "succes" : "lagune"}>
                    {dossier.statut === "ouvert" ? "Ouvert" : "Archivé"}
                  </Badge>
                </div>
                <p className="text-xs text-ardoise-clair mt-1">
                  {dossier.digiid} · {dossier.motif}
                </p>
                <p className="text-xs text-ardoise-clair">
                  {dossier.consultations} consultation(s) · Dernière visite : {new Date(dossier.date).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/medecin/dossiers/${dossier.id}`}>
                  <Bouton variante="secondaire" taille="petit">Détails</Bouton>
                </Link>
                {dossier.statut === "ouvert" && (
                  <Link href={`/medecin/dossiers/${dossier.id}/modifier`}>
                    <Bouton variante="primaire" taille="petit">Modifier</Bouton>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/medecin/dashboard">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}
