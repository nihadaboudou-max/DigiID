"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { EnregistrementColis } from "@/composants/logistique/EnregistrementColis";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_GUICHET_ECRITURE } from "@/composants/logistique/roles";

export default function PageNouveauColisGerant() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET_ECRITURE}>
      <Suspense fallback={<p className="py-12 text-center italic">Chargement…</p>}>
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const params = useSearchParams();
  return <EnregistrementColis digiidInitial={params.get("digiid") ?? undefined} attributionFacultative />;
}
