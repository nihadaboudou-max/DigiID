"use client";
/**
 * Ticket « enfant » imprimable — suivi familial (Plan B, étape S7).
 *
 * Étiquette remise au parent et collée sur les bagages de l'enfant : QR Code
 * durable (scannable par la caméra d'un téléphone), code en clair ``ENF-…``
 * (repli saisie manuelle), trajet et liens de parenté.
 *
 * Le QR renvoie vers la **page publique** de suivi, consultable sans compte :
 * c'est ce qui permet à la famille de suivre le voyage en toute autonomie.
 */
import { Bouton } from "@/composants/commun/Bouton";
import { IconeIdentite } from "@/composants/commun/Icones";
import type { SuiviFamilial, Ticket } from "@/types/logistique";
import { formaterDate, formaterDateHeure, urlImageQR } from "./format";

interface Proprietes {
  ticket: Ticket;
  suivi: SuiviFamilial;
  /** Affiche le bouton d'impression (désactivable en aperçu). */
  afficherImpression?: boolean;
}

export function TicketSuiviFamilialImprimable({
  ticket,
  suivi,
  afficherImpression = true,
}: Proprietes) {
  const qrSrc = urlImageQR(ticket.qr_code_url || ticket.qr_token);
  const lienSuivi =
    typeof window !== "undefined"
      ? `${window.location.origin}/suivi/${encodeURIComponent(ticket.code_clair)}`
      : `/suivi/${ticket.code_clair}`;

  return (
    <div className="space-y-4">
      <div className="zone-impression rounded-xl border-2 border-ardoise/20 bg-white p-5 text-ardoise">
        {/* En-tête */}
        <div className="mb-4 flex items-center justify-between border-b border-dashed border-ardoise-clair/40 pb-3">
          <div className="flex items-center gap-2 text-lagune">
            <IconeIdentite className="h-6 w-6" />
            <span className="text-lg font-bold">DigiID — Suivi familial</span>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
              Ticket enfant
            </p>
            <p className="text-xs text-ardoise-clair">
              Émis le {formaterDateHeure(ticket.cree_le)}
            </p>
          </div>
        </div>

        {/* Corps : infos + QR */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-sable-clair p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
                Code de suivi de l&apos;enfant
              </p>
              <p className="break-all font-mono text-2xl font-bold tracking-wider text-lagune">
                {ticket.code_clair}
              </p>
            </div>

            <dl className="grid grid-cols-1 gap-2">
              <div className="flex gap-2">
                <dt className="min-w-[104px] text-ardoise-clair">Enfant</dt>
                <dd className="font-medium">{suivi.enfant_nom}</dd>
              </div>
              {suivi.enfant_age != null && (
                <div className="flex gap-2">
                  <dt className="min-w-[104px] text-ardoise-clair">Âge</dt>
                  <dd className="font-medium">
                    {suivi.enfant_age} ans
                    {suivi.enfant_sexe === "M"
                      ? " (garçon)"
                      : suivi.enfant_sexe === "F"
                      ? " (fille)"
                      : ""}
                  </dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="min-w-[104px] text-ardoise-clair">Départ</dt>
                <dd className="font-medium">{suivi.gare_depart_nom || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="min-w-[104px] text-ardoise-clair">Arrivée</dt>
                <dd className="font-medium">{suivi.gare_arrivee_nom || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="min-w-[104px] text-ardoise-clair">Parent</dt>
                <dd className="font-medium">{suivi.parent_nom || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="min-w-[104px] text-ardoise-clair">Téléphone</dt>
                <dd className="font-medium">{suivi.telephone_parent}</dd>
              </div>
            </dl>

            <p className="rounded-lg bg-lagune/5 p-2 text-xs text-ardoise-clair">
              Suivez le voyage sur : <span className="break-all">{lienSuivi}</span>
            </p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-start gap-2">
            {qrSrc ? (
              <img
                src={qrSrc}
                alt={`QR Code du suivi ${ticket.code_clair}`}
                className="h-40 w-40 rounded-lg border border-ardoise-clair/20 bg-white"
              />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-lg border-2 border-dashed border-ardoise-clair/30 p-2 text-center text-xs text-ardoise-clair">
                QR indisponible — utilisez le code ci-contre.
              </div>
            )}
            <p className="max-w-[160px] text-center text-[10px] text-ardoise-clair">
              Scannez pour suivre le voyage
            </p>
          </div>
        </div>

        {/* Pied */}
        <div className="mt-4 flex justify-between border-t border-dashed border-ardoise-clair/40 pt-3 text-[11px] text-ardoise-clair">
          <span>DigiID — suivi rassurant des enfants</span>
          <span>
            Réf. {ticket.id.slice(0, 8)} · {formaterDate(ticket.cree_le)}
          </span>
        </div>
      </div>

      {afficherImpression && (
        <div className="no-print flex flex-wrap gap-3">
          <Bouton variante="secondaire" onClick={() => window.print()}>
            🖨️ Imprimer le ticket
          </Bouton>
        </div>
      )}
    </div>
  );
}
