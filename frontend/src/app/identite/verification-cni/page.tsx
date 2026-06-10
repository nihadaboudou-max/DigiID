"use client";

/**
 * Page Identité → Vérification CNI (Scan Carte d'Identité).
 * Redirige vers la page de scan CNI existante.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function PageIdentiteVerificationCNI() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/verification-cni");
  }, [router]);

  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
        "citoyen", "agent", "medecin", "police", "ong",
        "administrateur", "super_administrateur",
      ]}
    >
      <div className="flex items-center justify-center py-20">
        <p className="text-ardoise-clair italic">Redirection vers le scan CNI...</p>
      </div>
    </EnvelopperEspaceProtege>
  );
}
