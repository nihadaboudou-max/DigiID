"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeIdentite, IconeScan } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ActionsVoyageChauffeur } from "@/composants/logistique/ActionsVoyageChauffeur";
import { EnregistrementDirectChauffeur } from "@/composants/logistique/EnregistrementDirectChauffeur";
import { PaginationListe } from "@/composants/logistique/PaginationListe";
import { formaterDate } from "@/composants/logistique/format";
import { ManifesteVoyage } from "@/composants/logistique/ManifesteVoyage";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { TableauColis } from "@/composants/logistique/TableauColis";
import { ErreurAPI } from "@/services/client_api";
import {
  libelleLigne,
  logistiqueAPI,
  type ArretLigne,
  type Ligne,
  type SuiviFamilial,
  type Voyage,
} from "@/services/logistique_api";
import {
  LIBELLES_STATUT_SUIVI,
  LIBELLES_STATUT_VOYAGE,
  VARIANTES_STATUT_VOYAGE,
  type Colis,
} from "@/types/logistique";

const ELEMENTS_PAR_PAGE = 5;
const STATUTS_COLIS_NON_ANNULES = [
  "non_attribue",
  "a_valider",
  "recu_chauffeur",
  "enregistre",
  "enregistre_direct",
  "en_transit",
  "arrive",
  "livre",
];
const STATUTS_PASSAGERS_NON_ANNULES = [
  "enregistre",
  "enregistre_direct",
  "en_route",
  "arrive",
];

type OngletVoyage = "manifeste" | "passagers" | "colis" | "enregistrement";

