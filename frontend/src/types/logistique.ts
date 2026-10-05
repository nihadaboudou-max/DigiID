/**
 * Types du domaine logistique (colis, tickets, événements, scans) — étape S3.
 *
 * Ces types reflètent les schémas Pydantic du backend
 * (`src/modules/logistique/schemas.py`) : `ColisResponse`, `TicketResponse`,
 * `ColisEvenementResponse`, `ScanResponse`, `ColisEnregistre`.
 */

/** Cycle de vie d'un colis. */
export type StatutColis =
  | "enregistre"
  | "en_transit"
  | "arrive"
  | "livre"
  | "annule";

/** Événements de scan supportés par l'API. */
export type TypeEvenementScan = "livraison" | "depart" | "mise_en_transit" | "arrivee";

/** Événements traçables d'un colis (le scan + l'enregistrement initial). */
export type TypeEvenementColis = TypeEvenementScan | "enregistrement";

/** Colis (vue enrichie : noms de gares, expéditeur, receveur, chauffeur, ticket). */
export interface Colis {
  id: string;
  ticket_id: string | null;
  code_clair: string | null;
  qr_token: string | null;
  qr_code_url: string | null;
  expediteur_id: string | null;
  destinataire_nom: string;
  destinataire_tel: string;
  description: string | null;
  poids_kg: number | null;
  valeur_fcfa: number | null;
  /** Nombre d'articles — base du calcul du frais de service DigiID. */
  nombre_articles: number;
  gare_depart_id: string;
  gare_arrivee_id: string;
  voyage_id: string | null;
  receveur_id: string | null;
  chauffeur_id: string | null;
  statut: StatutColis;

  /** Prix du transport — facultatif (DigiID ne l'encaisse pas). */
  frais_fcfa: number | null;
  livre_le: string | null;
  cree_le: string;
  modifie_le: string | null;
  // Champs enrichis (noms lisibles)
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  expediteur_nom: string | null;
  expediteur_tel: string | null;
  receveur_nom: string | null;
  chauffeur_nom: string | null;
}

/** Ticket portant le QR dynamique + le numéro lisible en clair. */
export interface Ticket {
  id: string;
  code_clair: string;
  qr_token: string;
  qr_code_url: string | null;
  type: string;
  reference_id: string | null;
  voyage_id: string | null;
  statut: string;
  nb_scans: number;
  premier_scan_le: string | null;
  imprime_le: string | null;
  cree_le: string;
  modifie_le: string | null;
}

/** Événement de la timeline d'un colis (anti-double-scan + traçabilité). */
export interface ColisEvenement {
  id: string;
  colis_id: string;
  type_evenement: TypeEvenementColis;
  acteur_id: string | null;
  acteur_nom: string | null;
  gare_id: string | null;
  localisation: string | null;
  horodatage: string;
  idempotency_key: string | null;
  synchro_le: string | null;
  cree_le: string;
}

/** Réponse d'enregistrement d'un colis : le colis + son ticket. */
export interface ColisEnregistre {
  colis: Colis;
  ticket: Ticket;
}

/** Payload d'enregistrement d'un colis (guichet). */
export interface DonneesColis {
  destinataire_nom: string;
  destinataire_tel: string;
  /** Expéditeur saisi au guichet (souvent un tiers sans compte DigiID). */
  expediteur_nom?: string | null;
  expediteur_tel?: string | null;
  gare_depart_id: string;
  gare_arrivee_id: string;
  description?: string | null;
  poids_kg?: number | null;
  valeur_fcfa?: number | null;
  /** Nombre d'articles — détermine le frais de service DigiID (barème). */
  nombre_articles: number;

  /** Prix du transport — facultatif : nul si le guichet ne le renseigne pas. */
  frais_fcfa?: number | null;
  expediteur_id?: string | null;
  receveur_id?: string | null;
  voyage_id?: string | null;
  chauffeur_id?: string | null;
}

/** Payload d'un scan (QR ou repli code clair). */
export interface DonneesScan {
  token?: string;
  code_clair?: string;
  type_evenement?: TypeEvenementScan;
  gare_id?: string | null;
  voyage_id?: string | null;
  localisation?: string | null;
  idempotency_key?: string | null;
  horodatage?: string | null;
}

/** Résultat d'un scan (idempotent + règle anti-« DÉJÀ LIVRÉ »). */
export interface ResultatScan {
  succes: boolean;
  deja_livre: boolean;
  deja_scanne: boolean;
  message: string;
  statut_colis: StatutColis | null;
  colis: Colis | null;
  ticket: Ticket | null;
  evenement: ColisEvenement | null;
}

// ─── Libellés & couleurs (UI guichet) ────────────────────────────────

/** Libellé lisible d'un statut de colis. */
export const LIBELLES_STATUT_COLIS: Record<StatutColis, string> = {
  enregistre: "Enregistré",
  en_transit: "En transit",
  arrive: "Arrivé",
  livre: "Livré",
  annule: "Annulé",
};

/** Variante de `Badge` par statut de colis. */
export const VARIANTES_STATUT_COLIS: Record<
  StatutColis,
  "lagune" | "ocre" | "terre" | "neutre" | "succes" | "info"
> = {
  enregistre: "info",
  en_transit: "ocre",
  arrive: "lagune",
  livre: "succes",
  annule: "terre",
};

/** Libellé lisible d'un type d'événement. */
export const LIBELLES_EVENEMENT: Record<TypeEvenementColis, string> = {
  enregistrement: "Enregistrement",
  depart: "Départ",
  mise_en_transit: "Mise en transit",
  arrivee: "Arrivée à destination",
  livraison: "Remise au destinataire",
};

// ─── Voyages (espace chauffeur — S4) ─────────────────────────────────

/** Cycle de vie d'un voyage. */
export type StatutVoyage = "planifie" | "en_cours" | "termine" | "annule";

/** Libellé lisible d'un statut de voyage. */
export const LIBELLES_STATUT_VOYAGE: Record<StatutVoyage, string> = {
  planifie: "Planifié",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

/** Variante de `Badge` par statut de voyage. */
export const VARIANTES_STATUT_VOYAGE: Record<
  StatutVoyage,
  "info" | "ocre" | "succes" | "terre"
> = {
  planifie: "info",
  en_cours: "ocre",
  termine: "succes",
  annule: "terre",
};
