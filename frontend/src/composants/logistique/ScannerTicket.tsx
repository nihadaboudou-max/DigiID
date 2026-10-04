"use client";
/**
 * Scanner de ticket colis — guichet / terrain (S3).
 *
 * Deux façons de renseigner le colis :
 *   - scan caméra (QR Code imprimé sur le ticket),
 *   - saisie manuelle du numéro en clair (repli quand la caméra est absente).
 *
 * Le scan est **idempotent** (clé générée à chaque tentative) et applique la
 * règle anti-« DÉJÀ LIVRÉ » : un second scan de livraison n'est pas accepté.
 */
import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeCheck, IconeScan } from "@/composants/commun/Icones";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import { gareDeLActeur, logistiqueAPI, type Gare } from "@/services/logistique_api";
import {
  LIBELLES_STATUT_COLIS,
  VARIANTES_STATUT_COLIS,
  type ResultatScan,
  type TypeEvenementScan,
} from "@/types/logistique";
import { analyserEntreeScan, formaterDateHeure, formaterFcfa } from "./format";

const ID_LECTEUR = "lecteur-qr-colis";

/** Actions proposées à l'agent, dans l'ordre du parcours d'un colis. */
const OPTIONS_TYPE: { valeur: TypeEvenementScan; libelle: string }[] = [
  { valeur: "livraison", libelle: "Remise au destinataire (livraison)" },
  { valeur: "depart", libelle: "Départ de la gare" },
  { valeur: "mise_en_transit", libelle: "Mise en transit" },
  { valeur: "arrivee", libelle: "Arrivée à destination" },
];

interface Proprietes {
  /** Code pré-rempli (ex : issu d'un scan caméra natif via `?token=`). */
  tokenInitial?: string;
  /** Action par défaut (livraison au guichet, départ en route…). */
  typeParDefaut?: TypeEvenementScan;
}

/** Génère une clé d'idempotence (UUID si disponible, sinon repli). */
function genererCleIdempotence(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ScannerTicket({
  tokenInitial,
  typeParDefaut = "livraison",
}: Proprietes) {
  const { utilisateur } = useAuthentification();

  const [code, setCode] = useState(tokenInitial ?? "");
  const [typeEvenement, setTypeEvenement] = useState<TypeEvenementScan>(typeParDefaut);
  const [gareContexte, setGareContexte] = useState<Gare | null>(null);

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatScan | null>(null);

  const [cameraOuverte, setCameraOuverte] = useState(false);
  const [erreurCamera, setErreurCamera] = useState<string | null>(null);
  const refScanner = useRef<Html5Qrcode | null>(null);

  // Gare de rattachement (contexte du scan)
  useEffect(() => {
    if (!utilisateur?.id) return;
    let annule = false;
    void gareDeLActeur(utilisateur.id).then((gare) => {
      if (!annule) setGareContexte(gare);
    });
    return () => {
      annule = true;
    };
  }, [utilisateur?.id]);

  // Arrêt de la caméra au démontage
  useEffect(() => {
    return () => {
      const instance = refScanner.current;
      refScanner.current = null;
      if (instance) {
        void instance.stop().catch(() => undefined);
      }
    };
  }, []);

  async function executerScan(entreeBrute: string) {
    const cible = analyserEntreeScan(entreeBrute);
    if (!cible.token && !cible.code_clair) {
      setErreur("Scannez ou saisissez d'abord le numéro du colis.");
      return;
    }
    setErreur(null);
    setResultat(null);
    setEnCours(true);
    try {
      const reponse = await logistiqueAPI.scans.scanner({
        ...cible,
        type_evenement: typeEvenement,
        gare_id: gareContexte?.id ?? null,
        idempotency_key: genererCleIdempotence(),
      });
      setResultat(reponse);
      setCode("");
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Échec du scan. Vérifiez le numéro puis réessayez.",
      );
    } finally {
      setEnCours(false);
    }
  }

  async function demarrerCamera() {
    setErreurCamera(null);
    if (refScanner.current) return;
    try {
      const module = await import("html5-qrcode");
      const instance = new module.Html5Qrcode(ID_LECTEUR);
      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texteDecode) => {
          void arreterCamera();
          setCode(texteDecode);
          void executerScan(texteDecode);
        },
        () => undefined,
      );
      refScanner.current = instance;
      setCameraOuverte(true);
    } catch {
      refScanner.current = null;
      setCameraOuverte(false);
      setErreurCamera(
        "Caméra indisponible. Saisissez le numéro du colis à la main.",
      );
    }
  }

  async function arreterCamera() {
    const instance = refScanner.current;
    refScanner.current = null;
    setCameraOuverte(false);
    if (instance) {
      try {
        await instance.stop();
        instance.clear();
      } catch {
        /* déjà arrêtée */
      }
    }
  }

  return (
    <div className="space-y-5">
      <Carte
        titre="Scanner un ticket colis"
        description="Scannez le QR Code du ticket, ou tapez le numéro imprimé."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ardoise">
              Action à enregistrer
            </label>
            <select
              className="champ-saisie"
              value={typeEvenement}
              onChange={(e) => setTypeEvenement(e.target.value as TypeEvenementScan)}
            >
              {OPTIONS_TYPE.map((option) => (
                <option key={option.valeur} value={option.valeur}>
                  {option.libelle}
                </option>
              ))}
            </select>
            {gareContexte && (
              <p className="text-xs text-ardoise-clair">
                Scan rattaché à la gare : {gareContexte.nom} ({gareContexte.ville})
              </p>
            )}
          </div>

          <ChampSaisie
            libelle="Numéro du colis ou contenu du QR"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex : DKR-2025-000001"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void executerScan(code);
              }
            }}
          />

          <div className="flex flex-wrap gap-3">
            <Bouton
              variante="primaire"
              disabled={enCours || !code.trim()}
              chargement={enCours && !cameraOuverte}
              onClick={() => void executerScan(code)}
            >
              <IconeCheck className="w-4 h-4" /> Valider le scan
            </Bouton>
            {!cameraOuverte ? (
              <Bouton variante="secondaire" onClick={() => void demarrerCamera()}>
                <IconeScan className="w-4 h-4" /> Scanner avec la caméra
              </Bouton>
            ) : (
              <Bouton variante="ghost" onClick={() => void arreterCamera()}>
                Fermer la caméra
              </Bouton>
            )}
          </div>

          {/* Zone caméra (html5-qrcode) */}
          <div
            id={ID_LECTEUR}
            className={
              cameraOuverte
                ? "rounded-xl overflow-hidden border border-ardoise-clair/20"
                : "hidden"
            }
          />

          {erreurCamera && (
            <Alerte variante="avertissement">{erreurCamera}</Alerte>
          )}
          {erreur && <Alerte variante="erreur" titre="Scan impossible">{erreur}</Alerte>}
        </div>
      </Carte>

      {resultat && (
        <ResultatScanAffichage resultat={resultat} />
      )}
    </div>
  );
}

