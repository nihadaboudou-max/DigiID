"use client";

/**
 * Page index des activités — redirige vers la vue médicale par défaut.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function ActivitesIndex() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/activites/medical"); }, [router]);
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <p className="text-ardoise-clair italic text-center py-12">Redirection...</p>
    </EnvelopperEspaceProtege>
  );
}
