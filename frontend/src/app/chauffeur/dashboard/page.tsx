"use client";
/**
 * Tableau de bord du chauffeur (S4).
 *
 * Liste les voyages du chauffeur (ou tous les voyages pour la démo), avec le
 * nombre de colis à bord, et donne accès d'un clic à la liste des colis d'un
 * voyage et au scan en route.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeColis, IconeScan } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { formaterDate } from "@/composants/logistique/format";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import {
  libelleLigne,
  logistiqueAPI,
  type Ligne,
  type Voyage,
} from "@/services/logistique_api";
import {
  LIBELLES_STATUT_VOYAGE,
  VARIANTES_STATUT_VOYAGE,
  type Colis,
} from "@/types/logistique";

export default function PageTableauDeBordChauffeur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [colis, setColis] = useState<Colis[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [mesVoyagesSeulement, setMesVoyagesSeulement] = useState(true);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const [repVoyages, repLignes, repColis] = await Promise.all([
          logistiqueAPI.voyages.lister({ par_page: 100 }),
          logistiqueAPI.lignes.lister(),
          logistiqueAPI.colis.lister({ par_page: 100 }),
        ]);
        if (annule) return;
        setVoyages(repVoyages.elements);
        setLignes(repLignes.elements);
        setColis(repColis.elements);
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger les voyages. Réessayez plus tard.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  // N'affiche que les voyages affectés au chauffeur (sauf si l'option est décochée).
  const mesVoyages = useMemo(
    () => voyages.filter((v) => v.chauffeur_id === utilisateur?.id),
    [voyages, utilisateur?.id],
  );
  const voyagesAffiches = mesVoyagesSeulement ? mesVoyages : voyages;

  const lignesParId = useMemo(() => {
    const map: Record<string, Ligne> = {};
    lignes.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [lignes]);

  const nbColisParVoyage = useMemo(() => {
    const map: Record<string, number> = {};
    colis.forEach((c) => {
      if (c.voyage_id) map[c.voyage_id] = (map[c.voyage_id] ?? 0) + 1;
    });
    return map;
  }, [colis]);

  return (
    <div className="space-y-6 apparition">
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Espace chauffeur</h1>
        <p className="text-sm text-ardoise-clair">
          Vos voyages, les colis à bord et le scan en route.
        </p>
      </div>

      {/* Action rapide : scan */}
      <Link
        href="/chauffeur/scan"
        className="carte hover:border-ocre/40 hover:shadow-md transition-all duration-200 group block"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-ocre/15 text-ocre-fonce flex items-center justify-center flex-shrink-0 group-hover:bg-ocre group-hover:text-white transition-colors">
            <IconeScan className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-ardoise">Scanner un colis</p>
            <p className="text-xs text-ardoise-clair mt-0.5">
              Enregistrer un départ, une mise en transit ou une arrivée
            </p>
          </div>
        </div>
      </Link>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      {/* Liste des voyages */}
      <Carte
        titre="Mes voyages"
        description="Ouvrez un voyage pour voir la liste des colis à bord."
      >
        <label className="flex items-center gap-2 text-xs text-ardoise-clair mb-4">
          <input
            type="checkbox"
            checked={mesVoyagesSeulement}
            onChange={(e) => setMesVoyagesSeulement(e.target.checked)}
            className="rounded border-ardoise-clair/30"
          />
          Afficher uniquement les voyages qui me sont affectés
        </label>

        {chargement ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Chargement des voyages…
          </p>
        ) : voyagesAffiches.length === 0 ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            {mesVoyagesSeulement
              ? "Aucun voyage ne vous est affecté pour le moment. Décochez la case pour voir tous les voyages."
              : "Aucun voyage enregistré."}
          </p>
        ) : (
          <ul className="space-y-3">
            {voyagesAffiches.map((voyage) => (
              <CarteVoyage
                key={voyage.id}
                voyage={voyage}
                ligne={lignesParId[voyage.ligne_id]}
                nbColis={nbColisParVoyage[voyage.id] ?? 0}
                estMien={voyage.chauffeur_id === utilisateur?.id}
              />
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}

/** Carte d'un voyage : trajet, véhicule, date, statut et nombre de colis. */
function CarteVoyage({
  voyage,
  ligne,
  nbColis,
  estMien,
}: {
  voyage: Voyage;
  ligne: Ligne | undefined;
  nbColis: number;
  estMien: boolean;
}) {
  const statut = voyage.statut as keyof typeof LIBELLES_STATUT_VOYAGE;
  const variante = VARIANTES_STATUT_VOYAGE[statut] ?? "neutre";

  return (
    <li className="border border-ardoise-clair/10 rounded-xl p-4 hover:border-lagune/30 transition-colors">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ardoise">{libelleLigne(ligne)}</span>
            <Badge variante={variante}>
              {LIBELLES_STATUT_VOYAGE[statut] ?? voyage.statut}
            </Badge>
            {estMien && <Badge variante="lagune">Mon voyage</Badge>}
          </div>
          <p className="text-sm text-ardoise-clair mt-1">
            Départ : {formaterDate(voyage.date_depart)}
            {voyage.vehicule_immatriculation
              ? ` • Véhicule : ${voyage.vehicule_immatriculation}`
              : ""}
          </p>
          <p className="text-xs text-ardoise-clair mt-0.5">
            {nbColis} colis à bord
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/chauffeur/voyages/${voyage.id}`}>
            <Bouton variante="secondaire" taille="petit">
              <IconeColis className="w-4 h-4" /> Voir les colis
            </Bouton>
          </Link>
          <Link href={`/chauffeur/scan?voyage_id=${voyage.id}`}>
            <Bouton variante="primaire" taille="petit">
              <IconeScan className="w-4 h-4" /> Scanner
            </Bouton>
          </Link>
        </div>
      </div>
    </li>
  );
}
