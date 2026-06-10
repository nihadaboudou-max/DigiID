"use client";

/**
 * Page Identité → Double Authentification (2FA).
 * Redirige vers la page 2FA existante dans les paramètres.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function PageIdentite2FA() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/parametres/2fa");
  }, [router]);

  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
        "citoyen", "agent", "medecin", "police", "ong",
        "administrateur", "super_administrateur",
      ]}
    >
      <div className="flex items-center justify-center py-20">
        <p className="text-ardoise-clair italic">Redirection vers la configuration 2FA...</p>
      </div>
    </EnvelopperEspaceProtege>
  );
}
