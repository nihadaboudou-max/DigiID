"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import StatistiquesChef from "@/composants/chefs/StatistiquesChef";

export default function ChefMedicalStatistiquesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_medical", "super_administrateur", "admin_domaine"]}>
      <StatistiquesChef
        titre="Statistiques Médicales"
        sousTitre="Suivez les performances de votre équipe médicale"
        typeOrganisation="medical"
      />
    </EnvelopperEspaceProtege>
  );
}