export default function PageDetailVoyageChauffeur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const params = useParams();
  const voyageId = String(params?.id ?? "");

  const [voyage, setVoyage] = useState<Voyage | null>(null);
  const [ligne, setLigne] = useState<Ligne | null>(null);
  const [arrets, setArrets] = useState<ArretLigne[]>([]);
  const [colis, setColis] = useState<Colis[]>([]);
  const [totalColis, setTotalColis] = useState(0);
  const [nbColisActifs, setNbColisActifs] = useState(0);
  const [nbColisAValider, setNbColisAValider] = useState(0);
  const [passagers, setPassagers] = useState<SuiviFamilial[]>([]);
  const [totalPassagers, setTotalPassagers] = useState(0);
  const [nbPassagersActifs, setNbPassagersActifs] = useState(0);
  const [pageColis, setPageColis] = useState(1);
  const [pagePassagers, setPagePassagers] = useState(1);
  const [onglet, setOnglet] = useState<OngletVoyage>("manifeste");
  const [chargement, setChargement] = useState(true);
  const [chargementColis, setChargementColis] = useState(true);
  const [chargementPassagers, setChargementPassagers] = useState(true);
  const [chargementCompteurs, setChargementCompteurs] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurColis, setErreurColis] = useState<string | null>(null);
  const [erreurPassagers, setErreurPassagers] = useState<string | null>(null);
  const [erreurCompteurs, setErreurCompteurs] = useState<string | null>(null);
  const [rafraichir, setRafraichir] = useState(0);

  useEffect(() => {
    setPageColis(1);
    setPagePassagers(1);
    setOnglet("manifeste");
  }, [voyageId]);

  useEffect(() => {
    if (!voyageId) return;
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const [voyageCharge, repLignes] = await Promise.all([
          logistiqueAPI.voyages.obtenir(voyageId),
          logistiqueAPI.lignes.lister(),
        ]);
        if (annule) return;
        const ligneTrouvee =
          repLignes.elements.find((element) => element.id === voyageCharge.ligne_id) ??
          null;
        const listeArrets = ligneTrouvee
          ? ligneTrouvee.arrets?.length
            ? ligneTrouvee.arrets
            : await logistiqueAPI.lignes.arrets.lister(ligneTrouvee.id)
          : [];
        if (annule) return;
        setVoyage(voyageCharge);
        setLigne(ligneTrouvee);
        setArrets(listeArrets.filter((arret) => arret.actif !== false));
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Voyage introuvable ou inaccessible.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [voyageId, rafraichir]);

  useEffect(() => {
    if (!voyageId) return;
    let annule = false;
    (async () => {
      setChargementColis(true);
      setErreurColis(null);
      try {
        const reponse = await logistiqueAPI.colis.lister({
          voyage_id: voyageId,
          page: pageColis,
          par_page: ELEMENTS_PAR_PAGE,
        });
        if (annule) return;
        setColis(reponse.elements);
        setTotalColis(reponse.total);
      } catch (e) {
        if (!annule) {
          setErreurColis(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger les colis de ce voyage.",
          );
        }
      } finally {
        if (!annule) setChargementColis(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [voyageId, pageColis, rafraichir]);

  useEffect(() => {
    if (!voyageId) return;
    let annule = false;
    (async () => {
      setChargementPassagers(true);
      setErreurPassagers(null);
      try {
        const reponse = await logistiqueAPI.suiviFamilial.lister({
          voyage_id: voyageId,
          page: pagePassagers,
          par_page: ELEMENTS_PAR_PAGE,
        });
        if (annule) return;
        setPassagers(reponse.elements);
        setTotalPassagers(reponse.total);
      } catch (e) {
        if (!annule) {
          setErreurPassagers(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger les passagers de ce voyage.",
          );
        }
      } finally {
        if (!annule) setChargementPassagers(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [voyageId, pagePassagers, rafraichir]);

  useEffect(() => {
    if (!voyageId) return;
    let annule = false;
    (async () => {
      setChargementCompteurs(true);
      setErreurCompteurs(null);
      try {
        const [colisActifs, passagersActifs, colisAValider] = await Promise.all([
          logistiqueAPI.colis.lister({
            voyage_id: voyageId,
            statuts: STATUTS_COLIS_NON_ANNULES,
            page: 1,
            par_page: 1,
          }),
          logistiqueAPI.suiviFamilial.lister({
            voyage_id: voyageId,
            statuts: STATUTS_PASSAGERS_NON_ANNULES,
            page: 1,
            par_page: 1,
          }),
          logistiqueAPI.colis.lister({
            voyage_id: voyageId,
            statuts: ["a_valider"],
            page: 1,
            par_page: 1,
          }),
        ]);
        if (annule) return;
        setNbColisActifs(colisActifs.total);
        setNbPassagersActifs(passagersActifs.total);
        setNbColisAValider(colisAValider.total);
      } catch (e) {
        if (!annule) {
          setErreurCompteurs(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de vérifier le chargement du voyage.",
          );
        }
      } finally {
        if (!annule) setChargementCompteurs(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [voyageId, rafraichir]);

  if (chargement) {
    return (
      <p className="py-12 text-center italic text-ardoise-clair">
        Chargement du voyage…
      </p>
    );
  }

  if (erreur || !voyage) {
    return (
      <div className="space-y-4">
        <Alerte variante="erreur" titre="Impossible d'afficher le voyage">
          {erreur ?? "Voyage introuvable."}
        </Alerte>
        <Link href="/chauffeur/dashboard">
          <Bouton variante="ghost">← Retour aux voyages</Bouton>
        </Link>
      </div>
    );
  }

  const statut = voyage.statut as keyof typeof LIBELLES_STATUT_VOYAGE;

  return (
    <div className="space-y-4 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/chauffeur/dashboard" className="hover:text-lagune">
          Mes voyages
        </Link>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ardoise-clair">
              Détail du départ
            </p>
            <h1 className="text-xl font-bold text-ardoise">{libelleLigne(ligne)}</h1>
            <p className="mt-1 text-sm text-ardoise-clair">
              Départ {formaterDate(voyage.date_depart)}
              {voyage.vehicule_immatriculation
                ? ` · ${voyage.vehicule_immatriculation}`
                : ""}
            </p>
          </div>
          <Badge variante={VARIANTES_STATUT_VOYAGE[statut] ?? "neutre"} taille="moyen">
            {LIBELLES_STATUT_VOYAGE[statut] ?? voyage.statut}
          </Badge>
        </div>
        <Link href={`/chauffeur/scan?voyage_id=${voyage.id}`}>
          <Bouton variante="primaire">
            <IconeScan className="h-4 w-4" /> Scanner un colis
          </Bouton>
        </Link>
      </div>

      {erreurCompteurs && (
        <Alerte variante="erreur" titre="Chargement indisponible">
          {erreurCompteurs}
        </Alerte>
      )}
      <ActionsVoyageChauffeur
        voyageId={voyage.id}
        dateDepart={voyage.date_depart}
        statut={voyage.statut}
        nbColis={nbColisActifs}
        nbColisAValider={nbColisAValider}
        nbPassagers={nbPassagersActifs}
        gares={
          ligne
            ? [{ id: ligne.gare_arrivee_id, nom: ligne.gare_arrivee_nom ?? "Terminus" }]
            : []
        }
        pointsArrivee={[
          ...arrets.map((arret) => ({
            cle: `arret:${arret.id}`,
            libelle: `${arret.ordre}. ${arret.gare_nom ?? "Arrêt"}`,
            arret_id: arret.id,
            gare_id: arret.gare_id,
          })),
          ...(ligne
            ? [
                {
                  cle: `gare:${ligne.gare_arrivee_id}`,
                  libelle: `Terminus — ${ligne.gare_arrivee_nom ?? "Arrivée"}`,
                  gare_id: ligne.gare_arrivee_id,
                },
              ]
            : []),
        ]}
        surSucces={() => setRafraichir((nombre) => nombre + 1)}
      />

      <div
        role="tablist"
        aria-label="Contenu du voyage"
        className="flex flex-wrap gap-2"
      >
        {(
          [
            ["manifeste", "Manifeste"],
            ["passagers", `Passagers (${totalPassagers})`],
            ["colis", `Colis (${totalColis})`],
            ["enregistrement", "Enregistrer en route"],
          ] as const
        ).map(([cle, libelle]) => (
          <Bouton
            key={cle}
            variante={onglet === cle ? "primaire" : "ghost"}
            taille="petit"
            id={`voyage-tab-${cle}`}
            role="tab"
            aria-selected={onglet === cle}
            aria-controls={`voyage-panel-${cle}`}
            tabIndex={onglet === cle ? 0 : -1}
            onClick={() => setOnglet(cle)}
          >
            {libelle}
          </Bouton>
        ))}
      </div>

      <section
        id="voyage-panel-manifeste"
        role="tabpanel"
        aria-labelledby="voyage-tab-manifeste"
        hidden={onglet !== "manifeste"}
      >
        <ManifesteVoyage voyageId={voyage.id} rafraichir={rafraichir} />
      </section>

      <section
        id="voyage-panel-passagers"
        role="tabpanel"
        aria-labelledby="voyage-tab-passagers"
        hidden={onglet !== "passagers"}
      >
        <Carte titre={`Passagers (${totalPassagers})`} className="p-4">
          {erreurPassagers && (
            <Alerte variante="erreur" titre="Passagers indisponibles">
              {erreurPassagers}
            </Alerte>
          )}
          {chargementPassagers ? (
            <p className="py-6 text-center text-sm italic text-ardoise-clair">
              Chargement des passagers…
            </p>
          ) : passagers.length === 0 ? (
            <p className="py-6 text-center text-sm italic text-ardoise-clair">
              Aucun passager suivi affecté à ce voyage.
            </p>
          ) : (
            <>
              <ul className="space-y-3 sm:hidden">
                {passagers.map((passager) => {
                  const statutPassager =
                    passager.statut as keyof typeof LIBELLES_STATUT_SUIVI;
                  return (
                    <li
                      key={passager.id}
                      className="rounded-xl border border-ardoise-clair/10 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-ardoise-clair">
                            Code
                          </span>
                          <span className="font-mono text-sm font-semibold text-lagune">
                            {passager.code_clair ?? "—"}
                          </span>
                        </div>
                        <Badge
                          variante={
                            passager.statut === "arrive"
                              ? "succes"
                              : passager.statut === "en_route"
                                ? "ocre"
                                : "info"
                          }
                        >
                          {LIBELLES_STATUT_SUIVI[statutPassager] ?? passager.statut}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-ardoise">
                        {passager.gare_depart_nom ?? "?"} →{" "}
                        {passager.gare_arrivee_nom ?? "?"}
                      </p>
                      <details className="mt-3">
                        <summary className="inline-flex cursor-pointer list-none items-center rounded-xl border border-ardoise-clair/20 px-3 py-1.5 text-sm font-medium text-lagune hover:bg-sable">
                          Détails
                        </summary>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-ardoise-clair/10 pt-3 text-sm">
                          <ChampDetail
                            libelle="Code"
                            valeur={passager.code_clair ?? "—"}
                          />
                          <ChampDetail
                            libelle="Statut"
                            valeur={
                              LIBELLES_STATUT_SUIVI[statutPassager] ??
                              passager.statut
                            }
                          />
                          <ChampDetail
                            libelle="Trajet"
                            valeur={`${passager.gare_depart_nom ?? "?"} → ${
                              passager.gare_arrivee_nom ?? "?"
                            }`}
                          />
                          <ChampDetail libelle="Passager" valeur={passager.enfant_nom} />
                          <ChampDetail
                            libelle="Type"
                            valeur={passager.type_passager === "adulte" ? "Adulte" : "Enfant"}
                          />
                          <ChampDetail
                            libelle="Sacs"
                            valeur={String(passager.nombre_bagages)}
                          />
                          <ChampDetail
                            libelle="Responsable"
                            valeur={passager.telephone_parent}
                          />
                        </dl>
                      </details>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto sm:block">
                <table className="min-w-[42rem] w-full text-sm">
                  <thead>
                    <tr className="border-b border-ardoise-clair/20 text-left text-xs uppercase tracking-wider text-ardoise-clair">
                      <th className="py-2 pr-3">Passager</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Sacs</th>
                      <th className="py-2 pr-3">Responsable</th>
                      <th className="py-2 pr-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passagers.map((passager) => {
                      const statutPassager =
                        passager.statut as keyof typeof LIBELLES_STATUT_SUIVI;
                      return (
                        <tr
                          key={passager.id}
                          className="border-b border-ardoise-clair/10"
                        >
                          <td className="py-2 pr-3 font-medium text-ardoise">
                            <span className="inline-flex items-center gap-2">
                              <IconeIdentite className="h-4 w-4 text-lagune" />
                              {passager.enfant_nom}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-ardoise-clair">
                            {passager.type_passager === "adulte" ? "Adulte" : "Enfant"}
                          </td>
                          <td className="py-2 pr-3 text-ardoise-clair">
                            {passager.nombre_bagages}
                          </td>
                          <td className="py-2 pr-3 text-ardoise-clair">
                            {passager.telephone_parent}
                          </td>
                          <td className="py-2 pr-3">
                            <Badge
                              variante={
                                passager.statut === "arrive"
                                  ? "succes"
                                  : passager.statut === "en_route"
                                    ? "ocre"
                                    : "info"
                              }
                            >
                              {LIBELLES_STATUT_SUIVI[statutPassager] ??
                                passager.statut}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <PaginationListe
            page={pagePassagers}
            total={totalPassagers}
            parPage={ELEMENTS_PAR_PAGE}
            chargement={chargementPassagers}
            surChangement={setPagePassagers}
          />
        </Carte>
      </section>

      <section
        id="voyage-panel-colis"
        role="tabpanel"
        aria-labelledby="voyage-tab-colis"
        hidden={onglet !== "colis"}
      >
        <Carte titre={`Colis (${totalColis})`} className="p-4">
          {erreurColis && (
            <Alerte variante="erreur" titre="Colis indisponibles">
              {erreurColis}
            </Alerte>
          )}
          {chargementColis ? (
            <p className="py-6 text-center text-sm italic text-ardoise-clair">
              Chargement des colis…
            </p>
          ) : (
            <TableauColis
              colis={colis}
              cartesMobiles
              baseSuivi="/chauffeur/colis"
              baseScan="/chauffeur/scan"
              messageVide="Aucun colis affecté à ce voyage pour le moment."
            />
          )}
          <PaginationListe
            page={pageColis}
            total={totalColis}
            parPage={ELEMENTS_PAR_PAGE}
            chargement={chargementColis}
            surChangement={setPageColis}
          />
        </Carte>
      </section>

      <section
        id="voyage-panel-enregistrement"
        role="tabpanel"
        aria-labelledby="voyage-tab-enregistrement"
        hidden={onglet !== "enregistrement"}
      >
        {voyage.statut !== "termine" && voyage.statut !== "annule" ? (
          <EnregistrementDirectChauffeur
            voyageId={voyage.id}
            gareDepartId={ligne?.gare_depart_id ?? null}
            gareArriveeId={ligne?.gare_arrivee_id ?? null}
            surSucces={() => setRafraichir((nombre) => nombre + 1)}
          />
        ) : (
          <Alerte variante="info" titre="Voyage terminé">
            Les colis et passagers ne peuvent plus être enregistrés sur ce voyage.
          </Alerte>
        )}
      </section>
    </div>
  );
}

function ChampDetail({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <dt className="text-xs text-ardoise-clair">{libelle}</dt>
      <dd className="text-ardoise">{valeur}</dd>
    </div>
  );
}
