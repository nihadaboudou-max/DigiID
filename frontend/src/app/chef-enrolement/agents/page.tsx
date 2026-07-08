"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";
import { creerAgentEnrolement } from "@/services/chefs";

export default function ChefEnrolementAgentsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Agents Enrôlement"
        sousTitre="Gérez votre équipe d'agents terrain"
        typeAgent="enrolement"
        creerAgent={creerAgentEnrolement}
        champsSupplementaires={[
          { nom: "zone_couverture", label: "Zone de couverture", type: "text" },
          { nom: "specialite", label: "Spécialité", type: "text" },
          { nom: "numero_matricule", label: "Numéro de matricule", type: "text" },
        ]}
      />
    </EnvelopperEspaceProtege>
  );
}