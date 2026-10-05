"use client";
/**
 * Encaissement des **frais de service** d'un colis (S6).
 *
 * ⚠️ À ne pas confondre avec le **prix de transport** du colis : ce dernier est
 * un montant facultatif saisi au guichet, c'est le revenu du transporteur et
 * DigiID ne l'encaisse jamais. Ici on encaisse le frais de service payé par le
 * client, selon un **barème par nombre d'articles** :
 *
 * | Articles dans le colis | Frais/colis | dont receveur | dont DigiID |
 * |------------------------|-------------|---------------|-------------|
 * | 1 à 3                  | 100 FCFA    | 25 FCFA       | 75 FCFA     |
 * | 4 à 6                  | 200 FCFA    | 50 FCFA       | 150 FCFA    |
 * | 7 à 10                 | 350 FCFA    | 80 FCFA       | 270 FCFA    |
 * | plus de 10             | 500 FCFA    | 150 FCFA      | 350 FCFA    |
 *
 * Le montant n'est donc **pas saisi** : il vient du serveur
 * (`GET /paiement/tarifs?nombre_articles=N`).
 *
 * Deux garde-fous contre le double prélèvement :
 *  1. le serveur n'accepte qu'**un seul** paiement actif par colis — on affiche
 *     donc l'état existant (« déjà réglé ») au lieu du bouton ;
 *  2. `idempotency_key` généré côté client pour un double clic / rejeu réseau.
 */
