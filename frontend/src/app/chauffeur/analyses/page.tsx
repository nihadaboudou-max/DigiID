"use client";

import { AnalysesLogistiques } from "@/composants/logistique/AnalysesLogistiques";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";

export default function PageAnalysesChauffeur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <AnalysesLogistiques profil="chauffeur" />
    </EnvelopperEspaceProtege>
  );
}
