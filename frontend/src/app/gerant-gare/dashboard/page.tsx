"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_GERANT_GARE } from "@/composants/logistique/roles";
import { ErreurAPI } from "@/services/client_api";
import {
  logistiqueAPI,
  type AnalysesLogistiques,
  type Vehicule,
} from "@/services/logistique_api";
import { AnalyseDemandeLogistique } from "@/composants/logistique/AnalyseDemandeLogistique";
import { IconeColis, IconeIdentite, IconeScan } from "@/composants/commun/Icones";

export default function PageTableauDeBordGérant() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GERANT_GARE}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [analyses, setAnalyses] = useState<AnalysesLogistiques | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    void Promise.all([
      logistiqueAPI.vehicules.lister(),
      logistiqueAPI.analyses.obtenir(),
    ])
      .then(([reponse, resultatAnalyses]) => {
        if (annule) return;
        setVehicules(reponse.elements);
        setAnalyses(resultatAnalyses);
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
  }, []);

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
          Vous pouvez aussi intervenir au guichet en cas de besoin.
        </p>
      </header>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      <div className="grid gap-3 sm:grid-cols-3">
        <LienAction href="/gerant-gare/colis/nouveau" libelle="Enregistrer un colis" Icone={IconeColis} />
        <LienAction href="/gerant-gare/passagers/nouveau" libelle="Enregistrer un passager" Icone={IconeIdentite} />
        <LienAction href="/gerant-gare/scan" libelle="Scanner en cas de litige" Icone={IconeScan} />
      </div>

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

      {analyses && <AnalyseDemandeLogistique analyses={analyses} />}

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

function LienAction({
  href,
  libelle,
  Icone,
}: {
  href: string;
  libelle: string;
  Icone: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="carte flex items-center gap-3 text-sm font-semibold text-ardoise hover:border-lagune/40"
    >
      <Icone className="h-5 w-5 text-lagune" />
      {libelle}
    </Link>
  );
}
