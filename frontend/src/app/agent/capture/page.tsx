"use client";

/**
 * Capture biométrique — photo et empreinte pour l'enrôlement.
 */
import { useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { useRoleUI } from "@/crochets/useRoleUI";

export default function CapturePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_terrain"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can, chargement, avertissement } = useRoleUI();

  if (chargement) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-ardoise-clair animate-pulse">Chargement des permissions...</p>
      </div>
    );
  }

  if (!can.captureBiometrics) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1>Capture biométrique</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module de capture biométrique désactivé.</p>
        </div>
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      {avertissement && (
        <div className="bg-ocre/10 border-l-4 border-ocre p-4 rounded">
          <p className="text-sm text-ocre">{avertissement}</p>
        </div>
      )}
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/agent/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Capture biométrique</span>
      </nav>

      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1 className="mt-1">Capture biométrique</h1>
        <p className="text-ardoise-clair mt-2">Photo d&apos;identité et empreinte digitale du citoyen.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Carte titre="Photo d'identité">
          <div className="border-2 border-dashed border-ardoise-clair/30 rounded-xl p-12 text-center bg-sable/50">
            <p className="text-5xl mb-3">📷</p>
            <p className="text-sm text-ardoise-clair mb-1">Capture de la photo</p>
            <p className="text-xs text-ardoise-clair/60">(Intégration caméra à développer)</p>
          </div>
          <div className="mt-4 flex gap-2">
            <Bouton variante="primaire" onClick={() => alert("📷 Intégration webcam en cours de déploiement")}>Prendre la photo</Bouton>
            <Bouton variante="ghost" onClick={() => alert("📁 Sélection de fichier en cours de déploiement")}>Importer</Bouton>
          </div>
        </Carte>

        <Carte titre="Empreinte digitale">
          <div className="border-2 border-dashed border-ardoise-clair/30 rounded-xl p-12 text-center bg-sable/50">
            <p className="text-5xl mb-3">👆</p>
            <p className="text-sm text-ardoise-clair mb-1">Scanner l&apos;empreinte</p>
            <p className="text-xs text-ardoise-clair/60">(Intégration lecteur d&apos;empreinte à développer)</p>
          </div>
          <div className="mt-4">
            <Bouton variante="primaire" onClick={() => alert("👆 Intégration lecteur d'empreinte en cours de déploiement")}>Lancer le scan</Bouton>
          </div>
        </Carte>
      </div>

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          Les données biométriques sont chiffrées et stockées de manière sécurisée conformément
          à la loi 2008-12 sur la protection des données personnelles (Sénégal).
        </p>
      </div>

      <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
