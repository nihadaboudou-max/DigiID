"use client";
/**
 * LecteurQRCode — caméra QR réutilisable (html5-qrcode).
 *
 * Utilisé pour **identifier un chauffeur** sans qu'on ait à taper son
 * identifiant : le chauffeur présente sa carte DigiID, le code est décodé.
 *
 * Reprend la technique éprouvée de `ScannerTicket` :
 *   1. le conteneur est rendu **visible AVANT** `start()` — html5-qrcode fixe la
 *      largeur de la vidéo sur `parentElement.clientWidth`, qui vaut 0 si le
 *      conteneur est `display:none` (caméra active mais image invisible) ;
 *   2. on attend la peinture (2 frames) avant de démarrer ;
 *   3. la caméra est arrêtée puis libérée (`stop()` + `clear()`) au démontage.
 */
import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { IconeScan } from "@/composants/commun/Icones";

/** Attend que le navigateur ait peint (deux frames). */
function attendrePeinture(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

interface Proprietes {
  /** Identifiant DOM du conteneur vidéo — doit être **unique** dans la page. */
  id: string;
  /** Appelé avec le texte décodé (la caméra est arrêtée automatiquement). */
  surDecode: (texte: string) => void;
  libelleBouton?: string;
  /** Message affiché si la caméra est refusée ou indisponible. */
  messageIndisponible?: string;
}

export function LecteurQRCode({
  id,
  surDecode,
  libelleBouton = "Scanner la carte du chauffeur",
  messageIndisponible = "Caméra indisponible ou accès refusé. Saisissez le code à la main.",
}: Proprietes) {
  const [ouverte, setOuverte] = useState(false);
  const [demarrage, setDemarrage] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const refScanner = useRef<Html5Qrcode | null>(null);

  // Arrêt de la caméra au démontage (changement de page, fermeture du volet…).
  useEffect(() => {
    return () => {
      const instance = refScanner.current;
      refScanner.current = null;
      if (instance) {
        void instance.stop().catch(() => undefined);
      }
    };
  }, []);

  async function demarrer() {
    setErreur(null);
    if (refScanner.current || ouverte) return;
    setDemarrage(true);
    setOuverte(true);
    try {
      const module = await import("html5-qrcode");
      await attendrePeinture();
      const instance = new module.Html5Qrcode(id);
      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texteDecode) => {
          void arreter();
          surDecode(texteDecode);
        },
        () => undefined,
      );
      refScanner.current = instance;
    } catch {
      refScanner.current = null;
      setOuverte(false);
      setErreur(messageIndisponible);
    } finally {
      setDemarrage(false);
    }
  }

  async function arreter() {
    const instance = refScanner.current;
    refScanner.current = null;
    setOuverte(false);
    setDemarrage(false);
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!ouverte ? (
          <Bouton
            type="button"
            variante="secondaire"
            disabled={demarrage}
            chargement={demarrage}
            onClick={() => void demarrer()}
          >
            <IconeScan className="w-4 h-4" /> {libelleBouton}
          </Bouton>
        ) : (
          <Bouton type="button" variante="ghost" onClick={() => void arreter()}>
            Fermer la caméra
          </Bouton>
        )}
      </div>

      {/*
        ⚠️ Ne PAS laisser le conteneur en `hidden` pendant `start()` (voir l'entête).
        L'indicateur de chargement est HORS du conteneur `id` : `clear()` fait
        `innerHTML = ""` et effacerait un enfant géré par React.
      */}
      <div className="relative">
        <div
          id={id}
          className={
            ouverte
              ? "relative w-full min-h-[260px] rounded-xl overflow-hidden border border-ardoise-clair/20 bg-black [&_video]:!w-full [&_video]:h-auto [&_video]:block"
              : "hidden"
          }
        />
        {ouverte && demarrage && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-white/80 bg-black/50">
            Activation de la caméra…
          </p>
        )}
      </div>

      {erreur && <Alerte variante="avertissement">{erreur}</Alerte>}
    </div>
  );
}
