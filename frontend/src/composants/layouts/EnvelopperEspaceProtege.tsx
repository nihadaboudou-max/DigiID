"use client";

/**
 * Wrapper standardisé pour toutes les pages des espaces protégés.
 * Protection par rôle + en-tête + barre latérale + zone de contenu aérée.
 */
import type { ReactNode } from "react";

import { EnTete } from "@/composants/layouts/EnTete";
import { BarreLaterale } from "@/composants/layouts/BarreLaterale";
import { GarantieRole } from "@/composants/commun/GarantieRole";
import type { RoleUtilisateur } from "@/types/api";

interface ProprietesEnveloppe {
  rolesAutorises: RoleUtilisateur[];
  children: ReactNode;
}

export function EnvelopperEspaceProtege({
  rolesAutorises,
  children,
}: ProprietesEnveloppe) {
  return (
    <GarantieRole rolesAutorises={rolesAutorises}>
      <div className="min-h-screen flex flex-col bg-sable-clair">
        <EnTete />
        <div className="flex flex-1">
          <BarreLaterale />
          <main className="flex-1 min-w-0">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </GarantieRole>
  );
}
