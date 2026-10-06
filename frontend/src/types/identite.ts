/**
 * Types du module Identité DigiID.
 *
 * Reflète `backend/src/modules/identite_digiid/schemas.py` :
 *  - `CarteDigiIDResponse` / `ContactDigiIDResponse` — carte citoyenne (QR durable)
 *  - `ProfilLogistiqueResponse` — dossier professionnel (pièce, permis, véhicule)
 *  - `ManifesteVoyageResponse` / `VoyageChauffeurResponse` — espace chauffeur
 *  - `MesVoyagesResponse` — vue « mes voyages » du citoyen
 */
import type { ModeEnregistrement } from "@/types/logistique";

// ─── Carte citoyenne (QR durable) ────────────────────────────────────

/** Contenu de la carte DigiID affichée par le citoyen. */
export interface CarteDigiID {
  utilisateur_id: string;
  digiid_public: string | null;
  nom_complet: string;
  telephone: string | null;
  ville: string | null;
  adresse: string | null;
  role: string;
  /** Jeton durable encodé dans le QR (≠ QR dynamique 30 s). */
  qr_token: string;
  /** URL navigable encodée dans le QR (`/identite/carte?token=…`). */
  qr_code_url: string;
  /** `true` si le jeton existait déjà, `false` s'il vient d'être créé. */
  deja_genere: boolean;
}

/** Fiche minimale renvoyée au guichet après scan de la carte. */
export interface ContactDigiID {
  utilisateur_id: string;
  digiid_public: string | null;
  nom_complet: string;
  telephone: string | null;
  ville: string | null;
  adresse: string | null;
  role: string;
  correspondance: "digiid" | "qr";
}

// ─── Profil logistique (dossier professionnel) ───────────────────────

export type TypeProfilLogistique = "chauffeur" | "receveur";
export type StatutVerificationProfil = "en_attente" | "verifie" | "rejete";

export interface ProfilLogistique {
  id: string;
  utilisateur_id: string;
  identifiant_public: string;
  type_profil: TypeProfilLogistique;
  type_piece: string | null;
  numero_piece: string | null;
  piece_verifiee: boolean;
  permis_numero: string | null;
  permis_categorie: string | null;
  permis_expiration: string | null;
  permis_verifie: boolean;
  vehicule_immatriculation: string | null;
  vehicule_marque: string | null;
  vehicule_modele: string | null;
  vehicule_capacite: number | null;
  photo_verifiee: boolean;
  statut_verification: StatutVerificationProfil;
  est_verifie: boolean;
  verifie_le: string | null;
  verifie_par_id: string | null;
  notes: string | null;
  cree_le: string;
  modifie_le: string | null;
  utilisateur_nom: string | null;
  verifie_par_nom: string | null;
  /** Éléments encore à fournir / valider (pilotage du terrain). */
  champs_manquants: string[];
}

/** Payload de création / mise à jour du dossier professionnel. */
export interface DonneesProfilLogistique {
  type_profil: TypeProfilLogistique;
  type_piece?: string | null;
  numero_piece?: string | null;
  permis_numero?: string | null;
  permis_categorie?: string | null;
  permis_expiration?: string | null;
  vehicule_immatriculation?: string | null;
  vehicule_marque?: string | null;
  vehicule_modele?: string | null;
  vehicule_capacite?: number | null;
}

/** Payload de validation d'un dossier par un gérant de gare. */
export interface DonneesVerificationProfil {
  piece_verifiee: boolean;
  permis_verifie: boolean;
  photo_verifiee: boolean;
  notes?: string | null;
}

/** Libellé lisible d'un statut de vérification. */
export const LIBELLES_VERIFICATION_PROFIL: Record<
  StatutVerificationProfil,
  string
> = {
  en_attente: "Vérification en attente",
  verifie: "Dossier vérifié",
  rejete: "Dossier rejeté",
};

/** Libellés des éléments contrôlés (affichage « champs manquants »). */
export const LIBELLES_CHAMPS_PROFIL: Record<string, string> = {
  numero_piece: "Numéro de pièce d'identité",
  piece_verifiee: "Pièce d'identité vérifiée",
  permis_numero: "Numéro de permis",
  permis_verifie: "Permis vérifié",
  vehicule_immatriculation: "Immatriculation du véhicule",
  photo_verifiee: "Photo vérifiée",
};

// ─── Manifeste du chauffeur ──────────────────────────────────────────

/** Une ligne du manifeste : un colis ou un passager. */
export interface LigneManifeste {
  id: string;
  type: "colis" | "passager";
  code: string;
  libelle: string;
  /** Numéro masqué (`77 ** ** 67`) — côté chauffeur. */
  contact_masque: string | null;
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  statut: string;
  nombre_bagages: number;
  nombre_articles: number;
  mode_enregistrement: ModeEnregistrement;
  enregistre_le: string | null;
}

/** Manifeste complet d'un voyage (colis + passagers). */
export interface ManifesteVoyage {
  voyage_id: string;
  date_depart: string | null;
  statut: string;
  vehicule_immatriculation: string | null;
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  nb_colis: number;
  nb_passagers: number;
  nb_bagages: number;
  colis: LigneManifeste[];
  passagers: LigneManifeste[];
}

/** Voyage affecté à un chauffeur, avec les volumes à transporter. */
export interface VoyageChauffeur {
  id: string;
  date_depart: string | null;
  date_arrivee: string | null;
  statut: string;
  vehicule_immatriculation: string | null;
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  nb_colis: number;
  nb_passagers: number;
}

// ─── Voyages du citoyen ──────────────────────────────────────────────

export interface VoyageCitoyen {
  id: string;
  type: "colis" | "passager";
  code: string;
  libelle: string;
  statut: string;
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  date_depart: string | null;
  vehicule_immatriculation: string | null;
  chauffeur_nom: string | null;
  nombre_bagages: number;
  /** Lien vers la page publique de suivi (`/suivi/<code>`). */
  lien: string | null;
}

export interface MesVoyages {
  colis: VoyageCitoyen[];
  passagers: VoyageCitoyen[];
}
