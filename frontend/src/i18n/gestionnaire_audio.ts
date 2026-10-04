/**
 * DigiID — Gestionnaire audio (singleton) — S5.
 *
 * Un seul son à la fois : jouer un nouvel audio interrompt le précédent.
 * Respecte la préférence « muet » (persistée dans `localStorage`).
 * Repli automatique sur la synthèse vocale (TTS) si le fichier audio est
 * absent, puis silence + avertissement.
 *
 * Ce module est volontairement sans dépendance React : il est piloté par le
 * contexte de langue (`useLangue` / `useVoix`).
 */
import { AUDIOS, urlAudio } from "./audios";
import { METADONNEES_LANGUES, type Langue } from "./langues";

/** Clé `localStorage` de la préférence « muet ». */
export const CLE_MUET = "digiid.muet";

/** Sélectionne une voix TTS dont la langue correspond au code BCP-47 demandé. */
function choisirVoix(bcp47: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const prefixe = bcp47.split("-")[0].toLowerCase();
  const voix = window.speechSynthesis.getVoices();
  // 1) correspondance exacte (ex. « fon », « fr-FR »)
  const exacte = voix.find((v) => v.lang.toLowerCase() === bcp47.toLowerCase());
  if (exacte) return exacte;
  // 2) correspondance sur le préfixe de langue (ex. « fr »)
  return voix.find((v) => v.lang.toLowerCase().startsWith(prefixe)) ?? null;
}

class GestionnaireAudioImpl {
  private audio: HTMLAudioElement | null = null;
  /** Abonnés notifiés quand l'état « muet » change (pour refléter dans l'UI). */
  private abonnes = new Set<(muet: boolean) => void>();

  /** Indique si le son est coupé. */
  estMuet(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CLE_MUET) === "1";
  }

  /** Coupe ou réactive le son (persisté). */
  definirMuet(muet: boolean): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CLE_MUET, muet ? "1" : "0");
    this.abonnes.forEach((cb) => cb(muet));
    if (muet) this.arreter();
  }

  /** S'abonne aux changements de l'état « muet ». Renvoie la fonction de désabonnement. */
  surChangementMuet(cb: (muet: boolean) => void): () => void {
    this.abonnes.add(cb);
    return () => this.abonnes.delete(cb);
  }

  /**
   * Précharge (en tâche de fond) les audios du registre pour une langue.
   * Un audio absent renverra une erreur ici : on l'ignore silencieusement
   * (le TTS prendra le relais à la lecture).
   */
  precharger(langue: Langue): void {
    if (typeof window === "undefined") return;
    Object.keys(AUDIOS).forEach((cle) => {
      const url = urlAudio(cle, langue);
      if (!url) return;
      const precharge = new Audio();
      precharge.preload = "auto";
      precharge.src = url;
    });
  }

  /** Arrête tout son en cours (fichier + TTS). */
  arreter(): void {
    if (typeof window === "undefined") return;
    if (this.audio) {
      this.audio.pause();
      try {
        this.audio.currentTime = 0;
      } catch {
        /* ignoré */
      }
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Joue le son associé à une clé pour la langue donnée.
   *
   * @param cle     Clé du registre audio (ex. `btn.enregistrer_colis`).
   * @param texte   Texte de repli (TTS) si le fichier audio est absent.
   * @param langue  Langue courante.
   */
  jouer(cle: string, texte: string | undefined, langue: Langue): void {
    if (typeof window === "undefined") return;
    if (this.estMuet()) return;

    const url = urlAudio(cle, langue);
    if (url) {
      this.arreter();
      const audio = this.audio ?? (this.audio = new Audio());
      audio.preload = "auto";
      audio.src = url;
      audio.onerror = () => this.parler(texte, langue, cle);
      const promesse = audio.play();
      if (promesse && typeof promesse.catch === "function") {
        promesse.catch(() => this.parler(texte, langue, cle));
      }
      return;
    }
    this.parler(texte, langue, cle);
  }

  /** Repli synthèse vocale → sinon silence + avertissement. */
  private parler(texte: string | undefined, langue: Langue, cle: string): void {
    if (!texte || !texte.trim()) {
      console.warn(`[audio] texte manquant pour « ${cle} » (${langue}) — silence.`);
      return;
    }
    if (!("speechSynthesis" in window)) {
      console.warn(
        `[audio] audio non enregistré et TTS indisponible pour « ${cle} » (${langue}).`,
      );
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const enonce = new SpeechSynthesisUtterance(texte);
      const bcp47 = METADONNEES_LANGUES[langue].bcp47;
      const voix = choisirVoix(bcp47);
      if (voix) enonce.voice = voix;
      enonce.lang = voix?.lang ?? bcp47;
      enonce.rate = 0.95;
      window.speechSynthesis.speak(enonce);
    } catch (erreur) {
      console.warn(`[audio] échec de la synthèse vocale pour « ${cle} » :`, erreur);
    }
  }
}

/** Instance unique partagée dans toute l'application. */
export const gestionnaireAudio = new GestionnaireAudioImpl();
