"use client";

/**
 * Page d'accueil de l'espace Police.
 * Redirige vers le tableau de bord.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function AccueilPolice() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/police/dashboard");
  }, [router]);

  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_police"]}>
      <p className="text-ardoise-clair italic text-center py-12">
        Redirection vers le tableau de bord...
      </p>
    </EnvelopperEspaceProtege>
  );
}
