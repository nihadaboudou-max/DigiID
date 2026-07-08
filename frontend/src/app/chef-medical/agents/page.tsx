"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import GestionAgentsChef from "@/composants/chefs/GestionAgentsChef";
import { creerMedecin, listerMedecins } from "@/services/chefs";

export default function ChefMedicalAgentsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_medical", "super_administrateur", "admin_domaine"]}>
      <GestionAgentsChef
        titre="Médecins"
        sousTitre="Gérez votre équipe de médecins et agents médicaux"
        typeAgent="medical"
        creerAgent={creerMedecin}
        champsSupplementaires={[
          { nom: "specialite", label: "Spécialité médicale", type: "text" },
          { nom: "numero_ordre", label: "Numéro d'ordre", type: "text" },
        ]}
      />
    </EnvelopperEspaceProtege>
  );
}