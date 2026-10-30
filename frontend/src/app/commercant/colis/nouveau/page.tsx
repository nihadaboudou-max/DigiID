"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Carte } from "@/composants/commun/Carte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { EnregistrementColis } from "@/composants/logistique/EnregistrementColis";
import { ROLES_COMMERCANT } from "@/composants/logistique/roles";

export default function PageNouveauDepotCommercant() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={ROLES_COMMERCANT}
      modeCommercantRequis
    >
      <Suspense
        fallback={
          <p className="py-12 text-center italic text-ardoise-clair">Chargement…</p>
        }
      >
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const searchParams = useSearchParams();
  const digiid = searchParams.get("digiid") ?? undefined;

  return (
    <div className="space-y-6 apparition">
      <header>
        <h1 className="text-2xl font-bold text-ardoise">Enregistrer un dépôt client</h1>
        <p className="mt-1 text-sm text-ardoise-clair">
          Saisissez les coordonnées du destinataire et le trajet prévu. Imprimez le
          ticket et remettez-le au client ; le chauffeur et le guichet assurent le suivi
          du transport et la remise finale.
        </p>
      </header>

      <EnregistrementColis digiidInitial={digiid} attributionFacultative />

      <Carte variante="pointilles">
        <p className="text-xs text-ardoise-clair">
          Votre rôle s&apos;arrête à l&apos;enregistrement du dépôt. Ne confirmez pas
          les départs, les arrivées ou la remise au destinataire.
        </p>
      </Carte>
    </div>
  );
}
