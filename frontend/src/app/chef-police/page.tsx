"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import DashboardChef from "@/composants/chefs/GestionAgentsChef";
import { creerAgentPolice } from "@/services/chefs";

export default function ChefPolicePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_police", "super_administrateur", "admin_domaine"]}>
      <DashboardChef
        titre="Chef Police"
        sousTitre="Gestion des agents police"
        typeAgent="police"
        creerAgent={creerAgentPolice}
        champsSupplementaires={[
          { nom: "matricule", label: "Matricule", type: "text" },
          { nom: "grade", label: "Grade", type: "text" },
        ]}
      />
    </EnvelopperEspaceProtege>
  );
}