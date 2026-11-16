"use client";
/**
 * Mes colis — espace chauffeur.
 *
 * Vue globale (tous mes cars) de ce qui voyage à bord. Le chauffeur y vérifie
 * ce qu'il transporte et livre directement (scan), sans dépendre d'un écran
 * « receveur » : c'est lui qui remet le colis au destinataire.
 *
 * Le ticket et l'impression restent au guichet (le ticket papier est collé sur
 * le colis à l'enregistrement) ; ici, l'action utile est la remise.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeColis } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { formaterDateHeure } from "@/composants/logistique/format";
import { PaginationListe } from "@/composants/logistique/PaginationListe";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import {
  LIBELLES_STATUT_COLIS,
  VARIANTES_STATUT_COLIS,
  type Colis,
} from "@/types/logistique";

type OngletColis = "a_valider" | "recu" | "en_route" | "livre";
const ONGLETS_COLIS: OngletColis[] = ["a_valider", "recu", "en_route", "livre"];

const STATUTS_PAR_ONGLET: Record<OngletColis, string[]> = {
  a_valider: ["a_valider"],
  recu: ["recu_chauffeur", "enregistre_direct"],
  en_route: ["en_transit", "arrive"],
  livre: ["livre"],
};

const LIBELLES_ONGLET: Record<OngletColis, string> = {
  a_valider: "À valider",
  recu: "Reçus",
  en_route: "En route",
  livre: "Livrés",
};

export default function PageMesColis() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [colis, setColis] = useState<Colis[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [onglet, setOnglet] = useState<OngletColis>("a_valider");
  const [page, setPage] = useState(1);
  const [totalFiltres, setTotalFiltres] = useState(0);
  const [compteurs, setCompteurs] = useState<Record<OngletColis, number>>({
    a_valider: 0,
    recu: 0,
    en_route: 0,
    livre: 0,
  });
  const [colisEnAction, setColisEnAction] = useState<string | null>(null);
  const [rechargement, setRechargement] = useState(0);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur(null);
    const filtresRecherche = recherche.trim()
      ? { recherche: recherche.trim() }
      : {};
    void Promise.all([
      logistiqueAPI.colis.lister({
        page,
        par_page: 5,
        statuts: STATUTS_PAR_ONGLET[onglet],
        ...filtresRecherche,
      }),
      ...ONGLETS_COLIS.map((cle) =>
        logistiqueAPI.colis.lister({
          page: 1,
          par_page: 1,
          statuts: STATUTS_PAR_ONGLET[cle],
        }),
      ),
    ])
      .then(([reponse, ...reponsesCompteurs]) => {
        if (annule) return;
        setColis(reponse.elements);
        setTotalFiltres(reponse.total);
        setCompteurs({
          a_valider: reponsesCompteurs[0].total,
          recu: reponsesCompteurs[1].total,
          en_route: reponsesCompteurs[2].total,
          livre: reponsesCompteurs[3].total,
        });
      })
      .catch((e: unknown) => {
        if (annule) return;
        setErreur(
          e instanceof ErreurAPI
            ? e.message_utilisateur
            : "Impossible de charger vos colis. Réessayez.",
        );
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [onglet, page, recherche, rechargement]);

  async function traiterReception(colisId: string, accepte: boolean) {
    setColisEnAction(colisId);
    setErreur(null);
    try {
      if (accepte) {
        await logistiqueAPI.colis.confirmerReception(colisId);
      } else {
        await logistiqueAPI.colis.refuserReception(
          colisId,
          "Colis non reçu lors du chargement.",
        );
      }
      setPage(1);
      setRechargement((valeur) => valeur + 1);
    } catch (e: unknown) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible d'enregistrer votre réponse. Réessayez.",
      );
    } finally {
      setColisEnAction(null);
    }
  }

  return (
    <div className="space-y-5 apparition">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ardoise">Mes colis</h1>
          <p className="text-sm text-ardoise-clair">
            Confirmez d&apos;abord les colis reçus au guichet, puis suivez ceux
            qui partent en route.
          </p>
        </div>
        <Link href="/chauffeur/colis/nouveau">
          <Bouton variante="primaire" taille="petit">
            <IconeColis className="h-4 w-4" /> Enregistrer un colis
          </Bouton>
        </Link>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      <div
        id="onglet-a-valider"
        role="tablist"
        aria-label="Statut des colis"
        className="flex flex-wrap gap-2"
      >
        {ONGLETS_COLIS.map((cle) => (
          <Bouton
            key={cle}
            variante={onglet === cle ? "primaire" : "ghost"}
            taille="petit"
            role="tab"
            aria-selected={onglet === cle}
            onClick={() => {
              setOnglet(cle);
              setPage(1);
            }}
          >
            {LIBELLES_ONGLET[cle]} ({compteurs[cle]})
          </Bouton>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium text-ardoise">Rechercher</label>
          <input
            className="champ-saisie"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setPage(1);
            }}
            placeholder="Destinataire, téléphone ou code du colis"
          />
        </div>
      </div>

      <Carte
        titre={`${totalFiltres} colis`}
        description="Sélectionnez un colis pour consulter sa fiche et son suivi."
      >
        {chargement ? (
          <p className="py-8 text-center text-sm italic text-ardoise-clair">
            Chargement de vos colis…
          </p>
        ) : colis.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-ardoise-clair">
            Aucun colis pour ces critères.
          </p>
        ) : (
          <ul className="divide-y divide-ardoise-clair/10">
            {colis.map((c) => {
              const contenu = (
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ardoise">
                      {c.destinataire_nom}
                    </span>
                    <Badge variante={VARIANTES_STATUT_COLIS[c.statut] ?? "neutre"}>
                      {LIBELLES_STATUT_COLIS[c.statut] ?? c.statut}
                    </Badge>
                  </span>
                  <span className="text-sm text-ardoise-clair">
                    {`${c.gare_depart_nom ?? "?"} → ${c.gare_arrivee_nom ?? "?"}`}
                  </span>
                  <span className="text-xs text-ardoise-clair">
                    {c.code_clair ?? "Code en attente"} · {c.nombre_articles} article(s)
                    {" · "}{formaterDateHeure(c.cree_le)}
                  </span>
                  <span className="text-xs font-medium text-ardoise-clair">
                    {c.mode_enregistrement === "chauffeur_direct"
                      ? "Origine : Chauffeur"
                      : `Guichet : ${c.gare_depart_nom ?? "Gare de départ"}${
                          c.enregistre_par_nom ? ` / ${c.enregistre_par_nom}` : ""
                        }`}
                  </span>
                </span>
              );

              return (
                <li key={c.id} className="space-y-2 py-3">
                  <div className="flex items-center gap-3">
                    {c.code_clair ? (
                      <Link
                        href={`/chauffeur/colis/${encodeURIComponent(c.code_clair)}`}
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-sable-clair focus-visible:outline focus-visible:outline-2 focus-visible:outline-lagune"
                      >
                        {contenu}
                        <span className="shrink-0 text-sm font-medium text-lagune">
                          Détails →
                        </span>
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3">
                        {contenu}
                        <span className="shrink-0 text-xs text-ardoise-clair">
                          En attente
                        </span>
                      </div>
                    )}
                  </div>
                  {(c.statut === "a_valider" || c.statut === "enregistre") &&
                    c.mode_enregistrement === "guichet" && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Bouton
                          variante="succes"
                          taille="moyen"
                          className="h-14 w-full"
                          chargement={colisEnAction === c.id}
                          disabled={colisEnAction !== null && colisEnAction !== c.id}
                          onClick={() => void traiterReception(c.id, true)}
                        >
                          J&apos;ai reçu le colis
                        </Bouton>
                        <Bouton
                          variante="danger"
                          taille="moyen"
                          className="h-14 w-full"
                          chargement={colisEnAction === c.id}
                          disabled={colisEnAction !== null && colisEnAction !== c.id}
                          onClick={() => void traiterReception(c.id, false)}
                        >
                          Je n&apos;ai pas reçu ce colis
                        </Bouton>
                      </div>
                    )}
                </li>
              );
            })}
          </ul>
        )}
        <PaginationListe
          page={page}
          total={totalFiltres}
          parPage={5}
          chargement={chargement}
          surChangement={setPage}
        />
      </Carte>
    </div>
  );
}
