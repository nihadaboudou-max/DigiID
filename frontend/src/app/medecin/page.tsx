"use client";

/**
 * Page d'accueil de l'espace Médecin.
 * Redirige vers le tableau de bord.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function AccueilMedecin() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/medecin/dashboard");
  }, [router]);

  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical"]}>
      <p className="text-ardoise-clair italic text-center py-12">
        Redirection vers le tableau de bord...
      </p>
    </EnvelopperEspaceProtege>
  );
}
