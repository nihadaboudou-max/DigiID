"use client";
/**
 * ActionsVoyageChauffeur — les 3 gestes groupés du chauffeur (P0 ajusté).
 *
 * Sur la route, un chauffeur ne peut pas scanner 40 QR un par un. On lui donne
 * donc **un seul bouton** par étape, qui traite **à la fois** les passagers et
 * les colis du voyage :
 *
 *   1. « Valider le Départ »       → tous les passagers + colis passent en route.
 *   2. « Prévenir de l'approche »  → SMS de pré-alerte (familles, proches,
 *      destinataires) ~45 min avant l'arrivée, pour qu'ils se déplacent à temps.
 *   3. « Arrivés »                 → colis/passagers de l'arrêt (ou gare) ciblé.
 *
 * Chaque action reste traçable (un événement par passager/colis) et idempotente.
 * Garde-fous UI : pas d'action sur un car vide, et boutons alignés sur le statut.
 */
import { useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ModalConfirmation } from "@/composants/commun/ModalConfirmation";
import { IconeCheck, IconeCloche } from "@/composants/commun/Icones";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import type { StatutVoyage } from "@/types/logistique";

type Action = "depart" | "approche" | "arrivee";

/** Point de descente proposé pour « Arrivés » (arrêt intermédiaire ou terminus). */
export interface PointArrivee {
  /** Clé unique : `arret:{id}` ou `gare:{id}`. */
  cle: string;
  libelle: string;
  arret_id?: string | null;
  gare_id?: string | null;
}

interface Props {
  voyageId: string;
  /** Date planifiée, utilisée pour empêcher un départ avant le jour prévu. */
  dateDepart: string;
  /** Statut courant du voyage — pilote quels boutons sont actifs. */
  statut: StatutVoyage | string;
  /** Nombre de colis non annulés à bord. */
  nbColis: number;
  /** Nombre de passagers non annulés à bord. */
  nbPassagers: number;
  /** Gares connues du voyage (repli si pas d'arrêts structurés). */
  gares?: { id: string; nom: string }[];
  /** Arrêts ordonnés + terminus — prioritaire pour cibler « Arrivés ». */
  pointsArrivee?: PointArrivee[];
  /** Appelé après une action réussie (rafraîchit les listes). */
  surSucces?: () => void;
}

const CONFIG: Record<
  Action,
  { titre: string; description: string; messageAlerte: string; texteBouton: string }
> = {
  depart: {
    titre: "Valider le Départ ?",
    description: "Tous les passagers et colis de ce voyage seront marqués en route.",
    messageAlerte:
      "Un SMS de départ sera envoyé aux familles et aux destinataires. Cette action s'applique au voyage entier.",
    texteBouton: "Valider le départ",
  },
  approche: {
    titre: "Prévenir de l'approche ?",
    description:
      "Les familles, proches et destinataires seront prévenus (SMS) que le bus approche.",
    messageAlerte:
      "Envoyez cette pré-alerte environ 45 minutes à 1 heure avant l'arrivée, pour que chacun se rende à la gare.",
    texteBouton: "Envoyer la pré-alerte",
  },
  arrivee: {
    titre: "Marquer arrivés ?",
    description:
      "Les passagers et colis de l'arrêt (ou de la gare) sélectionné seront marqués arrivés.",
    messageAlerte:
      "Un SMS d'arrivée sera envoyé aux familles et aux destinataires concernés. Vous pouvez livrer directement ou confier colis/enfants au guichet si vous souhaitez qu'un agent le remette.",
    texteBouton: "Marquer arrivés",
  },
};

