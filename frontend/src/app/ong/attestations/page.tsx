"use client";

import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { useRoleUI } from "@/crochets/useRoleUI";

export default function OngAttestationsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent-ong"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/ong/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Attestations</span>
      </nav>
      <p className="text-ocre text-sm uppercase font-semibold tracking-wider">ONG Partenaire</p>
      <h1>Attestations</h1>
      <p className="text-ardoise-clair">Certificats et documents communautaires.</p>

      <Carte titre="Attestations beneficiaires">
        {can.manageCommunityAttestations ? (
          <p className="text-sm text-ardoise-clair italic">Module attestations disponible. Fonctionnalite a venir.</p>
        ) : (
          <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
            <p className="text-sm text-terre">Module desactive.</p>
          </div>
        )}
      </Carte>

      <Link href="/ong/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
