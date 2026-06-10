/**
 * Service consentements — appels API pour la page /consentements.
 * Branché sur /api/v1/utilisateur/consentements/*
 */
import { clientAPI } from "./client_api";

const PREFIXE = "/api/v1/utilisateur/consentements";

export interface ConsentementDetail {
  categorie: string;
  titre: string;
  description: string;
  obligatoire: boolean;
  version: string;
  est_accorde: boolean;
  date_accord: string | null;
  date_retrait: string | null;
}

export interface ConsentementTexteLegal extends ConsentementDetail {
  texte_legal: string;
}

export interface ListeConsentements {
  consentements: ConsentementDetail[];
  total: number;
  accordes: number;
}

export const listerMesConsentements = () =>
  clientAPI.get<ListeConsentements>(PREFIXE, { authentifie: true });

export const obtenirConsentementDetail = (categorie: string) =>
  clientAPI.get<ConsentementTexteLegal>(`${PREFIXE}/${categorie}`, { authentifie: true });

export const basculerConsentement = (categorie: string, accorder: boolean) =>
  clientAPI.patch<ConsentementDetail>(
    `${PREFIXE}/${categorie}`,
    { accorder },
    { authentifie: true },
  );
