/**
 * Service API du module Identité DigiID.
 *
 * Regroupe les appels du « guichet augmenté » et de la carte citoyenne :
 *  - `carte` : QR **durable** du citoyen (reste scannable, contrairement au QR
 *    dynamique de 30 s) + page « mes voyages ».
 *  - `guichet` : pré-remplissage d'une fiche colis/passager par scan de carte.
 *  - `profils` : dossier professionnel (pièce, permis, véhicule) + validation.
 *  - `chauffeur` : voyages affectés et manifeste (colis + passagers).
 */
import { clientAPI } from "@/services/client_api";
import type {
  CarteDigiID,
  ContactDigiID,
  DonneesProfilLogistique,
  DonneesVerificationProfil,
  ManifesteVoyage,
  MesVoyages,
  ProfilLogistique,
  VoyageChauffeur,
} from "@/types/identite";

export type {
  CarteDigiID,
  ContactDigiID,
  DonneesProfilLogistique,
  DonneesVerificationProfil,
  ManifesteVoyage,
  LigneManifeste,
  MesVoyages,
  ProfilLogistique,
  TypeProfilLogistique,
  StatutVerificationProfil,
  VoyageChauffeur,
  VoyageCitoyen,
} from "@/types/identite";

export {
  LIBELLES_CHAMPS_PROFIL,
  LIBELLES_VERIFICATION_PROFIL,
} from "@/types/identite";

const BASE = "/api/v1/identite";
const opts = { authentifie: true } as const;

export const identiteAPI = {
  // ─── Ma carte DigiID (QR durable) ──────────────────────────────────
  carte: {
    /** Récupère (et crée au besoin) la carte DigiID du citoyen connecté. */
    obtenir: () => clientAPI.get<CarteDigiID>(`${BASE}/carte`, opts),
    /** Même contenu — point d'entrée de la page « QR plein écran ». */
    qr: () => clientAPI.get<CarteDigiID>(`${BASE}/carte/qr`, opts),
  },

  // ─── Guichet : pré-remplir une fiche depuis la carte du client ─────
  guichet: {
    /**
     * Retrouve un client par sa carte (DigiID public **ou** URL du QR scannée).
     * Lève `ErreurAPI` (404) si aucune carte ne correspond.
     */
    rechercher: (digiid: string) =>
      clientAPI.post<ContactDigiID>(
        `${BASE}/guichet/rechercher`,
        { digiid },
        opts,
      ),
  },

  // ─── Profil logistique (dossier professionnel) ─────────────────────
  profils: {
    /** Mon dossier professionnel (404 s'il n'a pas encore été créé). */
    mien: () => clientAPI.get<ProfilLogistique>(`${BASE}/profil-logistique/mien`, opts),
    /** Crée / met à jour mon dossier (pièce, permis, véhicule). */
    enregistrer: (d: DonneesProfilLogistique) =>
      clientAPI.put<ProfilLogistique>(`${BASE}/profil-logistique/mien`, d, opts),
    /** Consulte le dossier d'un acteur (gérant de gare). */
    obtenir: (utilisateurId: string) =>
      clientAPI.get<ProfilLogistique>(
        `${BASE}/profil-logistique/${utilisateurId}`,
        opts,
      ),
    /** Valide les éléments contrôlés (gérant de gare / administrateur). */
    verifier: (utilisateurId: string, d: DonneesVerificationProfil) =>
      clientAPI.post<ProfilLogistique>(
        `${BASE}/profil-logistique/${utilisateurId}/verification`,
        d,
        opts,
      ),
  },

  // ─── Chauffeur : mes voyages + manifeste ───────────────────────────
  chauffeur: {
    /** Voyages affectés au chauffeur connecté (volumes inclus). */
    voyages: () =>
      clientAPI.get<VoyageChauffeur[]>(`${BASE}/chauffeur/voyages`, opts),
    /** Manifeste d'un voyage : colis **et** passagers, sur un seul écran. */
    manifeste: (voyageId: string) =>
      clientAPI.get<ManifesteVoyage>(
        `${BASE}/chauffeur/voyages/${voyageId}/manifeste`,
        opts,
      ),
  },

  // ─── Citoyen : mes envois et les voyages de mes proches ────────────
  mesVoyages: () => clientAPI.get<MesVoyages>(`${BASE}/mes-voyages`, opts),
};

/**
 * Pré-remplit un formulaire guichet à partir d'une carte DigiID.
 *
 * Renvoie `null` (au lieu de lever) quand aucune carte ne correspond : le
 * guichet doit pouvoir continuer en saisie manuelle pour un client sans compte.
 */
export async function chercherContactParCarte(
  valeur: string,
): Promise<ContactDigiID | null> {
  const recherche = valeur.trim();
  if (!recherche) return null;
  try {
    return await identiteAPI.guichet.rechercher(recherche);
  } catch {
    return null;
  }
}

/** Numéros de téléphone normalisés (chiffres uniquement) pour comparaison. */
export function normaliserTelephone(valeur: string | null | undefined): string {
  return (valeur ?? "").replace(/[^0-9]/g, "");
}
