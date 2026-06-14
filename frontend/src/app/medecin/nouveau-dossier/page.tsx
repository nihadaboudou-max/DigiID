"use client";

/**
 * Création d'un nouveau dossier médical.
 * Réservé aux médecins avec le module 'creation_dossier' activé.
 */
import { useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { useRoleUI } from "@/crochets/useRoleUI";

export default function NouveauDossier() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [digiid, setDigiid] = useState("");
  const [motif, setMotif] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [etape, setEtape] = useState<"recherche" | "formulaire" | "confirmation">("recherche");

  if (!can.createMedicalRecord) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace médical</p>
        <h1>Création de dossier</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">
            Module désactivé. Contacte le super administrateur.
          </p>
        </div>
        <Link href="/medecin/dashboard">
          <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre transition-colors">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Nouveau dossier</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace médical</p>
        <h1 className="mt-1">Nouveau dossier médical</h1>
        <p className="text-ardoise-clair mt-2">
          Crée un dossier médical pour un patient identifié par son DigiID.
        </p>
      </div>

      {etape === "recherche" && (
        <Carte titre="🔍 Rechercher le patient">
          <p className="text-sm text-ardoise-clair mb-4">
            Saisis l'identifiant numérique DigiID du citoyen pour créer son dossier.
          </p>
          <div className="max-w-md space-y-4">
            <ChampSaisie
              libelle="DigiID du patient"
              value={digiid}
              onChange={(e) => setDigiid(e.target.value)}
              placeholder="Ex: DIG-A1B2C3D4E5F6"
            />
            <Bouton
              variante="primaire"
              disabled={digiid.length < 4}
              onClick={() => {
                setEtape("formulaire");
              }}
            >
              Rechercher
            </Bouton>
          </div>
        </Carte>
      )}

      {etape === "formulaire" && (
        <>
          {/* Infos patient (lecture seule) */}
          <Carte titre="👤 Identité du patient">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-ardoise-clair font-semibold">DigiID</p>
                <p className="text-sm font-medium">{digiid || "DIG-A1B2C3D4E5F6"}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-ardoise-clair font-semibold">Nom complet</p>
                <p className="text-sm font-medium">Fatou Diallo</p>
              </div>
              <div>
                <p className="text-xs uppercase text-ardoise-clair font-semibold">Date naissance</p>
                <p className="text-sm font-medium">15/03/1990</p>
              </div>
              <div>
                <p className="text-xs uppercase text-ardoise-clair font-semibold">Score</p>
                <p className="text-sm font-medium">78/100</p>
              </div>
            </div>
          </Carte>

          {/* Formulaire dossier médical */}
          <Carte titre="📋 Dossier médical">
            <div className="space-y-4 max-w-lg">
              <ChampSaisie
                libelle="Motif de la consultation"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex: Consultation de routine"
              />
              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                  Diagnostic / Observations
                </label>
                <textarea
                  value={diagnostic}
                  onChange={(e) => setDiagnostic(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                  placeholder="Description détaillée du diagnostic..."
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                  Pièces jointes
                </label>
                <div className="border-2 border-dashed border-ardoise-clair/20 rounded-lg p-6 text-center">
                  <p className="text-sm text-ardoise-clair">
                    Glisse des fichiers ici ou{" "}
                    <button className="text-ocre hover:underline">parcours</button>
                  </p>
                  <p className="text-xs text-ardoise-clair mt-1">
                    PDF, images (max 10 Mo)
                  </p>
                </div>
              </div>
            </div>
          </Carte>

          {/* Actions */}
          <div className="flex gap-3">
            <Bouton
              variante="primaire"
              disabled={!motif || !diagnostic}
              onClick={() => setEtape("confirmation")}
            >
              Créer le dossier
            </Bouton>
            <Bouton variante="ghost" onClick={() => setEtape("recherche")}>
              Annuler
            </Bouton>
          </div>
        </>
      )}

      {etape === "confirmation" && (
        <Carte titre="✅ Dossier créé avec succès">
          <p className="text-sm text-ardoise-clair mb-4">
            Le dossier médical a été créé et lié au patient {digiid || "DIG-A1B2C3D4E5F6"}.
          </p>
          <div className="bg-sable p-4 rounded-lg space-y-2 mb-4">
            <p className="text-sm"><strong>Motif :</strong> {motif}</p>
            <p className="text-sm"><strong>Diagnostic :</strong> {diagnostic}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/medecin/dossiers">
              <Bouton variante="primaire">Voir les dossiers</Bouton>
            </Link>
            <Bouton variante="ghost" onClick={() => { setEtape("recherche"); setMotif(""); setDiagnostic(""); }}>
              Nouveau dossier
            </Bouton>
          </div>
        </Carte>
      )}

      <Link href="/medecin/dashboard">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}
