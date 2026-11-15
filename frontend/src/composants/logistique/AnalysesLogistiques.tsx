"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { AnalyseDemandeLogistique } from "@/composants/logistique/AnalyseDemandeLogistique";
import { RecommandationTarifaire } from "@/composants/logistique/RecommandationTarifaire";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI, type AnalysesLogistiques as DonneesAnalyses } from "@/services/logistique_api";

export function AnalysesLogistiques({
  profil,
}: {
  profil: "chauffeur" | "receveur";
}) {
  const [analyses, setAnalyses] = useState<DonneesAnalyses | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      setAnalyses(null);
      try {
        const resultat = await logistiqueAPI.analyses.obtenir();
        if (annule) return;
        setAnalyses(resultat);
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
          {analyses && (
            <>
              <RecommandationTarifaire analyses={analyses} />
              <AnalyseDemandeLogistique analyses={analyses} />
            </>
          )}
        </>
      )}
    </div>
  );
}
