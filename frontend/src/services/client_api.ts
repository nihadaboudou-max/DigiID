/**
 * Client HTTP centralisé pour tous les appels à l'API DigiID.
 *
 * Avantages d'un wrapper unique :
 *  - Gestion uniforme du token JWT
 *  - Rafraîchissement automatique du token expiré (401)
 *  - Gestion uniforme des erreurs (format ReponseErreurAPI)
 *  - Logs centralisés
 *  - Facile à remplacer par axios/ky si besoin
 */
import Cookies from "js-cookie";

import type { Jetons, ReponseErreurAPI } from "@/types/api";
import {
  effacerJetonsApresRafraichissement,
  peutRafraichirApres401,
  renouvelerAvantEnvoi,
} from "@/services/jetons";

// ✅ CORRECTION : URL_BASE vide pour éviter le doublon /api/backend/api/v1/...
// Les appels sont déjà au format /api/v1/... dans les composants
const URL_BASE = "";

// Nom du cookie où on stocke le token d'accès
const NOM_COOKIE_TOKEN = "digiid_token";
const NOM_COOKIE_REFRESH = "digiid_refresh";

const CHEMIN_RAFRAICHIR = "/api/v1/auth/rafraichir";

/**
 * Événement personnalisé déclenché quand l'authentification expire
 * de façon irrécupérable (token invalide, rôle modifié, etc.).
 * Le contexte d'authentification écoute cet événement pour
 * déconnecter l'utilisateur proprement.
 */
export const EVENEMENT_AUTH_EXPIRE = "digiid:auth-expired";

export function declencherEvenementAuthExpire() {
  if (typeof window !== "undefined") {
    effacerJetons();
    window.dispatchEvent(new CustomEvent(EVENEMENT_AUTH_EXPIRE));
  }
}

// -----------------------------------------------------------------------------
// Gestion du token
// -----------------------------------------------------------------------------

export function stockerJetons(tokenAcces: string, tokenRafraichissement: string) {
  const estHTTPS = typeof window !== 'undefined' && window.location.protocol === 'https:';
  
  Cookies.set(NOM_COOKIE_TOKEN, tokenAcces, {
    path: "/",
    secure: estHTTPS,
    sameSite: "strict",
    expires: 1 / 96, // 15 minutes
  });
  Cookies.set(NOM_COOKIE_REFRESH, tokenRafraichissement, {
    path: "/",
    secure: estHTTPS,
    sameSite: "strict",
    expires: 7, // 7 jours
  });
}

export function obtenirTokenAcces(): string | undefined {
  return Cookies.get(NOM_COOKIE_TOKEN);
}

export function obtenirTokenRafraichissement(): string | undefined {
  return Cookies.get(NOM_COOKIE_REFRESH);
}

export function effacerJetons() {
  Cookies.remove(NOM_COOKIE_TOKEN, { path: "/" });
  Cookies.remove(NOM_COOKIE_REFRESH, { path: "/" });
}

/**
 * Vrai si ce poste possède encore une session (accès ou rafraîchissement).
 *
 * Sert aux routines de fond (synchronisation hors-ligne) : sans session, un
 * appel authentifié ne peut que répondre 401 — inutile d'alerter l'utilisateur.
 */
export function aUneSession(): boolean {
  return Boolean(obtenirTokenAcces() || obtenirTokenRafraichissement());
}

/** État local des jetons, tel que le lisent les règles pures de `./jetons`. */
function etatDesJetons() {
  return {
    acces: obtenirTokenAcces(),
    rafraichissement: obtenirTokenRafraichissement(),
  };
}

// -----------------------------------------------------------------------------
// Rafraîchissement automatique (mutex pour requêtes parallèles)
// -----------------------------------------------------------------------------

let promesseRafraichissement: Promise<boolean> | null = null;

