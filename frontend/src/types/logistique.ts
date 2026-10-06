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
  /** Enregistré **par le chauffeur en route** (client monté en cours de trajet). */
  | "enregistre_direct"
  | "en_transit"
  | "arrive"
  | "livre"
  | "annule";

/**
 * Origine de l'enregistrement d'un colis / d'un passager.
 *  - `guichet` : enregistré au guichet par un receveur ou un commerçant.
 *  - `chauffeur_direct` : enregistré par le chauffeur lui-même, en route.
 */
export type ModeEnregistrement = "guichet" | "chauffeur_direct";

/** Événements de scan supportés par l'API. */
export type TypeEvenementScan = "livraison" | "depart" | "mise_en_transit" | "arrivee";

/** Événements traçables d'un colis (le scan + l'enregistrement initial). */
export type TypeEvenementColis = TypeEvenementScan | "enregistrement";

/** Étiquette QR d'un sac (une par sac — traçabilité, sans impact sur le prix). */
export interface Bagage {
  id: string;
  ticket_id: string | null;
  suivi_familial_id: string | null;
  colis_id: string | null;
  /** Numéro lisible : « Sac 1/3 », « Sac 2/3 »… */
  numero_serie: string;
  position: number;
  nombre_total: number;
  statut: string;
  /** Code clair de l'étiquette (ticket type=BAGAGE). */
  code_clair: string | null;
  qr_code_url: string | null;
  cree_le: string;
}

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
  /** Nombre de sacs (1 à 10) — traçabilité, sans impact sur le prix. */
  nombre_bagages: number;
  gare_depart_id: string;
  gare_arrivee_id: string;
  voyage_id: string | null;
  receveur_id: string | null;
  chauffeur_id: string | null;
  statut: StatutColis;

  /** Origine de l'enregistrement : guichet ou chauffeur en route. */
  mode_enregistrement: ModeEnregistrement;
  /** Qui a matériellement créé le colis (receveur ou chauffeur). */
  enregistre_par_id: string | null;
  enregistre_par_nom: string | null;

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
  /** Étiquettes QR générées (une par sac). */
  bagages: Bagage[];
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
  /** Nombre d'articles — information libre du guichet. */
  nombre_articles: number;
  /** Nombre de sacs (1 à 10) — traçabilité, sans impact sur le prix. */
  nombre_bagages: number;

  /** Prix du transport — facultatif : nul si le guichet ne le renseigne pas. */
  frais_fcfa?: number | null;
  expediteur_id?: string | null;
  receveur_id?: string | null;

  /** Attribution **obligatoire** : trajet + chauffeur précis.
   *  Peut être omis en **enregistrement direct** : le backend force alors le
   *  chauffeur = utilisateur connecté (et vérifie qu'il conduit bien ce voyage).
   */
  voyage_id: string;

  chauffeur_id?: string;
  /**
   * **Enregistrement direct** : le client monte en route et le chauffeur crée
   * lui-même la fiche depuis son téléphone. Le backend force alors le chauffeur
   * = utilisateur courant, le mode « chauffeur_direct » et le statut initial
   * « enregistre_direct ».
   */
  enregistrement_direct?: boolean;
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
  enregistre_direct: "Enregistré en route",
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
  enregistre_direct: "ocre",
  en_transit: "ocre",
  arrive: "lagune",
  livre: "succes",
  annule: "terre",
};

