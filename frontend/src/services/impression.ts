/**
 * Impression « propre » des tickets et des étiquettes QR (S3).
 *
 * **Le problème corrigé ici** : à l'impression, le CSS plaçait *toutes* les
 * zones d'impression (`.zone-impression`) en `position: absolute; top: 0`. Deux
 * blocs absolus se retrouvaient donc **empilés l'un sur l'autre** au même
 * endroit de la première page — un seul ticket restait visible, et un élément
 * hors flux n'accepte **aucun** saut de page (`break-after` sans effet).
 *
 * **La solution** : les zones restent dans le flux normal, chacune commence sur
 * une nouvelle page, et on masque le reste de l'application. Reste à savoir quoi
 * masquer : un ticket est **imbriqué** dans la page (layout, en-tête, filtres…).
 * On marque donc, au moment d'imprimer :
 *
 *   - chaque `.zone-impression` (le ticket lui-même) et tout son contenu ;
 *   - ses **ancêtres**, du parent jusqu'à `<body>` (`data-impression-chemin`) :
 *     ce sont les seuls éléments de l'application conservés ;
 *   - `<html>` (`data-impression="1"`), ce qui **active** les règles
 *     d'impression de `globaux.css`.
 *
 * Tout le reste — menus, en-têtes, formulaires, boutons, notifications — est
 * masqué par le CSS. Un écran **sans** ticket (manifeste, export, carte…)
 * n'est pas touché : pas d'attribut, donc aucun masquage.
 *
 * Les QR codes proviennent d'une API d'images distante : on **attend qu'ils
 * soient chargés** avant de lancer l'impression, sinon la feuille sort avec des
 * cadres vides (« un seul QR s'affiche »).
 */

/** Classe qui délimite ce qui doit être imprimé (ticket, étiquette…). */
export const CLASSE_ZONE = "zone-impression";

/** Éléments à **conserver** à l'impression (ticket, son contenu, ses parents). */
const ATTRIBUT_VISIBLE = "data-impression-visible";
/** Parents du ticket : à conserver, mais sans marge ni fond d'écran. */
const ATTRIBUT_CHEMIN = "data-impression-chemin";
/** Tickets suivants : à commencer sur une nouvelle page. */
const ATTRIBUT_PAGE = "data-impression-page";
/** Attribut qui active les règles d'impression de `globaux.css`. */
const ATTRIBUT_ACTIF = "data-impression";

/** Délai maximal d'attente des images QR (réseau lent au guichet). */
const ATTENTE_IMAGES_MS = 2500;

/** Délai avant nettoyage, après la fermeture de la boîte d'impression. */
const NETTOYAGE_MS = 1500;

/** Les zones à imprimer, dans l'ordre du document. */
export function zonesImpression(): HTMLElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll<HTMLElement>(`.${CLASSE_ZONE}`));
}

/**
 * Prépare la page : marque les tickets, leur chemin d'ancêtres et la page.
 * @returns `true` si un ticket a été trouvé (donc si le reste doit être masqué).
 */
export function preparerImpression(): boolean {
  if (typeof document === "undefined") return false;

  const zones = zonesImpression();
  if (zones.length === 0) return false;

  zones.forEach((zone, index) => {
    // Chaque ticket après le premier démarre sur une nouvelle page. Le faire ici
    // (et pas seulement en CSS) est indispensable : deux tickets peuvent vivre
    // dans des conteneurs différents et ne pas être « frères ».
    if (index > 0) zone.setAttribute(ATTRIBUT_PAGE, "1");

    // Le ticket **et tout son contenu** restent visibles. On les marque un par
    // un plutôt que d'utiliser un sélecteur `:not(.zone-impression *)` : ainsi
    // le CSS reste simple et fonctionne sur tous les navigateurs.
    zone.setAttribute(ATTRIBUT_VISIBLE, "1");
    zone
      .querySelectorAll("*")
      .forEach((element) => element.setAttribute(ATTRIBUT_VISIBLE, "1"));

    // ... puis la chaîne de parents qui mène au ticket (layout, conteneur…).
    let parent = zone.parentElement;
    while (parent && parent !== document.body) {
      parent.setAttribute(ATTRIBUT_VISIBLE, "1");
      parent.setAttribute(ATTRIBUT_CHEMIN, "1");
      parent = parent.parentElement;
    }
  });

  document.documentElement.setAttribute(ATTRIBUT_ACTIF, "1");
  return true;
}

/** Retire tous les marquages (après l'impression). */
export function terminerImpression(): void {
  if (typeof document === "undefined") return;
  document
    .querySelectorAll(
      `[${ATTRIBUT_VISIBLE}], [${ATTRIBUT_CHEMIN}], [${ATTRIBUT_PAGE}]`,
    )
    .forEach((element) => {
      element.removeAttribute(ATTRIBUT_VISIBLE);
      element.removeAttribute(ATTRIBUT_CHEMIN);
      element.removeAttribute(ATTRIBUT_PAGE);
    });
  document.documentElement.removeAttribute(ATTRIBUT_ACTIF);
}

/**
 * Attend le chargement des images (QR codes) présentes dans les tickets.
 * L'attente est plafonnée : mieux vaut imprimer sans QR que bloquer l'agent.
 */
export function attendreImages(limiteMs = ATTENTE_IMAGES_MS): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  const enAttente = Array.from(
    document.querySelectorAll<HTMLImageElement>(`.${CLASSE_ZONE} img`),
  ).filter((image) => !image.complete);

  if (enAttente.length === 0) return Promise.resolve();

  const chargements = enAttente.map(
    (image) =>
      new Promise<void>((resoudre) => {
        const fini = () => {
          image.removeEventListener("load", fini);
          image.removeEventListener("error", fini);
          resoudre();
        };
        image.addEventListener("load", fini);
        image.addEventListener("error", fini);
      }),
  );

  return Promise.race([
    Promise.all(chargements).then(() => undefined),
    new Promise<void>((resoudre) => window.setTimeout(resoudre, limiteMs)),
  ]);
}

/**
 * Imprime : **une page par ticket, une page par étiquette**, QR chargés.
 *
 * À utiliser à la place de `window.print()` sur toutes les pages imprimables.
 */
export async function imprimer(): Promise<void> {
  if (typeof window === "undefined") return;

  await attendreImages();
  const contientUnTicket = preparerImpression();

  window.print();

  if (contientUnTicket) {
    // `afterprint` n'est pas déclenché par tous les navigateurs : on nettoie
    // aussi, systématiquement, une fois la boîte d'impression refermée.
    window.setTimeout(terminerImpression, NETTOYAGE_MS);
  }
}
