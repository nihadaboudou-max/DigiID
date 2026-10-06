"use client";
/**
 * Écran de scan du chauffeur (S4).
 *
 * Accepte un code pré-rempli via l'URL (`?token=` ou `?code=`) et, au besoin,
 * un voyage à rattacher (`?voyage_id=`). L'action par défaut est « mise en
 * transit » : un chauffeur en route enregistre le passage des colis.
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_SCAN } from "@/composants/logistique/roles";
import { ScannerTicket } from "@/composants/logistique/ScannerTicket";
import type { TypeEvenementScan } from "@/types/logistique";

/** Événements qu'un chauffeur peut enregistrer depuis son téléphone. */
const TYPES_ACCEPTES: TypeEvenementScan[] = [
  "mise_en_transit",
  "depart",
  "arrivee",
  "livraison",
];

export default function PageScanChauffeur() {
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
  const voyageId = searchParams.get("voyage_id");
  // `?type=livraison` arrive depuis la fiche colis (« Remettre au destinataire ») :
  // l'action est pré-sélectionnée, le chauffeur n'a plus qu'à confirmer.
  const typeDemande = searchParams.get("type");
  const typeParDefaut: TypeEvenementScan =
    (TYPES_ACCEPTES as string[]).includes(typeDemande ?? "")
      ? (typeDemande as TypeEvenementScan)
      : "mise_en_transit";

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Scanner un colis</h1>
        <p className="text-sm text-ardoise-clair">
          Scannez le QR Code du colis ou saisissez son numéro pour enregistrer un
          événement de transport (départ, transit ou arrivée).
        </p>
      </div>

      {voyageId && (
        <Alerte variante="info">
          Le scan sera rattaché au voyage sélectionné.
        </Alerte>
      )}

      <ScannerTicket
        key={`${token || "scan"}-${voyageId || "sans-voyage"}-${typeParDefaut}`}
        tokenInitial={token || undefined}
        typeParDefaut={typeParDefaut}
        voyageId={voyageId}
      />
    </div>
  );
}
