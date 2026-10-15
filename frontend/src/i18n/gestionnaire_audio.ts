/**
 * DigiID — Gestionnaire audio & voix française (S5).
 *
 * Objectif : qu'une personne qui ne lit pas le français (ou ne lit pas du tout)
 * puisse **utiliser toute l'application à l'oreille**. La voix doit donc être
 * disponible partout, pas seulement sur deux ou trois boutons.
 *
 * Ce module centralise :
 *   1. la **synthèse vocale française de qualité** : choix de la meilleure voix
 *      `fr-FR` installée, attente du chargement des voix, réglages adaptés
 *      (débit légèrement ralenti, articulation claire) ;
 *   2. la **préparation du texte à dire** : « DigiID » → « Digi ID », « QR » →
 *      « Q R », « *346# » → « étoile 3 4 6 dièse », suppression des emojis et des
 *      chemins techniques (/receveur/scan) qu'un non-lecteur ne peut pas suivre ;
 *   3. le **découpage en phrases courtes** : les navigateurs coupent les longues
 *      lectures, on enchaîne donc des phrases de moins de 180 caractères ;
 *   4. la **file d'attente** : une seule lecture à la fois, la nouvelle remplace
 *      l'ancienne, et l'interface est prévenue (`surChangementLecture`) ;
 *   5. le **repli fichiers audio** : si un .mp3 existe dans `public/audios`, il
 *      est joué ; sinon la voix prend le relais (aucune dépendance obligatoire).
 *
 * Aucune dépendance React : ce fichier est piloté par `useLangue` / `useVoix`.
 */
import { AUDIOS, urlAudio } from "./audios";
import { AUDIOS_ENREGISTRES } from "./config";
import { METADONNEES_LANGUES, type Langue } from "./langues";

/** Clé `localStorage` de la préférence « muet ». */
export const CLE_MUET = "digiid.muet";
/** Clé `localStorage` de la vitesse de lecture (0,6 à 1,3). */
export const CLE_VITESSE = "digiid.vitesse";

/** Débit par défaut : un peu lent, c'est ce qui se comprend le mieux. */
const VITESSE_DEFAUT = 0.92;
/** Longueur maximale d'un morceau lu d'un trait (limite des navigateurs). */
const LONGUEUR_MAX = 180;

interface OptionsLecture {
  /** Débit (0,6 lent → 1,3 rapide). Par défaut, la préférence enregistrée. */
  vitesse?: number;
  /** Hauteur de la voix (1 = normale). */
  hauteur?: number;
  /** Volume (1 = maximum). */
  volume?: number;
  /** Langue de lecture (fr par défaut). */
  langue?: Langue;
}

// ─── Texte : préparer une phrase que la voix française dira bien ──────

/**
 * Réécrit le texte pour la voix : sigles épelés, symboles traduits, chemins et
 * emojis retirés. On ne traduit pas tout, on évite seulement ce qu'un auditeur
 * ne peut pas comprendre.
 */