/** Affiche le résultat d'un scan (succès, déjà scanné, ou « DÉJÀ LIVRÉ »). */
function ResultatScanAffichage({ resultat }: { resultat: ResultatScan }) {
  const colis = resultat.colis;

  if (resultat.deja_livre) {
    return (
      <Alerte variante="erreur" titre="DÉJÀ LIVRÉ">
        {resultat.message}
      </Alerte>
    );
  }

  return (
    <div className="space-y-3 apparition">
      <Alerte
        variante={resultat.deja_scanne ? "avertissement" : "succes"}
        titre={resultat.deja_scanne ? "Scan déjà enregistré" : "Scan enregistré"}
      >
        {resultat.message}
      </Alerte>

      {colis && (
        <Carte titre="Colis concerné">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="font-mono font-bold text-lagune text-lg">
                {colis.code_clair || "—"}
              </span>
              <Badge variante={VARIANTES_STATUT_COLIS[colis.statut] ?? "neutre"}>
                {LIBELLES_STATUT_COLIS[colis.statut] ?? colis.statut}
              </Badge>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <Ligne libelle="Destinataire" valeur={colis.destinataire_nom} />
              <Ligne libelle="Téléphone" valeur={colis.destinataire_tel} />
              <Ligne libelle="Départ" valeur={colis.gare_depart_nom || "—"} />
              <Ligne libelle="Arrivée" valeur={colis.gare_arrivee_nom || "—"} />
              <Ligne libelle="Frais" valeur={formaterFcfa(colis.frais_fcfa)} />
              {colis.livre_le && (
                <Ligne libelle="Livré le" valeur={formaterDateHeure(colis.livre_le)} />
              )}
            </dl>
            {colis.code_clair && (
              <div className="pt-1">
                <a
                  href={`/receveur/tickets/${encodeURIComponent(colis.code_clair)}`}
                  className="text-sm text-lagune hover:underline font-medium"
                >
                  Voir le suivi complet →
                </a>
              </div>
            )}
          </div>
        </Carte>
      )}
    </div>
  );
}

/** Petite ligne libellé/valeur. */
function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-ardoise-clair/10 pb-1">
      <dt className="text-ardoise-clair">{libelle}</dt>
      <dd className="font-medium text-ardoise text-right">{valeur}</dd>
    </div>
  );
}
