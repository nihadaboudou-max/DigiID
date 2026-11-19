"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import {
  IconeCamion,
  IconeCheck,
  IconeColis,
  IconeFlecheRetour,
  IconeRecherche,
} from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { TicketImprimable } from "@/composants/logistique/TicketImprimable";
import { useAuthentification } from "@/contextes/authentification";
import { identiteAPI, type VoyageCitoyen } from "@/services/identite_api";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import type { ColisEnregistre } from "@/types/logistique";

const TAILLE_PAGE = 5;

function progression(statut: string): number {
  const normalise = statut.toLowerCase();
  if (["livre", "arrive", "arrivee", "remis", "termine", "terminé"].includes(normalise)) {
    return 2;
  }
  if (["en_route", "en_transit", "en_cours", "embarque", "embarqué"].includes(normalise)) {
    return 1;
  }
  return 0;
}

export default function PageMesEnvois() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [elements, setElements] = useState<VoyageCitoyen[]>([]);
  const [total, setTotal] = useState(0);
  const [selection, setSelection] = useState<VoyageCitoyen | null>(null);
  const [recuColis, setRecuColis] = useState<ColisEnregistre | null>(null);
  const [chargementRecu, setChargementRecu] = useState(false);
  const [erreurRecu, setErreurRecu] = useState<string | null>(null);
  const codeInitial = useRef<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      codeInitial.current = code;
      setRecherche(code);
    }
  }, []);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const resultat = await identiteAPI.mesVoyagesPagines({
        page,
        parPage: TAILLE_PAGE,
        recherche,
      });
      setElements(resultat.elements);
      setTotal(resultat.total);
      if (codeInitial.current) {
        const envoi = resultat.elements.find(
          (element) =>
            element.code.toLowerCase() === codeInitial.current?.toLowerCase() ||
            element.id.toLowerCase() === codeInitial.current?.toLowerCase(),
        );
        if (envoi) setSelection(envoi);
        codeInitial.current = null;
      }
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger tes envois. Réessaie dans un instant.",
      );
    } finally {
      setChargement(false);
    }
  }, [page, recherche]);

  useEffect(() => {
    if (!selection || selection.type !== "colis") {
      setRecuColis(null);
      setErreurRecu(null);
      setChargementRecu(false);
      return;
    }

    let ignore = false;
    setRecuColis(null);
    setErreurRecu(null);
    setChargementRecu(true);
    logistiqueAPI.colis
      .pourMonCompte(selection.id)
      .then((recu) => {
        if (!ignore) setRecuColis(recu);
      })
      .catch((e: unknown) => {
        if (!ignore) {
          setErreurRecu(
            e instanceof ErreurAPI
              ? e.code_http === 403
                ? "Vous ne pouvez pas consulter ce reçu : seul l'agent qui a enregistré le colis peut l'imprimer."
                : e.message_utilisateur
              : "Impossible de charger le reçu de ce colis.",
          );
        }
      })
      .finally(() => {
        if (!ignore) setChargementRecu(false);
      });

    return () => {
      ignore = true;
    };
  }, [selection]);

  useEffect(() => {
    const minuteur = window.setTimeout(() => void charger(), 250);
    return () => window.clearTimeout(minuteur);
  }, [charger]);

  const totalPages = Math.max(1, Math.ceil(total / TAILLE_PAGE));

  function rechercher(value: string) {
    setRecherche(value);
    setPage(1);
    setSelection(null);
  }

  return (
    <div className="space-y-5 apparition">
      <header>
        <p className="text-ocre font-semibold uppercase tracking-wide">Mon transport</p>
        <h1 className="mt-1">Mes envois</h1>
        <p className="mt-1 text-ardoise-clair">Retrouve tes colis et les enfants suivis.</p>
      </header>

      <Carte>
        <label htmlFor="recherche-envois" className="mb-2 block font-semibold text-ardoise">
          Rechercher par code
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="recherche-envois"
            value={recherche}
            onChange={(event) => rechercher(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void charger();
            }}
            placeholder="Exemple : DKR-2025-000001"
            className="champ-saisie min-h-14 flex-1"
          />
          <Bouton
            type="button"
            taille="grand"
            className="min-h-14"
            onClick={() => void charger()}
          >
            <IconeRecherche className="h-5 w-5" aria-hidden="true" />
            Rechercher
          </Bouton>
        </div>
      </Carte>

      {erreur && <Alerte variante="erreur" titre="Envois indisponibles">{erreur}</Alerte>}

      {utilisateur?.est_telephone_verifie !== true && (
        <Alerte variante="avertissement" titre="Vérification du téléphone requise">
          Les envois et notifications associés à ton numéro sont protégés par la
          vérification téléphonique. Vérifie ton numéro depuis ton{" "}
          <Link href="/profil" className="font-semibold underline">
            profil
          </Link>{" "}
          pour les retrouver ici.
        </Alerte>
      )}

      <section aria-label="Liste de mes envois" className="space-y-2">
        {chargement ? (
          <Carte><p className="py-4 text-center text-ardoise-clair">Chargement de tes envois…</p></Carte>
        ) : elements.length === 0 ? (
          <Carte>
            <p className="text-center text-ardoise">
              {recherche ? "Aucun envoi trouvé pour ce code." : "Tu n'as pas encore d'envoi à suivre."}
            </p>
            <div className="mt-4 flex justify-center">
              <Bouton
                type="button"
                variante="secondaire"
                taille="grand"
                onClick={() => router.push("/horaires")}
              >
                <IconeCamion className="h-5 w-5" aria-hidden="true" />
                Voir les horaires
              </Bouton>
            </div>
          </Carte>
        ) : (
          elements.map((element) => {
            const estSelectionne =
              selection?.id === element.id && selection.type === element.type;

            return (
              <div key={`${element.type}-${element.id}`} className="space-y-2">
                <Carte className="!p-3 space-y-2 sm:!p-4">
                  <div className="flex items-start gap-3">
                    <IconeColis className="mt-1 h-6 w-6 shrink-0 text-lagune" aria-hidden="true" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-bold text-ardoise">
                        {element.type === "colis" ? "Colis" : "Enfant suivi"}
                        {element.libelle ? ` — ${element.libelle}` : ""}
                      </p>
                      <p className="mt-1 text-ardoise-clair">Code : {element.code}</p>
                      <p className="mt-1 text-ardoise-clair">
                        {element.gare_depart_nom || "Départ"} → {element.gare_arrivee_nom || "Arrivée"}
                      </p>
                    </div>
                  </div>
                  <Bouton
                    type="button"
                    variante="secondaire"
                    taille="petit"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={() => setSelection(estSelectionne ? null : element)}
                    aria-expanded={estSelectionne}
                  >
                    <IconeFlecheRetour className="h-5 w-5 rotate-180" aria-hidden="true" />
                    {estSelectionne
                      ? "Masquer les détails"
                      : element.type === "colis"
                        ? "Ouvrir le reçu et les étapes"
                        : "Voir les étapes"}
                  </Bouton>
                </Carte>

                {estSelectionne && (
                  <>
                    <Carte
                      titre="Les étapes de ton envoi"
                      description={`Code : ${element.code}`}
                      className="!p-4"
                    >
                      <ol className="space-y-2">
                        {["Enregistré", "En route", "Arrivé"].map((etape, index) => {
                          const actif = index <= progression(element.statut);
                          const Icone =
                            index === 0
                              ? IconeCheck
                              : index === 1
                                ? IconeCamion
                                : IconeColis;
                          return (
                            <li
                              key={etape}
                              className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 ${
                                actif
                                  ? "border-lagune bg-lagune text-white"
                                  : "border-ardoise-clair/20 bg-sable text-ardoise-clair"
                              }`}
                            >
                              <Icone className="h-6 w-6 shrink-0" aria-hidden="true" />
                              <span className="font-bold">{etape}</span>
                              {index === progression(element.statut) && (
                                <span className="ml-auto text-xs font-semibold">
                                  Étape actuelle
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </Carte>

                    {element.type === "colis" && (
                      <Carte titre="Reçu du colis" className="!p-4">
                        {chargementRecu ? (
                          <p className="py-4 text-center text-ardoise-clair">
                            Chargement du reçu…
                          </p>
                        ) : erreurRecu ? (
                          <Alerte variante="erreur" titre="Reçu indisponible">
                            {erreurRecu}
                          </Alerte>
                        ) : recuColis ? (
                          <TicketImprimable
                            ticket={recuColis.ticket}
                            colis={recuColis.colis}
                          />
                        ) : null}
                      </Carte>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </section>

      <nav aria-label="Pagination des envois" className="flex flex-wrap items-center justify-between gap-3">
        <Bouton
          type="button"
          variante="ghost"
          taille="moyen"
          disabled={page <= 1 || chargement}
          onClick={() => setPage((courante) => Math.max(1, courante - 1))}
        >
          <IconeFlecheRetour className="h-5 w-5" aria-hidden="true" />
          Précédent
        </Bouton>
        <span className="font-semibold text-ardoise">Page {page} sur {totalPages}</span>
        <Bouton
          type="button"
          variante="ghost"
          taille="moyen"
          disabled={page >= totalPages || chargement}
          onClick={() => setPage((courante) => Math.min(totalPages, courante + 1))}
        >
          Suivant
          <IconeFlecheRetour className="h-5 w-5 rotate-180" aria-hidden="true" />
        </Bouton>
      </nav>
    </div>
  );
}
