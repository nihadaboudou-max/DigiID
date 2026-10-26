"use client";
/**
 * ManifesteVoyage — la « feuille de route » du chauffeur.
 *
 * Un seul écran, imprimable, qui liste **tout ce qui est à bord** : colis et
 * passagers, avec les coordonnées **masquées** (le chauffeur n'a pas besoin de
 * connaître par cœur le numéro des familles ; il appelle depuis le central ou
 * depuis la fiche du ticket au moment utile).
 *
 * C'est ce document qui rend le trajet vérifiable : si un sac manque à l'arrivée,
 * on sait exactement ce qui avait été embarqué.
 */
import { useCallback, useEffect, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ErreurAPI } from "@/services/client_api";
import { imprimer } from "@/services/impression";
import { identiteAPI } from "@/services/identite_api";
import { logistiqueAPI } from "@/services/logistique_api";
import type { LigneManifeste, ManifesteVoyage as TypeManifeste } from "@/types/identite";
import { LIBELLES_MODE_ENREGISTREMENT } from "@/types/logistique";

interface Proprietes {
  voyageId: string;
  /** Change cette valeur pour forcer un rechargement (après un ajout). */
  rafraichir?: number;
  /** Rendu compact quand le manifeste est intégré à un écran déjà chargé. */
  compact?: boolean;
}

export function ManifesteVoyage({
  voyageId,
  rafraichir = 0,
  compact = false,
}: Proprietes) {
  const [manifeste, setManifeste] = useState<TypeManifeste | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setManifeste(await identiteAPI.chauffeur.manifeste(voyageId));
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger le manifeste.",
      );
    } finally {
      setChargement(false);
    }
  }, [voyageId]);

  useEffect(() => {
    void charger();
  }, [charger, rafraichir]);

  /**
   * Prise en charge / dépôt au guichet — gestes du **chauffeur uniquement**.
   *
   * La remise finale au destinataire reste au guichet : le chauffeur dépose,
   * le guichet constate. On rafraîchit ensuite le manifeste pour que l'arrêt
   * suivant ne contienne plus le colis déjà descendu.
   */
  async function agir(ligne: LigneManifeste, type: "reception" | "remise") {
    const cle = `${ligne.type}-${ligne.id}-${type}`;
    setActionEnCours(cle);
    setErreur(null);
    try {
      if (ligne.type === "colis") {
        if (type === "reception") await logistiqueAPI.colis.confirmerReception(ligne.id);
        else await logistiqueAPI.colis.remettreGuichet(ligne.id);
      } else if (type === "reception") {
        await logistiqueAPI.suiviFamilial.confirmerReception(ligne.id);
      } else {
        await logistiqueAPI.suiviFamilial.remettreGuichet(ligne.id);
      }
      await charger();
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible d'enregistrer ce geste.",
      );
    } finally {
      setActionEnCours(null);
    }
  }

  return (
    <Carte
      titre="Manifeste du voyage"
      description="Tout ce qui est à bord, en une feuille — à imprimer si besoin."
    >
      {chargement ? (
        <p className="text-sm text-ardoise-clair italic py-6 text-center">
          Chargement du manifeste…
        </p>
      ) : erreur || !manifeste ? (
        <Alerte variante="erreur" titre="Manifeste indisponible">
          {erreur ?? "Aucune donnée."}
        </Alerte>
      ) : (
        // Zone d'impression : le manifeste se vide de tout le reste à
        // l'impression (et n'est jamais coupé au milieu d'une page).
        <div className={`zone-impression ${compact ? "space-y-4" : "space-y-6"}`}>
          {/* Compteurs */}
          <div className="grid grid-cols-3 gap-3">
            <Compteur libelle="Colis" valeur={manifeste.nb_colis} />
            <Compteur libelle="Passagers" valeur={manifeste.nb_passagers} />
            <Compteur libelle="Sacs" valeur={manifeste.nb_bagages} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ardoise-clair">
              {manifeste.gare_depart_nom ?? "?"} → {manifeste.gare_arrivee_nom ?? "?"}
              {manifeste.vehicule_immatriculation
                ? ` · ${manifeste.vehicule_immatriculation}`
                : ""}
            </span>
            <Bouton
              variante="ghost"
              taille="petit"
              className="no-print"
              onClick={() => void imprimer()}
            >
              Imprimer le manifeste
            </Bouton>
          </div>

          {manifeste.colis.length === 0 && manifeste.passagers.length === 0 ? (
            <p className="text-sm italic text-ardoise-clair">
              Rien n&apos;est encore chargé sur ce voyage.
            </p>
          ) : (
            <div className="space-y-6">
              <TableauManifeste
                titre="Colis à bord"
                lignes={manifeste.colis}
                vide="Aucun colis embarqué."
                actionEnCours={actionEnCours}
                surAction={agir}
              />
              <TableauManifeste
                titre="Passagers à bord"
                lignes={manifeste.passagers}
                vide="Aucun passager enregistré."
                actionEnCours={actionEnCours}
                surAction={agir}
              />
            </div>
          )}

          <p className="text-xs text-ardoise-clair">
            Les numéros de téléphone sont volontairement masqués sur cette feuille :
            ils restent disponibles dans la fiche de chaque ticket.
          </p>
        </div>
      )}
    </Carte>
  );
}