import { useCallback, useEffect, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeCheck, IconePortefeuille } from "@/composants/commun/Icones";
import { formaterFcfa } from "@/composants/logistique/format";
import { ErreurAPI } from "@/services/client_api";
import { cleIdempotence, paiementAPI } from "@/services/paiement_api";
import {
  fraisServicePourArticles,
  LIBELLES_MOYEN,
  LIBELLES_STATUT_TRANSACTION,
  VARIANTES_STATUT_TRANSACTION,
  type MoyenPaiement,
  type MoyenPaiementInfo,
  type ResultatPaiement,
  type TarifsColis,
  type TransactionPaiement,
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

/** Statuts pour lesquels un paiement occupe déjà le colis. */
const STATUTS_ACTIFS: string[] = ["en_attente", "reussi"];

export function PaiementColis({ colis, onPaiementEffectue }: Proprietes) {
  const [tarifs, setTarifs] = useState<TarifsColis | null>(null);
  const [moyens, setMoyens] = useState<MoyenPaiementInfo[]>(MOYENS_PAR_DEFAUT);
  const [moyen, setMoyen] = useState<MoyenPaiement>("especes");
  const [telephone, setTelephone] = useState(colis.destinataire_tel || "");
  const [cle, setCle] = useState<string | null>(null);

  const [chargement, setChargement] = useState(false);
  const [verification, setVerification] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatPaiement | null>(null);
  /** Paiement déjà existant pour ce colis (le cas échéant). */
  const [existant, setExistant] = useState<TransactionPaiement | null>(null);

  // ─── État initial : tarif, moyens et éventuel paiement déjà fait ────
  const initialiser = useCallback(async () => {
    const [resTarifs, resMoyens, resTransactions] = await Promise.allSettled([
      paiementAPI.tarifs(colis.nombre_articles || 1),
      paiementAPI.moyens(),
      paiementAPI.transactions.lister({ colis_id: colis.id, par_page: 10 }),
    ]);

    if (resTarifs.status === "fulfilled") setTarifs(resTarifs.value);
    if (resMoyens.status === "fulfilled" && resMoyens.value.length > 0) {
      setMoyens(resMoyens.value);
    }
    if (resTransactions.status === "fulfilled") {
      const dejaPaye = resTransactions.value.elements.find((t) =>
        STATUTS_ACTIFS.includes(t.statut),
      );
      setExistant(dejaPaye ?? null);
    }
  }, [colis.id, colis.nombre_articles]);

  useEffect(() => {
    let annule = false;
    (async () => {
      await initialiser();
      if (!annule) setVerification(false);
    })();
    return () => {
      annule = true;
    };
  }, [initialiser]);

  // Repli local (barème miroir) si `GET /paiement/tarifs` est injoignable.
  const fraisLocal = fraisServicePourArticles(colis.nombre_articles || 1);
  const fraisFcfa = tarifs?.frais_fcfa ?? fraisLocal.frais_fcfa;
  const partReceveur = tarifs?.part_receveur_fcfa ?? fraisLocal.part_receveur_fcfa;
  const telephoneValide =
    moyen !== "wave" || telephone.replace(/\D/g, "").length >= 6;

  async function regler() {
    if (!telephoneValide) return;
    setErreur(null);
    setChargement(true);
    // Même clé conservée après un échec : le rejeu reste idempotent.
    const cleUtilisee = cle ?? cleIdempotence(`frais-colis-${colis.id}`);
    if (!cle) setCle(cleUtilisee);
    try {
      // Le montant n'est pas envoyé : le serveur applique son barème.
      const reponse = await paiementAPI.transactions.payer({
        type: "COLIS",
        colis_id: colis.id,
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
      // Un paiement a peut-être été créé entre-temps : on rafraîchit l'état.
      await initialiser();
    } finally {
      setChargement(false);
    }
  }

  async function confirmer(reference: string) {
    setErreur(null);
    setChargement(true);
    try {
      const reponse = await paiementAPI.transactions.confirmer(reference);
      setResultat(reponse);
      setExistant(null);
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

  const blocErreur = erreur ? (
    <div className="mt-3">
      <Alerte variante="erreur" titre="Erreur">
        {erreur}
      </Alerte>
    </div>
  ) : null;

  // ─── 1. Reçu après paiement ────────────────────────────────────────
  if (resultat) {
    const { transaction, commission, portefeuille_beneficiaire, message } =
      resultat;
    return (
      <Carte titre="Frais de service du colis">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge
              variante={VARIANTES_STATUT_TRANSACTION[transaction.statut] ?? "info"}
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
            <dt className="text-ardoise-clair">Part du receveur</dt>
            <dd className="font-medium text-green-700">
              {formaterFcfa(transaction.commission_receveur)}
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
              onClick={() => confirmer(transaction.reference)}
            >
              <IconeCheck className="w-4 h-4" /> Confirmer (démo)
            </Bouton>
            <span className="text-xs text-ardoise-clair italic">
              En production, la confirmation vient de l&apos;opérateur (webhook).
            </span>
          </div>
        )}

        {blocErreur}
      </Carte>
    );
  }

  // ─── 2. Vérification du paiement existant ──────────────────────────
  if (verification) {
    return (
      <Carte titre="Frais de service du colis">
        <p className="text-sm text-ardoise-clair italic">
          Vérification des frais de ce colis…
        </p>
      </Carte>
    );
  }

  // ─── 3. Frais déjà prélevés : on ne redemande jamais ───────────────
  if (existant) {
    const reussi = existant.statut === "reussi";
    return (
      <Carte titre="Frais de service du colis">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variante={reussi ? "succes" : "ocre"}>
              {reussi ? "Déjà réglé" : "En attente"}
            </Badge>
            <span className="text-xs text-ardoise-clair font-mono">
              {existant.reference}
            </span>
          </div>
          <span className="text-lg font-bold text-lagune">
            {formaterFcfa(existant.montant_fcfa)}
          </span>
        </div>

        <p className="text-sm text-ardoise mt-3">
          {reussi
            ? "Les frais de service de ce colis ont déjà été réglés : ils ne seront pas prélevés une seconde fois."
            : "Un paiement est déjà en cours pour ce colis. Confirmez-le (ou attendez le retour de l'opérateur) : inutile de repayer."}
        </p>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-ardoise-clair/10 pb-1.5">
            <dt className="text-ardoise-clair">Moyen de paiement</dt>
            <dd className="font-medium">
              {LIBELLES_MOYEN[existant.moyen] ?? existant.moyen}
            </dd>
          </div>
          <div className="flex justify-between border-b border-ardoise-clair/10 pb-1.5">
            <dt className="text-ardoise-clair">Part du receveur</dt>
            <dd className="font-medium text-green-700">
              {formaterFcfa(existant.commission_receveur)}
            </dd>
          </div>
        </dl>

        {!reussi && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Bouton
              variante="primaire"
              chargement={chargement}
              onClick={() => confirmer(existant.reference)}
            >
              <IconeCheck className="w-4 h-4" /> Confirmer (démo)
            </Bouton>
          </div>
        )}

        {blocErreur}
      </Carte>
    );
  }

  // ─── 4. Formulaire d'encaissement (montant imposé par le barème) ────
  return (
    <Carte
      titre="Frais de service du colis"
      description="Payés par le client. Ils ne sont prélevés qu'une seule fois par colis."
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-sable-clair/60 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <span className="text-sm text-ardoise-clair">
              Frais de service à encaisser
            </span>
            <span className="text-2xl font-bold text-lagune">
              {formaterFcfa(fraisFcfa)}
            </span>
          </div>
          <p className="text-xs text-ardoise-clair mt-1">
            Colis de {colis.nombre_articles || 1} article
            {(colis.nombre_articles || 1) > 1 ? "s" : ""} — dont{" "}
            {formaterFcfa(partReceveur)} pour la cagnotte du receveur.
            {colis.frais_fcfa
              ? ` Prix du transport indiqué : ${formaterFcfa(
                  colis.frais_fcfa,
                )} (hors frais DigiID, non encaissé ici).`
              : ""}
          </p>
          <p className="text-xs text-ocre mt-1">
            Barème : 100 F (1-3 articles) · 200 F (4-6) · 350 F (7-10) · 500 F
            (plus de 10).
          </p>
        </div>

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
            disabled={!telephoneValide || chargement}
            onClick={regler}
          >
            <IconeCheck className="w-4 h-4" /> Encaisser{" "}
            {formaterFcfa(fraisFcfa)}
          </Bouton>
        </div>
      </div>
    </Carte>
  );
}
