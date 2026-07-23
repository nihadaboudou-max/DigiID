"use client";

/**
 * Page redirigée vers /profil.
 * Le contenu a été fusionné dans la page profil (sans QR code statique).
 * Voir frontend/src/app/profil/page.tsx
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PagePartage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/profil");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-ardoise-clair italic">Redirection vers Mon Profil...</p>
    </div>
  );
}
