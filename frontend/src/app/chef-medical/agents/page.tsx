"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";

export default function ChefMedicalAgentsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_medical", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Médecins & Agents Médicaux"
        sousTitre="Gérez votre équipe de médecins et agents médicaux"
        typeAgent="medical"
      />
    </EnvelopperEspaceProtege>
  );
}