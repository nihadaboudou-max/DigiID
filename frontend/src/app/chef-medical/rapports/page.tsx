"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import RapportsChef from "@/composants/chefs/RapportsChef";

export default function ChefMedicalRapportsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_medical", "super_administrateur", "admin_domaine"]}>
      <RapportsChef
        titre="Rapports Médicaux"
        sousTitre="Consultez et générez les rapports d'activité médicale"
        typeOrganisation="medical"
      />
    </EnvelopperEspaceProtege>
  );
}