"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Ancienne page /tableau-de-bord redirigée vers /citoyen/dashboard.
 * Le contenu a été déplacé dans /citoyen/dashboard.
 */
export default function PageTableauDeBord() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/citoyen/dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-ardoise-clair italic">Redirection vers le tableau de bord...</p>
    </div>
  );
}
