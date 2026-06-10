/**
 * Service d'authentification — appels API pour inscription, connexion, etc.
 */
import {
  clientAPI,
  stockerJetons,
  effacerJetons,
  obtenirTokenRafraichissement,
} from "@/services/client_api";

import type {
  DonneesConnexion,
  DonneesInscription,
  ReponseConnexion,
  ReponseInscription,
  Utilisateur,
  Jetons,
} from "@/types/api";

const PREFIXE = "/api/v1/auth";

/**
 * Inscrit un nouvel utilisateur.
 * Stocke automatiquement les jetons reçus pour que l'utilisateur
 * soit connecté immédiatement (peut accéder à la vérification d'identité).
 */
export async function inscrire(
  donnees: DonneesInscription,
): Promise<ReponseInscription> {
  const reponse = await clientAPI.post<ReponseInscription>(
    `${PREFIXE}/inscription`,
    donnees,
  );

  // Stocker les jetons si la réponse en contient
  if (reponse.jetons?.token_acces && reponse.jetons?.token_rafraichissement) {
    stockerJetons(
      reponse.jetons.token_acces,
      reponse.jetons.token_rafraichissement,
    );
  }

  return reponse;
}

/**
 * Connecte un utilisateur — stocke automatiquement les jetons en cookie.
 */
export async function seConnecter(
  donnees: DonneesConnexion,
): Promise<ReponseConnexion> {
  const reponse = await clientAPI.post<ReponseConnexion>(
    `${PREFIXE}/connexion`,
    donnees,
  );

  // Stockage des jetons dès qu'on les reçoit
  stockerJetons(
    reponse.jetons.token_acces,
    reponse.jetons.token_rafraichissement,
  );

  return reponse;
}

/**
 * Déconnecte l'utilisateur courant — révoque la session côté serveur
 * ET supprime les jetons locaux.
 */
export async function seDeconnecter(): Promise<void> {
  const refresh = obtenirTokenRafraichissement();
  if (refresh) {
    try {
      await clientAPI.post(
        `${PREFIXE}/deconnexion`,
        { refresh_token: refresh },
        { authentifie: true },
      );
    } catch {
      // Si le serveur ne répond pas, on supprime quand même les jetons locaux
    }
  }
  effacerJetons();
}

/**
 * Rafraîchit le token d'accès via le refresh token.
 */
export async function rafraichirJetons(): Promise<Jetons> {
  const refresh = obtenirTokenRafraichissement();
  if (!refresh) {
    throw new Error("Aucun refresh token disponible");
  }
  const jetons = await clientAPI.post<Jetons>(`${PREFIXE}/rafraichir`, {
    refresh_token: refresh,
  });
  stockerJetons(jetons.token_acces, jetons.token_rafraichissement);
  return jetons;
}

/**
 * Récupère le profil de l'utilisateur connecté.
 */
export async function obtenirMonProfil(): Promise<Utilisateur> {
  return clientAPI.get<Utilisateur>(`${PREFIXE}/moi`, { authentifie: true });
}
