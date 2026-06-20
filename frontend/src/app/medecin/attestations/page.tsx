"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { useRoleUI } from "@/crochets/useRoleUI";
import { listerDossiers } from "@/services/medical";
import type { DossierMedical } from "@/services/medical";

export default function AttestationsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
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

  useEffect(() => {
    listerDossiers()
      .then(setDossiers)
      .catch(() => {})
      .finally(() => setChargement(false));
  }, []);

  async function genererAttestation() {
    if (!dossierId || !typeAttestation) return;
    // TODO: appel API création d'attestation médicale
    alert("Fonctionnalité à venir : création d'attestation médicale.");
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/medecin/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Attestations</span>
      </nav>

      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Espace medical</p>
        <h1 className="mt-1">Attestations medicales</h1>
        <p className="text-ardoise-clair mt-2">Emettez et gerez les certificats medicaux.</p>
      </div>

      {can.manageMedicalAttestations ? (
        <>
          <Carte titre="Nouvelle attestation">
            <p className="text-sm text-ardoise-clair mb-4">
              Selectionnez un dossier medical et le type d attestation.
            </p>
            <div className="max-w-md space-y-3">
              <select
                value={dossierId}
                onChange={(e) => setDossierId(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white"
              >
                <option value="">-- Selectionnez un dossier --</option>
                {chargement ? (
                  <option disabled>Chargement des dossiers...</option>
                ) : dossiers.length === 0 ? (
                  <option disabled>Aucun dossier disponible</option>
                ) : (
                  dossiers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.patient_nom} ({d.patient_digiid}) — {d.motif}
                    </option>
                  ))
                )}
              </select>
              <select
                value={typeAttestation}
                onChange={(e) => setTypeAttestation(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white"
              >
                <option value="">-- Type d attestation --</option>
                <option value="certificat_medical">Certificat medical</option>
                <option value="certificat_vaccination">Certificat de vaccination</option>
                <option value="certificat_aptitude">Certificat d aptitude</option>
                <option value="certificat_visite">Certificat de visite</option>
              </select>
              <Bouton
                variante="primaire"
                onClick={genererAttestation}
                disabled={!dossierId || !typeAttestation}
              >
                Generer l attestation
              </Bouton>
            </div>
          </Carte>

          <Carte titre="Attestations recentes">
            <p className="text-sm text-ardoise-clair italic">Aucune attestation emise pour le moment.</p>
          </Carte>
        </>
      ) : (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module desactive.</p>
        </div>
      )}

      <Link href="/medecin/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
