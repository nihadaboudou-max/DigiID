"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { obtenirTokenAcces } from "@/services/client_api";

interface ProprietesPhotoProtegee {
  /** URL relative de la photo (ex: /api/v1/police/photo/{id}) */
  src?: string | null;
  alt?: string;
  className?: string;
  /** Affichage de secours (initiales, placeholder…) si photo absente ou indisponible */
  fallback?: ReactNode;
}

/**
 * Affiche une photo servie par un endpoint protégé par JWT.
 *
 * Une balise <img> classique ne peut pas envoyer l'en-tête Authorization,
 * on charge donc l'image via fetch (avec le token) puis on l'affiche
 * via une URL objet créée à la volée.
 */
export default function PhotoProtegee({
  src,
  alt = "Photo",
  className,
  fallback = null,
}: ProprietesPhotoProtegee) {
  const [url, setUrl] = useState<string | null>(null);
  const [indisponible, setIndisponible] = useState(false);

  useEffect(() => {
    let actif = true;
    if (!src) {
      setUrl(null);
      setIndisponible(false);
      return;
    }
    setUrl(null);
    setIndisponible(false);

    (async () => {
      try {
        const token = obtenirTokenAcces();
        const reponse = await fetch(src, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });
        if (!reponse.ok) throw new Error("photo indisponible");
        const blob = await reponse.blob();
        if (actif) {
          setUrl(URL.createObjectURL(blob));
        }
      } catch {
        if (actif) setIndisponible(true);
      }
    })();

    return () => {
      actif = false;
    };
  }, [src]);

  if (!src || indisponible || !url) {
    return <>{fallback}</>;
  }

  return <img src={url} alt={alt} className={className} />;
}
