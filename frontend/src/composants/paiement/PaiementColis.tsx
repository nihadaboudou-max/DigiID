"use client";
/**
 * Panneau de paiement d'un colis (S6).
 *
 * Affiche le montant à encaisser, le moyen de paiement (espèces au guichet ou
 * Wave en mode mock) et — une fois le paiement réussi — le reçu avec la
 * **commission de 25 FCFA créditée sur la cagnotte du receveur**.
 *
 * Sécurité : `idempotency_key` généré côté client pour qu'un double clic ou un
 * rejeu réseau ne débite jamais deux fois.
 */
import { useEffect, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeCheck, IconePortefeuille } from "@/composants/commun/Icones";
import { Badge } from "@/composants/commun/Badge";
import { formaterFcfa } from "@/composants/logistique/format";
import { ErreurAPI } from "@/services/client_api";
import { cleIdempotence, paiementAPI } from "@/services/paiement_api";
import {
  FRAIS_COLIS_DEFAUT_FCFA,
  LIBELLES_MOYEN,
  LIBELLES_STATUT_TRANSACTION,
  VARIANTES_STATUT_TRANSACTION,
  type MoyenPaiement,
  type MoyenPaiementInfo,
  type ResultatPaiement,
} from "@/types/paiement";
import type { Colis } from "@/types/logistique";

interface Proprietes {
  colis: Colis;
  onPaiementEffectue?: (resultat: ResultatPaiement) => void;
}

const MOYENS_PAR_DEFAUT: MoyenPaiementInfo[] = [
  { code: "especes", libelle: "Espèces (guichet)", immediat: true },
  { code: "wave", libelle: "Wave (mobile money)", immediat: false },
];

