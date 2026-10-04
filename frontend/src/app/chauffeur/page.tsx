"use client";
/**
 * Point d'entrée de l'espace chauffeur (S4) → tableau de bord.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";

export default function PageChauffeur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Redirection />
    </EnvelopperEspaceProtege>
  );
}

function Redirection() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/chauffeur/dashboard");
  }, [router]);
  return (
    <p className="text-ardoise-clair italic text-center py-12">
      Redirection vers le tableau de bord…
    </p>
  );
}
