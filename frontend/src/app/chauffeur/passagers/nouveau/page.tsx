"use client";
/**
 * Enregistrer un **passager** depuis la route — espace chauffeur (suivi familial).
 *
 * Un adulte qui monte en cours de trajet, ou un enfant confié au chauffeur par
 * un proche au bord de la route : le chauffeur crée la fiche depuis son
 * téléphone. Le parent/proche reçoit le SMS de confirmation puis, comme pour un
 * enregistrement au guichet, les SMS de départ et d'arrivée — c'est ce qui
 * rassure la famille, et c'est le cœur du suivi familial.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";

import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { IconeIdentite } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { EnregistrementSuiviFamilial } from "@/composants/logistique/EnregistrementSuiviFamilial";
import {
  AucunVoyageAffecte,
  EncartVoyageImpose,
  SelecteurMonVoyage,
  useMesVoyages,
} from "@/composants/logistique/MonVoyageDuJour";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { useAuthentification } from "@/contextes/authentification";

export default function PageNouveauPassagerChauffeur() {
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

  useEffect(() => {
    const ouverts = voyages.filter(
      (v) => v.statut !== "termine" && v.statut !== "annule",
    );
    if (!voyageId && ouverts.length === 1) setVoyageId(ouverts[0].id);
  }, [voyages, voyageId]);

  const voyage = voyages.find((v) => v.id === voyageId) ?? null;
  const voyagesOuverts = voyages.filter(
    (v) => v.statut !== "termine" && v.statut !== "annule",
  );
  const voyageClos = voyage?.statut === "termine" || voyage?.statut === "annule";

  return (
    <div className="space-y-5 apparition">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ardoise">
            Enregistrer un passager en route
          </h1>
          <p className="text-sm text-ardoise-clair">
            Adulte monté en cours de trajet ou enfant confié au bord de la route :
            créez la fiche maintenant, la famille est prévenue par SMS.
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
      ) : voyagesOuverts.length === 0 ? (
        <Alerte variante="info" titre="Aucun voyage ouvert">
          Tous vos voyages sont terminés ou annulés. Le formulaire d&apos;enregistrement
          de passager n&apos;est disponible que pour un voyage planifié ou en cours.
        </Alerte>
      ) : (
        <>
          <SelecteurMonVoyage
            voyages={voyagesOuverts}
            lignes={lignes}
            valeur={voyageId}
            surChangement={setVoyageId}
          />

          {voyageClos ? (
            <Alerte variante="avertissement" titre="Voyage terminé">
              Il n&apos;est plus possible d&apos;ajouter un passager à ce voyage.
              Sélectionnez un voyage planifié ou en cours.
            </Alerte>
          ) : voyage ? (
            <>
              <EncartVoyageImpose voyage={voyage} lignes={lignes} />
              <EnregistrementSuiviFamilial
                voyageImposeId={voyage.id}
                chauffeurImposeId={utilisateur?.id}
                enregistrementDirect
              />
            </>
          ) : (
            <Carte>
              <p className="flex items-center gap-2 text-sm text-ardoise-clair">
                <IconeIdentite className="h-4 w-4" />
                Choisissez d&apos;abord votre car ci-dessus : le passager y sera
                rattaché et le chauffeur renseigné automatiquement.
              </p>
            </Carte>
          )}
        </>
      )}
    </div>
  );
}
