"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_GERANT_GARE } from "@/composants/logistique/roles";
import { ErreurAPI } from "@/services/client_api";
import { gareDeLActeur, logistiqueAPI, type Vehicule } from "@/services/logistique_api";
import { AnalyseDemandeLogistique } from "@/composants/logistique/AnalyseDemandeLogistique";
import { useAuthentification } from "@/contextes/authentification";
import type { Colis } from "@/types/logistique";

export default function PageTableauDeBordGérant() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GERANT_GARE}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [colis, setColis] = useState<Colis[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    void Promise.all([
      logistiqueAPI.vehicules.lister(),
      utilisateur?.id ? gareDeLActeur(utilisateur.id) : Promise.resolve(null),
    ])
      .then(async ([reponse, gare]) => {
        if (annule) return;
        setVehicules(reponse.elements);
        const colisGare = await logistiqueAPI.colis.lister(
          gare ? { gare_id: gare.id, par_page: 100 } : { par_page: 100 },
        );
        if (!annule) setColis(colisGare.elements);
      })
      .catch((e: unknown) => {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger le parc de la gare. Réessayez.",
          );
        }
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [utilisateur?.id]);

  const vehiculesActifs = vehicules.filter((vehicule) => vehicule.actif);
  const sansChauffeur = vehiculesActifs.filter(
    (vehicule) => vehicule.chauffeur_id === null,
  );

  return (
    <div className="space-y-6 apparition">
      <header>
        <h1 className="text-2xl font-bold text-ardoise">Supervision de gare</h1>
        <p className="mt-1 text-sm text-ardoise-clair">
          Gérez le parc roulant et vérifiez les affectations des chauffeurs.
          L&apos;enregistrement des colis et la remise aux familles restent des
          opérations du receveur.
        </p>
      </header>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Indicateur
          titre="Cars actifs"
          nombre={chargement ? "…" : String(vehiculesActifs.length)}
        />
        <Indicateur
          titre="Affectés à un chauffeur"
          nombre={
            chargement
              ? "…"
              : String(vehiculesActifs.length - sansChauffeur.length)
          }
        />
        <Indicateur
          titre="À affecter"
          nombre={chargement ? "…" : String(sansChauffeur.length)}
        />
      </div>

      <AnalyseDemandeLogistique colis={colis} vehicules={vehicules} />

      <Carte titre="Parc roulant" description="Une affectation claire évite qu'un chauffeur engage le car d'un collègue.">
        <p className="mb-4 text-sm text-ardoise-clair">
          {chargement
            ? "Chargement du parc roulant…"
            : `${vehicules.length} car${vehicules.length > 1 ? "s" : ""} référencé${vehicules.length > 1 ? "s" : ""}.`}
        </p>
        <Link href="/gerant-gare/vehicules">
          <Bouton variante="primaire">Gérer les cars et chauffeurs</Bouton>
        </Link>
      </Carte>
    </div>
  );
}

function Indicateur({ titre, nombre }: { titre: string; nombre: string }) {
  return (
    <div className="carte py-4 text-center">
      <p className="text-2xl font-bold text-lagune">{nombre}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
        {titre}
      </p>
    </div>
  );
}
