"use client";

/**
 * Page Identité → Vérification Visuelle (Reconnaissance Faciale).
 * Redirige vers la page de vérification visuelle complète existante.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function PageIdentiteVerificationVisuelle() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/verification-visuelle");
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
        <p className="text-ardoise-clair italic">Redirection vers la vérification faciale...</p>
      </div>
    </EnvelopperEspaceProtege>
  );
}
