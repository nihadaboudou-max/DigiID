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
  type StatutColis,
} from "@/types/logistique";

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
  const [filtre, setFiltre] = useState<"" | StatutColis>("");
  const [page, setPage] = useState(1);
  const [totalFiltres, setTotalFiltres] = useState(0);
  const [totalColis, setTotalColis] = useState(0);
  const [aLivrer, setALivrer] = useState(0);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur(null);
    void Promise.all([
      logistiqueAPI.colis.lister({
        page,
        par_page: 5,
        ...(filtre ? { statut: filtre } : {}),
        ...(recherche.trim() ? { recherche: recherche.trim() } : {}),
      }),
      logistiqueAPI.colis.lister({ page: 1, par_page: 1 }),
      logistiqueAPI.colis.lister({
        page: 1,
        par_page: 1,
        statuts: ["enregistre", "enregistre_direct", "en_transit", "arrive"],
      }),
    ])
      .then(([reponse, reponseTotale, reponseALivrer]) => {
        if (annule) return;
        setColis(reponse.elements);
        setTotalFiltres(reponse.total);
        setTotalColis(reponseTotale.total);
        setALivrer(reponseALivrer.total);
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
  }, [filtre, page, recherche]);

  return (
    <div className="space-y-5 apparition">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ardoise">Mes colis</h1>
          <p className="text-sm text-ardoise-clair">
            Ce que vous transportez. À la remise, scannez le QR du colis : le
            destinataire et l&apos;expéditeur sont prévenus.
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

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="carte py-4 text-center">
          <p className="text-2xl font-bold text-ardoise">{totalColis}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
            Colis à bord
          </p>
        </div>
        <div className="carte py-4 text-center">
          <p className="text-2xl font-bold text-ocre-fonce">{aLivrer}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
            À remettre
          </p>
        </div>
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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ardoise">Statut</label>
          <select
            className="champ-saisie"
            value={filtre}
            onChange={(e) => {
              setFiltre(e.target.value as "" | StatutColis);
              setPage(1);
            }}
          >
            <option value="">Tous les statuts</option>
            <option value="enregistre">Enregistrés</option>
            <option value="enregistre_direct">Enregistrés en route</option>
            <option value="en_transit">En transit</option>
            <option value="arrive">Arrivés</option>
            <option value="livre">Livrés</option>
            <option value="annule">Annulés</option>
          </select>
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
                </span>
              );

              return (
                <li key={c.id}>
                  {c.code_clair ? (
                    <Link
                      href={`/chauffeur/colis/${encodeURIComponent(c.code_clair)}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-sable-clair focus-visible:outline focus-visible:outline-2 focus-visible:outline-lagune"
                    >
                      {contenu}
                      <span className="shrink-0 text-sm font-medium text-lagune">
                        Détails →
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-3">
                      {contenu}
                      <span className="shrink-0 text-xs text-ardoise-clair">
                        En attente
                      </span>
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
