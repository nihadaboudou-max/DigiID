"use client";

import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { IconeFlecheRetour } from "@/composants/commun/Icones";
import { Bouton } from "@/composants/commun/Bouton";
import AffichageQR from "@/composants/qr-dynamique/AffichageQR";
//  Import du composant de protection
import ProtectionContenuSensible from "@/composants/commun/ProtectionContenuSensible";

export default function QRCodePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/citoyen/dashboard" className="hover:text-ocre">
          Mon espace
        </Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Code de sécurité temporaire</span>
      </nav>

      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Identité
        </p>
        <h1 className="mt-1">Code de sécurité temporaire</h1>
        <p className="text-ardoise-clair mt-2">
          Présente ce code aux forces de l'ordre pour vérifier ton identité.
        </p>
      </div>

      {/* Alerte sécurité (Texte renforcé) */}
      <div className="bg-ocre/10 border-l-4 border-ocre p-3 rounded">
        <p className="text-sm text-ocre font-semibold">
          ⚠️ Important : Ce code change toutes les 30 secondes.
        </p>
        <p className="text-xs text-ardoise-clair mt-1">
          Toute tentative de capture d'écran rendra le contenu flou et apposera un filigrane traçable avec votre identifiant.
        </p>
      </div>

      {/*Composant QR Code dynamique PROTÉGÉ */}
      <ProtectionContenuSensible 
        identifiantFiligrane="DigiID CONFIDENTIEL" 
        niveau="strict"
      >
        <AffichageQR />
      </ProtectionContenuSensible>

      {/* Bouton retour */}
      <Link href="/profil">
        <Bouton variante="ghost" taille="grand">
          <IconeFlecheRetour className="h-5 w-5" />
          Retour au profil
        </Bouton>
      </Link>
    </div>
  );
}