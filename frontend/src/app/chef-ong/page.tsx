"use client";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import DashboardChef from "@/composants/chefs/DashboardChef";

export default function ChefONGPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur", "admin_domaine"]}>
      <DashboardChef
        titre="Chef ONG"
        sousTitre="Gestion des agents ONG"
        typeAgent="ong"
        iconeDashboard="🤝"
      />
    </EnvelopperEspaceProtege>
  );
}