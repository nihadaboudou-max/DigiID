"use client";
/**
 * Écran de scan du guichet receveur (S3).
 *
 * Accepte un code pré-rempli via l'URL (`?token=…` ou `?code=…`), par exemple
 * quand l'agent scanne l'étiquette avec la caméra de son téléphone.
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_SCAN } from "@/composants/logistique/roles";
import { ScannerTicket } from "@/composants/logistique/ScannerTicket";

export default function PageScanReceveur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_SCAN}>
      <Suspense
        fallback={
          <p className="text-ardoise-clair italic py-12 text-center">Chargement…</p>
        }
      >
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? searchParams.get("code") ?? "";

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Scanner / Livrer</h1>
        <p className="text-sm text-ardoise-clair">
          Scannez le QR Code du colis ou saisissez son numéro pour enregistrer une
          remise au destinataire.
        </p>
      </div>

      <ScannerTicket
        key={token || "scan"}
        tokenInitial={token || undefined}
        typeParDefaut="livraison"
      />
    </div>
  );
}
