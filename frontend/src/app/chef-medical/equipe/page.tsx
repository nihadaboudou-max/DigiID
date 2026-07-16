"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";

export default function ChefMedicalEquipePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_medical", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Équipe Médicale"
        sousTitre="Gérez vos médecins et agents de santé"
        typeAgent="medical"
      />
    </EnvelopperEspaceProtege>
  );
}