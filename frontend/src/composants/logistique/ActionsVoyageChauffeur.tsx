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
 *   3. « Arrivés »                 → tous les passagers + colis d'une gare arrivés.
 *
 * Chaque action reste traçable (un événement par passager/colis) et idempotente.
 */
import { useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ModalConfirmation } from "@/composants/commun/ModalConfirmation";
import { IconeCheck, IconeCloche } from "@/composants/commun/Icones";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";

type Action = "depart" | "approche" | "arrivee";

interface Props {
  voyageId: string;
  /** Gares connues du voyage (issues de la ligne) pour cibler « Arrivés ». */
  gares?: { id: string; nom: string }[];
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
    description: "Les passagers et colis de la gare sélectionnée seront marqués arrivés.",
    messageAlerte:
      "Un SMS d'arrivée sera envoyé aux familles et aux destinataires concernés.",
    texteBouton: "Marquer arrivés",
  },
};

export function ActionsVoyageChauffeur({ voyageId, gares = [], surSucces }: Props) {
  const [action, setAction] = useState<Action | null>(null);
  const [gareArriveeId, setGareArriveeId] = useState<string>("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  async function confirmer() {
    if (!action) return;
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
        const r = await logistiqueAPI.voyages.marquerArrivee(voyageId, {
          gare_id: gareArriveeId || null,
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

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Bouton
            variante="succes"
            onClick={() => {
              setSucces(null);
              setAction("depart");
            }}
          >
            <IconeCheck className="h-4 w-4" /> Valider le Départ
          </Bouton>
          <Bouton
            variante="secondaire"
            onClick={() => {
              setSucces(null);
              setAction("approche");
            }}
          >
            <IconeCloche className="h-4 w-4" /> Prévenir de l&apos;approche
          </Bouton>
          <Bouton
            variante="primaire"
            onClick={() => {
              setSucces(null);
              setAction("arrivee");
            }}
          >
            <IconeCheck className="h-4 w-4" /> Arrivés
          </Bouton>
        </div>

        {gares.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ardoise">
              Gare pour « Arrivés »
            </label>
            <select
              className="champ-saisie"
              value={gareArriveeId}
              onChange={(e) => setGareArriveeId(e.target.value)}
            >
              <option value="">Toutes les gares du voyage</option>
              {gares.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nom}
                </option>
              ))}
            </select>
            <p className="text-xs italic text-ardoise-clair">
              Laissez sur « toutes les gares » pour marquer l&apos;ensemble du voyage.
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
