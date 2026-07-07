"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionMissionsChef from "@/composants/chefs/GestionMissionsChef";

export default function ChefONGMissionsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur", "admin_domaine"]}>
      <GestionMissionsChef
        titre="Missions ONG"
        sousTitre="Planifiez et suivez vos missions sur le terrain"
        typeOrganisation="ONG"
      />
    </EnvelopperEspaceProtege>
  );
}