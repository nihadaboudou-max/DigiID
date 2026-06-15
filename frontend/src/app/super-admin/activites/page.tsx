"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";

export default function SuperAdminActivitesIndex() {
  const router = useRouter();
  useEffect(() => { router.replace("/super-admin/activites/medical"); }, [router]);
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <p className="text-ardoise-clair italic text-center py-12">Redirection...</p>
    </EnvelopperEspaceProtege>
  );
}
