"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_COMMERCANT } from "@/composants/logistique/roles";

export default function PageCommercant() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={ROLES_COMMERCANT}
      modeCommercantRequis
    >
      <Redirection />
    </EnvelopperEspaceProtege>
  );
}

function Redirection() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/commercant/dashboard");
  }, [router]);

  return (
    <p className="py-12 text-center text-sm italic text-ardoise-clair">
      Ouverture de votre espace commerçant…
    </p>
  );
}
