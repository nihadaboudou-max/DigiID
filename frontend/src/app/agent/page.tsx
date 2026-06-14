"use client";

/**
 * Page d'accueil de l'espace Agent.
 * Redirige vers le tableau de bord.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function AccueilAgent() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/agent/dashboard");
  }, [router]);

  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent"]}>
      <p className="text-ardoise-clair italic text-center py-12">
        Redirection vers le tableau de bord...
      </p>
    </EnvelopperEspaceProtege>
  );
}
