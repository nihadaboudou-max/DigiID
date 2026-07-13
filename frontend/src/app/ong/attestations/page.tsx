"use client";

import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";

export default function OngAttestationsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong", "chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  return (
    <div className="space-y-6 apparition">
      <nav className="text-sm text-ardoise-clair">
        <Link href="/ong" className="hover:text-ocre">Tableau de bord</Link>
        <span className="mx-2">/</span>
        <span className="text-ardoise font-semibold">Attestations</span>
      </nav>

      <div>
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">ONG Partenaire</p>
        <h1 className="mt-1 text-2xl">Attestations</h1>
        <p className="text-ardoise-clair mt-1 text-sm">Certificats et documents communautaires.</p>
      </div>

      <Carte titre="Attestations bénéficiaires">
        <div className="text-center py-8">
          <p className="text-4xl mb-3">📜</p>
          <p className="text-ardoise-clair italic">Module en cours de développement.</p>
          <p className="text-xs text-ardoise-clair mt-2">
            Cette fonctionnalité sera disponible prochainement pour gérer les attestations de vos bénéficiaires.
          </p>
        </div>
      </Carte>

      <Link href="/ong">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}