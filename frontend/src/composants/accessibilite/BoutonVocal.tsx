"use client";
/**
 * BoutonVocal — bouton qui « parle » (S5).
 *
 * Enveloppe le `Bouton` existant : au clic (et éventuellement au focus), joue
 * l'audio associé à `cleAudio` dans la langue courante, puis exécute l'action.
 *
 * Pensé pour les utilisateurs peu ou pas scolarisés : chaque action clé est
 * annoncée à voix haute, dans la langue choisie « à l'oreille ».
 *
 *   <BoutonVocal cleAudio="btn.enregistrer_colis" onClick={…}>
 *     📦 Enregistrer un colis
 *   </BoutonVocal>
 */
import type { ButtonHTMLAttributes, MouseEvent, FocusEvent, ReactNode } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { useVoix } from "@/i18n/useLangue";

type Quand = "avant" | "apres" | "sur-clic";

interface ProprietesBoutonVocal extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "primaire" | "secondaire" | "ghost" | "danger" | "succes";
  taille?: "petit" | "moyen" | "grand";
  chargement?: boolean;
  /** Clé audio (identique à une clé de traduction). */
  cleAudio?: string;
  /** Texte de repli (TTS) si l'audio est absent — par défaut, la traduction. */
  texteAudio?: string;
  /**
   * Quand jouer le son :
   *  - `avant`    : annonce l'action AVANT de l'exécuter ;
   *  - `apres`    : exécute l'action puis l'annonce (défaut) ;
   *  - `sur-clic` : synchrone au clic (défaut = `apres` pour ne pas ralentir).
   */
  quand?: Quand;
  /** Joue aussi l'audio à la prise de focus (aide desktop / non-lecteurs). */
  vocalSurFocus?: boolean;
  children: ReactNode;
}

export function BoutonVocal({
  cleAudio,
  texteAudio,
  quand = "apres",
  vocalSurFocus = false,
  onClick,
  onFocus,
  children,
  ...reste
}: ProprietesBoutonVocal) {
  const { jouer } = useVoix();

  function annoncer() {
    if (cleAudio) jouer(cleAudio, texteAudio);
  }

  function gererClic(evenement: MouseEvent<HTMLButtonElement>) {
    if (quand === "avant") annoncer();
    onClick?.(evenement);
    if (quand !== "avant") annoncer();
  }

  function gererFocus(evenement: FocusEvent<HTMLButtonElement>) {
    if (vocalSurFocus) annoncer();
    onFocus?.(evenement);
  }

  return (
    <Bouton onClick={gererClic} onFocus={gererFocus} {...reste}>
      {children}
    </Bouton>
  );
}
