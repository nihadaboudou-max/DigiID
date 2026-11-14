"use client";

import { useEffect, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Carte } from "@/composants/commun/Carte";
import { PaginationListe } from "@/composants/logistique/PaginationListe";
import { TableauColis } from "@/composants/logistique/TableauColis";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import type { Colis } from "@/types/logistique";

export function ColisDuJour({
  gareId,
  baseSuivi,
  baseScan,
}: {
  gareId?: string | null;
  baseSuivi: string;
  baseScan?: string;
}) {
  const [colis, setColis] = useState<Colis[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    const maintenant = new Date();
    const debut = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      maintenant.getDate(),
    );
    const fin = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      maintenant.getDate() + 1,
    );

    setChargement(true);
    setErreur(null);
    logistiqueAPI.colis
      .lister({
        page,
        par_page: 5,
        cree_depuis: debut.toISOString(),
        cree_jusqu_a: fin.toISOString(),
        ...(gareId ? { gare_id: gareId } : {}),
      })
      .then((reponse) => {
        if (annule) return;
        setColis(reponse.elements);
        setTotal(reponse.total);
      })
      .catch((e: unknown) => {
        if (annule) return;
        setErreur(
          e instanceof ErreurAPI
            ? e.message_utilisateur
            : "Impossible de charger les colis du jour.",
        );
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });

    return () => {
      annule = true;
    };
  }, [gareId, page]);

  return (
    <Carte
      titre="Colis du jour"
      description="Colis enregistrés aujourd'hui."
    >
      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}
      {chargement ? (
        <p className="py-6 text-center text-sm italic text-ardoise-clair">
          Chargement des colis du jour…
        </p>
      ) : (
        <TableauColis
          colis={colis}
          cartesMobiles
          baseSuivi={baseSuivi}
          baseScan={baseScan}
          messageVide="Aucun colis enregistré aujourd'hui."
        />
      )}
      <PaginationListe
        page={page}
        total={total}
        parPage={5}
        chargement={chargement}
        surChangement={setPage}
      />
    </Carte>
  );
}
