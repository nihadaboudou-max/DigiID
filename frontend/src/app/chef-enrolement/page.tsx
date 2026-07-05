"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import DashboardChef from "@/composants/chefs/DashboardChef";
import { creerAgentEnrolement } from "@/services/chefs";

export default function ChefEnrolementPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <DashboardChef
        titre="Chef Enrôlement"
        sousTitre="Gestion des agents terrain"
        typeAgent="enrôlement"
        iconeDashboard="📋"
        creerAgent={creerAgentEnrolement}
        champsSupplementaires={[
          { nom: "zone_couverture", label: "Zone de couverture", type: "text" },
          { nom: "langues_parlees", label: "Langues parlées", type: "text" },
        ]}
      />
    </EnvelopperEspaceProtege>
  );
}