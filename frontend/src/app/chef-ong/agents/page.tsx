"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";
import { creerAgentONG, listerAgentsONG } from "@/services/chefs";

export default function ChefONGAgentsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Agents ONG"
        sousTitre="Gérez votre équipe d'agents ONG"
        typeAgent="ong"  // ✅ minuscules
        creerAgent={creerAgentONG}
        champsSupplementaires={[
          { nom: "mission", label: "Mission principale", type: "text" },
          { nom: "zone_intervention", label: "Zone d'intervention", type: "text" },
        ]}
      />
    </EnvelopperEspaceProtege>
  );
}