export function franciser(texte: string): string {
  let t = texte;

  // Emojis et pictogrammes : jamais lus.
  t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, " ");

  // Chemins d'écran : « /receveur/colis/nouveau » → indication parlée.
  // (Au moins deux segments : sinon « départ/arrivée » serait abîmé.)
  t = t.replace(/\/(?:[a-z0-9\-[\]]+\/)+[a-z0-9\-[\]]+/gi, " l'écran indiqué ");

  // Sigles et symboles de l'application.
  // « ID » d'abord : dans « DigiID », il n'y a pas de limite de mot → intact,
  // la règle suivante s'en charge.
  t = t.replace(/\bID\b/g, "I D");
  t = t.replace(/DigiID/gi, "Digi ID");
  t = t.replace(/\bQR\s?-?\s?Code\b/gi, "Q R code");
  t = t.replace(/\bQR\b/g, "Q R");
  t = t.replace(/\bSMS\b/g, "S M S");
  t = t.replace(/\bUSSD\b/gi, "U S S D");
  t = t.replace(/\b2FA\b/gi, "double authentification");
  t = t.replace(/[nN]°\s?/g, "numéro ");
  t = t.replace(/\*346#/g, "étoile 3 4 6 dièse");
  t = t.replace(/\bex\.\s?/gi, "par exemple ");
  t = t.replace(/\benv\.\s?/gi, "environ ");
  t = t.replace(/\bkm\/h\b/gi, "kilomètres heure");
  t = t.replace(/\bFCFA\b/gi, "francs CFA");

  // Ponctuation et flèches.
  t = t.replace(/→|➜|->|=>/g, " puis ");
  t = t.replace(/[«»"“”]/g, " ");
  t = t.replace(/\s*\/\s*/g, " ou ");
  t = t.replace(/\s*:\s*/g, " : ");
  t = t.replace(/\s*•\s*/g, ". ");
  t = t.replace(/\s*-{2,}\s*/g, ". ");
  t = t.replace(/[\t\r]+/g, " ");
  t = t.replace(/\n+/g, ". ");
  t = t.replace(/\.\s*\./g, ".");
  t = t.replace(/\s{2,}/g, " ");

  return t.trim();
}

/** Découpe en morceaux courts (les navigateurs coupent les lectures longues). */
export function decouperEnMorceaux(texte: string): string[] {
  const propre = texte.trim();
  if (!propre) return [];
  if (propre.length <= LONGUEUR_MAX) return [propre];

  // Découpage volontairement sans « lookbehind » : certains navigateurs
  // anciens (iOS 16 par exemple) refusent cette syntaxe et casseraient tout.
  const phrases = propre
    .replace(/([.!?…:;])\s+/g, "$1\u0000")
    .split("\u0000")
    .map((p) => p.trim())
    .filter(Boolean);

  const morceaux: string[] = [];
  let courant = "";
  for (const phrase of phrases) {
    if (!courant) {
      courant = phrase;
    } else if ((courant + " " + phrase).length <= LONGUEUR_MAX) {
      courant = `${courant} ${phrase}`;
    } else {
      morceaux.push(courant);
      courant = phrase;
    }
    // Une phrase seule trop longue : on la coupe à la virgule la plus proche.
    while (courant.length > LONGUEUR_MAX) {
      const coupe = courant.lastIndexOf(",", LONGUEUR_MAX);
      const fin = coupe > LONGUEUR_MAX / 2 ? coupe + 1 : LONGUEUR_MAX;
      morceaux.push(courant.slice(0, fin).trim());
      courant = courant.slice(fin).trim();
    }
  }
  if (courant) morceaux.push(courant);
  return morceaux;
}

// ─── Choix de la meilleure voix française disponible ─────────────────

/**
 * Voix françaises préférées, par ordre de qualité perçue à l'oreille.
 * Ces noms correspondent aux voix installées sur Windows, macOS, Android et
 * Chrome (« Google français »). La correspondance est souple.
 */
const VOIX_PREFEREES = [
  "google français",
  "microsoft denise",
  "microsoft amélie",
  "microsoft amelie",
  "microsoft hortense",
  "microsoft paul",
  "microsoft thomas",
  "microsoft julie",
  "amélie",
  "amelie",
  "thomas",
  "audrey",
  "marie",
  "siri",
  "hortense",
  "denise",
];

function scoreVoix(voix: SpeechSynthesisVoice, bcp47: string): number {
  const langue = voix.lang.toLowerCase().replace("_", "-");
  const cible = bcp47.toLowerCase();
  const prefixe = cible.split("-")[0];
  let score = 0;

  if (langue === cible) score += 6; // fr-FR exactement
  else if (langue.startsWith(prefixe)) score += 4; // fr, fr-CA…
  else return -1; // mauvaise langue : écartée

  const nom = voix.name.toLowerCase();
  const rang = VOIX_PREFEREES.findIndex((v) => nom.includes(v));
  if (rang >= 0) score += 6 - Math.min(rang, 5); // voix réputée claire

  if (voix.localService) score += 1; // fonctionne hors ligne
  if (voix.default) score += 1;
  if (nom.includes("network")) score -= 1; // parfois hachée

  return score;
}

// ─── Gestionnaire ────────────────────────────────────────────────────

class GestionnaireAudioImpl {
  private audio: HTMLAudioElement | null = null;
  private abonnesMuet = new Set<(muet: boolean) => void>();
  private abonnesLecture = new Set<(enLecture: boolean) => void>();

  private file: string[] = [];
  private enLecture = false;
  private generation = 0;
  private voix: SpeechSynthesisVoice[] = [];
  private vitesse = VITESSE_DEFAUT;
  private parametresCourants = {
    vitesse: VITESSE_DEFAUT,
    hauteur: 1,
    volume: 1,
    langue: "fr" as Langue,
  };

  constructor() {
    if (typeof window === "undefined") return;
    this.vitesse = this.lireVitesseEnregistree();
    this.chargerVoix();
  }

  // ── Voix disponibles ───────────────────────────────────────────────

  /** Chrome renvoie une liste vide au premier appel : on attend `voiceschanged`. */
  private chargerVoix(): void {
    if (!("speechSynthesis" in window)) return;
    const recuperer = () => {
      const liste = window.speechSynthesis.getVoices();
      if (liste.length) this.voix = liste;
    };
    recuperer();
    window.speechSynthesis.addEventListener?.("voiceschanged", recuperer);
  }

  /** Meilleure voix pour une langue donnée (ou `null` → voix par défaut). */
  private choisirVoix(bcp47: string): SpeechSynthesisVoice | null {
    if (!("speechSynthesis" in window)) return null;
    if (!this.voix.length) this.voix = window.speechSynthesis.getVoices();
    if (!this.voix.length) return null;

    let meilleure: SpeechSynthesisVoice | null = null;
    let meilleurScore = -1;
    for (const voix of this.voix) {
      const score = scoreVoix(voix, bcp47);
      if (score > meilleurScore) {
        meilleure = voix;
        meilleurScore = score;
      }
    }
    return meilleurScore >= 0 ? meilleure : null;
  }

  /** Nom de la voix française utilisée (diagnostic / page Paramètres). */
  voixFrancaise(): string | null {
    const voix = this.choisirVoix("fr-FR");
    return voix ? `${voix.name} (${voix.lang})` : null;
  }

  /** La voix est-elle disponible dans ce navigateur ? */
  voixDisponible(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  // ── Préférences ────────────────────────────────────────────────────

  private lireVitesseEnregistree(): number {
    const brut = window.localStorage.getItem(CLE_VITESSE);
    const valeur = brut ? Number.parseFloat(brut) : NaN;
    return Number.isFinite(valeur) && valeur >= 0.6 && valeur <= 1.3
      ? valeur
      : VITESSE_DEFAUT;
  }

  /** Change le débit de la voix (persisté) — « parler lentement » / normal. */
  definirVitesse(valeur: number): void {
    const bornee = Math.min(1.3, Math.max(0.6, valeur));
    this.vitesse = bornee;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CLE_VITESSE, String(bornee));
    }
  }

  vitesseActuelle(): number {
    return this.vitesse;
  }

  estMuet(): boolean {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CLE_MUET) === "1";
  }

  definirMuet(muet: boolean): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CLE_MUET, muet ? "1" : "0");
    this.abonnesMuet.forEach((cb) => cb(muet));
    if (muet) this.arreter();
  }

  surChangementMuet(cb: (muet: boolean) => void): () => void {
    this.abonnesMuet.add(cb);
    return () => this.abonnesMuet.delete(cb);
  }

  /** S'abonne à l'état « en train de lire » (pour l'icône du bouton). */
  surChangementLecture(cb: (enLecture: boolean) => void): () => void {
    this.abonnesLecture.add(cb);
    return () => this.abonnesLecture.delete(cb);
  }

  estEnLecture(): boolean {
    return this.enLecture;
  }

  private notifierLecture(): void {
    this.abonnesLecture.forEach((cb) => cb(this.enLecture));
  }

  // ── Lecture ────────────────────────────────────────────────────────

  /**
   * Parle. Une nouvelle demande remplace la lecture en cours : l'utilisateur
   * n'entend jamais deux voix en même temps.
   *
   * @returns `false` si rien n'a pu être dit (son coupé, texte vide, TTS absent).
   */
  parler(texte: string | undefined | null, options: OptionsLecture = {}): boolean {
    if (typeof window === "undefined") return false;
    if (this.estMuet()) return false;

    const langue = options.langue ?? "fr";
    const prepare = franciser(texte ?? "");
    const morceaux = decouperEnMorceaux(prepare);
    if (!morceaux.length) return false;
    if (!("speechSynthesis" in window)) {
      console.warn("[audio] synthèse vocale indisponible dans ce navigateur.");
      return false;
    }

    this.arreter(false);
    this.generation += 1;
    this.file = morceaux;
    this.parametresCourants = {
      vitesse: options.vitesse ?? this.vitesse,
      hauteur: options.hauteur ?? 1,
      volume: options.volume ?? 1,
      langue,
    };
    this.enLecture = true;
    this.notifierLecture();

    const generation = this.generation;
    // Un court délai après `cancel()` : sinon certains navigateurs perdent la
    // première phrase.
    window.setTimeout(() => {
      if (generation === this.generation) this.lireSuivant(generation);
    }, 60);
    return true;
  }

  private lireSuivant(generation: number): void {
    if (generation !== this.generation) return;
    const morceau = this.file.shift();
    if (!morceau) {
      this.enLecture = false;
      this.notifierLecture();
      return;
    }

    const { vitesse, hauteur, volume, langue } = this.parametresCourants;
    const bcp47 = METADONNEES_LANGUES[langue].bcp47;
    const enonce = new SpeechSynthesisUtterance(morceau);
    const voix = this.choisirVoix(bcp47);
    if (voix) {
      enonce.voice = voix;
      enonce.lang = voix.lang;
    } else {
      enonce.lang = bcp47;
    }
    enonce.rate = vitesse;
    enonce.pitch = hauteur;
    enonce.volume = volume;
    enonce.onend = () => this.lireSuivant(generation);
    enonce.onerror = () => this.lireSuivant(generation);

    try {
      window.speechSynthesis.speak(enonce);
    } catch (erreur) {
      console.warn("[audio] échec de la synthèse vocale :", erreur);
      this.enLecture = false;
      this.notifierLecture();
    }
  }

  /**
   * Joue le son associé à une clé (fichier .mp3 s'il existe, sinon la voix).
   * Conservé pour `BoutonVocal` et les clés de `audios.ts`.
   */
  jouer(cle: string, texte: string | undefined, langue: Langue): void {
    if (typeof window === "undefined") return;
    if (this.estMuet()) return;

    // Français d'abord : si aucun .mp3 n'est enregistré, on parle directement
    // (pas de tentative de fichier → pas de 404, voix qui démarre tout de suite).
    const tenterFichier = langue === "fr" ? AUDIOS_ENREGISTRES : true;
    const url = tenterFichier ? urlAudio(cle, langue) : undefined;
    if (url) {
      this.arreter();
      const audio = this.audio ?? (this.audio = new Audio());
      audio.preload = "auto";
      audio.src = url;
      audio.onerror = () => this.parler(texte, { langue });
      const promesse = audio.play();
      if (promesse && typeof promesse.catch === "function") {
        promesse.catch(() => this.parler(texte, { langue }));
      }
      return;
    }
    this.parler(texte, { langue });
  }

  /** Annonce parlée courte (notification, changement d'écran, résultat). */
  annoncer(texte: string, options: OptionsLecture = {}): boolean {
    return this.parler(texte, options);
  }

  /**
   * Arrête tout son en cours.
   *
   * @param effacerFile vider aussi la file d'attente (défaut : oui)
   */
  arreter(effacerFile = true): void {
    if (typeof window === "undefined") return;
    if (effacerFile) {
      this.file = [];
      this.generation += 1;
    }
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
    if (this.enLecture && effacerFile) {
      this.enLecture = false;
      this.notifierLecture();
    }
  }

  /** Reprend après une interruption du navigateur (appel, changement d'onglet). */
  reprendre(): void {
    if (typeof window === "undefined") return;
    if ("speechSynthesis" in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  /** Précharge les .mp3 d'une langue (aucun effet si les fichiers n'existent pas). */
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
}

/** Instance unique partagée dans toute l'application. */
export const gestionnaireAudio = new GestionnaireAudioImpl();
