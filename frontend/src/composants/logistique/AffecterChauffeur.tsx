"use client";
/**
 * « Qui va transporter ceci ? » — affectation d'un colis ou d'un passager à un car.
 *
 * Le guichet enregistre souvent **avant de savoir** quel car partira (« le
 * prochain, ou celui de 15 h »). Cette carte permet de revenir compléter
 * l'attribution — ou de la corriger — sans jamais manipuler d'identifiant :
 * le receveur choisit un **chauffeur nommé**, l'identifiant technique suit.
 *
 * Le trajet déclaré filtre les cars proposés : on ne peut pas affecter un colis
 * Dakar → Thiès à un car Thiès → Dakar.
 */
import { useEffect, useMemo, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI, type Ligne, type Voyage } from "@/services/logistique_api";
import { SelectionVoyage } from "./SelectionVoyage";

interface Proprietes {
  /** Trajet déclaré de l'enregistrement : filtre les cars pertinents. */
  gareDepartId: string;
  gareArriveeId: string;
  /** Voyage actuellement affecté (null = « à affecter »). */
  voyageIdActuel: string | null;
  /** Nom du chauffeur actuellement affecté, pour l'affichage. */
  chauffeurNomActuel?: string | null;
  /** Appel API d'affectation (colis ou suivi familial). */
  surAffecter: (voyageId: string) => Promise<void>;
  /** Colis livré / passager arrivé : plus d'affectation possible. */
  desactive?: boolean;
  /** Message expliquant pourquoi c'est désactivé. */
  raisonDesactivation?: string;
}

export function AffecterChauffeur({
  gareDepartId,
  gareArriveeId,
  voyageIdActuel,
  chauffeurNomActuel,
  surAffecter,
  desactive = false,
  raisonDesactivation,
}: Proprietes) {
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [choix, setChoix] = useState<string>(voyageIdActuel ?? "");
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const [reponseVoyages, reponseLignes] = await Promise.all([
          logistiqueAPI.voyages.lister({ par_page: 100 }),
          logistiqueAPI.lignes.lister().catch(() => ({ elements: [] as Ligne[] })),
        ]);
        if (annule) return;
        setVoyages(reponseVoyages.elements);
        setLignes(reponseLignes.elements);
      } catch {
        if (!annule) {
          setErreur("Impossible de charger la liste des cars et de leurs chauffeurs.");
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    setChoix(voyageIdActuel ?? "");
  }, [voyageIdActuel]);

  const voyageChoisi = useMemo(
    () => voyages.find((v) => v.id === choix) ?? null,
    [voyages, choix],
  );

  async function affecter() {
    if (!choix) return;
    setErreur(null);
    setSucces(null);
    setEnregistrement(true);
    try {
      await surAffecter(choix);
      setSucces(
        voyageChoisi?.chauffeur_nom
          ? `Affecté à ${voyageChoisi.chauffeur_nom}.`
          : "Affectation enregistrée.",
      );
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Échec de l'affectation. Réessayez.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <Carte
      titre="Chauffeur & car"
      description="Choisissez le car : le chauffeur affecté au voyage en découle, et son nom apparaît sur le ticket."
      variante={voyageIdActuel ? "standard" : "accent"}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ardoise-clair">Situation actuelle :</span>
          {voyageIdActuel ? (
            <Badge variante="succes">
              {chauffeurNomActuel ? `Chauffeur : ${chauffeurNomActuel}` : "Affecté"}
            </Badge>
          ) : (
            <Badge variante="ocre">À affecter — aucun car désigné</Badge>
          )}
        </div>

        {erreur && (
          <Alerte variante="erreur" titre="Erreur">
            {erreur}
          </Alerte>
        )}
        {succes && (
          <Alerte variante="succes" titre="Affectation enregistrée">
            {succes}
          </Alerte>
        )}

        {desactive ? (
          <p className="rounded-lg border border-dashed border-ardoise-clair/40 px-3 py-3 text-sm text-ardoise-clair">
            {raisonDesactivation ??
              "Cet enregistrement est terminé : il ne peut plus être réaffecté."}
          </p>
        ) : chargement ? (
          <p className="text-sm italic text-ardoise-clair">Chargement des cars…</p>
        ) : (
          <>
            <SelectionVoyage
              mode="liste"
              voyages={voyages}
              lignes={lignes}
              valeur={choix}
              surSelection={(id) => {
                setChoix(id);
                setSucces(null);
              }}
              gareDepartId={gareDepartId}
              gareArriveeId={gareArriveeId}
              exigerChauffeur
              libelle="Cars disponibles sur ce trajet"
              aide="Un car sans chauffeur affecté ne peut pas être choisi : demandez au gérant de gare de désigner le chauffeur du voyage."
            />

            <div className="flex items-center justify-between gap-3 border-t border-ardoise-clair/20 pt-4">
              <p className="text-xs text-ardoise-clair">
                L&apos;affectation est tracée dans le suivi (qui a affecté, quand).
              </p>
              <Bouton
                variante="primaire"
                chargement={enregistrement}
                disabled={enregistrement || !choix || choix === voyageIdActuel}
                onClick={() => void affecter()}
              >
                {voyageIdActuel ? "Réaffecter" : "Affecter"}
              </Bouton>
            </div>
          </>
        )}
      </div>
    </Carte>
  );
}
