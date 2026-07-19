"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import ProfilAgent from "@/app/profil/ProfilAgent";

export default function ChefEnrolementProfilPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent"]}>
      <ProfilAgent role="chef_agent" titre="Profil Chef Enrôlement" />
    </EnvelopperEspaceProtege>
  );
}