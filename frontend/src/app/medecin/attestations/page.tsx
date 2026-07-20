"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { useRoleUI } from "@/crochets/useRoleUI";
import { listerDossiers } from "@/services/medical";
import type { DossierMedical } from "@/services/medical";

export default function AttestationsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical", "chef_medical"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [dossiers, setDossiers] = useState<DossierMedical[]>([]);
  const [dossierId, setDossierId] = useState("");
  const [typeAttestation, setTypeAttestation] = useState("");
  const [chargement, setChargement] = useState(true);
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [message, setMessage] = useState<{ type: "succes" | "info" | "erreur"; texte: string } | null>(null);

  useEffect(() => {
    listerDossiers()
      .then(setDossiers)
      .catch(() => setMessage({ type: "erreur", texte: "Impossible de charger les dossiers." }))
      .finally(() => setChargement(false));
  }, []);

  async function genererAttestation() {
    if (!dossierId || !typeAttestation) return;
    
    setGenerationEnCours(true);
    setMessage(null);
    
    try {
      // TODO: Remplacer par l'appel API réel une fois la route backend créée
      // await creerAttestation({ dossier_id: dossierId, type: typeAttestation });
      
      // Simulation d'attente réseau
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setMessage({ 
        type: "info", 
        texte: "Fonctionnalité en cours de développement. La génération d'attestation sera bientôt disponible via l'API." 
      });
    } catch (e: any) {
      setMessage({ type: "erreur", texte: e.message || "Erreur lors de la génération." });
    } finally {
      setGenerationEnCours(false);
    }
  }

  if (!can.manageMedicalAttestations) {
    return (
      <div className="space-y-8 apparition">
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module d'attestations désactivé pour votre rôle.</p>
        </div>
        <Link href="/medecin/dashboard"><Bouton variante="ghost">← Retour</Bouton></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition max-w-4xl mx-auto">
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/medecin/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Attestations</span>
      </nav>

      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Espace médical</p>
        <h1 className="mt-1">Attestations médicales</h1>
        <p className="text-ardoise-clair mt-2">Émettez et gérez les certificats médicaux pour vos patients.</p>
      </div>

      {message && (
        <div className={`p-4 rounded border-l-4 ${
          message.type === "succes" ? "bg-succes/10 border-succes text-succes" :
          message.type === "erreur" ? "bg-terre/10 border-terre text-terre" :
          "bg-lagune/10 border-lagune text-lagune"
        }`}>
          <p className="text-sm font-medium">{message.texte}</p>
        </div>
      )}

      <Carte titre="Nouvelle attestation">
        <p className="text-sm text-ardoise-clair mb-4">
          Sélectionnez un dossier médical existant et le type de document à générer.
        </p>
        <div className="max-w-md space-y-4">
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Dossier du patient</label>
            <select
              value={dossierId}
              onChange={(e) => setDossierId(e.target.value)}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lagune/30"
            >
              <option value="">-- Sélectionnez un dossier --</option>
              {chargement ? (
                <option disabled>Chargement des dossiers...</option>
              ) : dossiers.length === 0 ? (
                <option disabled>Aucun dossier disponible</option>
              ) : (
                dossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.patient_prenom ? `${d.patient_prenom} ` : ""}{d.patient_nom} ({d.patient_digiid}) — {d.motif}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Type d'attestation</label>
            <select
              value={typeAttestation}
              onChange={(e) => setTypeAttestation(e.target.value)}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lagune/30"
            >
              <option value="">-- Type de document --</option>
              <option value="certificat_medical">Certificat médical standard</option>
              <option value="certificat_vaccination">Certificat de vaccination</option>
              <option value="certificat_aptitude">Certificat d'aptitude</option>
              <option value="certificat_visite">Certificat de visite</option>
            </select>
          </div>

          <Bouton
            variante="primaire"
            onClick={genererAttestation}
            disabled={!dossierId || !typeAttestation || generationEnCours}
            chargement={generationEnCours}
            className="w-full sm:w-auto"
          >
            {generationEnCours ? "Génération..." : "Générer l'attestation"}
          </Bouton>
        </div>
      </Carte>

      <Carte titre="Attestations récentes">
        <div className="text-center py-8">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-ardoise-clair italic">Aucune attestation émise pour le moment.</p>
        </div>
      </Carte>

      <Link href="/medecin/dashboard">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}