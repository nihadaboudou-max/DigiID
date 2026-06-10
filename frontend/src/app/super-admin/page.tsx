"use client";

/**
 * Page d'accueil de l'espace super administrateur.
 * Redirige vers le tableau de bord après vérification du rôle.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function AccueilSuperAdmin() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/super-admin/tableau-de-bord");
  }, [router]);

  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <div className="space-y-8 apparition py-12">
        <p className="text-ardoise-clair italic text-center">
          Redirection vers le tableau de bord...
        </p>
      </div>
    </EnvelopperEspaceProtege>
  );
}
