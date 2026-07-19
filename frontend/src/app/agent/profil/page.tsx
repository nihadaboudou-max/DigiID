"use client";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import ProfilAgent from "@/app/profil/ProfilAgent";

export default function AgentProfilPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_terrain"]}>
      <ProfilAgent role="agent_terrain" titre="Profil Agent Terrain" />
    </EnvelopperEspaceProtege>
  );
}