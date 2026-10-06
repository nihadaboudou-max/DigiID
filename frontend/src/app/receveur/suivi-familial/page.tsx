"use client";
/**
 * Liste des enfants suivis (guichet) — suivi familial (Plan B, étape S7).
 *
 * Le guichet enregistre un enfant (ticket ``ENFANT``), puis marque le
 * **départ** et l'**arrivée** : chaque étape déclenche un SMS automatique au
 * parent et reste traçable. La famille peut aussi consulter la page publique
 * ``/suivi/ENF-…`` (sans compte).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge, type BadgeVariante } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeIdentite, IconeScan, IconeUtilisateur } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { AffecterChauffeur } from "@/composants/logistique/AffecterChauffeur";
import { formaterDateHeure } from "@/composants/logistique/format";
import { ROLES_GUICHET } from "@/composants/logistique/roles";
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
  const [suivis, setSuivis] = useState<SuiviFamilial[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<"" | StatutSuiviFamilial>("");
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  /** Suivi dont on est en train de (ré)affecter le chauffeur (panneau ouvert). */
  const [affectationPour, setAffectationPour] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await logistiqueAPI.suiviFamilial.lister({ par_page: 100 });
      setSuivis(reponse.elements);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger les suivis familiaux. Réessayez.",
      );
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  /** Marque une étape (départ / arrivée) : déclenche le SMS au parent. */
  async function marquer(suivi: SuiviFamilial, type: "depart" | "arrivee") {
    setActionEnCours(`${suivi.id}:${type}`);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await logistiqueAPI.suiviFamilial.enregistrerEvenement(
        suivi.id,
        {
          type_evenement: type,
          gare_id: type === "arrivee" ? suivi.gare_arrivee_id : suivi.gare_depart_id,
          // Clé stable : empêche tout double enregistrement si l'agent reclique.
          idempotency_key: `${type}-${suivi.id}`,
        },
      );
      setMessage(`${suivi.enfant_nom} — ${resultat.message}`);
      await charger();
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

  const suivisFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return suivis.filter((s) => {
      if (filtreStatut && s.statut !== filtreStatut) return false;
      if (!terme) return true;
      return (
        s.enfant_nom.toLowerCase().includes(terme) ||
        (s.parent_nom ?? "").toLowerCase().includes(terme) ||
        (s.code_clair ?? "").toLowerCase().includes(terme) ||
        s.telephone_parent.includes(terme)
      );
    });
  }, [suivis, recherche, filtreStatut]);

  const compteurs = useMemo(
    () => ({
      total: suivis.length,
      en_route: suivis.filter((s) => s.statut === "en_route").length,
      arrives: suivis.filter((s) => s.statut === "arrive").length,
    }),
    [suivis],
  );

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
            <IconeIdentite className="h-4 w-4" /> Enregistrer un enfant
          </Bouton>
        </Link>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}
      {message && (
        <Alerte variante="succes" titre="Étape enregistrée">
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
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom de l'enfant, parent, code ou téléphone"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ardoise">Statut</label>
          <select
            className="champ-saisie"
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value as "" | StatutSuiviFamilial)}
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
        ) : suivisFiltres.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-ardoise-clair">
            Aucun enfant suivi pour ces critères.
          </p>
        ) : (
          <ul className="space-y-3">
            {suivisFiltres.map((suivi) => {
              const enRoute = suivi.statut === "en_route";
              const arrive = suivi.statut === "arrive";
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
                      {!enRoute && !arrive && (
                        <Bouton
                          variante="secondaire"
                          taille="petit"
                          chargement={actionEnCours === `${suivi.id}:depart`}
                          disabled={actionEnCours !== null || suivi.statut === "annule"}
                          onClick={() => void marquer(suivi, "depart")}
                        >
                          <IconeScan className="h-4 w-4" /> Marquer le départ
                        </Bouton>
                      )}
                      {!arrive && (
                        <Bouton
                          variante="succes"
                          taille="petit"
                          chargement={actionEnCours === `${suivi.id}:arrivee`}
                          disabled={actionEnCours !== null || suivi.statut === "annule"}
                          onClick={() => void marquer(suivi, "arrivee")}
                        >
                          ✅ Marquer l&apos;arrivée
                        </Bouton>
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
      </Carte>

      <div className="rounded-xl bg-lagune/5 p-3 text-xs text-ardoise-clair">
        💡 Le suivi familial rassure les familles : le parent reçoit un SMS
        automatique au départ puis à l&apos;arrivée, et peut suivre le voyage en
        ligne avec le code imprimé sur le ticket.
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
