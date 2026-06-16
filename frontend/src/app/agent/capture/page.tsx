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
    <EnvelopperEspaceProtege rolesAutorises={["agent"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();

  if (!can.captureBiometrics) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1>Capture biometrique</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module de capture biometrique desactive.</p>
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
        <span className="text-ardoise font-semibold">Capture biometrique</span>
      </nav>

      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1 className="mt-1">Capture biometrique</h1>
        <p className="text-ardoise-clair mt-2">Photo d identite et empreinte digitale du citoyen.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Carte titre="Photo d identite">
          <div className="border-2 border-dashed border-ardoise-clair/30 rounded-xl p-12 text-center bg-sable/50">
            <p className="text-5xl mb-3">📷</p>
            <p className="text-sm text-ardoise-clair mb-1">Capture de la photo</p>
            <p className="text-xs text-ardoise-clair/60">(Integration camera a developper)</p>
          </div>
          <div className="mt-4 flex gap-2">
            <Bouton variante="primaire" onClick={() => alert("📷 Intégration webcam en cours de déploiement")}>Prendre la photo</Bouton>
            <Bouton variante="ghost" onClick={() => alert("📁 Sélection de fichier en cours de déploiement")}>Importer</Bouton>
          </div>
        </Carte>

        <Carte titre="Empreinte digitale">
          <div className="border-2 border-dashed border-ardoise-clair/30 rounded-xl p-12 text-center bg-sable/50">
            <p className="text-5xl mb-3">👆</p>
            <p className="text-sm text-ardoise-clair mb-1">Scanner l empreinte</p>
            <p className="text-xs text-ardoise-clair/60">(Integration lecteur d empreinte a developper)</p>
          </div>
          <div className="mt-4">
            <Bouton variante="primaire" onClick={() => alert("👆 Intégration lecteur d'empreinte en cours de déploiement")}>Lancer le scan</Bouton>
          </div>
        </Carte>
      </div>

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          Les donnees biometriques sont chiffrees et stockees de maniere securisee conformement 
          a la loi 2008-12 sur la protection des donnees personnelles (Senegal).
        </p>
      </div>

      <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
