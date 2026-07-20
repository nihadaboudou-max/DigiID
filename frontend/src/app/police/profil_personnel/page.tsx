"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import ProfilAgent from "@/app/profil/ProfilAgent";

export default function PoliceProfilPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_police", "chef_police"]}>
      <ProfilAgent role="agent_police" titre="Profil Agent Police" />
    </EnvelopperEspaceProtege>
  );
}