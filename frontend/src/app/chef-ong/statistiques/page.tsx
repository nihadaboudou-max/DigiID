"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import StatistiquesChef from "@/composants/chefs/StatistiquesChef";

export default function ChefONGStatistiquesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur", "admin_domaine"]}>
      <StatistiquesChef
        titre="Statistiques ONG"
        sousTitre="Suivez les performances de votre équipe"
        typeOrganisation="ong"
      />
    </EnvelopperEspaceProtege>
  );
}