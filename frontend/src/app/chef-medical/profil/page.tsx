"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import ProfilAgent from "@/app/profil/ProfilAgent";

export default function ChefMedicalProfilPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_medical"]}>
      <ProfilAgent role="chef_medical" titre="Profil Chef Médical" />
    </EnvelopperEspaceProtege>
  );
}