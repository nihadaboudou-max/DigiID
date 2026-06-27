"use client";

/**
 * Page Profil — Redirige vers le Tableau de bord (hub 4 menus).
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function PageProfil() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/tableau-de-bord");
  }, [router]);

  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <p className="text-ardoise-clair italic text-center py-20">Redirection vers le tableau de bord...</p>
    </EnvelopperEspaceProtege>
  );
}
