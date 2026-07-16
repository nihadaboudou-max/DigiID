"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import DashboardChef from "@/composants/chefs/DashboardChef";

export default function ChefMedicalPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_medical", "super_administrateur", "admin_domaine"]}>
      <DashboardChef
        titre="Chef Médical"
        sousTitre="Gestion de l'équipe médicale et des soins"
        typeAgent="medical"
        iconeDashboard="🩺"
      />
    </EnvelopperEspaceProtege>
    // Note: Assurez-vous que DashboardChef gère bien la prop typeAgent="medical"
  );
}