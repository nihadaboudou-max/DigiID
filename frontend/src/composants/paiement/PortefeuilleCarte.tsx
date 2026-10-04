"use client";
/**
 * Carte « Ma cagnotte » (S6) — solde du portefeuille + derniers mouvements.
 *
 * Réutilisée sur les tableaux de bord (receveur, chauffeur, commerçant) et sur
 * la page dédiée `/receveur/cagnotte`. Le receveur y voit les commissions
 * (25 FCFA) créditées à chaque colis enregistré.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconePortefeuille } from "@/composants/commun/Icones";
import { formaterDateHeure, formaterFcfa } from "@/composants/logistique/format";
import { ErreurAPI } from "@/services/client_api";
import { paiementAPI } from "@/services/paiement_api";
import {
  LIBELLES_MOTIF,
  type MouvementPortefeuille,
  type Portefeuille,
} from "@/types/paiement";

interface Proprietes {
  /** Nombre de mouvements récents affichés (0 = aucun). */
  limiteMouvements?: number;
  /** Affiche un lien « Voir ma cagnotte ». */
  afficherLien?: boolean;
  /** Chemin de la page cagnotte (selon le rôle). */
  cheminCagnotte?: string;
}

export function PortefeuilleCarte({
  limiteMouvements = 3,
  afficherLien = true,
  cheminCagnotte = "/receveur/cagnotte",
}: Proprietes) {
  const [portefeuille, setPortefeuille] = useState<Portefeuille | null>(null);
  const [mouvements, setMouvements] = useState<MouvementPortefeuille[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const pf = await paiementAPI.portefeuilles.moi();
      setPortefeuille(pf);
      if (limiteMouvements > 0) {
        const reponse = await paiementAPI.portefeuilles.mesMouvements({
          par_page: limiteMouvements,
        });
        setMouvements(reponse.elements);
      }
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger la cagnotte.",
      );
    } finally {
      setChargement(false);
    }
  }, [limiteMouvements]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <Carte>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-lagune/10 text-lagune flex items-center justify-center flex-shrink-0">
            <IconePortefeuille className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold">
              Ma cagnotte
            </p>
            <p className="text-2xl font-bold text-lagune">
              {chargement
                ? "…"
                : formaterFcfa(portefeuille?.solde_fcfa ?? 0)}
            </p>
          </div>
        </div>
        {afficherLien && (
          <Link href={cheminCagnotte}>
            <Bouton variante="ghost" taille="petit">
              Détail →
            </Bouton>
          </Link>
        )}
      </div>

      {portefeuille?.maj_le && (
        <p className="text-xs text-ardoise-clair mt-2">
          Dernier mouvement : {formaterDateHeure(portefeuille.maj_le)}
        </p>
      )}

      {erreur && (
        <div className="mt-3">
          <Alerte variante="erreur" titre="Cagnotte indisponible">
            {erreur}
          </Alerte>
        </div>
      )}

      {!erreur && limiteMouvements > 0 && (
        <ul className="mt-4 space-y-2">
          {chargement && (
            <li className="text-sm text-ardoise-clair italic">
              Chargement des mouvements…
            </li>
          )}
          {!chargement && mouvements.length === 0 && (
            <li className="text-sm text-ardoise-clair italic">
              Aucun mouvement pour l&apos;instant — enregistrez un colis pour
              recevoir votre première commission.
            </li>
          )}
          {mouvements.map((mouvement) => (
            <li
              key={mouvement.id}
              className="flex items-center justify-between gap-3 text-sm border-b border-ardoise-clair/10 pb-1.5 last:border-0"
            >
              <span className="text-ardoise-clair">
                {LIBELLES_MOTIF[mouvement.motif] ?? mouvement.motif}
              </span>
              <span
                className={
                  mouvement.sens === "CREDIT"
                    ? "font-semibold text-green-700"
                    : "font-semibold text-terre"
                }
              >
                {mouvement.sens === "CREDIT" ? "+" : "−"}
                {formaterFcfa(mouvement.montant_fcfa)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Carte>
  );
}
