"use client";
/**
 * Page publique « Horaires des cars » — accessible **sans connexion**.
 *
 * Répond au besoin le plus courant du voyageur : « quand part le prochain car
 * pour Parakou, et de quelle gare ? ». Le backend n'expose ici **aucune donnée
 * personnelle** : ni client, ni colis, ni téléphone — seulement le trajet,
 * l'heure, le véhicule et le prénom abrégé du chauffeur (« Moussa D. »).
 *
 * On y accède depuis la page d'accueil ou par un lien direct partagé sur les
 * réseaux ; un champ permet aussi de **suivre un colis** à partir de son code.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { formaterDateHeure } from "@/composants/logistique/format";
import { ErreurAPI } from "@/services/client_api";
import {
  logistiqueAPI,
  type VoyagePublic,
} from "@/services/logistique_api";

/** Horizon d'affichage : ce qui intéresse un voyageur, pas tout l'historique. */
type Horizon = "jour" | "semaine" | "tout";

const HORIZONS: { valeur: Horizon; libelle: string }[] = [
  { valeur: "jour", libelle: "Aujourd'hui" },
  { valeur: "semaine", libelle: "7 prochains jours" },
  { valeur: "tout", libelle: "Tous les départs" },
];

/** Instant (ms) d'un départ, ou `null` si la date est illisible. */
function instant(iso: string): number | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