export function PaiementColis({ colis, onPaiementEffectue }: Proprietes) {
  const montantInitial =
    colis.frais_fcfa && colis.frais_fcfa > 0
      ? colis.frais_fcfa
      : FRAIS_COLIS_DEFAUT_FCFA;

  const [moyens, setMoyens] = useState<MoyenPaiementInfo[]>(MOYENS_PAR_DEFAUT);
  const [moyen, setMoyen] = useState<MoyenPaiement>("especes");
  const [montant, setMontant] = useState(String(montantInitial));
  const [telephone, setTelephone] = useState(colis.destinataire_tel || "");
  const [cle, setCle] = useState<string | null>(null);

  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatPaiement | null>(null);

  // Catalogue des moyens (repli local si l'API ne répond pas).
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const catalogue = await paiementAPI.moyens();
        if (!annule && catalogue.length > 0) setMoyens(catalogue);
      } catch {
        /* repli : liste locale */
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  const montantNombre = Number(montant.replace(/\s/g, ""));
  const montantValide = !Number.isNaN(montantNombre) && montantNombre > 0;
  const telephoneValide = moyen !== "wave" || telephone.replace(/\D/g, "").length >= 6;
  const dejaReussi = resultat?.transaction.statut === "reussi";

  async function payer() {
    if (!montantValide || !telephoneValide) return;
    setErreur(null);
    setChargement(true);
    // On conserve la même clé après un échec : le rejeu reste idempotent.
    const cleUtilisee = cle ?? cleIdempotence(`colis-${colis.id}`);
    if (!cle) setCle(cleUtilisee);
    try {
      const reponse = await paiementAPI.transactions.payer({
        type: "COLIS",
        colis_id: colis.id,
        montant_fcfa: montantNombre,
        moyen,
        telephone: moyen === "wave" ? telephone.trim() : null,
        idempotency_key: cleUtilisee,
      });
      setResultat(reponse);
      onPaiementEffectue?.(reponse);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Le paiement a échoué. Vérifiez la connexion puis réessayez.",
      );
    } finally {
      setChargement(false);
    }
  }

  async function confirmer() {
    if (!resultat) return;
    setErreur(null);
    setChargement(true);
    try {
      const reponse = await paiementAPI.transactions.confirmer(
        resultat.transaction.reference,
      );
      setResultat(reponse);
      onPaiementEffectue?.(reponse);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de confirmer le paiement.",
      );
    } finally {
      setChargement(false);
    }
  }

  // ─── Reçu après paiement ───────────────────────────────────────────
  if (resultat) {
    const { transaction, commission, portefeuille_beneficiaire, message } =
      resultat;
    return (
      <Carte titre="Paiement du colis">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge
              variante={
                VARIANTES_STATUT_TRANSACTION[transaction.statut] ?? "info"
              }
            >
              {LIBELLES_STATUT_TRANSACTION[transaction.statut] ?? transaction.statut}
            </Badge>
            <span className="text-xs text-ardoise-clair font-mono">
              {transaction.reference}
            </span>
          </div>
          <span className="text-lg font-bold text-lagune">
            {formaterFcfa(transaction.montant_fcfa)}
          </span>
        </div>

        <p className="text-sm text-ardoise mt-3">{message}</p>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-ardoise-clair/10 pb-1.5">
            <dt className="text-ardoise-clair">Moyen de paiement</dt>
            <dd className="font-medium">
              {LIBELLES_MOYEN[transaction.moyen] ?? transaction.moyen}
            </dd>
          </div>
          <div className="flex justify-between border-b border-ardoise-clair/10 pb-1.5">
            <dt className="text-ardoise-clair">Commission receveur</dt>
            <dd className="font-medium text-green-700">
              {formaterFcfa(transaction.frais_plateforme)}
            </dd>
          </div>
          {portefeuille_beneficiaire && (
            <div className="flex justify-between border-b border-ardoise-clair/10 pb-1.5">
              <dt className="text-ardoise-clair">Nouvelle cagnotte receveur</dt>
              <dd className="font-semibold text-lagune">
                {formaterFcfa(portefeuille_beneficiaire.solde_fcfa)}
              </dd>
            </div>
          )}
        </dl>

        {commission && (
          <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <IconePortefeuille className="w-4 h-4" />
            {formaterFcfa(commission.montant_fcfa)} crédités sur la cagnotte du
            receveur.
          </div>
        )}

        {transaction.statut === "en_attente" && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Bouton
              variante="primaire"
              chargement={chargement}
              onClick={confirmer}
            >
              <IconeCheck className="w-4 h-4" /> Confirmer (démo)
            </Bouton>
            <span className="text-xs text-ardoise-clair italic">
              En production, la confirmation vient de l&apos;opérateur (webhook).
            </span>
          </div>
        )}

        {erreur && (
          <div className="mt-3">
            <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>
          </div>
        )}
      </Carte>
    );
  }

  // ─── Formulaire d'encaissement ─────────────────────────────────────
  return (
    <Carte
      titre="Encaisser les frais du colis"
      description="Le ticket est généré : encaissez maintenant les frais. 25 FCFA sont reversés au receveur."
    >
      <div className="space-y-4">
        <ChampSaisie
          libelle="Montant à encaisser (FCFA)"
          value={montant}
          onChange={(e) => setMontant(e.target.value)}
          inputMode="numeric"
          placeholder={String(FRAIS_COLIS_DEFAUT_FCFA)}
          disabled={dejaReussi}
          erreur={montantValide ? undefined : "Montant invalide"}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ardoise">
            Moyen de paiement
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {moyens.map((m) => {
              const actif = m.code === moyen;
              return (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => setMoyen(m.code as MoyenPaiement)}
                  className={
                    "flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition-all " +
                    (actif
                      ? "border-lagune bg-lagune/5 ring-1 ring-lagune"
                      : "border-ardoise-clair/20 hover:border-lagune/40")
                  }
                >
                  <span className="font-medium text-ardoise">
                    {m.libelle || LIBELLES_MOYEN[m.code] || m.code}
                  </span>
                  {m.immediat && (
                    <span className="text-[10px] uppercase tracking-wider text-green-700 font-semibold">
                      Immédiat
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {moyen === "wave" && (
          <ChampSaisie
            libelle="Numéro mobile money"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            inputMode="tel"
            placeholder="Ex : 77 123 45 67"
            aide="Le client reçoit une demande de validation sur son téléphone (mode démo)."
            erreur={telephoneValide ? undefined : "Au moins 6 chiffres"}
          />
        )}

        {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

        <div className="flex justify-end">
          <Bouton
            variante="succes"
            chargement={chargement}
            disabled={!montantValide || !telephoneValide || chargement}
            onClick={payer}
          >
            <IconeCheck className="w-4 h-4" /> Encaisser{" "}
            {formaterFcfa(montantValide ? montantNombre : 0)}
          </Bouton>
        </div>
      </div>
    </Carte>
  );
}
