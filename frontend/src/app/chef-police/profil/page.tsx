"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import ProfilAgent from "@/app/profil/ProfilAgent";

export default function ChefPoliceProfilPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_police"]}>
      <ProfilAgent role="chef_police" titre="Profil Chef Police" />
    </EnvelopperEspaceProtege>
  );
}