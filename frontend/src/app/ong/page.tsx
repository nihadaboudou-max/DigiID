"use client";

/**
 * Page d'accueil de l'espace ONG.
 * Redirige vers le tableau de bord.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function AccueilONG() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/ong/dashboard");
  }, [router]);

  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong"]}>
      <p className="text-ardoise-clair italic text-center py-12">
        Redirection vers le tableau de bord...
      </p>
    </EnvelopperEspaceProtege>
  );
}