function TableauManifeste({
  titre,
  lignes,
  vide,
  actionEnCours,
  surAction,
}: {
  titre: string;
  lignes: LigneManifeste[];
  vide: string;
  actionEnCours: string | null;
  surAction: (ligne: LigneManifeste, type: "reception" | "remise") => void;
}) {
  if (lignes.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-ardoise mb-2">{titre}</h4>
        <p className="text-sm italic text-ardoise-clair">{vide}</p>
      </div>
    );
  }

  // Regroupement par arrêt de descente : le chauffeur lit « ce qui descend à
  // Bohicon » d'un bloc, au lieu de parcourir une liste triée par heure de
  // saisie. Le terminus (ou l'absence d'arrêt) ferme la marche.
  const groupes = new Map<string, LigneManifeste[]>();
  for (const ligne of [...lignes].sort((a, b) => {
    const ordre = (a.arret_ordre ?? 10_000) - (b.arret_ordre ?? 10_000);
    return ordre !== 0 ? ordre : a.code.localeCompare(b.code);
  })) {
    const libelle = ligne.arret_nom ?? "Terminus / arrêt non précisé";
    groupes.set(libelle, [...(groupes.get(libelle) ?? []), ligne]);
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-ardoise mb-3">
        {titre} <span className="text-ardoise-clair">({lignes.length})</span>
      </h4>
      <div className="space-y-4">
        {[...groupes.entries()].map(([arret, lignesArret]) => (
          <div key={arret}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-lagune">
              Descente à {arret} <span className="text-ardoise-clair">({lignesArret.length})</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ardoise-clair/20 text-left text-xs uppercase tracking-wider text-ardoise-clair">
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Pour</th>
                    <th className="py-2 pr-3">Contact</th>
                    <th className="py-2 pr-3">Sacs</th>
                    <th className="py-2 pr-3">Origine</th>
                    <th className="py-2 pr-3">Statut</th>
                    <th className="py-2 pr-3 no-print">Gestes</th>
                  </tr>
                </thead>
                <tbody>
                  {lignesArret.map((ligne) => {
                    const cle = `${ligne.type}-${ligne.id}-reception`;
                    const cleRemise = `${ligne.type}-${ligne.id}-remise`;
                    return (
                      <tr
                        key={`${ligne.type}-${ligne.id}`}
                        className="border-b border-ardoise-clair/10"
                      >
                        <td className="py-2 pr-3 font-mono text-xs text-ardoise">
                          {ligne.code}
                        </td>
                        <td className="py-2 pr-3 text-ardoise">{ligne.libelle}</td>
                        <td className="py-2 pr-3 text-ardoise-clair">
                          {ligne.contact_masque ?? "—"}
                        </td>
                        <td className="py-2 pr-3 text-ardoise-clair">
                          {ligne.nombre_bagages}
                        </td>
                        <td className="py-2 pr-3">
                          <Badge
                            variante={
                              ligne.mode_enregistrement === "chauffeur_direct"
                                ? "ocre"
                                : "neutre"
                            }
                          >
                            {LIBELLES_MODE_ENREGISTREMENT[ligne.mode_enregistrement] ??
                              ligne.mode_enregistrement}
                          </Badge>
                        </td>
                        <td className="py-2 pr-3 text-ardoise-clair">
                          {ligne.statut}
                          {ligne.reception_confirmee && (
                            <span className="ml-2 text-xs text-green-700">✓ pris en charge</span>
                          )}
                          {ligne.remis_guichet && (
                            <span className="ml-2 text-xs text-lagune">✓ déposé au guichet</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 no-print">
                          <GestesManifeste
                            ligne={ligne}
                            actionEnCours={actionEnCours}
                            cleReception={cle}
                            cleRemise={cleRemise}
                            surAction={surAction}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Gestes chauffeur sur une ligne du manifeste.
 *
 * - « Prendre en charge » : ajouts mid-route ou confirmation individuelle.
 * - « Déposer au guichet » : uniquement **après arrivée** à destination.
 *   Colis : si le chauffeur ne livre pas lui-même.
 *   Passager enfant : si le responsable n'est pas à l'heure.
 *   Passager adulte : trajet terminé à l'arrivée — pas de dépôt guichet.
 */
function GestesManifeste({
  ligne,
  actionEnCours,
  cleReception,
  cleRemise,
  surAction,
}: {
  ligne: LigneManifeste;
  actionEnCours: string | null;
  cleReception: string;
  cleRemise: string;
  surAction: (ligne: LigneManifeste, type: "reception" | "remise") => void;
}) {
  if (!ligne.reception_confirmee) {
    return (
      <Bouton
        variante="ghost"
        taille="petit"
        chargement={actionEnCours === cleReception}
        onClick={() => surAction(ligne, "reception")}
      >
        Prendre en charge
      </Bouton>
    );
  }

  if (ligne.remis_guichet) {
    return (
      <span className="text-xs italic text-ardoise-clair">Au guichet</span>
    );
  }

  const adulteArrive =
    ligne.type === "passager" &&
    ligne.type_passager === "adulte" &&
    ligne.statut === "arrive";
  if (adulteArrive) {
    return (
      <span className="text-xs italic text-ardoise-clair">
        Trajet terminé
      </span>
    );
  }

  const peutDeposerAuGuichet =
    ligne.statut === "arrive" &&
    (ligne.type === "colis" || ligne.type_passager === "enfant");

  if (peutDeposerAuGuichet) {
    return (
      <Bouton
        variante="secondaire"
        taille="petit"
        chargement={actionEnCours === cleRemise}
        onClick={() => surAction(ligne, "remise")}
      >
        Déposer au guichet
      </Bouton>
    );
  }

  if (ligne.statut === "arrive") {
    return (
      <span className="text-xs italic text-ardoise-clair">Arrivé</span>
    );
  }

  return (
    <span className="text-xs italic text-ardoise-clair">
      En route — attendre « Arrivés »
    </span>
  );
}

function Compteur({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div className="rounded-xl bg-sable-clair py-3 text-center">
      <p className="text-xl font-bold text-ardoise">{valeur}</p>
      <p className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold mt-0.5">
        {libelle}
      </p>
    </div>
  );
}
