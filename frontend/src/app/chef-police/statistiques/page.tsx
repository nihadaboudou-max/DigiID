"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import StatistiquesChef from "@/composants/chefs/StatistiquesChef";

export default function ChefPoliceStatistiquesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_police", "super_administrateur", "admin_domaine"]}>
      <StatistiquesChef
        titre="Statistiques Police"
        sousTitre="Suivez les performances de votre équipe de police"
        typeOrganisation="police"
      />
    </EnvelopperEspaceProtege>
  );
}