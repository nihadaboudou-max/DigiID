"use client";
/**
 * Enregistrement d'un enfant voyageant seul (guichet) — suivi familial (S7).
 */
import Link from "next/link";

import { Bouton } from "@/composants/commun/Bouton";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { EnregistrementSuiviFamilial } from "@/composants/logistique/EnregistrementSuiviFamilial";
import { ROLES_GUICHET_ECRITURE } from "@/composants/logistique/roles";

export default function PageNouveauSuiviFamilial() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET_ECRITURE}>
      <div className="space-y-5 apparition">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ardoise">
              Nouvel enfant suivi
            </h1>
            <p className="text-sm text-ardoise-clair">
              Enregistrez l&apos;enfant : le parent reçoit un SMS de confirmation,
              puis un SMS au départ et à l&apos;arrivée.
            </p>
          </div>
          <Link href="/receveur/suivi-familial">
            <Bouton variante="ghost" taille="petit">
              ← Retour à la liste
            </Bouton>
          </Link>
        </div>

        <EnregistrementSuiviFamilial />
      </div>
    </EnvelopperEspaceProtege>
  );
}
