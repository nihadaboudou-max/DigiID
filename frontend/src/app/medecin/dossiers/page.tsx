"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { listerDossiers, modifierDossier } from "@/services/medical";
import type { DossierMedical } from "@/services/medical";

export default function SuiviDossiers() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical", "chef_medical"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [dossiers, setDossiers] = useState<DossierMedical[]>([]);
  const [chargement, setChargement] = useState(true);
  const [archivageEnCours, setArchivageEnCours] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "ouvert" | "archive">("tous");
  const [recherche, setRecherche] = useState("");

  // Recharger quand le filtre change
  useEffect(() => { 
    charger(); 
  }, [filtre]);

  async function charger() {
    setChargement(true);
    try {
      const data = await listerDossiers(
        filtre === "tous" ? undefined : filtre, 
        recherche.trim() || undefined
      );
      setDossiers(data);
    } catch (error) {
      console.error("Erreur lors du chargement des dossiers:", error);
    } finally { 
      setChargement(false); 
    }
  }

  async function handleArchiver(dossierId: string) {
    if (!confirm("Êtes-vous sûr de vouloir archiver ce dossier ? Cette action peut être annulée plus tard.")) return;
    
    setArchivageEnCours(dossierId);
    try {
      await modifierDossier(dossierId, { statut: "archive" });
      await charger(); // Recharger la liste pour refléter le changement
    } catch (error) {
      console.error("Erreur lors de l'archivage:", error);
      alert("Une erreur est survenue lors de l'archivage du dossier.");
    } finally {
      setArchivageEnCours(null);
    }
  }

  return (
    <div className="space-y-6 apparition pb-20">
      {/* Navigation */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre transition-colors">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Dossiers médicaux</span>
      </nav>

      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace médical</p>
          <h1 className="mt-1 text-2xl font-bold text-ardoise">Suivi des dossiers</h1>
          <p className="text-ardoise-clair mt-1">{dossiers.length} dossier(s) trouvé(s)</p>
        </div>
        <Link href="/medecin/nouveau-dossier">
          <Bouton variante="primaire">+ Nouveau dossier</Bouton>
        </Link>
      </div>

      {/* Filtres et Recherche */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2 flex-wrap">
          {(["tous", "ouvert", "archive"] as const).map((f) => (
            <button 
              key={f} 
              onClick={() => setFiltre(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtre === f 
                  ? "bg-ocre text-white shadow-sm" 
                  : "text-ardoise-clair hover:text-ardoise bg-sable hover:bg-sable/80"
              }`}
            >
              {f === "tous" ? "Tous" : f === "ouvert" ? "Ouverts" : "Archives"}
            </button>
          ))}
        </div>
        <div className="flex-1">
          <ChampRecherche 
            placeholder="Rechercher par nom ou DigiID..." 
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") charger(); }} 
          />
        </div>
      </div>

      {/* Liste des dossiers */}
      {chargement ? (
        <Carte>
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-ardoise-clair italic">Chargement des dossiers...</p>
          </div>
        </Carte>
      ) : dossiers.length === 0 ? (
        <Carte>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📂</p>
            <p className="text-ardoise-clair italic">Aucun dossier trouvé.</p>
          </div>
        </Carte>
      ) : (
        <div className="space-y-3">
          {dossiers.map((dossier) => (
            <div 
              key={dossier.id} 
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-ardoise-clair/10 hover:shadow-md transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-ardoise text-lg truncate">
                    {dossier.patient_prenom ? `${dossier.patient_prenom} ${dossier.patient_nom}` : dossier.patient_nom}
                  </h3>
                  <Badge variante={dossier.statut === "ouvert" ? "succes" : "lagune"} taille="petit">
                    {dossier.statut === "ouvert" ? "Ouvert" : "Archivé"}
                  </Badge>
                </div>
                <p className="text-sm text-ardoise-clair font-mono mb-1 truncate">{dossier.patient_digiid}</p>
                <p className="text-sm text-ardoise mb-1 truncate">
                  <span className="font-semibold">Motif :</span> {dossier.motif}
                </p>
                <p className="text-xs text-ardoise-clair">
                  {dossier.consultations_count} consultation(s) · Créé le {new Date(dossier.date_creation).toLocaleDateString("fr-FR")}
                </p>
              </div>
              
              <div className="flex gap-2 flex-shrink-0">
                <Link href={`/medecin/dossiers/${dossier.id}`}>
                  <Bouton variante="secondaire" taille="petit">Détails</Bouton>
                </Link>
                {dossier.statut === "ouvert" && (
                  <Bouton 
                    variante="ghost" 
                    taille="petit" 
                    chargement={archivageEnCours === dossier.id}
                    onClick={() => handleArchiver(dossier.id)}
                    className="text-terre hover:text-terre hover:bg-terre/10"
                  >
                    Archiver
                  </Bouton>
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