"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import ProfilAgent from "@/app/profil/ProfilAgent";

export default function ChefOngProfilPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong"]}>
      <ProfilAgent role="chef_ong" titre="Profil Chef ONG" />
    </EnvelopperEspaceProtege>
  );
}