/**
 * DigiID — Accessibilité v1 : langues supportées (S5).
 *
 * Quatre langues : Dendi, Bariba (Baatonum), Fon et Français.
 * Toutes sont en écriture latine (LTR) → aucune gestion RTL à prévoir.
 *
 * Ordre d'affichage : langues du Nord (Dendi, Bariba) en tête pour la zone
 * d'implantation, puis Fon et Français. L'ordre est centralisé ici afin de
 * pouvoir le rendre paramétrable par région ultérieurement.
 */

export type Langue = "fr" | "fon" | "dendi" | "bariba";

export interface MetaLangue {
  /** Code interne DigiID. */
  code: Langue;
  /** Nom en français (pour les lecteurs). */
  libelle: string;
  /** Nom dans la langue elle-même (choix « à l'oreille »). */
  natif: string;
  /** Repère visuel (pictogramme / drapeau). */
  emoji: string;
  /** Code BCP-47 utilisé pour `html[lang]` et la synthèse vocale. */
  bcp47: string;
}

export const METADONNEES_LANGUES: Record<Langue, MetaLangue> = {
  fr: { code: "fr", libelle: "Français", natif: "Français", emoji: "🇫🇷", bcp47: "fr-FR" },
  fon: { code: "fon", libelle: "Fon", natif: "Fɔngbè", emoji: "🟡", bcp47: "fon" },
  dendi: { code: "dendi", libelle: "Dendi", natif: "Dendi", emoji: "🟢", bcp47: "ddn" },
  bariba: { code: "bariba", libelle: "Bariba", natif: "Baatonum", emoji: "🔵", bcp47: "bba" },
};

/** Langue de repli (référence complète des traductions). */
export const LANGUE_PAR_DEFAUT: Langue = "fr";

/** Ordre d'affichage des langues dans le sélecteur (Nord → Sud). */
export const LANGUES: Langue[] = ["dendi", "bariba", "fon", "fr"];

/** Vérifie qu'une valeur est bien une langue supportée. */
export function estLangue(valeur: string | null | undefined): valeur is Langue {
  return valeur === "fr" || valeur === "fon" || valeur === "dendi" || valeur === "bariba";
}

/** Clé `localStorage` de la langue choisie. */
export const CLE_LANGUE = "digiid.langue";
