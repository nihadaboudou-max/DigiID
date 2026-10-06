"use client";
/**
 * Mes passagers — espace chauffeur.
 *
 * Vue globale (tous mes cars) des personnes à bord : enfant suivi ou adulte.
 * Le chauffeur marque le départ et l'arrivée directement d'ici — chaque étape
 * déclenche le SMS à la famille — sans passer par un écran « receveur ».
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge, type BadgeVariante } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeIdentite, IconeScan } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { formaterDateHeure } from "@/composants/logistique/format";
import { useMesVoyages } from "@/composants/logistique/MonVoyageDuJour";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import {
  LIBELLES_STATUT_SUIVI,
  type StatutSuiviFamilial,
  type SuiviFamilial,
} from "@/types/logistique";

const VARIANTES: Record<StatutSuiviFamilial, BadgeVariante> = {
  enregistre: "info",
  enregistre_direct: "info",
  en_route: "ocre",
  arrive: "succes",
  annule: "terre",
};

export default function PageMesPassagers() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { voyages, chargement: chargementVoyages } = useMesVoyages();
  const [suivis, setSuivis] = useState<SuiviFamilial[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (voyages.length === 0) {
      setSuivis([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      // Filtre **côté serveur** : uniquement les passagers de ses propres cars.
      const reponses = await Promise.all(
        voyages.map((voyage) =>
          logistiqueAPI.suiviFamilial.lister({ voyage_id: voyage.id, par_page: 100 }),
        ),
      );
      setSuivis(reponses.flatMap((reponse) => reponse.elements));
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger vos passagers. Réessayez.",
      );
    } finally {
      setChargement(false);
    }
  }, [voyages]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // L'API a déjà restreint la liste à ses cars : aucun filtrage à refaire ici.
  const mesPassagers = suivis;

  const passagersFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return mesPassagers;
    return mesPassagers.filter((s) =>
      [s.enfant_nom, s.telephone_parent, s.code_clair]
        .filter(Boolean)
        .some((champ) => String(champ).toLowerCase().includes(terme)),
    );
  }, [mesPassagers, recherche]);

  /** Marque une étape : le SMS part vers la famille (idempotent). */
  async function marquer(suivi: SuiviFamilial, type: "depart" | "arrivee") {
    setActionEnCours(`${suivi.id}:${type}`);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await logistiqueAPI.suiviFamilial.enregistrerEvenement(suivi.id, {
        type_evenement: type,
        gare_id: type === "arrivee" ? suivi.gare_arrivee_id : suivi.gare_depart_id,
        idempotency_key: `${type}-${suivi.id}`,
      });
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

  return (
    <div className="space-y-5 apparition">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ardoise">Mes passagers</h1>
          <p className="text-sm text-ardoise-clair">
            Les personnes à bord de vos cars. Marquez le départ et l&apos;arrivée :
            la famille reçoit un SMS à chaque étape.
          </p>
        </div>
        <Link href="/chauffeur/passagers/nouveau">
          <Bouton variante="primaire" taille="petit">
            <IconeIdentite className="h-4 w-4" /> Enregistrer un passager
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

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-ardoise">Rechercher</label>
        <input
          className="champ-saisie"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Nom, code du ticket ou téléphone de la famille"
        />
      </div>

      <Carte
        titre={`${passagersFiltres.length} passager(s) à bord`}
        description="Seuls les passagers rattachés à l'un de vos cars apparaissent ici."
      >
        {chargement || chargementVoyages ? (
          <p className="py-8 text-center text-sm italic text-ardoise-clair">
            Chargement de vos passagers…
          </p>
        ) : passagersFiltres.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-ardoise-clair">
            Aucun passager pour le moment. Utilisez « Enregistrer un passager »
            lorsqu&apos;une personne monte en route.
          </p>
        ) : (
          <ul className="space-y-3">
            {passagersFiltres.map((suivi) => {
              const arrive = suivi.statut === "arrive";
              const enRoute = suivi.statut === "en_route";
              return (
                <li
                  key={suivi.id}
                  className="rounded-xl border border-ardoise-clair/10 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ardoise">
                          {suivi.enfant_nom}
                        </p>
                        <Badge variante={VARIANTES[suivi.statut]}>
                          {LIBELLES_STATUT_SUIVI[suivi.statut] ?? suivi.statut}
                        </Badge>
                        <Badge variante="neutre">
                          {suivi.type_passager === "enfant" ? "Enfant" : "Adulte"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-ardoise">
                        {suivi.gare_depart_nom ?? "?"}{" "}
                        <span className="text-ocre">→</span>{" "}
                        {suivi.gare_arrivee_nom ?? "?"}
                      </p>
                      <p className="mt-1 text-xs text-ardoise-clair">
                        Famille : {suivi.parent_nom || "—"} · {suivi.telephone_parent}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-ardoise-clair">
                        {suivi.code_clair ?? "code en attente"} · enregistré le{" "}
                        {formaterDateHeure(suivi.cree_le)}
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
                      {!arrive && suivi.statut !== "annule" && (
                        <Bouton
                          variante="succes"
                          taille="petit"
                          chargement={actionEnCours === `${suivi.id}:arrivee`}
                          disabled={actionEnCours !== null}
                          onClick={() => void marquer(suivi, "arrivee")}
                        >
                          Marquer l&apos;arrivée
                        </Bouton>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>
    </div>
  );
}
