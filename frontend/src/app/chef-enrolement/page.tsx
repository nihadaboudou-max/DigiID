"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";
import { creerAgentEnrolement } from "@/services/chefs";

export default function ChefEnrolementPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Chef Enrôlement"
        sousTitre="Gestion des agents terrain"
        typeAgent="enrolement"  // ✅ Sans accent
        creerAgent={creerAgentEnrolement}
        champsSupplementaires={[
          { nom: "zone_couverture", label: "Zone de couverture", type: "text" },
          { nom: "specialite", label: "Spécialité", type: "text" },
        ]}
      />
    </EnvelopperEspaceProtege>
  );
}