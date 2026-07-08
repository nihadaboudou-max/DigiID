"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import StatistiquesChef from "@/composants/chefs/StatistiquesChef";

export default function ChefEnrolementStatistiquesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <StatistiquesChef
        titre="Statistiques Enrôlement"
        sousTitre="Suivez les performances de votre équipe d'enrôlement"
        typeOrganisation="enrolement"
      />
    </EnvelopperEspaceProtege>
  );
}