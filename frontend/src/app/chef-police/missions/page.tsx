"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionMissionsChef from "@/composants/chefs/GestionMissionsChef";

export default function ChefPoliceMissionsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_police", "super_administrateur", "admin_domaine"]}>
      <GestionMissionsChef
        titre="Missions Police"
        sousTitre="Planifiez et suivez vos missions de police sur le terrain"
        typeOrganisation="police"
      />
    </EnvelopperEspaceProtege>
  );
}