"use client";

import { Suspense } from "react";

import { EnregistrementSuiviFamilial } from "@/composants/logistique/EnregistrementSuiviFamilial";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_GUICHET_ECRITURE } from "@/composants/logistique/roles";

export default function PageNouveauPassagerGerant() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET_ECRITURE}>
      <Suspense fallback={<p className="py-12 text-center italic">Chargement…</p>}>
        <EnregistrementSuiviFamilial attributionFacultative />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}
