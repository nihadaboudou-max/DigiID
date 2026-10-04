/**
 * DigiID — Registre audio (S5).
 *
 * Associe chaque clé (identique à une clé de traduction) à un fichier audio
 * par langue. Les fichiers sont servis en statique depuis `public/audios/`.
 *
 * Stratégie (voir ARCHITECTURE_ACCESSIBILITE_VOCALE.md §3.2) :
 *   1. audio pré-enregistré (`.mp3`) si le fichier existe → qualité + hors-ligne ;
 *   2. sinon repli synthèse vocale (TTS) sur le texte traduit ;
 *   3. sinon silence + avertissement console.
 *
 * ⚠️ Les fichiers référencés ci-dessous sont à ENREGISTRER (voix humaines) et à
 * déposer dans `public/audios/{fr,fon,dendi,bariba}/`. Tant qu'ils n'existent
 * pas, le TTS prend le relais : la démo reste « parlante » sans enregistrement.
 */
import type { Langue } from "./langues";

export type RegistreAudio = Record<string, Partial<Record<Langue, string>>>;

/** Construit les 4 URLs d'une clé (convention `<cle_suffixe>.mp3`). */
function toutesLangues(cle: string): Partial<Record<Langue, string>> {
  const nomFichier = cle.replace(/\./g, "_");
  return {
    fr: `/audios/fr/${nomFichier}.mp3`,
    fon: `/audios/fon/${nomFichier}.mp3`,
    dendi: `/audios/dendi/${nomFichier}.mp3`,
    bariba: `/audios/bariba/${nomFichier}.mp3`,
  };
}

/** Clés « parlantes » du parcours colis + navigation (couverture v1). */
const CLES_AUDIO = [
  "accueil.bienvenue",
  "langue.titre",
  "btn.continuer",
  "btn.retour",
  "btn.enregistrer_colis",
  "btn.enregistrer",
  "btn.valider_scan",
  "btn.scanner_un_colis",
  "colis.expediteur.titre",
  "colis.destinataire.titre",
  "colis.succes.titre",
  "scan.titre",
  "receveur.titre",
  "chauffeur.titre",
] as const;

export const AUDIOS: RegistreAudio = CLES_AUDIO.reduce<RegistreAudio>(
  (acc, cle) => {
    acc[cle] = toutesLangues(cle);
    return acc;
  },
  {},
);

/** Renvoie l'URL audio d'une clé pour une langue, si déclarée. */
export function urlAudio(cle: string, langue: Langue): string | undefined {
  return AUDIOS[cle]?.[langue];
}
