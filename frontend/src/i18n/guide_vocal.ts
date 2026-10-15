/**
 * DigiID — Guide vocal global (S5).
 *
 * Le problème corrigé ici : la voix ne fonctionnait que sur quelques boutons
 * (colis, scan). Pour une personne qui ne lit pas, l'application entière doit
 * pouvoir se raconter.
 *
 * Ce module fournit :
 *   - **« Écouter cette page »** : lit, dans l'ordre, le titre de l'écran, les
 *     messages d'alerte affichés, les champs à remplir et les actions
 *     disponibles — sur n'importe quelle page, sans annotation préalable ;
 *   - le **mode guidé** : à chaque changement d'écran, le titre et les actions
 *     sont annoncés ; chaque bouton ou lien touché est nommé à voix haute ;
 *     chaque champ qui reçoit le focus est décrit ;
 *   - l'**annonce des notifications** (succès, avertissement, erreur) : le
 *     résultat d'une action ne reste jamais uniquement à l'écran.
 *
 * Le français est la langue de référence du guide : les phrases sont donc
 * écrites en français clair, courtes, et prononcées par la meilleure voix
 * française disponible (`gestionnaireAudio`).
 *
 * Aucune dépendance React : ce fichier est utilisable par les composants
 * (`GuideVocal`, `BoutonVocal`) comme par le contexte de notifications.
 */
import { gestionnaireAudio } from "./gestionnaire_audio";

/** Clé `localStorage` du mode guidé. */
export const CLE_GUIDE = "digiid.guide";

let actif = false;
const abonnes = new Set<(actif: boolean) => void>();

/** Le mode guidé est-il activé ? */
export function guideActif(): boolean {
  return actif;
}

/** Active / désactive le mode guidé (persisté) et prévient l'interface. */
export function definirGuide(valeur: boolean): void {
  actif = valeur;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CLE_GUIDE, valeur ? "1" : "0");
  }
  abonnes.forEach((cb) => cb(valeur));
}

/** S'abonne aux changements du mode guidé. Renvoie le désabonnement. */
export function surChangementGuide(cb: (actif: boolean) => void): () => void {
  abonnes.add(cb);
  return () => abonnes.delete(cb);
}

/** Relit la préférence enregistrée (appelé au premier rendu client). */
export function lireGuideEnregistre(): boolean {
  if (typeof window === "undefined") return false;
  actif = window.localStorage.getItem(CLE_GUIDE) === "1";
  return actif;
}

// ─── Analyse de la page ──────────────────────────────────────────────

/** Décor à ne jamais raconter quand on lit une page : menus, en-têtes, pieds. */
const SELECTEUR_DECOR =
  "nav, aside, header, footer, script, style, [data-vocal-ignorer], [aria-hidden='true']";
/** Éléments hors sujet pour un geste : notre propre commande vocale. */
const SELECTEUR_HORS_GESTE = "[data-vocal-ignorer], [aria-hidden='true'], script, style";

function zoneLisible(): Element | null {
  if (typeof document === "undefined") return null;
  // `data-vocal-zone` permet à une page d'indiquer la zone à raconter (utile sur
  // les écrans publics, qui n'ont pas de balise `<main>`).
  return (
    document.querySelector("[data-vocal-zone]") ??
    document.querySelector("main") ??
    document.querySelector("[role='main']") ??
    document.body
  );
}

function estInvisible(element: Element): boolean {
  if (typeof window === "undefined") return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return true;
  const rect = element.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0;
}

/** Élément de décor (menu, en-tête…) ou invisible : rien à raconter dans la page. */
function estCache(element: Element): boolean {
  return Boolean(element.closest(SELECTEUR_DECOR)) || estInvisible(element);
}

/**
 * Élément concerné par un geste de l'utilisateur.
 *
 * Ici on garde les menus et l'en-tête : si la personne touche « Mes colis » dans
 * la barre latérale, elle doit l'entendre — c'est justement son moyen de
 * naviguer.
 */
function estHorsGeste(element: Element): boolean {
  return Boolean(element.closest(SELECTEUR_HORS_GESTE)) || estInvisible(element);
}

