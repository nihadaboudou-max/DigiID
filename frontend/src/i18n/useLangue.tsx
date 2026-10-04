"use client";

/**
 * Contexte de langue DigiID — mini-moteur i18n maison (S5).
 *
 * Volontairement léger (pas de `react-i18next`) pour maîtriser le couplage
 * texte ↔ audio : une clé de traduction EST une clé audio.
 *
 * Fournit :
 *   - `useLangue()` : langue courante, changement de langue, traductions `t()` ;
 *   - `useVoix()`   : lecture audio (via le `GestionnaireAudio` singleton) + muet.
 *
 * Repli : si une clé manque dans la langue locale → français ; si elle manque
 * partout → la clé est renvoyée telle quelle (jamais de plantage).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import fr from "./fr.json";
import fon from "./fon.json";
import dendi from "./dendi.json";
import bariba from "./bariba.json";
import { CLE_MUET, gestionnaireAudio } from "./gestionnaire_audio";
import { ACTIVER_PREACHARGEMENT_AUDIO } from "./config";
import {
  CLE_LANGUE,
  estLangue,
  LANGUE_PAR_DEFAUT,
  LANGUES,
  METADONNEES_LANGUES,
  type Langue,
  type MetaLangue,
} from "./langues";

type Dictionnaire = Record<string, string>;

const DICTIONNAIRES: Record<Langue, Dictionnaire> = {
  fr,
  fon,
  dendi,
  bariba,
};

export type ParametresTraduction = Record<string, string | number>;

interface ContexteLangueValeur {
  langue: Langue;
  /** Métadonnées de la langue courante. */
  meta: MetaLangue;
  /** Toutes les langues, dans l'ordre d'affichage. */
  langues: MetaLangue[];
  definirLangue: (langue: Langue) => void;
  /** Traduit une clé (avec interpolation `{nom}`). */
  t: (cle: string, parametres?: ParametresTraduction) => string;
  /** Joue l'audio d'une clé (texte de repli = traduction).
   *  `langueForcee` permet de pré-écouter une langue avant de l'avoir choisie. */
  jouer: (cle: string, textePersonnalise?: string, langueForcee?: Langue) => void;
  /** Arrête tout son en cours. */
  arreter: () => void;
  /** Son coupé ? */
  muet: boolean;
  definirMuet: (muet: boolean) => void;
  basculerMuet: () => void;
}

const Contexte = createContext<ContexteLangueValeur | undefined>(undefined);

/** Récupère le texte traduit brut (repli FR) sans interpolation. */
function texteBrut(langue: Langue, cle: string): string | undefined {
  return DICTIONNAIRES[langue]?.[cle] ?? DICTIONNAIRES.fr[cle];
}

function interpoler(texte: string, parametres?: ParametresTraduction): string {
  if (!parametres) return texte;
  return texte.replace(/\{(\w+)\}/g, (correspondance, cle) => {
    const valeur = parametres[cle];
    return valeur === undefined ? correspondance : String(valeur);
  });
}

export function FournisseurLangue({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<Langue>(LANGUE_PAR_DEFAUT);
  const [muet, setMuet] = useState(false);
  const monte = useRef(false);

  // Restaure la langue et la préférence « muet » au premier rendu client.
  useEffect(() => {
    monte.current = true;
    const memoLangue = window.localStorage.getItem(CLE_LANGUE);
    if (estLangue(memoLangue)) setLangue(memoLangue);
    setMuet(gestionnaireAudio.estMuet());

    const desabonner = gestionnaireAudio.surChangementMuet(setMuet);
    return desabonner;
  }, []);

  // Applique `lang` sur <html> et persiste le choix.
  useEffect(() => {
    if (!monte.current) return;
    document.documentElement.lang = METADONNEES_LANGUES[langue].bcp47;
    window.localStorage.setItem(CLE_LANGUE, langue);
  }, [langue]);

  const definirLangue = useCallback((nouvelle: Langue) => {
    setLangue(nouvelle);
  }, []);

  const t = useCallback(
    (cle: string, parametres?: ParametresTraduction) => {
      const texte = texteBrut(langue, cle) ?? cle;
      return interpoler(texte, parametres);
    },
    [langue],
  );

  const jouer = useCallback(
    (cle: string, textePersonnalise?: string, langueForcee?: Langue) => {
      const langueCible = langueForcee ?? langue;
      // On ne passe au TTS que du vrai texte traduit (jamais la clé brute).
      const texte = textePersonnalise ?? texteBrut(langueCible, cle);
      gestionnaireAudio.jouer(cle, texte, langueCible);
    },
    [langue],
  );

  const arreter = useCallback(() => gestionnaireAudio.arreter(), []);
  const definirMuet = useCallback((valeur: boolean) => {
    gestionnaireAudio.definirMuet(valeur);
    setMuet(valeur);
  }, []);
  const basculerMuet = useCallback(() => {
    definirMuet(!gestionnaireAudio.estMuet());
  }, [definirMuet]);

  // Précharge le pack de la langue courante.
  // 🔌 Piloté par l'interrupteur ACTIVER_PREACHARGEMENT_AUDIO (voir `config.ts`).
  // Il reste `false` tant que les .mp3 ne sont pas déposés dans `public/audios/`
  // (sinon : erreurs 404 en console). Passer l'interrupteur à `true` le jour venu.
  useEffect(() => {
    if (!ACTIVER_PREACHARGEMENT_AUDIO) return;
    gestionnaireAudio.precharger(langue);
  }, [langue]);

  const valeur = useMemo<ContexteLangueValeur>(
    () => ({
      langue,
      meta: METADONNEES_LANGUES[langue],
      langues: LANGUES.map((code) => METADONNEES_LANGUES[code]),
      definirLangue,
      t,
      jouer,
      arreter,
      muet,
      definirMuet,
      basculerMuet,
    }),
    [langue, definirLangue, t, jouer, arreter, muet, definirMuet, basculerMuet],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useLangue(): ContexteLangueValeur {
  const contexte = useContext(Contexte);
  if (contexte === undefined) {
    throw new Error(
      "useLangue() doit être utilisé à l'intérieur de FournisseurLangue",
    );
  }
  return contexte;
}

/**
 * `useVoix()` — API de lecture audio centrée sur la voix (alias pratique).
 * Réutilise le même contexte de langue (une seule source de vérité).
 */
export function useVoix() {
  const { jouer, arreter, muet, definirMuet, basculerMuet } = useLangue();
  return { jouer, arreter, muet, definirMuet, basculerMuet };
}

export { CLE_MUET };
