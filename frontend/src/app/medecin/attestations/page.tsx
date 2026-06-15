"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { useRoleUI } from "@/crochets/useRoleUI";

export default function AttestationsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();

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
            <form className="max-w-md space-y-3" onSubmit={(e) => e.preventDefault()}>
              <select className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white">
                <option value="">-- Selectionnez un dossier --</option>
                <option value="..." disabled>Dossiers disponibles (bientot)</option>
              </select>
              <select className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white">
                <option value="">-- Type d attestation --</option>
                <option>Certificat medical</option>
                <option>Certificat de vaccination</option>
                <option>Certificat d aptitude</option>
                <option>Certificat de visite</option>
              </select>
              <Bouton variante="primaire" disabled>Generer l attestation</Bouton>
            </form>
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
