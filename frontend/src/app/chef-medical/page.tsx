"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import DashboardChef from "@/composants/chefs/GestionAgentsChef";
import { creerMedecin } from "@/services/chefs";

export default function ChefMedicalPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_medical", "super_administrateur", "admin_domaine"]}>
      <DashboardChef
        titre="Chef Médical"
        sousTitre="Gestion des médecins"
        typeAgent="medical"
        creerAgent={creerMedecin}
        champsSupplementaires={[
          { nom: "specialite", label: "Spécialité", type: "text", required: true },
          { nom: "numero_ordre", label: "Numéro d'ordre", type: "text" },
        ]}
      />
    </EnvelopperEspaceProtege>
  );
}