export function ActionsVoyageChauffeur({
  voyageId,
  dateDepart,
  statut,
  nbColis,
  nbPassagers,
  gares = [],
  pointsArrivee = [],
  surSucces,
}: Props) {
  const [action, setAction] = useState<Action | null>(null);
  const [pointCle, setPointCle] = useState<string>("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const chargeABord = nbColis + nbPassagers > 0;
  const voyageClos = statut === "termine" || statut === "annule";
  const dateDepartUtc = new Date(dateDepart);
  const jourDepartUtc = Number.isNaN(dateDepartUtc.getTime())
    ? null
    : dateDepartUtc.toISOString().slice(0, 10);
  const jourActuelUtc = new Date().toISOString().slice(0, 10);
  const jourDepartAtteint = jourDepartUtc !== null && jourActuelUtc >= jourDepartUtc;
  const peutDepart =
    chargeABord &&
    (statut === "en_cours" || (statut === "planifie" && jourDepartAtteint));
  const peutApproche = chargeABord && statut === "en_cours";
  const peutArrivee = chargeABord && statut === "en_cours";

  const optionsArrivee: PointArrivee[] =
    pointsArrivee.length > 0
      ? pointsArrivee
      : gares.map((g) => ({
          cle: `gare:${g.id}`,
          libelle: g.nom,
          gare_id: g.id,
        }));

  async function confirmer() {
    if (!action) return;
    if (action === "depart" && statut === "planifie" && !jourDepartAtteint) {
      setErreur("Le départ ne peut être validé qu'à partir du jour planifié.");
      setAction(null);
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      if (action === "depart") {
        const r = await logistiqueAPI.voyages.validerDepart(voyageId, {});
        setSucces(r.message);
      } else if (action === "approche") {
        const r = await logistiqueAPI.voyages.preAlerte(voyageId, {});
        setSucces(r.message);
      } else {
        const point = optionsArrivee.find((p) => p.cle === pointCle);
        const r = await logistiqueAPI.voyages.marquerArrivee(voyageId, {
          arret_id: point?.arret_id ?? null,
          gare_id: point?.arret_id ? null : (point?.gare_id ?? null),
        });
        setSucces(r.message);
      }
      setAction(null);
      surSucces?.();
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "L'action n'a pas pu être appliquée. Réessayez.",
      );
    } finally {
      setChargement(false);
    }
  }

  const config = action ? CONFIG[action] : null;

  return (
    <Carte
      titre="Actions groupées"
      description="Un seul geste pour tous les passagers et colis du voyage."
    >
      <div className="space-y-4">
        {erreur && (
          <Alerte variante="erreur" titre="Action impossible">
            {erreur}
          </Alerte>
        )}
        {succes && (
          <Alerte variante="succes" titre="C'est fait">
            {succes}
          </Alerte>
        )}

        {!chargeABord && !voyageClos && (
          <Alerte variante="info" titre="Car vide">
            Aucun passager ni colis à bord pour l&apos;instant. Les actions
            (départ, pré-alerte, arrivée) s&apos;activeront dès qu&apos;un
            chargement est affecté à ce voyage.
          </Alerte>
        )}

        {statut === "planifie" && !jourDepartAtteint && (
          <Alerte variante="avertissement" titre="Départ pas encore autorisé">
            Ce voyage est planifié pour le{" "}
            {jourDepartUtc
              ? new Intl.DateTimeFormat("fr-FR", {
                  dateStyle: "long",
                  timeZone: "UTC",
                }).format(dateDepartUtc)
              : "une date invalide"}
            . Vous pourrez valider le départ à partir de ce jour.
          </Alerte>
        )}

        {voyageClos && (
          <Alerte variante="info" titre="Voyage clos">
            Ce voyage est « {statut} » : plus aucune action groupée n&apos;est
            possible.
          </Alerte>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Bouton
            variante="succes"
            disabled={!peutDepart}
            onClick={() => {
              setSucces(null);
              setAction("depart");
            }}
          >
            <IconeCheck className="h-4 w-4" /> Valider le Départ
          </Bouton>
          <Bouton
            variante="secondaire"
            disabled={!peutApproche}
            onClick={() => {
              setSucces(null);
              setAction("approche");
            }}
          >
            <IconeCloche className="h-4 w-4" /> Prévenir de l&apos;approche
          </Bouton>
          <Bouton
            variante="primaire"
            disabled={!peutArrivee}
            onClick={() => {
              setSucces(null);
              setAction("arrivee");
            }}
          >
            <IconeCheck className="h-4 w-4" /> Arrivés
          </Bouton>
        </div>

        {optionsArrivee.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ardoise">
              Arrêt / gare pour « Arrivés »
            </label>
            <select
              className="champ-saisie"
              value={pointCle}
              onChange={(e) => setPointCle(e.target.value)}
              disabled={!peutArrivee}
            >
              <option value="">Tous les arrêts du voyage</option>
              {optionsArrivee.map((p) => (
                <option key={p.cle} value={p.cle}>
                  {p.libelle}
                </option>
              ))}
            </select>
            <p className="text-xs italic text-ardoise-clair">
              Choisissez l&apos;arrêt où vous êtes : seuls les colis et passagers
              destinés à cet arrêt passent « arrivés ». Ensuite seulement, dépôt
              au guichet (colis / enfants).
            </p>
          </div>
        )}
      </div>

      <ModalConfirmation
        ouvert={action !== null}
        titre={config?.titre ?? ""}
        description={config?.description}
        messageAlerte={config?.messageAlerte}
        varianteAlerte="avertissement"
        texteBoutonConfirmer={config?.texteBouton ?? "Confirmer"}
        couleurBoutonConfirmer="succes"
        chargement={chargement}
        surAnnulation={() => setAction(null)}
        surConfirmation={confirmer}
      />
    </Carte>
  );
}
