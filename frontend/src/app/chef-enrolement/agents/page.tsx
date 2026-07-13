"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";

export default function ChefEnrolementAgentsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Agents Enrôlement"
        sousTitre="Gérez votre équipe d'agents terrain"
        typeAgent="enrolement"
      />
    </EnvelopperEspaceProtege>
  );
}