/**
 * Règles **pures** de gestion des jetons — utilisées par `client_api` et
 * vérifiables hors navigateur (`node scripts/verifier-sync-jetons.mjs`).
 *
 * ⚠️ Bug corrigé ici : le cookie d'accès ne vit que **15 minutes**
 * (`stockerJetons` → `expires: 1/96`). Après une coupure plus longue, un poste
 * guichet n'a donc plus de jeton d'accès ; la synchronisation hors-ligne
 * partait alors **sans** en-tête `Authorization` et le backend répondait
 * `401 AUTH_001` (« aucun token d'authentification fourni »). Ce code étant
 * exclu du rafraîchissement, on déconnectait l'agent — et la file de colis ne
 * partait jamais.
 *
 * Les deux corrections :
 *  1. renouveler le jeton **avant** d'envoyer (dès qu'il manque mais qu'un
 *     refresh token existe encore) ;
 *  2. accepter de rafraîchir sur `AUTH_001` plutôt que de déconnecter.
 *
 * Aucun import : module testable tel quel.
 */

export interface EtatJetons {
  /** Jeton d'accès (cookie `digiid_token`, 15 min). */
  acces?: string;
  /** Jeton de rafraîchissement (cookie `digiid_refresh`, 7 jours). */
  rafraichissement?: string;
}

/**
 * Faut-il renouveler le jeton d'accès **avant** d'envoyer la requête ?
 *
 * Vrai uniquement pour un appel authentifié, sans jeton d'accès, alors qu'un
 * jeton de rafraîchissement subsiste — c'est-à-dire exactement la situation
 * d'une coupure de plus de 15 minutes (ou d'un poste resté hors-ligne).
 */
export function renouvelerAvantEnvoi(
  etat: EtatJetons,
  authentifie: boolean,
  dejaReessaye: boolean,
): boolean {
  if (!authentifie || dejaReessaye) return false;
  if (etat.acces) return false;
  return Boolean(etat.rafraichissement);
}

/**
 * Codes d'erreur pour lesquels un rafraîchissement ne sert à rien :
 * `AUTH_004` (2FA requise), `AUTH_005` (2FA invalide), `AUTH_008` (droit
 * refusé). `AUTH_001` n'en fait **plus** partie : il couvre aussi « aucun
 * token fourni », cas où le renouvellement est justement la solution.
 */
const CODES_SANS_RAFRAICHISSEMENT = new Set(["AUTH_004", "AUTH_005", "AUTH_008"]);

/** Un 401 justifie-t-il une tentative de rafraîchissement puis un nouvel essai ? */
export function peutRafraichirApres401(
  codeErreur: string,
  dejaReessaye: boolean,
  aUnRafraichissement: boolean,
): boolean {
  if (dejaReessaye || !aUnRafraichissement) return false;
  if (codeErreur === "AUTH_001") return true;
  return !CODES_SANS_RAFRAICHISSEMENT.has(codeErreur);
}

/**
 * Un échec de rafraîchissement doit-il effacer les jetons du poste ?
 *
 * Seuls 401/403 signifient « refresh révoqué ». Un 5xx, une passerelle en
 * erreur ou une panne réseau (`statutHttp = 0`) ne disent rien de la session :
 * effacer les jetons dans ce cas renvoyait l'agent à l'écran de connexion alors
 * qu'il suffisait d'attendre le retour du réseau.
 */
export function effacerJetonsApresRafraichissement(statutHttp: number): boolean {
  return statutHttp === 401 || statutHttp === 403;
}
