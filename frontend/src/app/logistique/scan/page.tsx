"use client";
/**
 * Compatibilité des anciens liens de scan vers le parcours propre au rôle.
 *
 * Cible du QR Code collé sur le colis : l'étiquette encode
 * `…/logistique/scan?token=<qr_token>`. En scannant l'étiquette avec la caméra
 * native du téléphone, l'agent ouvre directement cette page, s'authentifie
 * (le chemin est conservé), puis le colis est pré-rempli.
 *
 */
import { Suspense } from "react";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import {
  ROLES_SCAN_CHAUFFEUR,
  ROLES_SCAN_GUICHET,
} from "@/composants/logistique/roles";
import { useAuthentification } from "@/contextes/authentification";

export default function PageScanLogistique() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
        ...ROLES_SCAN_CHAUFFEUR,
        ...ROLES_SCAN_GUICHET,
      ]}
    >
      <Suspense
        fallback={
          <p className="text-ardoise-clair italic py-12 text-center">Chargement…</p>
        }
      >
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { utilisateur } = useAuthentification();
  const query = searchParams.toString();

  useEffect(() => {
    const destination =
      utilisateur?.role === "chauffeur"
        ? "/chauffeur/scan"
        : "/receveur/scan";
    router.replace(query ? `${destination}?${query}` : destination);
  }, [query, router, utilisateur?.role]);

  return (
    <p className="py-12 text-center text-sm italic text-ardoise-clair">
      Ouverture de votre espace logistique…
    </p>
  );
}
