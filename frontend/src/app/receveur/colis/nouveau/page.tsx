"use client";
/**
 * Enregistrement d'un colis au guichet (S3).
 *
 * Accepte un DigiID pré-rempli via l'URL (`?digiid=…`) : quand l'agent arrive
 * depuis la page `/guichet/carte` après avoir scanné la carte du client, la
 * fiche s'ouvre déjà remplie — aucune ressaisie, aucun risque de faute sur le
 * numéro de téléphone qui recevra le SMS.
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { Carte } from "@/composants/commun/Carte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { EnregistrementColis } from "@/composants/logistique/EnregistrementColis";
import { ROLES_GUICHET_ECRITURE } from "@/composants/logistique/roles";

export default function PageNouveauColis() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET_ECRITURE}>
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
  const searchParams = useSearchParams();
  const digiid = searchParams.get("digiid") ?? undefined;

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Enregistrer un colis</h1>
        <p className="text-sm text-ardoise-clair">
          Renseignez le destinataire et le trajet : un ticket avec QR Code sera généré.
        </p>
      </div>

      <EnregistrementColis digiidInitial={digiid} attributionFacultative />

      <Carte variante="pointilles">
        <p className="text-xs text-ardoise-clair">
          <strong className="text-ardoise">Astuce :</strong> si le client possède une
          carte DigiID, faites-la scanner (ou saisissez son DigiID) : son nom et son
          téléphone se remplissent tout seuls, et les SMS de suivi partiront vers le bon
          numéro. Après l&apos;enregistrement, imprimez le ticket et collez-le sur le
          colis.
        </p>
      </Carte>
    </div>
  );
}
