"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import RapportsChef from "@/composants/chefs/RapportsChef";

export default function ChefPoliceRapportsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_police", "super_administrateur", "admin_domaine"]}>
      <RapportsChef
        titre="Rapports Police"
        sousTitre="Consultez et générez les rapports d'activité de police"
        typeOrganisation="police"
      />
    </EnvelopperEspaceProtege>
  );
}