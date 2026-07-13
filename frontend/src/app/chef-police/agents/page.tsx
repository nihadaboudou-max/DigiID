"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";

export default function ChefPoliceAgentsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_police", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Agents Police"
        sousTitre="Gérez votre équipe d'agents de police"
        typeAgent="police"
      />
    </EnvelopperEspaceProtege>
  );
}