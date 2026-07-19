"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import ProfilAgent from "@/app/profil/ProfilAgent";

export default function MedecinProfilPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical"]}>
      <ProfilAgent role="agent_medical" titre="Profil Médecin" />
    </EnvelopperEspaceProtege>
  );
}