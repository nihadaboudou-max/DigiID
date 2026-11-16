"use client";
/**
 * ActionsVoyageChauffeur — les 3 gestes groupés du chauffeur (P0 ajusté).
 *
 * Sur la route, un chauffeur ne peut pas scanner 40 QR un par un. On lui donne
 * donc **un seul bouton** par étape, qui traite **à la fois** les passagers et
 * les colis du voyage :
 *
 *   1. « Valider le Départ »       → tous les passagers + colis passent en route.
 *   2. « Prévenir de l'approche »  → WhatsApp et notification plateforme aux
 *      personnes qui descendent à l'arrêt sélectionné.
 *   3. « Arrivés »                 → colis/passagers de l'arrêt (ou gare) ciblé.
 *
 * Chaque action reste traçable (un événement par passager/colis) et idempotente.
 * Garde-fous UI : pas d'action sur un car vide, et boutons alignés sur le statut.
 */
import { useState } from "react";
import Link from "next/link";

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
  /** Nombre de colis guichet qui attendent la confirmation du chauffeur. */
  nbColisAValider: number;
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
    description:
      "Les passagers et les colis reçus par le chauffeur seront marqués en route.",
    messageAlerte:
      "Un SMS de départ sera envoyé aux familles et aux destinataires. Cette action s'applique au voyage entier.",
    texteBouton: "Valider le départ",
  },
  approche: {
    titre: "Prévenir de l'approche ?",
    description:
      "Les personnes qui descendent à l'arrêt choisi seront prévenues par WhatsApp et dans la plateforme.",
    messageAlerte:
      "L'envoi WhatsApp est prioritaire. Un SMS est utilisé en secours s'il est configuré.",
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
  nbColisAValider,
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

  const optionsArrivee: PointArrivee[] =
    pointsArrivee.length > 0
      ? pointsArrivee
      : gares.map((g) => ({
          cle: `gare:${g.id}`,
          libelle: g.nom,
          gare_id: g.id,
        }));
  const selectionArriveeObligatoire = optionsArrivee.some((point) => point.arret_id);
  const selectionApprocheObligatoire = selectionArriveeObligatoire;
  const peutArrivee =
    chargeABord &&
    statut === "en_cours" &&
    (!selectionArriveeObligatoire || pointCle !== "");

  async function confirmer() {
    if (!action) return;
    if (action === "depart" && statut === "planifie" && !jourDepartAtteint) {
      setErreur("Le départ ne peut être validé qu'à partir du jour planifié.");
      setAction(null);
      return;
    }
    if (action === "arrivee" && selectionArriveeObligatoire && !pointCle) {
      setErreur("Choisissez l'arrêt où vous vous trouvez.");
      return;
    }
    if (action === "approche" && selectionApprocheObligatoire && !pointCle) {
      setErreur("Choisissez l'arrêt à prévenir.");
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      if (action === "depart") {
        const r = await logistiqueAPI.voyages.validerDepart(voyageId, {
          confirmer_colis_non_valides: nbColisAValider > 0,
        });
        setSucces(r.message);
      } else if (action === "approche") {
        const point = optionsArrivee.find((p) => p.cle === pointCle);
        const r = await logistiqueAPI.voyages.preAlerte(voyageId, {
          arret_id: point?.arret_id ?? null,
          gare_id: point?.arret_id ? null : (point?.gare_id ?? null),
        });
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
      if (action === "arrivee" && selectionArriveeObligatoire) {
        setPointCle("");
      }
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
  const descriptionAction =
    action === "depart" && nbColisAValider > 0
      ? `${nbColisAValider} colis non validé${nbColisAValider > 1 ? "s" : ""} ${
          nbColisAValider > 1 ? "seront retirés" : "sera retiré"
        } de ce voyage. Seuls les colis reçus par le chauffeur partiront en route.`
      : config?.description;

  return (
    <Carte
      titre="Étapes du départ et de l'arrivée"
      description="Suivez le voyage dans l'ordre : départ, approche, puis arrivée."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["1", "Départ", statut === "en_cours" || statut === "termine" ? "Validé" : "À faire"],
            ["2", "Approche", statut === "en_cours" ? "À envoyer" : "Après le départ"],
            ["3", "Arrivée", statut === "en_cours" ? "À faire à l'arrêt" : "Après le départ"],
          ].map(([numero, titre, etat]) => (
            <div
              key={numero}
              className="flex items-center gap-2 rounded-xl border border-ardoise-clair/15 bg-sable-clair/60 px-3 py-2"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lagune text-xs font-bold text-white">
                {numero}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ardoise">{titre}</span>
                <span className="block truncate text-xs text-ardoise-clair">{etat}</span>
              </span>
            </div>
          ))}
        </div>
        {erreur && (
          <Alerte variante="erreur" titre="Action impossible">
            {erreur}
          </Alerte>
        )}
        {nbColisAValider > 0 && (
          <Alerte variante="avertissement" titre="Colis à valider">
            {nbColisAValider} colis{" "}
            {nbColisAValider === 1 ? "est" : "sont"} à valider avant le départ.{" "}
            <Link
              href="/chauffeur/colis#onglet-a-valider"
              className="font-semibold underline underline-offset-2"
            >
              Les valider maintenant
            </Link>
            .
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

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Bouton
            variante="succes"
            disabled={!peutDepart}
            onClick={() => {
              setSucces(null);
              setAction("depart");
            }}
          >
            <IconeCheck className="h-4 w-4" /> 1. Valider le départ
            {nbColisAValider > 0 ? ` (${nbColisAValider} à valider)` : ""}
          </Bouton>
          <Bouton
            variante="secondaire"
            disabled={!peutApproche}
            onClick={() => {
              setSucces(null);
              setPointCle("");
              setAction("approche");
            }}
          >
            <IconeCloche className="h-4 w-4" /> 2. Prévenir de l&apos;approche
          </Bouton>
          <Bouton
            variante="primaire"
            disabled={!peutArrivee}
            onClick={() => {
              setSucces(null);
              setPointCle("");
              setAction("arrivee");
            }}
          >
            <IconeCheck className="h-4 w-4" /> 3. Marquer arrivés
          </Bouton>
        </div>

        {optionsArrivee.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ardoise">
              Arrêt ou gare d&apos;arrivée
            </label>
            <select
              className="champ-saisie"
              value={pointCle}
              onChange={(e) => setPointCle(e.target.value)}
              disabled={!chargeABord || statut !== "en_cours"}
            >
              <option value="">
                {selectionArriveeObligatoire
                  ? "— Choisir l'arrêt —"
                  : "Tous les arrêts du voyage"}
              </option>
              {optionsArrivee.map((p) => (
                <option key={p.cle} value={p.cle}>
                  {p.libelle}
                </option>
              ))}
            </select>
            <p className="text-xs italic text-ardoise-clair">
              Choisissez votre position actuelle : seuls les colis et passagers
              destinés à cet arrêt seront marqués arrivés.
            </p>
          </div>
        )}
      </div>

      <ModalConfirmation
        ouvert={action !== null}
        titre={config?.titre ?? ""}
        description={descriptionAction}
        messageAlerte={config?.messageAlerte}
        varianteAlerte="avertissement"
        texteBoutonConfirmer={config?.texteBouton ?? "Confirmer"}
        couleurBoutonConfirmer="succes"
        chargement={chargement}
        desactive={
          action === "approche" &&
          selectionApprocheObligatoire &&
          !pointCle
        }
        contenuCorps={
          action === "approche" && selectionApprocheObligatoire ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ardoise">
                Arrêt ou gare à prévenir
              </label>
              <select
                className="champ-saisie"
                value={pointCle}
                onChange={(e) => setPointCle(e.target.value)}
                disabled={chargement}
              >
                <option value="">— Choisir l'arrêt —</option>
                {optionsArrivee.map((point) => (
                  <option key={point.cle} value={point.cle}>
                    {point.libelle}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ardoise-clair">
                Seuls les passagers et colis destinés à cet arrêt seront prévenus.
              </p>
            </div>
          ) : undefined
        }
        surAnnulation={() => setAction(null)}
        surConfirmation={confirmer}
      />
    </Carte>
  );
}
