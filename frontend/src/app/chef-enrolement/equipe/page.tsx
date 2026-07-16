"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";

export default function ChefEnrolementEquipePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Équipe d'Enrôlement"
        sousTitre="Gérez vos agents de terrain"
        typeAgent="enrolement"
      />
    </EnvelopperEspaceProtege>
  );
}