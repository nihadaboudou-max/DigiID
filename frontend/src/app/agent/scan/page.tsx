"use client";

import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { useRoleUI } from "@/crochets/useRoleUI";

export default function ScanPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();

  if (!can.scanCNI) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1>Scan CNI</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module scan desactive.</p>
        </div>
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/agent/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Scan CNI</span>
      </nav>
      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1 className="mt-1">Scan de carte d identite</h1>
        <p className="text-ardoise-clair mt-2">Utilise le module OCR pour extraire les donnees de la CNI.</p>
      </div>

      <Carte titre="Scanner une CNI">
        <p className="text-sm text-ardoise-clair mb-4">
          Placez la carte d identite dans le cadre et prenez une photo.
        </p>
        <div className="border-2 border-dashed border-ardoise-clair/30 rounded-xl p-16 text-center bg-sable/50">
          <p className="text-4xl mb-2">📸</p>
          <p className="text-sm text-ardoise-clair">Zone de capture camera</p>
          <p className="text-xs text-ardoise-clair mt-1">(Integration camera a developper)</p>
        </div>
        <div className="mt-4">
          <Bouton variante="primaire" disabled>Lancer le scan</Bouton>
          <span className="ml-2 text-xs text-ardoise-clair">Requis: acces camera</span>
        </div>
      </Carte>

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          Le module OCR extraira automatiquement : nom, prenom, date naissance, numero CNI.
          Les donnees sont chiffrees et stockees de maniere securisee.
        </p>
      </div>

      <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
