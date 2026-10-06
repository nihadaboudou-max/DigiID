"use client";
/**
 * « Mon car du jour » — brique commune des écrans chauffeur.
 *
 * Un chauffeur n'a pas à choisir un voyage dans toute la base : il ne voit que
 * **les siens**, et c'est ce car qui est imposé lors d'un enregistrement en
 * route (le backend vérifie de son côté que le chauffeur connecté conduit bien
 * ce voyage). S'il n'a qu'un seul car, il est sélectionné d'office — moins de
 * gestes, moins d'erreurs, ce qui compte pour un utilisateur au volant.
 */
import { useEffect, useMemo, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Carte } from "@/composants/commun/Carte";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import {
  libelleLigne,
  logistiqueAPI,
  type Ligne,
  type Voyage,
} from "@/services/logistique_api";
import { formaterDate } from "./format";

export interface MesVoyages {
  voyages: Voyage[];
  lignes: Ligne[];
  chargement: boolean;
  erreur: string | null;
}

/** Voyages **du chauffeur connecté** (le référentiel des lignes sert aux libellés). */
export function useMesVoyages(): MesVoyages {
  const { utilisateur } = useAuthentification();
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const [reponseVoyages, reponseLignes] = await Promise.all([
          logistiqueAPI.voyages.lister({ par_page: 100 }),
          logistiqueAPI.lignes.lister().catch(() => ({ elements: [] as Ligne[] })),
        ]);
        if (annule) return;
        setVoyages(
          reponseVoyages.elements.filter(
            (voyage) => voyage.chauffeur_id === utilisateur?.id,
          ),
        );
        setLignes(reponseLignes.elements);
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger vos voyages. Réessayez plus tard.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [utilisateur?.id]);

  return { voyages, lignes, chargement, erreur };
}

/** Ligne (trajet) d'un voyage, ou `null` si la ligne n'est pas connue. */
export function ligneDuVoyage(voyage: Voyage | null, lignes: Ligne[]): Ligne | null {
  if (!voyage) return null;
  return lignes.find((l) => l.id === voyage.ligne_id) ?? null;
}

/** Sélecteur compact du car du jour (un seul voyage ⇒ présélectionné). */
export function SelecteurMonVoyage({
  voyages,
  lignes,
  valeur,
  surChangement,
}: {
  voyages: Voyage[];
  lignes: Ligne[];
  valeur: string;
  surChangement: (voyageId: string) => void;
}) {
  return (
    <Carte
      titre="Mon car du jour"
      description="Choisissez le car que vous conduisez : le colis ou le passager y sera rattaché automatiquement."
    >
      <select
        className="champ-saisie"
        value={valeur}
        onChange={(e) => surChangement(e.target.value)}
      >
        <option value="">— Choisir mon car —</option>
        {voyages.map((voyage) => (
          <option key={voyage.id} value={voyage.id}>
            {formaterDate(voyage.date_depart)} ·{" "}
            {libelleLigne(ligneDuVoyage(voyage, lignes) ?? undefined)}
            {voyage.vehicule_immatriculation ? ` · ${voyage.vehicule_immatriculation}` : ""}
          </option>
        ))}
      </select>
    </Carte>
  );
}

/** Aucun voyage affecté : on explique qui peut le faire, au lieu d'un écran vide. */
export function AucunVoyageAffecte() {
  return (
    <Alerte variante="info" titre="Aucun car ne vous est affecté">
      Un car doit d&apos;abord vous être attribué par le <strong>gérant de gare</strong>{" "}
      (Référentiel → Voyages → chauffeur du voyage). Dès qu&apos;un voyage vous est
      affecté, vous pouvez enregistrer vos clients en route depuis cet écran.
    </Alerte>
  );
}

/** Encart « car imposé » : rappel visuel permanent de l&apos;attribution retenue. */
export function EncartVoyageImpose({
  voyage,
  lignes,
}: {
  voyage: Voyage | null;
  lignes: Ligne[];
}) {
  const libelle = useMemo(() => {
    if (!voyage) return "—";
    const ligne = ligneDuVoyage(voyage, lignes);
    return [
      formaterDate(voyage.date_depart),
      libelleLigne(ligne ?? undefined),
      voyage.vehicule_immatriculation,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [voyage, lignes]);

  return (
    <div className="rounded-xl border border-ocre/30 bg-ocre/5 px-4 py-3 text-sm">
      <p className="font-medium text-ardoise">Car rattaché automatiquement</p>
      <p className="text-xs text-ardoise-clair">{libelle}</p>
    </div>
  );
}
