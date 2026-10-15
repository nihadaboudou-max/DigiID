"use client";

/**
 * AssistantImpression — prépare la page pour **Ctrl+P** (et le menu du
 * navigateur), pas seulement pour les boutons « Imprimer ».
 *
 * Le composant ne dessine rien : il écoute `beforeprint` / `afterprint` (et la
 * feuille de style média `print`, car Safari est capricieux) pour poser puis
 * retirer les marquages décrits dans `services/impression.ts`. Résultat : quelle
 * que soit la façon d'imprimer, on obtient **une page par ticket** et une page
 * par étiquette QR, sans superposition.
 *
 * Monté une seule fois dans le layout racine.
 */
import { useEffect } from "react";

import { preparerImpression, terminerImpression } from "@/services/impression";

export function AssistantImpression() {
  useEffect(() => {
    const avant = () => {
      preparerImpression();
    };
    const apres = () => {
      terminerImpression();
    };

    window.addEventListener("beforeprint", avant);
    window.addEventListener("afterprint", apres);

    // Repli pour les navigateurs qui n'émettent pas `beforeprint`.
    const media = window.matchMedia("print");
    const surChangement = (evenement: MediaQueryListEvent) => {
      if (evenement.matches) avant();
      else apres();
    };
    media.addEventListener?.("change", surChangement);

    return () => {
      window.removeEventListener("beforeprint", avant);
      window.removeEventListener("afterprint", apres);
      media.removeEventListener?.("change", surChangement);
    };
  }, []);

  return null;
}
