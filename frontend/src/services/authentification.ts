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

export interface StatutModeCommercant {
  mode_actif: boolean;
  document_valide: boolean;
  photo_validee: boolean;
  peut_activer: boolean;
}

export const modeCommercantAPI = {
  statut: () =>
    clientAPI.get<StatutModeCommercant>(`${PREFIXE}/mode-commercant`, {
      authentifie: true,
    }),
  activer: () =>
    clientAPI.post<Utilisateur>(
      `${PREFIXE}/mode-commercant/activer`,
      {},
      { authentifie: true },
    ),
  demanderAssistance: (message: string) =>
    clientAPI.post<{ message: string }>(
      `${PREFIXE}/mode-commercant/assistance`,
      { message },
      { authentifie: true },
    ),
};

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

// =============================================================================
// Code 2FA de connexion par email
// =============================================================================

export interface EnvoyerCodeConnexionReponse {
  succes: boolean;
  message: string;
  destination_masquee: string;
  duree_validite_minutes: number;
}

/**
 * Envoie un code 2FA de connexion par email (le mot de passe est vérifié
 * côté serveur avant l'envoi).
 */
export async function envoyerCodeConnexion(
  email: string,
  motDePasse: string,
): Promise<EnvoyerCodeConnexionReponse> {
  return clientAPI.post<EnvoyerCodeConnexionReponse>(
    `${PREFIXE}/connexion/code`,
    { email, mot_de_passe: motDePasse },
  );
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

// =============================================================================
// Vérification email
// =============================================================================

export interface EnvoyerCodeReponse {
  succes: boolean;
  message: string;
  destination_masquee: string;
  duree_validite_minutes: number;
}

export interface VerifierCodeReponse {
  succes: boolean;
  message: string;
  est_email_verifie: boolean;
  est_telephone_verifie: boolean;
}

export interface StatutVerificationReponse {
  est_email_verifie: boolean;
  doit_verifier: boolean;
}

/**
 * Envoie ou renvoie un code de vérification par email/SMS/appel.
 */
export async function envoyerCodeVerification(
  canal: "email" | "whatsapp" | "sms" | "appel" = "email",
): Promise<EnvoyerCodeReponse> {
  return clientAPI.post<EnvoyerCodeReponse>(
    `${PREFIXE}/verification/envoyer`,
    { canal },
    { authentifie: true },
  );
}

/**
 * Vérifie le code saisi par l'utilisateur et active le compte si valide.
 */
export async function verifierCode(
  code: string,
  canal: "email" | "whatsapp" | "sms" | "appel" = "email",
): Promise<VerifierCodeReponse> {
  return clientAPI.post<VerifierCodeReponse>(
    `${PREFIXE}/verification/verifier`,
    { code, canal },
    { authentifie: true },
  );
}

/**
 * Vérifie le statut de vérification de l'email de l'utilisateur connecté.
 */
export async function obtenirStatutVerification(): Promise<StatutVerificationReponse> {
  return clientAPI.get<StatutVerificationReponse>(
    `${PREFIXE}/verification/statut`,
    { authentifie: true },
  );
}

// =============================================================================
// Mot de passe oublié / réinitialisation
// =============================================================================

export interface MotDePasseOublieReponse {
  succes: boolean;
  message: string;
  duree_validite_minutes: number;
}

export interface MotDePasseCodeVerifierReponse {
  token: string;
}

export interface MotDePasseReinitialisationReponse {
  succes: boolean;
  message: string;
}

/**
 * Demande l'envoi d'un code sans révéler si le compte existe.
 */
export async function demanderReinitialisationMotDePasse(
  identifiant: string,
  canal: "email" | "whatsapp",
): Promise<MotDePasseOublieReponse> {
  return clientAPI.post<MotDePasseOublieReponse>(
    `${PREFIXE}/mot-de-passe/oublie`,
    { identifiant, canal },
  );
}

/**
 * Vérifie le code reçu puis retourne un jeton temporaire de réinitialisation.
 */
export async function verifierCodeReinitialisationMotDePasse(
  identifiant: string,
  code: string,
): Promise<MotDePasseCodeVerifierReponse> {
  return clientAPI.post<MotDePasseCodeVerifierReponse>(
    `${PREFIXE}/mot-de-passe/code/verifier`,
    { identifiant, code },
  );
}

/**
 * Réinitialise le mot de passe avec un token de réinitialisation.
 */
export async function reinitialiserMotDePasse(
  token: string,
  nouveauMotDePasse: string,
): Promise<MotDePasseReinitialisationReponse> {
  return clientAPI.post<MotDePasseReinitialisationReponse>(
    `${PREFIXE}/mot-de-passe/reinitialiser`,
    {
      token,
      nouveau_mot_de_passe: nouveauMotDePasse,
    },
  );
}