/** « Aujourd'hui », « Demain » ou le jour de la semaine — repère humain. */
function jourRelatif(iso: string): string {
  const quand = instant(iso);
  if (quand === null) return "";
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  const jour = new Date(quand);
  jour.setHours(0, 0, 0, 0);
  const ecart = Math.round(
    (jour.getTime() - aujourdHui.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return "Demain";
  return jour.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Heure seule « 08:00 » — c'est ce que le voyageur cherche d'abord. */
function heureSeule(iso: string): string {
  const quand = instant(iso);
  if (quand === null) return "--:--";
  return new Date(quand).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function PageHorairesPublics() {
  const router = useRouter();

  const [horaires, setHoraires] = useState<VoyagePublic[]>([]);
  const [horizon, setHorizon] = useState<Horizon>("jour");
  const [recherche, setRecherche] = useState("");
  const [codeSuivi, setCodeSuivi] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [majLe, setMajLe] = useState<Date | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    try {
      const resultat = await logistiqueAPI.horaires.prochains({ limite: 100 });
      setHoraires(resultat);
      setMajLe(new Date());
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger les horaires. Réessayez dans un instant.",
      );
    } finally {
      setChargement(false);
    }
  }, []);

  // Chargement initial + rafraîchissement automatique : les retards arrivent
  // souvent pendant que le voyageur est déjà à la gare.
  useEffect(() => {
    void charger();
    const minuteur = setInterval(() => void charger(), 60_000);
    return () => clearInterval(minuteur);
  }, [charger]);

  const affiches = useMemo(() => {
    const maintenant = Date.now();
    const limiteHaute =
      horizon === "jour"
        ? new Date().setHours(23, 59, 59, 999)
        : horizon === "semaine"
          ? maintenant + 7 * 24 * 60 * 60 * 1000
          : Number.POSITIVE_INFINITY;

    const terme = normaliser(recherche);

    return horaires
      .filter((horaire) => {
        const quand = instant(horaire.date_depart);
        if (quand === null) return false;
        return quand <= limiteHaute;
      })
      .filter((horaire) => {
        if (!terme) return true;
        const champs = [
          horaire.trajet,
          horaire.gare_depart,
          horaire.gare_arrivee,
          horaire.vehicule,
          horaire.chauffeur_apercu,
        ]
          .filter(Boolean)
          .join(" ");
        return normaliser(champs).includes(terme);
      })
      .sort(
        (a, b) =>
          (instant(a.date_depart) ?? 0) - (instant(b.date_depart) ?? 0),
      );
  }, [horaires, horizon, recherche]);

  /** Regroupement par jour : « Aujourd'hui », « Demain »… comme un panneau de gare. */
  const parJour = useMemo(() => {
    const groupes: { cle: string; libelle: string; elements: VoyagePublic[] }[] = [];
    affiches.forEach((horaire) => {
      const libelle = jourRelatif(horaire.date_depart);
      const dernier = groupes[groupes.length - 1];
      if (dernier && dernier.libelle === libelle) {
        dernier.elements.push(horaire);
      } else {
        groupes.push({
          cle: `${libelle}-${horaire.date_depart}`,
          libelle,
          elements: [horaire],
        });
      }
    });
    return groupes;
  }, [affiches]);

  const suivre = () => {
    const code = codeSuivi.trim();
    if (!code) return;
    router.push(`/suivi/${encodeURIComponent(code)}`);
  };

  return (
    <div className="min-h-screen bg-sable-clair px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6 apparition">
        {/* En-tête public */}
        <header className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-lagune">
            DigiID
          </p>
          <h1 className="mt-1 text-3xl font-bold text-ardoise">
            Horaires des cars
          </h1>
          <p className="mt-1 text-sm text-ardoise-clair">
            Les prochains départs, gare par gare — sans compte, sans application.
          </p>
          {majLe && (
            <p className="mt-2 text-[11px] text-ardoise-clair">
              Mis à jour à {majLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              {" · "}actualisation automatique chaque minute
            </p>
          )}
        </header>

        {/* Suivi d'un colis : le second réflexe du voyageur */}
        <Carte>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="code-suivi"
                className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair"
              >
                Suivre un colis ou un enfant
              </label>
              <input
                id="code-suivi"
                value={codeSuivi}
                onChange={(e) => setCodeSuivi(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") suivre();
                }}
                placeholder="Code du ticket (ex. DKR-2025-000001)"
                className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
              />
            </div>
            <Bouton variante="secondaire" onClick={suivre}>
              Voir le suivi
            </Bouton>
          </div>
        </Carte>

        {erreur && (
          <Alerte variante="erreur" titre="Horaires indisponibles">
            {erreur}
          </Alerte>
        )}

        {/* Filtres */}
        <Carte>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="recherche-horaire"
                className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair"
              >
                Destination ou gare
              </label>
              <input
                id="recherche-horaire"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Ex. Cotonou, Porto-Novo, car AB-1234"
                className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair">
                Période
              </span>
              <div className="flex flex-wrap gap-2">
                {HORIZONS.map((option) => (
                  <button
                    key={option.valeur}
                    type="button"
                    onClick={() => setHorizon(option.valeur)}
                    className={
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
                      (horizon === option.valeur
                        ? "bg-lagune text-white"
                        : "bg-sable text-ardoise-clair hover:bg-sable/70")
                    }
                  >
                    {option.libelle}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Carte>

        {/* Liste des départs */}
        {chargement ? (
          <Carte>
            <p className="py-10 text-center text-sm italic text-ardoise-clair">
              Chargement des départs…
            </p>
          </Carte>
        ) : parJour.length === 0 ? (
          <Carte>
            <p className="py-8 text-center text-sm italic text-ardoise-clair">
              Aucun départ annoncé pour le moment.
              <br />
              Essayez « 7 prochains jours » ou une autre recherche.
            </p>
          </Carte>
        ) : (
          parJour.map((groupe) => (
            <section key={groupe.cle} className="space-y-3">
              <h2 className="px-1 text-sm font-bold uppercase tracking-wider text-ardoise-clair">
                {groupe.libelle}
              </h2>
              <ul className="space-y-3">
                {groupe.elements.map((horaire) => (
                  <li
                    key={horaire.voyage_id}
                    className="rounded-2xl border border-ardoise-clair/10 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Heure d'abord : c'est la question posée. */}
                      <div className="w-20 flex-shrink-0 text-center">
                        <p className="text-2xl font-bold text-lagune">
                          {heureSeule(horaire.date_depart)}
                        </p>
                        <p className="text-[11px] text-ardoise-clair">
                          {new Date(horaire.date_depart).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="min-w-[180px] flex-1">
                        <p className="font-semibold text-ardoise">{horaire.trajet}</p>
                        <p className="text-xs text-ardoise-clair">
                          {horaire.gare_depart ?? "Gare de départ à confirmer"}
                          {" → "}
                          {horaire.gare_arrivee ?? "Gare d'arrivée à confirmer"}
                        </p>
                        <p className="mt-1 text-xs text-ardoise-clair">
                          {horaire.vehicule ? `Car ${horaire.vehicule}` : "Car à confirmer"}
                          {horaire.capacite ? ` · ${horaire.capacite} places` : ""}
                          {horaire.chauffeur_apercu
                            ? ` · Chauffeur ${horaire.chauffeur_apercu}`
                            : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {horaire.statut === "en_cours" ? (
                          <Badge variante="ocre">En route</Badge>
                        ) : (
                          <Badge variante="info">Planifié</Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-ardoise-clair">
                      Départ annoncé : {formaterDateHeure(horaire.date_depart)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <footer className="space-y-2 pt-2 text-center text-xs text-ardoise-clair">
          <p>
            Horaires indicatifs : un car peut partir avec quelques minutes
            d&apos;avance ou de retard. Présentez-vous à la gare un peu avant
            l&apos;heure annoncée.
          </p>
          <p>
            <Link href="/" className="font-semibold text-lagune hover:underline">
              Accueil DigiID
            </Link>
            {" · "}
            <Link
              href="/connexion"
              className="font-semibold text-lagune hover:underline"
            >
              Espace guichet & chauffeur
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
