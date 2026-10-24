"use client";
/**
 * Synchronisation hors-ligne globale (S3).
 *
 * Monté une seule fois dans `app/layout.tsx`. Il :
 *  - rejoue la file de colis dès que le réseau revient (`online`) ;
 *  - affiche un indicateur **compact** (icône + compteur), sans texte explicatif ;
 *  - reste silencieux quand tout est synchronisé.
 */
import { useCallback, useEffect, useState } from "react";

import { IconeCheck, IconeColis } from "@/composants/commun/Icones";
import {
  fileEnAttente,
  purgerColisSynchronises,
  synchroniserFile,
} from "@/services/offline/file_colis";

export function SynchronisationHorsLigne() {
  const [enAttente, setEnAttente] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [horsLigne, setHorsLigne] = useState(false);

  const rafraichir = useCallback(async () => {
    setEnAttente((await fileEnAttente().catch(() => [])).length);
  }, []);

  const synchroniser = useCallback(async () => {
    if (enCours) return;
    setEnCours(true);
    try {
      const bilan = await synchroniserFile();
      if (bilan.envoyes > 0) await purgerColisSynchronises();
    } catch {
      // Silencieux : la file sera rejouée au prochain retour du réseau.
    } finally {
      setEnCours(false);
      await rafraichir();
    }
  }, [enCours, rafraichir]);

  useEffect(() => {
    setHorsLigne(typeof navigator !== "undefined" && !navigator.onLine);
    void rafraichir();

    const surLigne = () => {
      setHorsLigne(false);
      void synchroniser();
    };
    const surHorsLigne = () => setHorsLigne(true);
    const intervalle = window.setInterval(() => void rafraichir(), 30_000);

    window.addEventListener("online", surLigne);
    window.addEventListener("offline", surHorsLigne);
    return () => {
      window.removeEventListener("online", surLigne);
      window.removeEventListener("offline", surHorsLigne);
      window.clearInterval(intervalle);
    };
  }, [rafraichir, synchroniser]);

  if (!horsLigne && enAttente === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void synchroniser()}
      disabled={horsLigne || enCours}
      className="no-print fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-ardoise-clair/20 bg-white px-3 py-2 text-xs font-semibold shadow-lg disabled:opacity-90"
      title={
        horsLigne
          ? "Hors ligne — les colis sont enregistrés localement"
          : "Synchroniser les colis en attente"
      }
    >
      <span
        className={`flex items-center gap-1 ${
          horsLigne ? "text-ambre" : "text-lagune"
        }`}
      >
        <IconeColis className="h-4 w-4" />
        {enAttente > 0 && <span>{enAttente}</span>}
      </span>
      {!horsLigne && enAttente === 0 ? (
        <IconeCheck className="h-4 w-4 text-lagune" />
      ) : (
        <span className="text-ardoise-clair">
          {horsLigne ? "hors ligne" : enCours ? "…" : "sync"}
        </span>
      )}
    </button>
  );
}
