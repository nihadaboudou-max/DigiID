"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import StatistiquesChef from "@/composants/chefs/StatistiquesChef";

export default function ChefEnrolementStatistiquesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <StatistiquesChef
        titre="Statistiques d'Enrôlement"
        sousTitre="Suivez les performances de vos agents de terrain"
        typeOrganisation="enrolement"
      />
    </EnvelopperEspaceProtege>
  );
}