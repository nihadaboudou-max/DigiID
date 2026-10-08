"use client";
import { Bouton } from "@/composants/commun/Bouton";
import { IconeTicket } from "@/composants/commun/Icones";
import type { Colis, Ticket } from "@/types/logistique";
import { formaterDate, formaterDateHeure, formaterFcfa, urlImageQR } from "./format";

interface Proprietes {
  ticket: Ticket;
  colis?: Colis | null;
  afficherImpression?: boolean;
}

export function TicketImprimable({
  ticket,
  colis,
  afficherImpression = true,
}: Proprietes) {
  const qrSrc = urlImageQR(ticket.qr_code_url || ticket.qr_token);

  return (
    <div className="space-y-6">
      
      {/* ==========================================
          PAGE 1 : LE TICKET PRINCIPAL (Pour le remettant/client)
         ========================================== */}
      <div className="zone-impression ticket-principal bg-white border-2 border-ardoise/20 rounded-xl p-5 text-ardoise">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-dashed border-ardoise-clair/40 pb-3 mb-4">
          <div className="flex items-center gap-2 text-lagune">
            <IconeTicket className="w-6 h-6" />
            <span className="text-lg font-bold">DigiID Logistique</span>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold">
              Ticket Colis (Remettant)
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
                <dd className="font-medium">{colis?.gare_depart_nom || "—"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ardoise-clair min-w-[92px]">Arrivée</dt>
                <dd className="font-medium">{colis?.gare_arrivee_nom || "—"}</dd>
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
                <dt className="text-ardoise-clair min-w-[92px]">Articles</dt>
                <dd className="font-medium">{colis?.nombre_articles ?? 1}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ardoise-clair min-w-[92px]">Sacs</dt>
                <dd className="font-medium">{colis?.nombre_bagages ?? 1}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ardoise-clair min-w-[92px]">Prix transport</dt>
                <dd className="font-bold text-lagune">{formaterFcfa(colis?.frais_fcfa)}</dd>
              </div>
            </dl>
          </div>

          {/* QR Code Principal */}
          <div className="flex flex-col items-center justify-start gap-2">
            {qrSrc ? (
              <img src={qrSrc} alt={`QR Code du colis ${ticket.code_clair}`} className="w-40 h-40 border border-ardoise-clair/20 rounded-lg bg-white" />
            ) : (
              <div className="w-40 h-40 border-2 border-dashed border-ardoise-clair/30 rounded-lg flex items-center justify-center text-center text-xs text-ardoise-clair p-2">
                QR indisponible
              </div>
            )}
            <p className="text-[10px] text-ardoise-clair text-center max-w-[160px]">
              À conserver par le remettant
            </p>
          </div>
        </div>

        {/* Pied */}
        <div className="mt-4 pt-3 border-t border-dashed border-ardoise-clair/40 text-[11px] text-ardoise-clair flex justify-between">
          <span>DigiID — Suivi logistique</span>
          <span>Réf. {ticket.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* ==========================================
          PAGES SUIVANTES : ÉTIQUETTES BAGAGES (1 par page)
         ========================================== */}
      {colis && colis.bagages && colis.bagages.length > 0 && (
        <>
          {colis.bagages.map((b, index) => {
            const qrBagage = urlImageQR(b.qr_code_url);
            return (
              <div
                key={b.id}
                className="zone-impression etiquette-bagage bg-white border-2 border-dashed border-ardoise/30 rounded-xl p-8 text-ardoise flex flex-col items-center justify-center"
              >
                <p className="text-xs uppercase tracking-wider text-ardoise-clair font-bold mb-2">
                  Étiquette Bagage {index + 1} / {colis.bagages.length}
                </p>
                
                <span className="text-xl font-bold text-lagune mb-4">
                  {b.numero_serie}
                </span>

                {qrBagage ? (
                  <img
                    src={qrBagage}
                    alt={`QR du sac ${b.numero_serie}`}
                    className="h-48 w-48 border border-ardoise-clair/20 rounded bg-white mb-4"
                  />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center border-2 border-dashed border-ardoise-clair/30 rounded text-center text-xs text-ardoise-clair mb-4">
                    QR indisponible
                  </div>
                )}

                {b.code_clair && (
                  <code className="text-sm font-mono text-ardoise-clair break-all text-center">
                    {b.code_clair}
                  </code>
                )}

                <p className="mt-6 text-[10px] text-ardoise-clair text-center border-t border-dashed border-ardoise-clair/30 pt-2 w-full">
                  Colis parent : <strong>{ticket.code_clair}</strong> — À coller sur le sac
                </p>
              </div>
            );
          })}
        </>
      )}

      {/* ==========================================
          BOUTON D'IMPRESSION (Caché à l'impression)
         ========================================== */}
      {afficherImpression && (
        <div className="no-print flex flex-wrap gap-3 print:hidden mt-6">
          <Bouton variante="primaire" onClick={() => window.print()}>
            ️ Imprimer le dossier complet
          </Bouton>
          <p className="text-xs text-ardoise-clair self-center">
            (Le ticket principal sera sur la 1ère page, les étiquettes sur les suivantes)
          </p>
        </div>
      )}
    </div>
  );
}