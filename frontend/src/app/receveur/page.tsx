"use client";
/**
 * Point d'entrée de l'espace receveur (guichet logistique) → tableau de bord.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_GUICHET } from "@/composants/logistique/roles";

export default function PageReceveur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET}>
      <Redirection />
    </EnvelopperEspaceProtege>
  );
}

function Redirection() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/receveur/dashboard");
  }, [router]);
  return (
    <p className="text-ardoise-clair italic text-center py-12">
      Redirection vers le tableau de bord…
    </p>
  );
}
