"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { AnalyseDemandeLogistique } from "@/composants/logistique/AnalyseDemandeLogistique";
import { RecommandationTarifaire } from "@/composants/logistique/RecommandationTarifaire";
import { ErreurAPI } from "@/services/client_api";
import { identiteAPI } from "@/services/identite_api";
import { logistiqueAPI, type Vehicule, type Voyage } from "@/services/logistique_api";
import type { Colis } from "@/types/logistique";

export function AnalysesLogistiques({
  profil,
}: {
  profil: "chauffeur" | "receveur";
}) {
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [colis, setColis] = useState<Colis[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [passagersParVoyage, setPassagersParVoyage] = useState<Record<string, number>>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const [reponseVoyages, reponseColis, listeVehicules, voyagesChauffeur] =
          await Promise.all([
            logistiqueAPI.voyages.lister({ page: 1, par_page: 100 }),
            logistiqueAPI.colis.lister({ page: 1, par_page: 100 }),
            profil === "chauffeur"
              ? logistiqueAPI.vehicules.listerMesVehicules()
              : logistiqueAPI.vehicules
                  .lister({ page: 1, par_page: 100 })
                  .then((reponse) => reponse.elements),
            profil === "chauffeur" ? identiteAPI.chauffeur.voyages() : Promise.resolve([]),
          ]);
        if (annule) return;
        setVoyages(reponseVoyages.elements);
        setColis(reponseColis.elements);
        setVehicules(listeVehicules);
        setPassagersParVoyage(
          Object.fromEntries(
            voyagesChauffeur.map((voyage) => [voyage.id, voyage.nb_passagers]),
          ),
        );
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger les analyses logistiques.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [profil]);

  const cheminTableau = profil === "chauffeur" ? "/chauffeur/dashboard" : "/receveur/dashboard";

  return (
    <div className="space-y-5 apparition">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ocre">
            Logistique
          </p>
          <h1 className="mt-1 text-2xl font-bold text-ardoise">
            Analyses et recommandations
          </h1>
        </div>
        <Link href={cheminTableau}>
          <Bouton variante="ghost" taille="petit">
            Retour au tableau de bord
          </Bouton>
        </Link>
      </header>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}
      {chargement ? (
        <p className="py-8 text-center text-sm italic text-ardoise-clair">
          Chargement des analyses…
        </p>
      ) : (
        <>
          <RecommandationTarifaire
            voyages={voyages}
            colis={colis}
            vehicules={vehicules}
            passagersParVoyage={passagersParVoyage}
          />
          <AnalyseDemandeLogistique colis={colis} vehicules={vehicules} />
        </>
      )}
    </div>
  );
}
