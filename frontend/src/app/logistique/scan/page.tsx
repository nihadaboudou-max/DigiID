"use client";
/**
 * Page de scan logistique « universelle » (S4).
 *
 * Cible du QR Code collé sur le colis : l'étiquette encode
 * `…/logistique/scan?token=<qr_token>`. En scannant l'étiquette avec la caméra
 * native du téléphone, l'agent ouvre directement cette page, s'authentifie
 * (le chemin est conservé), puis le colis est pré-rempli.
 *
 * L'action proposée par défaut dépend du rôle : un chauffeur en route
 * enregistre une « mise en transit », un receveur une remise au destinataire.
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_SCAN } from "@/composants/logistique/roles";
import { ScannerTicket } from "@/composants/logistique/ScannerTicket";
import { useAuthentification } from "@/contextes/authentification";
import type { TypeEvenementScan } from "@/types/logistique";

export default function PageScanLogistique() {
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
  const { utilisateur } = useAuthentification();
  const token = searchParams.get("token") ?? searchParams.get("code") ?? "";

  const typeParDefaut: TypeEvenementScan =
    utilisateur?.role === "chauffeur" ? "mise_en_transit" : "livraison";

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Scan d&apos;un colis</h1>
        <p className="text-sm text-ardoise-clair">
          Vérifiez l&apos;action, puis validez pour enregistrer l&apos;événement.
        </p>
      </div>

      {token && (
        <Alerte variante="info">
          Code détecté depuis le QR Code. Vérifiez l&apos;action ci-dessous, puis
          validez pour enregistrer l&apos;événement.
        </Alerte>
      )}

      <ScannerTicket
        key={token || "scan"}
        tokenInitial={token || undefined}
        typeParDefaut={typeParDefaut}
      />
    </div>
  );
}
