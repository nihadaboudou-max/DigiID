"use client";
/**
 * Tableau récapitulatif des colis — guichet logistique (S3).
 *
 * Affiche une ligne par colis (numéro, destinataire, trajet, statut, frais)
 * avec un lien vers le suivi détaillé. Utilisé par le tableau de bord et la
 * liste des tickets.
 */
import Link from "next/link";

import { Badge } from "@/composants/commun/Badge";
import {
  LIBELLES_STATUT_COLIS,
  VARIANTES_STATUT_COLIS,
  type Colis,
} from "@/types/logistique";
import { formaterDateHeure, formaterFcfa } from "./format";

interface Proprietes {
  colis: Colis[];
  /** Message affiché si la liste est vide. */
  messageVide?: string;
  /** Base des liens de suivi (défaut : guichet receveur). */
  baseSuivi?: string;
  /**
   * Si fourni, ajoute une action « Scanner » par ligne pointant vers cette base
   * (`{baseScan}?code=<code_clair>`). Utilisé par l'espace chauffeur (S4).
   */
  baseScan?: string;
  /** Affiche des cartes sous 640 px, sans modifier le tableau desktop. */
  cartesMobiles?: boolean;
}

function libelleStatutColis(colis: Colis): string {
  if (colis.statut === "recu_chauffeur") {
    return colis.chauffeur_nom
      ? `Reçu par ${colis.chauffeur_nom}`
      : "Reçu par le chauffeur";
  }
  if (colis.statut === "a_valider" || (colis.statut === "enregistre" && colis.chauffeur_id)) {
    return "À valider";
  }
  if (colis.statut === "non_attribue" || (colis.statut === "enregistre" && !colis.chauffeur_id)) {
    return "Non attribué";
  }
  return LIBELLES_STATUT_COLIS[colis.statut] ?? colis.statut;
}

export function TableauColis({
  colis,
  messageVide = "Aucun colis pour le moment.",
  baseSuivi = "/receveur/tickets",
  baseScan,
  cartesMobiles = false,
}: Proprietes) {
  if (colis.length === 0) {
    return <p className="text-sm text-ardoise-clair italic py-6 text-center">{messageVide}</p>;
  }

  return (
    <>
      {cartesMobiles && (
        <ul className="space-y-3 sm:hidden">
          {colis.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-ardoise-clair/10 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-ardoise-clair">
                    Code
                  </span>
                  <span className="font-mono font-semibold text-lagune">
                    {c.code_clair || "—"}
                  </span>
                </span>
                <Badge variante={VARIANTES_STATUT_COLIS[c.statut] ?? "neutre"}>
                  {libelleStatutColis(c)}
                </Badge>
              </div>

              <p className="mt-2 text-sm text-ardoise">
                {c.gare_depart_nom || "—"} → {c.gare_arrivee_nom || "—"}
              </p>

              <details className="mt-3">
                <summary className="inline-flex cursor-pointer list-none items-center rounded-xl border border-ardoise-clair/20 px-3 py-1.5 text-sm font-medium text-lagune hover:bg-sable">
                  Détails
                </summary>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-ardoise-clair/10 pt-3 text-sm">
                  <div>
                    <dt className="text-xs text-ardoise-clair">Code</dt>
                    <dd className="font-mono text-ardoise">{c.code_clair || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ardoise-clair">Statut</dt>
                    <dd className="text-ardoise">
                      {libelleStatutColis(c)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ardoise-clair">Destinataire</dt>
                    <dd className="text-ardoise">{c.destinataire_nom}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ardoise-clair">Téléphone</dt>
                    <dd className="text-ardoise">{c.destinataire_tel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ardoise-clair">Trajet</dt>
                    <dd className="text-ardoise">
                      {c.gare_depart_nom || "—"} → {c.gare_arrivee_nom || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ardoise-clair">Articles</dt>
                    <dd className="text-ardoise">{c.nombre_articles ?? 1}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ardoise-clair">Frais</dt>
                    <dd className="text-ardoise">{formaterFcfa(c.frais_fcfa)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ardoise-clair">Enregistré</dt>
                    <dd className="text-ardoise">{formaterDateHeure(c.cree_le)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium">
                  {c.code_clair && (
                    <Link
                      href={`${baseSuivi}/${encodeURIComponent(c.code_clair)}`}
                      className="text-lagune hover:underline"
                    >
                      Voir le suivi →
                    </Link>
                  )}
                  {baseScan && c.code_clair && (
                    <Link
                      href={`${baseScan}?code=${encodeURIComponent(c.code_clair)}`}
                      className="text-ocre-fonce hover:underline"
                    >
                      Scanner
                    </Link>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <div className={cartesMobiles ? "hidden overflow-x-auto sm:block" : "overflow-x-auto"}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-ardoise-clair border-b border-ardoise-clair/15">
            <th className="py-2 pr-3 font-semibold">Numéro</th>
            <th className="py-2 pr-3 font-semibold">Destinataire</th>
            <th className="py-2 pr-3 font-semibold">Trajet</th>
            <th className="py-2 pr-3 font-semibold">Statut</th>
            <th className="py-2 pr-3 font-semibold text-center">Articles</th>
            <th className="py-2 pr-3 font-semibold text-right">Frais</th>
            <th className="py-2 pr-3 font-semibold">Enregistré</th>
            <th className="py-2 font-semibold text-right">Suivi</th>
            {baseScan && <th className="py-2 font-semibold text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {colis.map((c) => (
            <tr
              key={c.id}
              className="border-b border-ardoise-clair/10 hover:bg-sable/60 transition-colors"
            >
              <td className="py-2.5 pr-3">
                <span className="font-mono font-semibold text-lagune">
                  {c.code_clair || "—"}
                </span>
              </td>
              <td className="py-2.5 pr-3">
                <span className="text-ardoise">{c.destinataire_nom}</span>
                <span className="block text-xs text-ardoise-clair">
                  {c.destinataire_tel}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-ardoise-clair">
                {c.gare_depart_nom || "—"} → {c.gare_arrivee_nom || "—"}
              </td>
              <td className="py-2.5 pr-3">
                <Badge variante={VARIANTES_STATUT_COLIS[c.statut] ?? "neutre"}>
                  {libelleStatutColis(c)}
                </Badge>
              </td>
              <td className="py-2.5 pr-3 text-center font-medium text-ardoise">
                {c.nombre_articles ?? 1}
              </td>
              <td className="py-2.5 pr-3 text-right font-medium text-ardoise">
                {formaterFcfa(c.frais_fcfa)}
              </td>
              <td className="py-2.5 pr-3 text-xs text-ardoise-clair">
                {formaterDateHeure(c.cree_le)}
              </td>
              <td className="py-2.5 text-right">
                {c.code_clair ? (
                  <Link
                    href={`${baseSuivi}/${encodeURIComponent(c.code_clair)}`}
                    className="text-lagune hover:underline font-medium whitespace-nowrap"
                  >
                    Voir →
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              {baseScan && (
                <td className="py-2.5 text-right">
                  {c.code_clair ? (
                    <Link
                      href={`${baseScan}?code=${encodeURIComponent(c.code_clair)}`}
                      className="text-ocre-fonce hover:underline font-medium whitespace-nowrap"
                    >
                      Scanner
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
