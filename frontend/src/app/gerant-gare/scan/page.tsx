"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_SCAN_GUICHET } from "@/composants/logistique/roles";
import { ScannerTicket } from "@/composants/logistique/ScannerTicket";

export default function PageScanGerant() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_SCAN_GUICHET}>
      <Suspense fallback={<p className="py-12 text-center italic">Chargement…</p>}>
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const params = useSearchParams();
  const token = params.get("token") ?? params.get("code") ?? "";
  return (
    <div className="space-y-5 apparition">
      <div>
        <h1 className="text-2xl font-bold text-ardoise">Scanner en cas de litige</h1>
        <p className="text-sm text-ardoise-clair">
          Vérifiez un ticket ou une remise uniquement pour traiter un litige.
        </p>
      </div>
      <ScannerTicket key={token || "scan"} tokenInitial={token || undefined} typeParDefaut="livraison" />
    </div>
  );
}
