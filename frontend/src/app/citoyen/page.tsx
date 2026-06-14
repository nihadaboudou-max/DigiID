"use client";

/**
 * Page d'accueil de l'espace Citoyen.
 * Redirige vers le tableau de bord.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function AccueilCitoyen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/citoyen/dashboard");
  }, [router]);

  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <p className="text-ardoise-clair italic text-center py-12">
        Redirection vers le tableau de bord...
      </p>
    </EnvelopperEspaceProtege>
  );
}
