"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import ProfilAgent from "@/app/profil/ProfilAgent";

export default function OngProfilPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong"]}>
      <ProfilAgent role="agent_ong" titre="Profil Agent ONG" />
    </EnvelopperEspaceProtege>
  );
}