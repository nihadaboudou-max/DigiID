"use client";
/**
 * Liste des enfants suivis (guichet) — suivi familial (Plan B, étape S7).
 *
 * Le guichet enregistre un enfant (ticket ``ENFANT``). Le chauffeur marque le
 * départ et l'arrivée ; le guichet ne confirme que la remise à la famille après
 * que le chauffeur lui a confié l'enfant.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge, type BadgeVariante } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeCheck, IconeIdentite, IconeUtilisateur } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { AffecterChauffeur } from "@/composants/logistique/AffecterChauffeur";
import { formaterDateHeure } from "@/composants/logistique/format";
import { PaginationListe } from "@/composants/logistique/PaginationListe";
import { ROLES_GUICHET } from "@/composants/logistique/roles";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import {
  LIBELLES_STATUT_SUIVI,
  type StatutSuiviFamilial,
  type SuiviFamilial,
} from "@/types/logistique";

const VARIANTES_STATUT: Record<StatutSuiviFamilial, BadgeVariante> = {
  enregistre: "info",
  // Enregistré par le chauffeur en route : même couleur que « Enregistré »,
  // le badge de provenance (mode_enregistrement) porte l'information.
  enregistre_direct: "info",
  en_route: "ocre",
  arrive: "succes",
  annule: "terre",
};

export default function PageSuiviFamilial() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [suivis, setSuivis] = useState<SuiviFamilial[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<"" | StatutSuiviFamilial>("");
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalFiltres, setTotalFiltres] = useState(0);
  const [compteurs, setCompteurs] = useState({ total: 0, en_route: 0, arrives: 0 });
  const requeteCourante = useRef(0);
  const [remisesConfirmees, setRemisesConfirmees] = useState<Set<string>>(
    () => new Set(),
  );
  const [codesRemise, setCodesRemise] = useState<Record<string, string>>({});
  const [motifsSansCode, setMotifsSansCode] = useState<Record<string, string>>({});
  /** Suivi dont on est en train de (ré)affecter le chauffeur (panneau ouvert). */
  const [affectationPour, setAffectationPour] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const numeroRequete = ++requeteCourante.current;
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await logistiqueAPI.suiviFamilial.lister({
        page,
        par_page: 5,
        ...(filtreStatut ? { statut: filtreStatut } : {}),
        ...(recherche.trim() ? { recherche: recherche.trim() } : {}),
      });
      if (numeroRequete !== requeteCourante.current) return;
      setSuivis(reponse.elements);
      setTotalFiltres(reponse.total);
    } catch (e) {
      if (numeroRequete !== requeteCourante.current) return;
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger les suivis familiaux. Réessayez.",
      );
    } finally {
      if (numeroRequete === requeteCourante.current) setChargement(false);
    }
  }, [filtreStatut, page, recherche]);

  const chargerCompteurs = useCallback(async () => {
    try {
      const [total, enRoute, arrives] = await Promise.all([
        logistiqueAPI.suiviFamilial.lister({ page: 1, par_page: 1 }),
        logistiqueAPI.suiviFamilial.lister({
          page: 1,
          par_page: 1,
          statut: "en_route",
        }),
        logistiqueAPI.suiviFamilial.lister({
          page: 1,
          par_page: 1,
          statut: "arrive",
        }),
      ]);
      setCompteurs({
        total: total.total,
        en_route: enRoute.total,
        arrives: arrives.total,
      });
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger les compteurs des suivis familiaux.",
      );
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    void chargerCompteurs();
  }, [chargerCompteurs]);

  /** Confirme la remise à la famille après le dépôt du chauffeur au guichet. */
  async function confirmerRemise(
    suivi: SuiviFamilial,
    code?: string,
    motifSansCode?: string,
  ) {
    setActionEnCours(`${suivi.id}:livraison`);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await logistiqueAPI.suiviFamilial.enregistrerEvenement(
        suivi.id,
        {
          type_evenement: "livraison",
          gare_id: suivi.gare_arrivee_id,
          idempotency_key: `livraison-${suivi.id}`,
          ...(code ? { code_confirmation: code } : {}),
          ...(motifSansCode ? { motif_sans_code: motifSansCode.trim() } : {}),
        },
      );
      setRemisesConfirmees((precedentes) => new Set(precedentes).add(suivi.id));
      setCodesRemise((precedents) => ({ ...precedents, [suivi.id]: "" }));
      setMotifsSansCode((precedents) => ({ ...precedents, [suivi.id]: "" }));
      setMessage(`${suivi.enfant_nom} — ${resultat.message}`);
      await charger();
      await chargerCompteurs();
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Échec de l'enregistrement de l'étape. Réessayez.",
      );
    } finally {
      setActionEnCours(null);
    }
  }

  async function renvoyerCodeRemise(suivi: SuiviFamilial) {
    setActionEnCours(`${suivi.id}:code`);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await logistiqueAPI.suiviFamilial.renvoyerCodeRemise(
        suivi.id,
      );
      setMessage(resultat.message);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de renvoyer le code de remise.",
      );
    } finally {
      setActionEnCours(null);
    }
  }

  return (
    <div className="space-y-6 apparition">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ardoise">Suivi familial</h1>
          <p className="text-sm text-ardoise-clair">
            Enfants voyageant seuls — la famille est rassurée par SMS au départ et
            à l&apos;arrivée.
          </p>
        </div>
        <Link href="/receveur/suivi-familial/nouveau">
          <Bouton variante="primaire">
            <IconeIdentite className="h-4 w-4" /> Enregistrer un voyageur
          </Bouton>
        </Link>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}
      {message && (
        <Alerte variante="succes" titre="Remise confirmée">
          {message}
        </Alerte>
      )}

      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-3">
        <Compteur libelle="Enfants suivis" valeur={compteurs.total} />
        <Compteur libelle="En route" valeur={compteurs.en_route} couleur="text-ocre-fonce" />
        <Compteur libelle="Arrivés" valeur={compteurs.arrives} couleur="text-lagune" />
      </div>

      {/* Filtres */}
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
            placeholder="Nom de l'enfant, parent, code ou téléphone"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ardoise">Statut</label>
          <select
            className="champ-saisie"
            value={filtreStatut}
            onChange={(e) => {
              setFiltreStatut(e.target.value as "" | StatutSuiviFamilial);
              setPage(1);
            }}
          >
            <option value="">Tous</option>
            <option value="enregistre">Enregistré</option>
            <option value="en_route">En route</option>
            <option value="arrive">Arrivé</option>
            <option value="annule">Annulé</option>
          </select>
        </div>
      </div>

      {/* Liste */}
      <Carte>
        {chargement ? (
          <p className="py-8 text-center text-sm italic text-ardoise-clair">
            Chargement des suivis…
          </p>
        ) : suivis.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-ardoise-clair">
            Aucun enfant suivi pour ces critères.
          </p>
        ) : (
          <ul className="space-y-3">
            {suivis.map((suivi) => {
              const arrive = suivi.statut === "arrive";
              const peutRemiseSansCode = [
                "gerant_gare",
                "super_admin",
                "super_administrateur",
              ].includes(utilisateur?.role ?? "");
              const remiseConfiee =
                peutRemiseSansCode ||
                (suivi.remis_guichet_le != null &&
                  suivi.remis_guichet_a_id === utilisateur?.id);
              return (
                <li
                  key={suivi.id}
                  className="rounded-xl border border-ardoise-clair/10 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-ardoise">
                          {suivi.enfant_nom}
                        </p>
                        <Badge variante={VARIANTES_STATUT[suivi.statut]}>
                          {LIBELLES_STATUT_SUIVI[suivi.statut] ?? suivi.statut}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-ardoise-clair">
                        {suivi.enfant_age != null && `${suivi.enfant_age} ans · `}
                        {suivi.enfant_sexe === "M"
                          ? "Garçon · "
                          : suivi.enfant_sexe === "F"
                          ? "Fille · "
                          : ""}
                        {suivi.code_clair ?? "code en attente"}
                      </p>
                      <p className="mt-1 text-sm text-ardoise">
                        {suivi.gare_depart_nom ?? "?"}{" "}
                        <span className="text-ocre">→</span>{" "}
                        {suivi.gare_arrivee_nom ?? "?"}
                      </p>
                      <p className="mt-1 text-xs text-ardoise-clair">
                        Parent : {suivi.parent_nom || "—"} · {suivi.telephone_parent}
                      </p>
                      <p className="mt-1 text-xs">
                        <span
                          className={
                            suivi.chauffeur_nom
                              ? "font-medium text-lagune"
                              : "font-medium text-ocre-fonce"
                          }
                        >
                          Chauffeur : {suivi.chauffeur_nom ?? "à affecter"}
                        </span>
                        {suivi.mode_enregistrement === "chauffeur_direct" && (
                          <span className="text-ardoise-clair"> · enregistré en route</span>
                        )}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        <span
                          className={
                            suivi.sms_depart_envoye
                              ? "rounded-full bg-green-100 px-2 py-0.5 text-green-800"
                              : "rounded-full bg-ardoise-clair/10 px-2 py-0.5 text-ardoise-clair"
                          }
                        >
                          SMS départ {suivi.sms_depart_envoye ? "envoyé" : "en attente"}
                        </span>
                        <span
                          className={
                            suivi.sms_arrivee_envoye
                              ? "rounded-full bg-green-100 px-2 py-0.5 text-green-800"
                              : "rounded-full bg-ardoise-clair/10 px-2 py-0.5 text-ardoise-clair"
                          }
                        >
                          SMS arrivée {suivi.sms_arrivee_envoye ? "envoyé" : "en attente"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-col items-stretch gap-2">
                      {remiseConfiee &&
                        arrive &&
                        suivi.type_passager === "enfant" &&
                        !remisesConfirmees.has(suivi.id) && (
                        <div className="min-w-60 space-y-2">
                          <label
                            className="block text-xs font-medium text-ardoise"
                            htmlFor={`code-remise-${suivi.id}`}
                          >
                            Code de remise à six chiffres
                          </label>
                          <input
                            id={`code-remise-${suivi.id}`}
                            className="champ-saisie"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={codesRemise[suivi.id] ?? ""}
                            onChange={(event) =>
                              setCodesRemise((precedents) => ({
                                ...precedents,
                                [suivi.id]: event.target.value.replace(/\D/g, "").slice(0, 6),
                              }))
                            }
                          />
                          <Bouton
                            variante="succes"
                            taille="petit"
                            chargement={actionEnCours === `${suivi.id}:livraison`}
                            disabled={
                              actionEnCours !== null ||
                              !/^\d{6}$/.test(codesRemise[suivi.id] ?? "")
                            }
                            onClick={() =>
                              void confirmerRemise(suivi, codesRemise[suivi.id])
                            }
                          >
                            <IconeCheck className="h-4 w-4" /> Remettre l'enfant
                          </Bouton>
                          <Bouton
                            variante="ghost"
                            taille="petit"
                            chargement={actionEnCours === `${suivi.id}:code`}
                            disabled={actionEnCours !== null}
                            onClick={() => void renvoyerCodeRemise(suivi)}
                          >
                            Renvoyer le code
                          </Bouton>
                          {peutRemiseSansCode && (
                            <>
                              <label
                                className="block text-xs font-medium text-ardoise"
                                htmlFor={`motif-remise-${suivi.id}`}
                              >
                                Motif obligatoire — remise sans code
                              </label>
                              <textarea
                                id={`motif-remise-${suivi.id}`}
                                className="champ-saisie"
                                maxLength={500}
                                value={motifsSansCode[suivi.id] ?? ""}
                                onChange={(event) =>
                                  setMotifsSansCode((precedents) => ({
                                    ...precedents,
                                    [suivi.id]: event.target.value,
                                  }))
                                }
                              />
                              <Bouton
                                variante="danger"
                                taille="petit"
                                disabled={
                                  actionEnCours !== null ||
                                  (motifsSansCode[suivi.id] ?? "").trim().length < 5
                                }
                                onClick={() =>
                                  void confirmerRemise(
                                    suivi,
                                    undefined,
                                    motifsSansCode[suivi.id],
                                  )
                                }
                              >
                                Remise exceptionnelle sans code
                              </Bouton>
                            </>
                          )}
                        </div>
                      )}
                      {!arrive && suivi.statut !== "annule" && (
                        <Bouton
                          variante="ghost"
                          taille="petit"
                          onClick={() =>
                            setAffectationPour(
                              affectationPour === suivi.id ? null : suivi.id,
                            )
                          }
                        >
                          <IconeUtilisateur className="h-4 w-4" />{" "}
                          {suivi.chauffeur_nom
                            ? "Changer de chauffeur"
                            : "Affecter un chauffeur"}
                        </Bouton>
                      )}
                      {suivi.code_clair && (
                        <a
                          href={`/suivi/${encodeURIComponent(suivi.code_clair)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Bouton variante="ghost" taille="petit" className="w-full">
                            Voir le suivi public
                          </Bouton>
                        </a>
                      )}
                      <span className="text-center text-[10px] text-ardoise-clair">
                        Enregistré le {formaterDateHeure(suivi.cree_le)}
                        {suivi.enregistre_par_nom
                          ? ` · ${suivi.enregistre_par_nom}`
                          : ""}
                      </span>
                    </div>
                  </div>

                  {affectationPour === suivi.id && (
                    <div className="mt-4 border-t border-ardoise-clair/15 pt-4">
                      <AffecterChauffeur
                        gareDepartId={suivi.gare_depart_id}
                        gareArriveeId={suivi.gare_arrivee_id}
                        voyageIdActuel={suivi.voyage_id}
                        chauffeurNomActuel={suivi.chauffeur_nom}
                        statut={suivi.statut}
                        surAffecter={async (voyageId) => {
                          const maj = await logistiqueAPI.suiviFamilial.affecter(
                            suivi.id,
                            { voyage_id: voyageId },
                          );
                          setSuivis((precedents) =>
                            precedents.map((s) => (s.id === maj.id ? maj : s)),
                          );
                          setMessage(
                            `${maj.enfant_nom} — chauffeur affecté${
                              maj.chauffeur_nom ? ` : ${maj.chauffeur_nom}` : ""
                            }.`,
                          );
                          setAffectationPour(null);
                        }}
                      />
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

      <div className="rounded-xl bg-lagune/5 p-3 text-xs text-ardoise-clair">
        💡 Le chauffeur enregistre le départ et l&apos;arrivée. Le guichet confirme
        uniquement la remise à la famille après réception de l&apos;enfant du
        chauffeur ; les proches peuvent suivre le voyage avec le code du ticket.
      </div>
    </div>
  );
}

/** Compteur coloré (statistiques rapides). */
function Compteur({
  libelle,
  valeur,
  couleur = "text-ardoise",
}: {
  libelle: string;
  valeur: number;
  couleur?: string;
}) {
  return (
    <div className="carte py-4 text-center">
      <p className={`text-2xl font-bold ${couleur}`}>{valeur}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
        {libelle}
      </p>
    </div>
  );
}
