"use client";
/**
 * Enregistrer un **colis** depuis la route — espace chauffeur.
 *
 * Cas réel : un client monte en cours de trajet avec un colis. Le chauffeur
 * l'enregistre immédiatement depuis son téléphone — le car est **imposé** (le
 * sien), il n'a donc aucun identifiant à saisir, et l'enregistrement est tracé
 * comme « en route » (`mode_enregistrement = chauffeur_direct`).
 *
 * Le ticket et le QR sont générés comme au guichet : le destinataire pourra
 * suivre son colis, et le guichet encaissera les frais de service à l'arrivée.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";

import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeColis } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { EnregistrementColis } from "@/composants/logistique/EnregistrementColis";
import {
  AucunVoyageAffecte,
  EncartVoyageImpose,
  SelecteurMonVoyage,
  useMesVoyages,
} from "@/composants/logistique/MonVoyageDuJour";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { useAuthentification } from "@/contextes/authentification";

export default function PageNouveauColisChauffeur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Suspense
        fallback={
          <p className="py-12 text-center italic text-ardoise-clair">Chargement.</p>
        }
      >
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const { voyages, lignes, chargement, erreur } = useMesVoyages();
  const [voyageId, setVoyageId] = useState("");

  // Un seul car ⇒ il est choisi d'office (le chauffeur n'a rien à faire).
  useEffect(() => {
    if (!voyageId && voyages.length === 1) setVoyageId(voyages[0].id);
  }, [voyages, voyageId]);

  const voyage = voyages.find((v) => v.id === voyageId) ?? null;

  return (
    <div className="space-y-5 apparition">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ardoise">
            Enregistrer un colis en route
          </h1>
          <p className="text-sm text-ardoise-clair">
            Un client monte avec un colis ? Créez sa fiche tout de suite : le car
            est déjà renseigné, le ticket part à l&apos;impression.
          </p>
        </div>
        <Link href="/chauffeur/dashboard">
          <Bouton variante="ghost" taille="petit">
            ← Mes voyages
          </Bouton>
        </Link>
      </div>

      {erreur && (
        <Carte>
          <p className="text-sm text-terre">{erreur}</p>
        </Carte>
      )}

      {chargement ? (
        <p className="py-12 text-center italic text-ardoise-clair">
          Chargement de vos cars…
        </p>
      ) : voyages.length === 0 ? (
        <AucunVoyageAffecte />
      ) : (
        <>
          <SelecteurMonVoyage
            voyages={voyages}
            lignes={lignes}
            valeur={voyageId}
            surChangement={setVoyageId}
          />

          {voyage ? (
            <>
              <EncartVoyageImpose voyage={voyage} lignes={lignes} />
              <EnregistrementColis
                voyageImposeId={voyage.id}
                chauffeurImposeId={utilisateur?.id}
                enregistrementDirect
              />
            </>
          ) : (
            <Carte>
              <p className="flex items-center gap-2 text-sm text-ardoise-clair">
                <IconeColis className="h-4 w-4" />
                Choisissez d&apos;abord votre car ci-dessus : le colis y sera
                rattaché et le chauffeur renseigné automatiquement.
              </p>
            </Carte>
          )}
        </>
      )}
    </div>
  );
}
