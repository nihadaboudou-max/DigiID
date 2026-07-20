"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";

export default function ChefOngEquipePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Agents ONG"
        sousTitre="Gérez votre équipe d'agents ONG"
        typeAgent="ong"
      />
    </EnvelopperEspaceProtege>
  );
}