"use client";
/**
 * Fiche d'un colis : informations, ticket imprimable et timeline (S3).
 *
 * Le `code` peut être le numéro en clair (`DKR-2025-000001`) ou le token QR :
 * l'API accepte les deux (`GET /api/v1/logistique/colis/{code}`).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeScan } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { formaterDateHeure, formaterFcfa } from "@/composants/logistique/format";
import { ROLES_GUICHET } from "@/composants/logistique/roles";
import { SuiviTimeline } from "@/composants/logistique/SuiviTimeline";
import { TicketImprimable } from "@/composants/logistique/TicketImprimable";
import { PaiementColis } from "@/composants/paiement/PaiementColis";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import {
  LIBELLES_STATUT_COLIS,
  VARIANTES_STATUT_COLIS,
  type Colis,
  type ColisEvenement,
  type Ticket,
} from "@/types/logistique";

export default function PageDetailTicket() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const params = useParams();
  const code = (() => {
    const brut = String(params?.code ?? "");
    try {
      return decodeURIComponent(brut);
    } catch {
      return brut;
    }
  })();

  const [colis, setColis] = useState<Colis | null>(null);
  const [evenements, setEvenements] = useState<ColisEvenement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const colisCharge = await logistiqueAPI.colis.parCode(code);
        const evenementsCharges = await logistiqueAPI.colis.evenements(colisCharge.id);
        if (!annule) {
          setColis(colisCharge);
          setEvenements(evenementsCharges);
        }
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Colis introuvable pour ce code.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [code]);

  if (chargement) {
    return (
      <p className="text-ardoise-clair italic py-12 text-center">Chargement du colis…</p>
    );
  }

  if (erreur || !colis) {
    return (
      <div className="space-y-4">
        <Alerte variante="erreur" titre="Impossible d'afficher le colis">
          {erreur ?? "Colis introuvable."}
        </Alerte>
        <Link href="/receveur/tickets">
          <Bouton variante="ghost">← Retour à la liste</Bouton>
        </Link>
      </div>
    );
  }

  // Reconstitution du ticket à partir du colis (pour l'impression / le suivi).
  const ticket: Ticket = {
    id: colis.ticket_id ?? colis.id,
    code_clair: colis.code_clair ?? code,
    qr_token: colis.qr_token ?? "",
    qr_code_url: colis.qr_code_url,
    type: "COLIS",
    reference_id: colis.id,
    voyage_id: colis.voyage_id,
    statut: colis.statut,
    nb_scans: evenements.filter((e) => e.type_evenement !== "enregistrement").length,
    premier_scan_le: null,
    imprime_le: null,
    cree_le: colis.cree_le,
    modifie_le: colis.modifie_le,
  };

  return (
    <div className="space-y-6 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/receveur/dashboard" className="hover:text-lagune">
          Guichet
        </Link>
        <span>/</span>
        <Link href="/receveur/tickets" className="hover:text-lagune">
          Colis &amp; tickets
        </Link>
        <span>/</span>
        <span className="text-ardoise font-semibold font-mono">{ticket.code_clair}</span>
      </nav>

      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ardoise font-mono">
            {ticket.code_clair}
          </h1>
          <Badge variante={VARIANTES_STATUT_COLIS[colis.statut] ?? "neutre"} taille="moyen">
            {LIBELLES_STATUT_COLIS[colis.statut] ?? colis.statut}
          </Badge>
        </div>
        <Link href={`/receveur/scan?code=${encodeURIComponent(ticket.code_clair)}`}>
          <Bouton variante="primaire">
            <IconeScan className="w-4 h-4" /> Scanner / Livrer
          </Bouton>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne gauche : ticket */}
        <div className="space-y-6">
          <TicketImprimable ticket={ticket} colis={colis} />

          {/* S6 — encaissement des frais (si pas encore payé) */}
          <div className="no-print">
            <PaiementColis colis={colis} />
          </div>
        </div>

        {/* Colonne droite : détails + timeline */}
        <div className="space-y-6">
          <Carte titre="Informations du colis">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Ligne libelle="Destinataire" valeur={colis.destinataire_nom} />
              <Ligne libelle="Téléphone" valeur={colis.destinataire_tel} />
              <Ligne libelle="Départ" valeur={colis.gare_depart_nom || "—"} />
              <Ligne libelle="Arrivée" valeur={colis.gare_arrivee_nom || "—"} />
              <Ligne libelle="Frais" valeur={formaterFcfa(colis.frais_fcfa)} />
              <Ligne
                libelle="Poids"
                valeur={colis.poids_kg != null ? `${colis.poids_kg} kg` : "—"}
              />
              <Ligne
                libelle="Valeur déclarée"
                valeur={colis.valeur_fcfa != null ? formaterFcfa(colis.valeur_fcfa) : "—"}
              />
              <Ligne libelle="Enregistré par" valeur={colis.receveur_nom || "—"} />
              {colis.description && (
                <div className="sm:col-span-2">
                  <dt className="text-ardoise-clair">Description</dt>
                  <dd className="text-ardoise">{colis.description}</dd>
                </div>
              )}
              {colis.livre_le && (
                <Ligne libelle="Livré le" valeur={formaterDateHeure(colis.livre_le)} />
              )}
            </dl>
          </Carte>

          <Carte titre="Suivi du colis" description={`${evenements.length} événement(s)`}>
            <SuiviTimeline evenements={evenements} />
          </Carte>
        </div>
      </div>
    </div>
  );
}

/** Ligne libellé/valeur. */
function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold">
        {libelle}
      </dt>
      <dd className="text-ardoise">{valeur}</dd>
    </div>
  );
}
