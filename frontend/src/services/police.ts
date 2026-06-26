/**
 * Service API pour le module Police — version complète.
 * Vérifications, signalements, notes internes, alertes, scan QR, etc.
 */
import { clientAPI } from "./client_api";

export interface VerificationPolice {
  id: string;
  officier_id: string;
  personne_digiid: string;
  personne_nom: string | null;
  personne_email?: string | null;
  personne_telephone?: string | null;
  type_verification: string;
  motif_verification?: string | null;
  resultat: string | null;
  notes: string | null;
  date_verification: string;
  est_signalement_fraude: boolean;
  localisation_lat?: number | null;
  localisation_lng?: number | null;
  localisation_adresse?: string | null;
}

export interface SignalementFraude {
  id: string;
  officier_id: string;
  personne_digiid: string;
  motif: string;
  description: string | null;
  statut: string;
  priorite: string;
  notes_traitement?: string | null;
  traite_par_id?: string | null;
  date_signalement: string;
  date_traitement: string | null;
}

export interface PersonneRecherchee {
  digiid: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  score: number;
  est_actif: boolean;
  est_verifie: boolean;
  ville: string;
  pays: string;
  photo_url: string | null;
  numero_cni: string | null;
  a_permis: boolean;
  a_assurance: boolean;
  score_similarite: number;
}

export interface NoteInterne {
  id: string;
  officier_id: string;
  personne_digiid: string;
  titre: string;
  contenu: string | null;
  categorie: string;
  est_important: boolean;
  est_partagee: boolean;
  date_creation: string;
  date_modification: string | null;
}

export interface AlertePolice {
  id: string;
  officier_id: string;
  type_alerte: string;
  titre: string;
  message: string;
  niveau: string;
  est_lue: boolean;
  est_active: boolean;
  donnees_liees?: Record<string, unknown> | null;
  date_creation: string;
  date_lecture: string | null;
}

export interface StatistiquesPolice {
  total_verifications: number;
  verifications_aujourdhui: number;
  total_signalements: number;
  signalements_en_cours: number;
  signalements_traites: number;
  alertes_non_lues: number;
  notes_total: number;
  personnes_recherchees: number;
  taux_confirmation: number | null;
  verification_recents: Record<string, unknown>[];
  signalements_recents: Record<string, unknown>[];
  alertes_recents: Record<string, unknown>[];
  activite_dernieres_heures: Record<string, unknown>[];
}

export interface PointCarte {
  lat: number;
  lng: number;
  adresse: string | null;
  titre: string;
  type: string;
  date: string | null;
  verification_id: string;
}

export interface ScanQRResultat {
  digiid: string;
  nom: string;
  email: string | null;
  photo_url: string | null;
  est_actif: boolean;
  est_verifie: boolean;
  documents: Record<string, unknown>[];
}

export interface ProfilPersonne {
  digiid: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  ville: string;
  pays: string;
  photo_url: string | null;
  role: string;
  score: number;
  est_actif: boolean;
  est_email_verifie: boolean;
  est_visage_verifie: boolean;
  est_cni_verifiee: boolean;
  date_inscription: string | null;
  documents: Record<string, unknown>[];
  signalements: Record<string, unknown>[];
  verifications_precedentes: Record<string, unknown>[];
  notes_internes: Record<string, unknown>[];
}

export interface ComparaisonPhotos {
  score_similarite: number;
  est_compatible: boolean;
  seuil_requis: number;
  temps_analyse_ms: number;
  details: Record<string, unknown>;
}

// =============================================================================
// VÉRIFICATIONS D'IDENTITÉ
// =============================================================================

export async function verifierIdentite(data: {
  personne_digiid: string;
  personne_nom?: string;
  personne_email?: string;
  personne_telephone?: string;
  type_verification?: string;
  motif_verification?: string;
  notes?: string;
  localisation_lat?: number;
  localisation_lng?: number;
  localisation_adresse?: string;
}): Promise<VerificationPolice> {
  return clientAPI.post<VerificationPolice>("/api/v1/utilisateur/police/verifier", data, {
    authentifie: true,
  });
}

export async function listerVerifications(params?: {
  limite?: number;
  page?: number;
}): Promise<VerificationPolice[]> {
  return clientAPI.get<VerificationPolice[]>("/api/v1/utilisateur/police/verifications", {
    authentifie: true,
    params,
  });
}

export async function obtenirVerificationParId(
  verificationId: string
): Promise<VerificationPolice> {
  return clientAPI.get<VerificationPolice>(
    `/api/v1/utilisateur/police/verifications/${verificationId}`,
    { authentifie: true }
  );
}

// =============================================================================
// RECHERCHE AVANCÉE
// =============================================================================

export async function rechercherPersonnes(data: {
  query: string;
  type_recherche?: string;
  filtre_statut?: string;
  filtre_score_min?: number;
  filtre_score_max?: number;
  filtre_ville?: string;
  limite?: number;
  page?: number;
}): Promise<{
  resultats: PersonneRecherchee[];
  total: number;
  page: number;
  limite: number;
  temps_ms: number;
}> {
  return clientAPI.post("/api/v1/utilisateur/police/rechercher", data, {
    authentifie: true,
  });
}

// =============================================================================
// PROFIL DÉTAILLÉ
// =============================================================================

