"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { identiteAPI, type VoyageCitoyen } from "@/services/identite_api";
import { ErreurAPI } from "@/services/client_api";

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
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [elements, setElements] = useState<VoyageCitoyen[]>([]);
  const [total, setTotal] = useState(0);
  const [selection, setSelection] = useState<VoyageCitoyen | null>(null);
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

      {selection && (
        <Carte titre="Les étapes de ton envoi" description={`Code : ${selection.code}`}>
          <button
            type="button"
            onClick={() => setSelection(null)}
            className="mb-5 inline-flex min-h-14 items-center gap-2 rounded-xl border border-ardoise-clair/20 px-4 font-semibold text-lagune"
          >
            <IconeFlecheRetour className="h-5 w-5" aria-hidden="true" />
            Retour à mes envois
          </button>
          <ol className="space-y-4">
            {["Enregistré", "En route", "Arrivé"].map((etape, index) => {
              const actif = index <= progression(selection.statut);
              const Icone = index === 0 ? IconeCheck : index === 1 ? IconeCamion : IconeColis;
              return (
                <li
                  key={etape}
                  className={`flex min-h-16 items-center gap-4 rounded-xl border p-4 ${
                    actif
                      ? "border-lagune bg-lagune text-white"
                      : "border-ardoise-clair/20 bg-sable text-ardoise-clair"
                  }`}
                >
                  <Icone className="h-7 w-7 shrink-0" aria-hidden="true" />
                  <span className="font-bold">{etape}</span>
                  {index === progression(selection.statut) && (
                    <span className="ml-auto text-sm font-semibold">Étape actuelle</span>
                  )}
                </li>
              );
            })}
          </ol>
        </Carte>
      )}

      <section aria-label="Liste de mes envois" className="space-y-3">
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
          elements.map((element) => (
            <Carte key={`${element.type}-${element.id}`} className="space-y-3">
              <div className="flex items-start gap-3">
                <IconeColis className="mt-1 h-6 w-6 shrink-0 text-lagune" aria-hidden="true" />
                <div className="min-w-0 flex-1">
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
                taille="grand"
                className="w-full"
                onClick={() => setSelection(element)}
              >
                <IconeFlecheRetour className="h-5 w-5 rotate-180" aria-hidden="true" />
                Voir les étapes
              </Bouton>
            </Carte>
          ))
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
