"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionMissionsChef from "@/composants/chefs/GestionMissionsChef";

export default function ChefEnrolementMissionsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <GestionMissionsChef
        titre="Missions Enrôlement"
        sousTitre="Planifiez et suivez vos missions d'enrôlement sur le terrain"
        typeOrganisation="enrolement"
      />
    </EnvelopperEspaceProtege>
  );
}