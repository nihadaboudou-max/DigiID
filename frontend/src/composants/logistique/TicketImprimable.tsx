"use client";
/**
 * Ticket de colis imprimable — guichet logistique (S3).
 *
 * Affiche l'étiquette à coller sur le colis : QR Code durable (scannable par
 * la caméra native d'un téléphone), numéro en clair (repli saisie manuelle),
 * gares de départ/arrivée, destinataire et frais.
 *
 * Le bouton « Imprimer » est masqué à l'impression (`.no-print`) et seule la
 * zone `.zone-impression` est imprimée (voir `styles/globaux.css`).
 */
import { Bouton } from "@/composants/commun/Bouton";
import { IconeTicket } from "@/composants/commun/Icones";
import type { Colis, Ticket } from "@/types/logistique";
import { formaterDate, formaterDateHeure, formaterFcfa, urlImageQR } from "./format";

interface Proprietes {
  ticket: Ticket;
  colis?: Colis | null;
  /** Affiche le bouton d'impression (désactivable en aperçu). */
  afficherImpression?: boolean;
}

export function TicketImprimable({
  ticket,
  colis,
  afficherImpression = true,
}: Proprietes) {
  const qrSrc = urlImageQR(ticket.qr_code_url || ticket.qr_token);

  return (
    <div className="space-y-4">
      <div className="zone-impression bg-white border-2 border-ardoise/20 rounded-xl p-5 text-ardoise">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-dashed border-ardoise-clair/40 pb-3 mb-4">
          <div className="flex items-center gap-2 text-lagune">
            <IconeTicket className="w-6 h-6" />
            <span className="text-lg font-bold">DigiID Logistique</span>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold">
              Ticket colis
            </p>
            <p className="text-xs text-ardoise-clair">
              Émis le {formaterDateHeure(ticket.cree_le)}
            </p>
          </div>
        </div>

        {/* Corps : infos + QR */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5">
          <div className="space-y-3 text-sm">
            <div className="bg-sable-clair rounded-lg p-3">
              <p className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold">
                Numéro du colis
              </p>
              <p className="text-2xl font-mono font-bold text-lagune tracking-wider break-all">
                {ticket.code_clair}
              </p>
            </div>

            <dl className="grid grid-cols-1 gap-2">
              <div className="flex gap-2">
                <dt className="text-ardoise-clair min-w-[92px]">Départ</dt>
                <dd className="font-medium">
                  {colis?.gare_depart_nom || "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ardoise-clair min-w-[92px]">Arrivée</dt>
                <dd className="font-medium">
                  {colis?.gare_arrivee_nom || "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ardoise-clair min-w-[92px]">Expéditeur</dt>
                <dd className="font-medium">{colis?.expediteur_nom || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ardoise-clair min-w-[92px]">Destinataire</dt>
                <dd className="font-medium">{colis?.destinataire_nom || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ardoise-clair min-w-[92px]">Téléphone</dt>
                <dd className="font-medium">{colis?.destinataire_tel || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ardoise-clair min-w-[92px]">Frais</dt>
                <dd className="font-bold text-lagune">
                  {formaterFcfa(colis?.frais_fcfa)}
                </dd>
              </div>
            </dl>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-start gap-2">
            {qrSrc ? (
              <img
                src={qrSrc}
                alt={`QR Code du colis ${ticket.code_clair}`}
                className="w-40 h-40 border border-ardoise-clair/20 rounded-lg bg-white"
              />
            ) : (
              <div className="w-40 h-40 border-2 border-dashed border-ardoise-clair/30 rounded-lg flex items-center justify-center text-center text-xs text-ardoise-clair p-2">
                QR indisponible — utilisez le numéro ci-contre.
              </div>
            )}
            <p className="text-[10px] text-ardoise-clair text-center max-w-[160px]">
              Scannez pour suivre / remettre le colis
            </p>
          </div>
        </div>

        {/* Pied */}
        <div className="mt-4 pt-3 border-t border-dashed border-ardoise-clair/40 text-[11px] text-ardoise-clair flex justify-between">
          <span>DigiID — prototype académique</span>
          <span>Réf. {ticket.id.slice(0, 8)} · {formaterDate(ticket.cree_le)}</span>
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