/** Libellé lisible de l'origine d'un enregistrement. */
export const LIBELLES_MODE_ENREGISTREMENT: Record<ModeEnregistrement, string> = {
  guichet: "Guichet",
  chauffeur_direct: "Chauffeur (en route)",
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

// ─── Suivi familial (enfants voyageant seuls — S7) ────────────────────

/** Cycle de vie d'un suivi familial. */
export type StatutSuiviFamilial =
  | "enregistre"
  /** Passager enregistré **par le chauffeur en route**. */
  | "enregistre_direct"
  | "en_route"
  | "arrive"
  | "annule";

/** Événements traçables du voyage d'un enfant. */
export type TypeEvenementSuivi =
  | "enregistrement"
  | "depart"
  | "arrivee"
  | "livraison"
  | "incident";

/** Enfant suivi (vue enrichie : noms de gares, agent, ticket). */
export interface SuiviFamilial {
  id: string;
  ticket_id: string | null;
  code_clair: string | null;
  qr_token: string | null;
  qr_code_url: string | null;
  enfant_nom: string;
  enfant_age: number | null;
  enfant_sexe: string | null;
  parent_nom: string | null;
  telephone_parent: string;
  /** « enfant » (responsabilité d'un tiers) ou « adulte » (voyageur autonome). */
  type_passager: "enfant" | "adulte";
  telephone_passager: string | null;
  acheteur_nom: string | null;
  acheteur_tel: string | null;
  proche_nom: string | null;
  proche_telephone: string | null;
  /** Nombre de sacs (1 à 10) — traçabilité, sans impact sur le prix. */
  nombre_bagages: number;
  parent_id: string | null;
  gare_depart_id: string;
  gare_arrivee_id: string;
  voyage_id: string | null;
  chauffeur_id: string | null;
  statut: StatutSuiviFamilial;
  /** Origine de l'enregistrement : guichet ou chauffeur en route. */
  mode_enregistrement: ModeEnregistrement;
  sms_depart_envoye: boolean;
  sms_arrivee_envoye: boolean;
  pre_alerte_envoyee: boolean;
  /** Frais de service **fixe** : 100 FCFA par passager/enfant. */
  frais_service_fcfa: number;
  enregistre_par_id: string | null;
  cree_le: string;
  modifie_le: string | null;
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  enregistre_par_nom: string | null;
  chauffeur_nom: string | null;
  nb_evenements: number;
  /** Étiquettes QR générées (une par sac). */
  bagages: Bagage[];
}

/** Événement de la timeline d'un suivi familial. */
export interface SuiviFamilialEvenement {
  id: string;
  suivi_familial_id: string;
  type_evenement: TypeEvenementSuivi;
  acteur_id: string | null;
  acteur_nom: string | null;
  gare_id: string | null;
  localisation: string | null;
  horodatage: string;
  idempotency_key: string | null;
  synchro_le: string | null;
  cree_le: string;
}

/** Réponse d'enregistrement : le suivi + son ticket (ENFANT). */
export interface SuiviFamilialEnregistre {
  suivi: SuiviFamilial;
  ticket: Ticket;
}

/** Payload d'enregistrement d'un enfant au guichet. */
export interface DonneesSuiviFamilial {
  enfant_nom: string;
  enfant_age?: number | null;
  enfant_sexe?: string | null;
  parent_nom?: string | null;
  /** Rempli par le backend selon `type_passager` si omis. */
  telephone_parent?: string | null;
  type_passager: "enfant" | "adulte";
  /** Adulte : son propre numéro. */
  telephone_passager?: string | null;
  /** Enfant : nom/numéro de l'acheteur du ticket. */
  acheteur_nom?: string | null;
  acheteur_tel?: string | null;
  /** Proche de confiance à prévenir (obligatoire). */
  proche_nom?: string | null;
  proche_telephone: string;
  /** Nombre de sacs (1 à 10). */
  nombre_bagages: number;
  gare_depart_id: string;
  gare_arrivee_id: string;

  /** Attribution **obligatoire** : trajet + chauffeur précis.
   *  Peut être omis en **enregistrement direct** : le backend force alors le
   *  chauffeur = utilisateur connecté (et vérifie qu'il conduit bien ce voyage).
   */
  voyage_id: string;

  chauffeur_id?: string;
  /** Enregistrement direct par le chauffeur (client monté en route). */
  enregistrement_direct?: boolean;
  parent_id?: string | null;
}

// ─── Actions groupées du chauffeur (départ / arrivée / pré-alerte) ───

/** Payload d'une action en lot (départ / arrivée). */
export interface DonneesActionLot {
  /** Gare ciblée (optionnelle) : pour « Arrivés », ne traiter qu'une gare. */
  gare_id?: string | null;
  localisation?: string | null;
}

/** Résultat d'une action en lot (départ / arrivée). */
export interface ResultatActionLot {
  succes: boolean;
  message: string;
  type_action: string;
  voyage_id: string;
  nb_passagers: number;
  nb_colis: number;
}

/** Payload d'une pré-alerte d'arrivée (« Prévenir de l'approche »). */
export interface DonneesPreAlerte {
  delai_minutes?: number | null;
  localisation?: string | null;
}

/** Résultat d'une pré-alerte (SMS émis). */
export interface ResultatPreAlerte {
  succes: boolean;
  message: string;
  voyage_id: string;
  nb_sms: number;
  nb_passagers: number;
  nb_colis: number;
}

/** Payload d'une étape du voyage (départ / arrivée…). */
export interface DonneesEvenementSuivi {
  type_evenement: "depart" | "arrivee" | "livraison" | "incident";
  gare_id?: string | null;
  localisation?: string | null;
  idempotency_key?: string | null;
}

/** Résultat d'un événement de suivi (idempotent). */
export interface ResultatEvenementSuivi {
  succes: boolean;
  deja_enregistre: boolean;
  message: string;
  statut_suivi: StatutSuiviFamilial | null;
  suivi: SuiviFamilial | null;
  evenement: SuiviFamilialEvenement | null;
}

/** Trace d'un SMS/alerte logistique (rendu visible en mode mock). */
export interface NotificationLogistique {
  id: string;
  canal: string;
  type_cible: string;
  cible_id: string | null;
  type_evenement: string;
  destinataire_role: string | null;
  telephone: string | null;
  message: string;
  envoye: boolean;
  cree_le: string;
}

/** Libellé lisible d'un statut de suivi familial. */
export const LIBELLES_STATUT_SUIVI: Record<StatutSuiviFamilial, string> = {
  enregistre: "Enregistré",
  enregistre_direct: "Enregistré en route",
  en_route: "En route",
  arrive: "Arrivé",
  annule: "Annulé",
};

/** Libellé lisible d'un type d'événement de suivi. */
export const LIBELLES_EVENEMENT_SUIVI: Record<string, string> = {
  enregistrement: "Enregistrement de l'enfant",
  depart: "Départ",
  arrivee: "Arrivée à destination",
  livraison: "Remis à la personne désignée",
  incident: "Incident signalé",
};

// ─── Suivi public (page /suivi/[code] — S7) ──────────────────────────

/** Événement de la timeline publique. */
export interface EvenementSuiviPublic {
  type_evenement: string;
  horodatage: string;
  localisation: string | null;
  gare_nom: string | null;
}

/** SMS visible par la famille (numéro masqué). */
export interface NotificationSuiviPublic {
  type_evenement: string;
  destinataire_role: string | null;
  telephone_masque: string | null;
  message: string;
  envoye: boolean;
  cree_le: string;
}

/** Informations publiques d'un colis (sans données sensibles). */
export interface ColisPublicInfo {
  destinataire_nom: string;
  description: string | null;
  poids_kg: number | null;
  nombre_articles: number;
  nombre_bagages: number;
}

/** Informations publiques d'un enfant suivi. */
export interface EnfantPublicInfo {
  enfant_nom: string;
  enfant_age: number | null;
  enfant_sexe: string | null;
  parent_nom: string | null;
  type_passager: "enfant" | "adulte";
  nombre_bagages: number;
}

/** Vue publique d'un suivi (colis **ou** enfant) renvoyée sans connexion. */
export interface SuiviPublic {
  type: "colis" | "enfant";
  code: string;
  statut: string;
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  date_depart: string | null;
  vehicule_immatriculation: string | null;
  nb_personnes_notifiees: number;
  colis: ColisPublicInfo | null;
  enfant: EnfantPublicInfo | null;
  evenements: EvenementSuiviPublic[];
  notifications: NotificationSuiviPublic[];
}