async function executerRafraichissement(): Promise<boolean> {
  const refresh = obtenirTokenRafraichissement();
  if (!refresh) {
    effacerJetons();
    return false;
  }

  const url = `${URL_BASE}${CHEMIN_RAFRAICHIR}`;
  let reponse: Response;
  try {
    reponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      credentials: "include",
    });
  } catch {
    // ⚠️ Backend injoignable ≠ session révoquée : on GARDE le refresh token
    // (7 jours), sinon une tentative pendant la coupure déconnecte l'agent.
    return false;
  }

  if (!reponse.ok) {
    // 401/403 = refresh refusé (session révoquée) → on nettoie ; 5xx = on garde.
    if (effacerJetonsApresRafraichissement(reponse.status)) effacerJetons();
    return false;
  }

  let jetons: Jetons;
  try {
    jetons = (await reponse.json()) as Jetons;
  } catch {
    return false;
  }
  if (!jetons?.token_acces || !jetons?.token_rafraichissement) {
    return false;
  }

  stockerJetons(jetons.token_acces, jetons.token_rafraichissement);
  return true;
}

function tenterRafraichissement(): Promise<boolean> {
  if (!promesseRafraichissement) {
    promesseRafraichissement = executerRafraichissement().finally(() => {
      promesseRafraichissement = null;
    });
  }
  return promesseRafraichissement;
}

// -----------------------------------------------------------------------------
// Erreurs typées
// -----------------------------------------------------------------------------

export class ErreurAPI extends Error {
  constructor(
    public code_erreur: string,
    public message_utilisateur: string,
    public code_http: number,
    public request_id?: string,
    public details?: Record<string, unknown> | null,
  ) {
    super(message_utilisateur);
    this.name = "ErreurAPI";
  }
}

function messageErreurConnexion(): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Vous êtes hors ligne. Vérifiez votre connexion puis réessayez.";
  }
  return "Connexion temporairement indisponible. Réessayez dans quelques instants.";
}

function messageErreurValidation(message: string): string {
  const obligatoire = message.match(
    /(?:^|[\s·])([a-zA-Z_][\w.]*)\s*:\s*(?:Field required|ce champ est obligatoire)/i,
  );
  if (obligatoire) {
    if (obligatoire[1] === "moyen_paiement") {
      return "Veuillez choisir un moyen de paiement.";
    }

    const champ = obligatoire[1]
      .split(".")
      .pop()!
      .replaceAll("_", " ");
    return `Le champ « ${champ} » est obligatoire.`;
  }

  if (/Field required/i.test(message)) {
    return "Veuillez remplir les champs obligatoires.";
  }

  return message;
}

/**
 * Vrai si l'échec vient du **réseau** (backend injoignable, coupure), et non
 * d'un refus métier (409, permission, validation…).
 *
 * ⚠️ Indispensable au mode hors-ligne : `appel_api` emballe aussi les pannes
 * réseau dans `ErreurAPI` (code `RESEAU`, HTTP 0). Un simple
 * `erreur instanceof ErreurAPI` classait donc une coupure réseau comme une
 * erreur métier — le colis n'était jamais mis en file et « le hors-ligne ne
 * marchait pas ».
 */
export function estErreurReseau(erreur: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (erreur instanceof ErreurAPI) {
    return erreur.code_erreur === "RESEAU" || erreur.code_http === 0;
  }
  // `fetch` qui rejette (TypeError) ou erreur inconnue non métier.
  return !(erreur instanceof ErreurAPI);
}

// -----------------------------------------------------------------------------
// Fonction principale — fait une requête à l'API
// -----------------------------------------------------------------------------

interface OptionsRequete extends RequestInit {
  authentifie?: boolean;
  /** Interne — évite une boucle infinie lors du retry après refresh. */
  _retry?: boolean;
  /** Paramètres de requête (query string) */
  params?: Record<string, unknown>;
}

