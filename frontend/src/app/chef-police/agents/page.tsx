"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";
import { creerAgentPolice } from "@/services/chefs";

export default function ChefPoliceAgentsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_police", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Agents Police"
        sousTitre="Gérez votre équipe d'agents de police"
        typeAgent="police"
        creerAgent={creerAgentPolice}
        champsSupplementaires={[
          { nom: "matricule", label: "Numéro de matricule", type: "text", required: true },
          { nom: "grade", label: "Grade", type: "text", required: true },
          { nom: "commissariat", label: "Commissariat d'affectation", type: "text" },
          { nom: "numero_badge", label: "Numéro de badge", type: "text" },
        ]}
      />
    </EnvelopperEspaceProtege>
  );
}