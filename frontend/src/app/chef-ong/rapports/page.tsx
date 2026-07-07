"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import RapportsChef from "@/composants/chefs/RapportsChef";

export default function ChefONGRapportsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur", "admin_domaine"]}>
      <RapportsChef
        titre="Rapports ONG"
        sousTitre="Consultez et générez les rapports d'activité"
        typeOrganisation="ONG"
      />
    </EnvelopperEspaceProtege>
  );
}