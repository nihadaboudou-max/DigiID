/**
 * Service profil — appels API pour les pages /profil, /parametres.
 * Branché sur /api/v1/utilisateur/profil/*
 */
import { clientAPI } from "./client_api";
import type { Utilisateur } from "@/types/api";

const PREFIXE = "/api/v1/utilisateur/profil";

export interface ProfilDetail extends Utilisateur {
  telephone: string | null;
  pays: string | null;
  date_dernier_calcul_score: string | null;
  date_derniere_connexion: string | null;
}

export interface ProfilModification {
  prenom?: string;
  nom?: string;
  telephone?: string;
  ville?: string;
  pays?: string;
}

export interface ExportDonnees {
  utilisateur: ProfilDetail;
  consentements: any[];
  historique_audit: any[];
  date_export: string;
  format: string;
}

export interface ReponseSuppression {
  message: string;
  utilisateur_id: string;
  date_suppression_effective: string;
  delai_purge_complete_jours: number;
}

export const obtenirMonProfilDetail = () =>
  clientAPI.get<ProfilDetail>(PREFIXE, { authentifie: true });

export const modifierMonProfil = (donnees: ProfilModification) =>
  clientAPI.patch<ProfilDetail>(PREFIXE, donnees, { authentifie: true });

export const exporterMesDonnees = () =>
  clientAPI.get<ExportDonnees>(`${PREFIXE}/export`, { authentifie: true });

export const supprimerMonCompte = () =>
  clientAPI.delete<ReponseSuppression>(PREFIXE, { authentifie: true });

// --- 2FA ---

export interface Preparation2FA {
  uri_provisioning: string;
  secret_manuel: string;
  qr_code_base64: string;
}

export interface Reponse2FA {
  message: string;
  deux_fa_active: boolean;
}

export const preparerActivation2FA = () =>
  clientAPI.post<Preparation2FA>(`${PREFIXE}/2fa/preparation`, undefined, {
    authentifie: true,
  });

export const activer2FA = (code: string) =>
  clientAPI.post<Reponse2FA>(`${PREFIXE}/2fa/activer`, { code }, { authentifie: true });

export const desactiver2FA = (code: string) =>
  clientAPI.post<Reponse2FA>(`${PREFIXE}/2fa/desactiver`, { code }, { authentifie: true });