export async function obtenirProfilPersonne(
  digiid: string
): Promise<ProfilPersonne> {
  return clientAPI.get<ProfilPersonne>(
    `/api/v1/utilisateur/police/profil/${digiid}`,
    { authentifie: true }
  );
}

// =============================================================================
// SIGNALEMENTS DE FRAUDE
// =============================================================================

export async function creerSignalement(data: {
  personne_digiid: string;
  motif: string;
  description?: string;
  priorite?: string;
}): Promise<SignalementFraude> {
  return clientAPI.post<SignalementFraude>("/api/v1/utilisateur/police/signalements", data, {
    authentifie: true,
  });
}

export async function listerSignalements(params?: {
  statut?: string;
  limite?: number;
  page?: number;
}): Promise<SignalementFraude[]> {
  return clientAPI.get<SignalementFraude[]>("/api/v1/utilisateur/police/signalements", {
    authentifie: true,
    params,
  });
}

export async function traiterSignalement(
  signalementId: string,
  data: { statut: string; notes_traitement?: string }
): Promise<SignalementFraude> {
  return clientAPI.patch<SignalementFraude>(
    `/api/v1/utilisateur/police/signalements/${signalementId}/traiter`,
    data,
    { authentifie: true }
  );
}

// =============================================================================
// NOTES INTERNES
// =============================================================================

export async function creerNote(data: {
  personne_digiid: string;
  titre: string;
  contenu?: string;
  categorie?: string;
  est_important?: boolean;
  est_partagee?: boolean;
}): Promise<NoteInterne> {
  return clientAPI.post<NoteInterne>("/api/v1/utilisateur/police/notes", data, {
    authentifie: true,
  });
}

export async function listerNotes(params?: {
  personne_digiid?: string;
  categorie?: string;
  limite?: number;
}): Promise<NoteInterne[]> {
  return clientAPI.get<NoteInterne[]>("/api/v1/utilisateur/police/notes", {
    authentifie: true,
    params,
  });
}

export async function modifierNote(
  noteId: string,
  data: {
    titre?: string;
    contenu?: string;
    categorie?: string;
    est_important?: boolean;
    est_partagee?: boolean;
  }
): Promise<NoteInterne> {
  return clientAPI.patch<NoteInterne>(
    `/api/v1/utilisateur/police/notes/${noteId}`,
    data,
    { authentifie: true }
  );
}

export async function supprimerNote(noteId: string): Promise<void> {
  return clientAPI.delete(`/api/v1/utilisateur/police/notes/${noteId}`, {
    authentifie: true,
  });
}

// =============================================================================
// ALERTES
// =============================================================================

export async function listerAlertes(params?: {
  non_lues_seulement?: boolean;
  limite?: number;
}): Promise<{
  alertes: AlertePolice[];
  total: number;
  non_lues: number;
}> {
  return clientAPI.get("/api/v1/utilisateur/police/alertes", {
    authentifie: true,
    params,
  });
}

export async function marquerAlerteLue(
  alerteId: string
): Promise<AlertePolice> {
  return clientAPI.patch<AlertePolice>(
    `/api/v1/utilisateur/police/alertes/${alerteId}/lire`,
    {},
    { authentifie: true }
  );
}

// =============================================================================
// STATISTIQUES / DASHBOARD
// =============================================================================


export async function obtenirStatistiques(): Promise<StatistiquesPolice> {
  return clientAPI.get<StatistiquesPolice>(
    "/api/v1/utilisateur/police/statistiques",
    { authentifie: true }
  );
}

// =============================================================================
// CARTE GÉOGRAPHIQUE
// =============================================================================


export async function obtenirPointsCarte(params?: {
  limite?: number;
}): Promise<{
  points: PointCarte[];
  total: number;
  centre_lat: number | null;
  centre_lng: number | null;
}> {
  return clientAPI.get("/api/v1/utilisateur/police/carte", {
    authentifie: true,
    params,
  });
}

// =============================================================================
// SCAN QR
// =============================================================================


export async function scannerQR(digiid: string): Promise<ScanQRResultat> {
  return clientAPI.get<ScanQRResultat>(
    `/api/v1/utilisateur/police/scan-qr/${digiid}`,
    { authentifie: true }
  );
}

// =============================================================================
// HISTORIQUE
// =============================================================================


export async function obtenirHistorique(params?: {
  type_historique?: string;
  limite?: number;
}): Promise<Record<string, unknown>> {
  return clientAPI.get("/api/v1/utilisateur/police/historique", {
    authentifie: true,
    params,
  });
}

// =============================================================================
// EXPORT DE RAPPORT
// =============================================================================


export async function genererRapport(params?: {
  date_debut?: string;
  date_fin?: string;
  format?: string;
  type_donnees?: string[];
}): Promise<Record<string, unknown>> {
  return clientAPI.post("/api/v1/utilisateur/police/export-rapport", {}, {
    authentifie: true,
    params,
  });
}

// =============================================================================
// COMPARAISON DE PHOTOS
// =============================================================================


export async function comparerPhotos(data: {
  photo_source: string;
  photo_cible: string;
}): Promise<ComparaisonPhotos> {
  return clientAPI.post<ComparaisonPhotos>(
    "/api/v1/utilisateur/police/comparer-photos",
    data,
    { authentifie: true }
  );
}
