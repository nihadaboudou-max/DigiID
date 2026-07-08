"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import DashboardChef from "@/composants/chefs/DashboardChef";

export default function ChefPolicePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_police", "super_administrateur", "admin_domaine"]}>
      <DashboardChef
        titre="Chef Police"
        sousTitre="Gestion des agents de police"
        typeAgent="police"
        iconeDashboard="👮"
      />
    </EnvelopperEspaceProtege>
  );
}