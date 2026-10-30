"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_GERANT_GARE } from "@/composants/logistique/roles";

export default function PageGérantGare() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GERANT_GARE}>
      <Redirection />
    </EnvelopperEspaceProtege>
  );
}

function Redirection() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/gerant-gare/dashboard");
  }, [router]);

  return (
    <p className="py-12 text-center italic text-ardoise-clair">
      Ouverture de la supervision de gare…
    </p>
  );
}
