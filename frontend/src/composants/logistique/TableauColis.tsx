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
}

export function TableauColis({
  colis,
  messageVide = "Aucun colis pour le moment.",
}: Proprietes) {
  if (colis.length === 0) {
    return <p className="text-sm text-ardoise-clair italic py-6 text-center">{messageVide}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-ardoise-clair border-b border-ardoise-clair/15">
            <th className="py-2 pr-3 font-semibold">Numéro</th>
            <th className="py-2 pr-3 font-semibold">Destinataire</th>
            <th className="py-2 pr-3 font-semibold">Trajet</th>
            <th className="py-2 pr-3 font-semibold">Statut</th>
            <th className="py-2 pr-3 font-semibold text-right">Frais</th>
            <th className="py-2 pr-3 font-semibold">Enregistré</th>
            <th className="py-2 font-semibold text-right">Suivi</th>
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
                  {LIBELLES_STATUT_COLIS[c.statut] ?? c.statut}
                </Badge>
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
                    href={`/receveur/tickets/${encodeURIComponent(c.code_clair)}`}
                    className="text-lagune hover:underline font-medium whitespace-nowrap"
                  >
                    Voir →
                  </Link>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
