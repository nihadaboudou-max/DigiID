"use client";

import { AnalysesLogistiques } from "@/composants/logistique/AnalysesLogistiques";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_GUICHET } from "@/composants/logistique/roles";

export default function PageAnalysesReceveur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET}>
      <AnalysesLogistiques profil="receveur" />
    </EnvelopperEspaceProtege>
  );
}