function nettoyer(texte: string | null | undefined): string {
  return (texte ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Libellé parlable d'un élément. Priorité au texte écrit pour la voix
 * (`data-vocal`), puis au libellé accessible (`aria-label`), puis au texte visible.
 */
export function libelleElement(element: Element | null): string {
  if (!element) return "";
  const vocal = element.getAttribute("data-vocal");
  if (vocal) return nettoyer(vocal);
  const aria = element.getAttribute("aria-label");
  if (aria) return nettoyer(aria);
  const titre = element.getAttribute("title");
  const texte = nettoyer(element.textContent);
  if (texte) return texte;
  return nettoyer(titre);
}

/** Décrit un champ de saisie : « nom du destinataire, obligatoire ». */
export function libelleChamp(champ: Element): string {
  let texte = "";
  const aria = champ.getAttribute("aria-label");
  const id = champ.getAttribute("id");
  if (aria) {
    texte = aria;
  } else if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    texte = nettoyer(label?.textContent);
  }
  if (!texte) {
    const labelParent = champ.closest("label");
    texte = nettoyer(labelParent?.textContent);
  }
  if (!texte) texte = nettoyer(champ.getAttribute("placeholder"));
  if (!texte) texte = nettoyer(champ.getAttribute("name"));
  if (!texte) return "";
  const obligatoire = champ.hasAttribute("required") ? ", obligatoire" : "";
  return `${texte}${obligatoire}`;
}

/**
 * Compose le texte à lire pour l'écran courant.
 *
 * Ordre choisi pour une personne qui découvre l'écran :
 *   1. ce que c'est (titre) ;
 *   2. l'éventuelle explication fournie par la page (`data-vocal-annonce`) ;
 *   3. ce qui s'est passé (messages d'alerte visibles) ;
 *   4. ce qu'il faut remplir (champs) ;
 *   5. ce qu'on peut toucher (boutons et liens).
 */
export function composerScriptPage(): string {
  const zone = zoneLisible();
  if (!zone) return "Cette page n'a rien à lire.";

  const parties: string[] = [];

  const titre = nettoyer(zone.querySelector("h1")?.textContent);
  parties.push(titre ? `Écran : ${titre}.` : `Écran : ${document.title}.`);

  const annonce = nettoyer(
    zone.getAttribute("data-vocal-annonce") ??
      zone.querySelector("[data-vocal-annonce]")?.getAttribute("data-vocal-annonce"),
  );
  if (annonce) parties.push(annonce);

  const messages = Array.from(zone.querySelectorAll("[role='alert'], [data-vocal-message']"))
    .filter((el) => !estCache(el))
    .map((el) => nettoyer(el.textContent))
    .filter(Boolean)
    .slice(0, 2);
  if (messages.length) parties.push(`Message affiché : ${messages.join(". ")}.`);

  const champs = Array.from(
    zone.querySelectorAll("input:not([type='hidden']), select, textarea"),
  )
    .filter((el) => !estCache(el))
    .map(libelleChamp)
    .filter(Boolean);
  if (champs.length) {
    const liste = champs.slice(0, 6).join(", ");
    const reste = champs.length > 6 ? `, et ${champs.length - 6} autres` : "";
    parties.push(`À remplir : ${liste}${reste}.`);
  }

  const actions = Array.from(zone.querySelectorAll("button, a[href], [role='button']"))
    .filter((el) => !estCache(el))
    .map(libelleElement)
    .filter((libelle) => libelle.length > 1 && libelle.length <= 60)
    .filter((libelle, index, tableau) => tableau.indexOf(libelle) === index);
  if (actions.length) {
    const liste = actions.slice(0, 8).join(", ");
    const reste = actions.length > 8 ? `, et ${actions.length - 8} autres` : "";
    parties.push(`Vous pouvez toucher : ${liste}${reste}.`);
  }

  const explication = nettoyer(
    zone.querySelector("[data-vocal-texte]")?.getAttribute("data-vocal-texte") ??
      zone.querySelector("[data-vocal-texte]")?.textContent,
  );
  if (explication) parties.push(explication);

  return parties.join(" ");
}

/** Lit l'écran courant à voix haute (« Écouter cette page »). */
export function lirePage(): boolean {
  return gestionnaireAudio.parler(composerScriptPage());
}

/**
 * Annonce un nouvel écran (mode guidé). Le délai laisse le temps à la page de
 * s'afficher : on lit ce que l'utilisateur voit, pas l'écran précédent.
 */
export function annoncerEcran(delai = 550): void {
  if (!guideActif()) return;
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    if (guideActif()) gestionnaireAudio.parler(composerScriptPage());
  }, delai);
}

/** Annonce une notification (succès, avertissement, erreur). */
export function annoncerNotification(
  message: string,
  variante: "info" | "succes" | "avertissement" | "erreur" = "info",
): void {
  const texte = nettoyer(message);
  if (!texte) return;

  if (variante === "erreur") {
    gestionnaireAudio.parler(`Attention. ${texte}`);
    return;
  }
  if (variante === "avertissement") {
    gestionnaireAudio.parler(`Attention. ${texte}`);
    return;
  }
  if (variante === "succes") {
    gestionnaireAudio.parler(`C'est fait. ${texte}`);
    return;
  }
  gestionnaireAudio.parler(texte);
}

// ─── Écoute des gestes (mode guidé) ──────────────────────────────────

/**
 * Pendant le mode guidé :
 *   - toucher un bouton ou un lien dit ce qu'on a touché ;
 *   - toucher un champ dit ce qu'il faut y mettre.
 *
 * @returns la fonction de nettoyage (à appeler au démontage React).
 */
export function activerEcouteInteractive(): () => void {
  if (typeof document === "undefined") return () => undefined;

  const surPression = (evenement: Event) => {
    if (!guideActif()) return;
    const cible = (evenement.target as Element | null)?.closest(
      "button, a[href], [role='button'], label",
    );
    if (!cible || estHorsGeste(cible)) return;
    // Un bouton déjà parlant (`<BoutonVocal>`, donc `data-vocal`) annonce
    // lui-même **ce qu'il fait** : inutile de doubler avec « Vous touchez… ».
    if (cible.closest("button[data-vocal], [role='button'][data-vocal]")) return;
    const libelle = libelleElement(cible);
    if (libelle) gestionnaireAudio.parler(`Vous touchez : ${libelle}`);
  };

  const surFocus = (evenement: Event) => {
    if (!guideActif()) return;
    const cible = evenement.target as Element | null;
    if (!cible) return;
    if (!cible.matches?.("input, select, textarea")) return;
    if (estHorsGeste(cible)) return;
    const libelle = libelleChamp(cible);
    if (libelle) gestionnaireAudio.parler(`Champ : ${libelle}`);
  };

  const surTouche = (evenement: KeyboardEvent) => {
    if (evenement.key === "Escape") gestionnaireAudio.arreter();
  };

  // `pointerdown` plutôt que `click` : le son démarre avant le changement de page.
  document.addEventListener("pointerdown", surPression, true);
  document.addEventListener("focusin", surFocus, true);
  document.addEventListener("keydown", surTouche);

  return () => {
    document.removeEventListener("pointerdown", surPression, true);
    document.removeEventListener("focusin", surFocus, true);
    document.removeEventListener("keydown", surTouche);
  };
}