async function appel_api<T>(
  chemin: string,
  options: OptionsRequete = {},
): Promise<T> {
  const { authentifie = false, headers = {}, _retry = false, params, ...reste } = options;

  // Construction des en-têtes
  const enTetes: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  if (authentifie) {
    // Cookie d'accès expiré (15 min) après une coupure : on renouvelle AVANT
    // d'envoyer, sinon la requête part sans `Authorization` → 401 `AUTH_001`.
    // C'est ce qui bloquait la synchronisation des colis hors-ligne.
    let token = obtenirTokenAcces();
    if (
      renouvelerAvantEnvoi(etatDesJetons(), authentifie, _retry) &&
      chemin !== CHEMIN_RAFRAICHIR
    ) {
      if (await tenterRafraichissement()) token = obtenirTokenAcces();
    }
    if (token) {
      enTetes["Authorization"] = `Bearer ${token}`;
    }
  }

  // URL complète (avec query string si params)
  const queryString = params
    ? '?' + new URLSearchParams(
        Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
      ).toString()
    : '';
  const url = `${URL_BASE}${chemin}${queryString}`;

  // Appel fetch
  let reponse: Response;
  try {
    reponse = await fetch(url, {
      ...reste,
      headers: enTetes,
      credentials: "include",
    });
  } catch (erreur) {
    console.error("Échec d'appel API vers :", url, erreur);
    throw new ErreurAPI(
      "RESEAU",
      messageErreurConnexion(),
      0,
    );
  }

  // Réponse 204 No Content : pas de body à parser
  if (reponse.status === 204) {
    return undefined as T;
  }

  // Parser le JSON
  let donnees: unknown;
  try {
    donnees = await reponse.json();
  } catch {
    throw new ErreurAPI(
      "REPONSE_INVALIDE",
      "Le serveur a renvoyé une réponse invalide.",
      reponse.status,
    );
  }

  // Token expiré → rafraîchir une fois puis réessayer
  if (
    !reponse.ok &&
    authentifie &&
    !_retry &&
    reponse.status === 401 &&
    chemin !== CHEMIN_RAFRAICHIR
  ) {
    const erreurApi = donnees as ReponseErreurAPI;
    const code = erreurApi.code_erreur || "";
    if (
      peutRafraichirApres401(
        code,
        _retry,
        Boolean(obtenirTokenRafraichissement()),
      )
    ) {
      const rafraichi = await tenterRafraichissement();
      if (rafraichi) {
        return appel_api<T>(chemin, { ...options, _retry: true });
      }
    }
    // On ne déconnecte que si la session a réellement disparu : un refresh
    // refusé (401/403) efface les jetons, alors qu'une panne serveur (5xx) ou
    // réseau les conserve pour la prochaine tentative.
    if (!obtenirTokenRafraichissement()) {
      declencherEvenementAuthExpire();
    }
    throw new ErreurAPI(
      "AUTH_TOKEN_EXPIRE",
      "Session expirée. Veuillez vous reconnecter.",
      401,
    );
  }

  // Réponse d'erreur ?
  if (!reponse.ok) {
    const erreurApi =
      typeof donnees === "object" && donnees !== null
        ? (donnees as Partial<ReponseErreurAPI> & { detail?: unknown })
        : {};
    // FastAPI renvoie 'detail', notre API custom renvoie 'message'
    const code = erreurApi.code_erreur || "INCONNU";
    const estErreurConnexion = [
      "RESEAU",
      "BACKEND_INDISPONIBLE",
      "BACKEND_TIMEOUT",
      "ERREUR_PROXY",
    ].includes(code);
    const message = estErreurConnexion
      ? messageErreurConnexion()
      : typeof erreurApi.message === "string"
        ? messageErreurValidation(erreurApi.message)
        : reponse.status === 422
          ? "Certaines informations sont incorrectes. Vérifiez le formulaire puis réessayez."
          : typeof erreurApi.detail === "string"
            ? erreurApi.detail
            : "Une erreur est survenue. Veuillez réessayer.";
    throw new ErreurAPI(
      code,
      message,
      reponse.status,
      erreurApi.request_id || undefined,
      erreurApi.details || null,
    );
  }

  return donnees as T;
}

// -----------------------------------------------------------------------------
// API publique — méthodes typées
// -----------------------------------------------------------------------------

export const clientAPI = {
  get: <T>(chemin: string, options?: OptionsRequete) =>
    appel_api<T>(chemin, { ...options, method: "GET" }),

  post: <T>(chemin: string, donnees?: unknown, options?: OptionsRequete) =>
    appel_api<T>(chemin, {
      ...options,
      method: "POST",
      body: donnees ? JSON.stringify(donnees) : undefined,
    }),

  patch: <T>(chemin: string, donnees?: unknown, options?: OptionsRequete) =>
    appel_api<T>(chemin, {
      ...options,
      method: "PATCH",
      body: donnees ? JSON.stringify(donnees) : undefined,
    }),

  delete: <T>(chemin: string, options?: OptionsRequete) =>
    appel_api<T>(chemin, { ...options, method: "DELETE" }),

  put: <T>(chemin: string, donnees?: unknown, options?: OptionsRequete) =>
    appel_api<T>(chemin, {
      ...options,
      method: "PUT",
      body: donnees ? JSON.stringify(donnees) : undefined,
    }),
};