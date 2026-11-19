"use client";
/**
 * Fiche d'un colis — vue chauffeur (lecture seule).
 *
 * Ce que le chauffeur a besoin de savoir au moment de la remise : **à qui** il
 * remet le colis, d'où il vient, où il va, et le QR à montrer/scanner. Il ne
 * touche ni à l'argent (l'encaissement reste au guichet) ni à l'affectation des
 * cars (le gérant de gare décide) : son geste, c'est la remise tracée.
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
import {
  formaterDateHeure,
  urlImageQR,
} from "@/composants/logistique/format";
import { PaginationListe } from "@/composants/logistique/PaginationListe";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { SuiviTimeline } from "@/composants/logistique/SuiviTimeline";
import {
  PhotoColisPrivee,
  TicketImprimable,
} from "@/composants/logistique/TicketImprimable";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import {
  LIBELLES_STATUT_COLIS,
  VARIANTES_STATUT_COLIS,
  type Colis,
  type ColisEvenement,
  type Ticket,
} from "@/types/logistique";

export default function PageColisChauffeur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
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
  const [pageEvenements, setPageEvenements] = useState(1);
  const [totalEvenements, setTotalEvenements] = useState(0);
  const [chargementEvenements, setChargementEvenements] = useState(true);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurEvenements, setErreurEvenements] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let annule = false;
    setColis(null);
    setEvenements([]);
    setPageEvenements(1);
    setTotalEvenements(0);
    setErreurEvenements(null);
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const colisCharge = await logistiqueAPI.colis.parCode(code);
        if (!annule) {
          setColis(colisCharge);
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

  useEffect(() => {
    if (!colis?.id) return;
    let annule = false;
    setChargementEvenements(true);
    setErreurEvenements(null);
    logistiqueAPI.colis
      .evenementsPagines(colis.id, { page: pageEvenements, par_page: 5 })
      .then((reponse) => {
        if (annule) return;
        setEvenements(reponse.elements);
        setTotalEvenements(reponse.total);
      })
      .catch((e: unknown) => {
        if (!annule) {
          setErreurEvenements(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger l'historique du colis.",
          );
        }
      })
      .finally(() => {
        if (!annule) setChargementEvenements(false);
      });
    return () => {
      annule = true;
    };
  }, [colis?.id, pageEvenements]);

  if (chargement) {
    return (
      <p className="py-12 text-center italic text-ardoise-clair">
        Chargement du colis…
      </p>
    );
  }

  if (erreur || !colis) {
    return (
      <div className="space-y-4">
        <Alerte variante="erreur" titre="Impossible d'afficher le colis">
          {erreur ?? "Colis introuvable."}
        </Alerte>
        <Link href="/chauffeur/colis">
          <Bouton variante="ghost">← Mes colis</Bouton>
        </Link>
      </div>
    );
  }

  const ticket: Ticket = {
    id: colis.ticket_id ?? colis.id,
    code_clair: colis.code_clair ?? code,
    qr_token: colis.qr_token ?? "",
    qr_code_url: colis.qr_code_url,
    type: "COLIS",
    reference_id: colis.id,
    voyage_id: colis.voyage_id,
    statut: colis.statut,
    nb_scans: Math.max(totalEvenements - 1, 0),
    premier_scan_le: null,
    imprime_le: null,
    cree_le: colis.cree_le,
    modifie_le: colis.modifie_le,
  };
  const dejaRemis = colis.statut === "livre" || colis.statut === "annule";
  const estEnregistreParUtilisateur =
    utilisateur?.id === colis.enregistre_par_id;
  const estChauffeurAffecte = utilisateur?.id === colis.chauffeur_id;
  const qrTicket = urlImageQR(colis.qr_code_url || colis.qr_token);

  return (
    <div className="space-y-6 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/chauffeur/colis" className="hover:text-lagune">
          Mes colis
        </Link>
        <span>/</span>
        <span className="font-mono font-semibold text-ardoise">{ticket.code_clair}</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold text-ardoise">
            {ticket.code_clair}
          </h1>
          <Badge
            variante={VARIANTES_STATUT_COLIS[colis.statut] ?? "neutre"}
            taille="moyen"
          >
            {LIBELLES_STATUT_COLIS[colis.statut] ?? colis.statut}
          </Badge>
          {colis.mode_enregistrement === "chauffeur_direct" && (
            <Badge variante="ocre">Enregistré en route</Badge>
          )}
        </div>
        {!dejaRemis && (
          <Link
            href={`/chauffeur/scan?code=${encodeURIComponent(ticket.code_clair)}&type=livraison`}
          >
            <Bouton variante="primaire">
              <IconeScan className="w-4 h-4" /> Remettre au destinataire
            </Bouton>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {estEnregistreParUtilisateur ? (
            <TicketImprimable ticket={ticket} colis={colis} />
          ) : estChauffeurAffecte ? (
            <Carte titre="Ticket et étiquettes QR">
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                <div className="flex flex-col items-center gap-3">
                  {qrTicket ? (
                    <img
                      src={qrTicket}
                      alt={`QR code du colis ${ticket.code_clair}`}
                      className="h-48 w-48 rounded-lg border border-ardoise-clair/20 bg-white"
                    />
                  ) : (
                    <p className="text-sm text-ardoise-clair">
                      QR du colis indisponible.
                    </p>
                  )}
                  {colis.photo_url && <PhotoColisPrivee url={colis.photo_url} />}
                </div>
                <dl className="grid w-full grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <Ligne libelle="Code du colis" valeur={ticket.code_clair} />
                  <Ligne
                    libelle="Trajet"
                    valeur={`${colis.gare_depart_nom || "—"} → ${colis.gare_arrivee_nom || "—"}`}
                  />
                  <Ligne
                    libelle="Enregistré par"
                    valeur={colis.enregistre_par_nom || "—"}
                  />
                  <Ligne
                    libelle="Téléphone de l'agent"
                    valeur={colis.enregistre_par_telephone || "—"}
                  />
                </dl>
              </div>

              {colis.bagages.length > 0 && (
                <div className="mt-5 border-t border-ardoise-clair/15 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-ardoise">
                    QR des bagages
                  </h3>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {colis.bagages.map((bagage) => {
                      const qrBagage = urlImageQR(bagage.qr_code_url);
                      return (
                        <li
                          key={bagage.id}
                          className="flex items-center gap-3 rounded-xl border border-ardoise-clair/15 p-3"
                        >
                          {qrBagage ? (
                            <img
                              src={qrBagage}
                              alt={`QR du bagage ${bagage.numero_serie}`}
                              className="h-28 w-28 rounded border border-ardoise-clair/20 bg-white"
                            />
                          ) : (
                            <p className="flex h-28 w-28 items-center justify-center rounded border border-dashed border-ardoise-clair/30 p-2 text-center text-xs text-ardoise-clair">
                              QR indisponible
                            </p>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-ardoise">
                              {bagage.numero_serie}
                            </p>
                            <p className="break-all font-mono text-xs text-ardoise-clair">
                              {bagage.code_clair || "Code indisponible"}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Carte>
          ) : null}
        </div>

        <div className="space-y-6">
          <Carte titre="À remettre à">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Ligne libelle="Destinataire" valeur={colis.destinataire_nom} />
              <Ligne libelle="Téléphone" valeur={colis.destinataire_tel} />
              <Ligne libelle="Départ" valeur={colis.gare_depart_nom || "—"} />
              <Ligne libelle="Arrivée" valeur={colis.gare_arrivee_nom || "—"} />
              <Ligne
                libelle="Articles"
                valeur={String(colis.nombre_articles ?? 1)}
              />
              <Ligne libelle="Sacs" valeur={String(colis.nombre_bagages ?? 1)} />
              <Ligne libelle="Expéditeur" valeur={colis.expediteur_nom || "—"} />
              <Ligne libelle="Enregistré par" valeur={colis.enregistre_par_nom || "—"} />
              <Ligne
                libelle="Téléphone de l'agent"
                valeur={colis.enregistre_par_telephone || "—"}
              />
              {colis.description && (
                <div className="sm:col-span-2">
                  <dt className="text-ardoise-clair">Description</dt>
                  <dd className="text-ardoise">{colis.description}</dd>
                </div>
              )}
              {colis.livre_le && (
                <Ligne libelle="Remis le" valeur={formaterDateHeure(colis.livre_le)} />
              )}
            </dl>
            <p className="mt-3 text-xs italic text-ardoise-clair">
              Les frais de service se règlent au guichet : ici, vous ne faites que
              la remise (elle est horodatée et notifiée automatiquement).
            </p>
          </Carte>

          <Carte
            titre="Suivi du colis"
            description={`${totalEvenements} événement(s)`}
          >
            {erreurEvenements ? (
              <Alerte variante="erreur" titre="Impossible de charger l'historique">
                {erreurEvenements}
              </Alerte>
            ) : chargementEvenements ? (
              <p className="py-4 text-center text-sm italic text-ardoise-clair">
                Chargement de l'historique…
              </p>
            ) : (
              <SuiviTimeline evenements={evenements} />
            )}
            <PaginationListe
              page={pageEvenements}
              total={totalEvenements}
              parPage={5}
              chargement={chargementEvenements}
              surChangement={setPageEvenements}
            />
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
      <dt className="text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
        {libelle}
      </dt>
      <dd className="text-ardoise">{valeur}</dd>
    </div>
  );
}
