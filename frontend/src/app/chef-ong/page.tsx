"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import DashboardChef from "@/composants/chefs/GestionAgentsChef";
import { creerAgentONG } from "@/services/chefs";

export default function ChefONGPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur", "admin_domaine"]}>
      <DashboardChef
        titre="Chef ONG"
        sousTitre="Gestion des agents ONG"
        typeAgent="ong"  // 
        creerAgent={creerAgentONG}
        champsSupplementaires={[
          { nom: "mission", label: "Mission principale", type: "text" },
          { nom: "zone_intervention", label: "Zone d'intervention", type: "text" },
        ]}
      />
    </EnvelopperEspaceProtege>
  );
}