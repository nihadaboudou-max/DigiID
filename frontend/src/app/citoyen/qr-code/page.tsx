"use client";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import AffichageQR from "@/composants/qr-dynamique/AffichageQR";

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
        <span className="text-ardoise font-semibold">Mon QR Code</span>
      </nav>

      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Identité
        </p>
        <h1 className="mt-1">Mon QR Code d'identité</h1>
        <p className="text-ardoise-clair mt-2">
          Présentez ce QR Code aux forces de l'ordre pour vérifier votre identité
          en temps réel.
        </p>
      </div>

      {/* Alerte sécurité */}
      <div className="bg-ocre/10 border-l-4 border-ocre p-3 rounded">
        <p className="text-sm text-ocre font-semibold">
          ⚠️ Important : Ce QR Code change toutes les 30 secondes.
        </p>
        <p className="text-xs text-ardoise-clair mt-1">
          Ne faites pas de capture d'écran : elle serait invalide après quelques secondes.
        </p>
      </div>

      {/* Composant QR Code dynamique */}
      <AffichageQR />

      {/* Bouton retour */}
      <Link href="/citoyen/dashboard">
        <Bouton variante="ghost">← Retour à mon espace</Bouton>
      </Link>
    </div>
  );
}