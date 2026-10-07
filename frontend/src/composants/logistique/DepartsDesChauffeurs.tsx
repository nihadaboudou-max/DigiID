"use client";
/**
 * « Départs des chauffeurs » — brique du guichet (receveur / gérant de gare).
 *
 * Un chauffeur indépendant planifie ses voyages depuis son propre espace. Le
 * guichet doit les voir **immédiatement** : c'est là que se joue le remplissage
 * du car — un client se présente avec un colis ou un enfant qui voyage seul, et
 * le receveur peut lui répondre « ce car part à 9 h 30, ça part avec lui ».
 *
 * On n'affiche que ce qui est utile au guichet : trajet, heure, car, chauffeur
 * (aperçu de nom, on ne divulgue pas le téléphone), statut.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Badge, type BadgeVariante } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeColis, IconeIdentite } from "@/composants/commun/Icones";
import { formaterDateHeure } from "@/composants/logistique/format";
import { ErreurAPI } from "@/services/client_api";
import { departsAVenir, type Voyage } from "@/services/logistique_api";

const STATUTS: Record<string, { libelle: string; variante: BadgeVariante }> = {
  planifie: { libelle: "Planifié", variante: "info" },
  en_cours: { libelle: "En route", variante: "ocre" },
};

/**
 * @param gareId Gare du guichet : les départs qui la touchent remontent en tête
 *               (un car qui passe par ma gare, c'est de la clientèle pour moi).
 * @param limite Nombre de départs affichés.
 */
export function DepartsDesChauffeurs({
  gareId,
  limite = 6,
}: {
  gareId?: string | null;
  limite?: number;
}) {
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const reponse = await departsAVenir();
        if (!annule) setVoyages(reponse);
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger les départs des chauffeurs.",
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

  /** Un départ qui touche ma gare d'abord (« Ma gare »), puis l'ordre des heures. */
  const liste = useMemo(() => {
    const toucheMaGare = (v: Voyage) =>
      !!gareId && (v.gare_depart_id === gareId || v.gare_arrivee_id === gareId);
    return [...voyages]
      .sort((a, b) => {
        const priorite = Number(toucheMaGare(b)) - Number(toucheMaGare(a));
        if (priorite !== 0) return priorite;
        return (
          new Date(a.date_depart).getTime() - new Date(b.date_depart).getTime()
        );
      })
      .slice(0, limite);
  }, [voyages, gareId, limite]);

  return (
    <Carte
      titre="Départs annoncés par les chauffeurs"
      description="Les cars planifiés par les chauffeurs. Enregistrez le colis ou le passager, puis affectez-le à ce départ : le chauffeur est prévenu et le car se remplit."
    >
      {erreur && <p className="text-sm text-terre">{erreur}</p>}

      {chargement ? (
        <p className="py-4 text-center text-sm italic text-ardoise-clair">
          Chargement des départs…
        </p>
      ) : liste.length === 0 ? (
        <p className="py-4 text-center text-sm italic text-ardoise-clair">
          Aucun départ annoncé pour l&apos;instant. Dès qu&apos;un chauffeur
          planifie un voyage, il apparaît ici.
        </p>
      ) : (
        <ul className="space-y-2">
          {liste.map((voyage) => {
            const statut = STATUTS[voyage.statut] ?? {
              libelle: voyage.statut,
              variante: "neutre" as BadgeVariante,
            };
            const passeParMaGare =
              !!gareId &&
              (voyage.gare_depart_id === gareId || voyage.gare_arrivee_id === gareId);
            return (
              <li
                key={voyage.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ardoise-clair/15 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ardoise">
                      {voyage.ligne_libelle ?? "Trajet à confirmer"}
                    </span>
                    <Badge variante={statut.variante}>{statut.libelle}</Badge>
                    {passeParMaGare && <Badge variante="lagune">Ma gare</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ardoise-clair">
                    {formaterDateHeure(voyage.date_depart)}
                    {voyage.vehicule_immatriculation
                      ? ` • Car ${voyage.vehicule_immatriculation}`
                      : ""}
                    {voyage.chauffeur_nom ? ` • ${voyage.chauffeur_nom}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/receveur/colis/nouveau">
                    <Bouton variante="secondaire" taille="petit">
                      <IconeColis className="w-4 h-4" /> Un colis
                    </Bouton>
                  </Link>
                  <Link href="/receveur/suivi-familial">
                    <Bouton variante="ghost" taille="petit">
                      <IconeIdentite className="w-4 h-4" /> Un passager
                    </Bouton>
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Carte>
  );
}
