/**
 * Page Paramètres → Rôle & Permissions.
 * Redirige vers /identite/role pour éviter la duplication.
 */
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function PageParametresRole() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/identite/role");
  }, [router]);

  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
        "citoyen", "agent", "medecin", "police", "ong",
        "administrateur", "super_administrateur",
      ]}
    >
      <p className="text-ardoise-clair italic text-center py-12">
        Redirection vers la page Rôle & Permissions...
      </p>
    </EnvelopperEspaceProtege>
  );
}
