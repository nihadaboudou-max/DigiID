"use client";

/**
 * Page Identité → Permis de Conduire.
 * Redirige vers la page de scan OCR du permis de conduire.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function PageIdentitePermisConduire() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/permis-conduire");
  }, [router]);

  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
        "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical",
        "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine",
        "administrateur", "super_administrateur"
      ]}
    >
      <div className="flex items-center justify-center py-20">
        <p className="text-ardoise-clair italic">Redirection vers le scan du permis...</p>
      </div>
    </EnvelopperEspaceProtege>
  );
}