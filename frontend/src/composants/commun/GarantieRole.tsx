"use client";

/**
 * Composant de protection — redirige si l'utilisateur n'a pas le bon rôle.
 * À placer en haut des pages protégées.
 *
 * Protection multi-couche :
 *  - Vérification au montage (useEffect)
 *  - Vérification au retour arrière (pageshow / BFCache)
 *  - Vérification au changement de stockage (storage, pour cross-tab)
 *
 * Attention : évite les boucles infinies — ne redirige pas si on est déjà sur
 * le chemin de destination (sinon router.push relance un rendu → nouvelle vérif).
 */
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useCallback, useRef } from "react";

import { useAuthentification } from "@/contextes/authentification";
import { obtenirTokenAcces } from "@/services/client_api";
import type { RoleUtilisateur } from "@/types/api";
import { cheminTableauDeBord } from "@/types/api";

interface ProprietesGarantie {
  rolesAutorises: RoleUtilisateur[];
  children: React.ReactNode;
}

export function GarantieRole({ rolesAutorises, children }: ProprietesGarantie) {
  const router = useRouter();
  const pathname = usePathname();
  const { utilisateur, chargement, estConnecte } = useAuthentification();
  const dejaRedirige = useRef(false);

  const verifierAuth = useCallback(() => {
    if (chargement) return;

    if (!estConnecte || !obtenirTokenAcces()) {
      if (pathname !== "/connexion") {
        dejaRedirige.current = true;
        router.push("/connexion");
      }
      return;
    }

    if (utilisateur && !rolesAutorises.includes(utilisateur.role)) {
      const destination = cheminTableauDeBord(utilisateur.role);
      // 🛑 Évite la boucle : ne redirige pas si on est déjà sur la destination
      if (pathname !== destination && !dejaRedirige.current) {
        dejaRedirige.current = true;
        router.push(destination);
      }
      return;
    }

    // Tout va bien : on réinitialise le flag
    dejaRedirige.current = false;
  }, [chargement, estConnecte, utilisateur, rolesAutorises, router, pathname]);

  useEffect(() => {
    verifierAuth();

    // Détecte le retour arrière (BFCache)
    function gererPageshow(event: PageTransitionEvent) {
      if (event.persisted) {
        dejaRedirige.current = false;
        verifierAuth();
      }
    }
    window.addEventListener("pageshow", gererPageshow);

    // Détecte un changement de stockage (déconnexion depuis un autre onglet)
    function gererStockage(event: StorageEvent) {
      if (event.key === "digiid_token" && !event.newValue) {
        dejaRedirige.current = false;
        verifierAuth();
      }
    }
    window.addEventListener("storage", gererStockage);

    return () => {
      window.removeEventListener("pageshow", gererPageshow);
      window.removeEventListener("storage", gererStockage);
    };
  }, [verifierAuth]);

  if (chargement) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <p className="text-ardoise-clair">Chargement...</p>
      </div>
    );
  }

  if (!estConnecte || !obtenirTokenAcces() || (utilisateur && !rolesAutorises.includes(utilisateur.role))) {
    return null;
  }

  return <>{children}</>;
}
