"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import RapportsChef from "@/composants/chefs/RapportsChef";

export default function ChefEnrolementRapportsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <RapportsChef
        titre="Rapports Enrôlement"
        sousTitre="Consultez et générez les rapports d'activité d'enrôlement"
        typeOrganisation="enrolement"
      />
    </EnvelopperEspaceProtege>
  );
}