"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import DashboardChef from "@/composants/chefs/DashboardChef";

export default function ChefEnrolementPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <DashboardChef
        titre="Chef Enrôlement"
        sousTitre="Gestion des agents terrain d'enrôlement"
        typeAgent="enrolement"
        iconeDashboard="📋"
      />
    </EnvelopperEspaceProtege>
  );
}