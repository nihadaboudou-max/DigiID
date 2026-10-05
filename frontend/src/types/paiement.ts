/**
 * Types du domaine paiement (S6) — wallet, transactions, commissions.
 *
 * Reflètent les schémas Pydantic du backend
 * (`src/modules/paiement/schemas.py`) : `PortefeuilleResponse`,
 * `MouvementResponse`, `TransactionResponse`, `CommissionResponse`,
 * `PaiementResultat`.
 */

// ─── Portefeuille ────────────────────────────────────────────────────

export interface Portefeuille {
  id: string;
  proprietaire_id: string;
  solde_fcfa: number;
  devise: string;
  actif: boolean;
  maj_le: string | null;
  cree_le: string;
  modifie_le: string | null;
}

export type SensMouvement = "CREDIT" | "DEBIT";

export type MotifMouvement =
  | "commission_colis"
  | "commission_api"
  | "reversement"
  | "abonnement"
  | "ajustement"
  | "paiement"
  | "frais_scan_agent";

export interface MouvementPortefeuille {
  id: string;
  portefeuille_id: string;
  sens: SensMouvement;
  montant_fcfa: number;
  motif: MotifMouvement | string;
  reference_id: string | null;
  solde_apres: number;
  cree_le: string;
}

// ─── Transactions ────────────────────────────────────────────────────

export type StatutTransaction = "en_attente" | "reussi" | "echoue" | "rembourse";
export type MoyenPaiement = "especes" | "wave";
export type TypeTransaction = "COLIS" | "BAGAGE" | "ABONNEMENT" | "API" | "REVERSEMENT";

export interface TransactionPaiement {
  id: string;
  reference: string;
  type: TypeTransaction | string;
  colis_id: string | null;
  payeur_id: string | null;
  beneficiaire_id: string | null;
  montant_fcfa: number;
  /** Notre part du frais de service. */
  frais_plateforme: number;
  /** Part reversée au receveur (créditée sur sa cagnotte). */
  commission_receveur: number;
  montant_net: number;
  statut: StatutTransaction;
  moyen: MoyenPaiement | string;
  telephone: string | null;
  confirme_le: string | null;
  cree_le: string;
  modifie_le: string | null;
}

export interface Commission {
  id: string;
  transaction_id: string;
  receveur_id: string | null;
  montant_fcfa: number;
  statut: string;
  portefeuille_id: string | null;
  verse_le: string | null;
  cree_le: string;
}

/** Résultat d'un paiement : transaction + commission + cagnotte bénéficiaire. */
export interface ResultatPaiement {
  transaction: TransactionPaiement;
  commission: Commission | null;
  portefeuille_beneficiaire: Portefeuille | null;
  message: string;
}

// ─── Payloads ────────────────────────────────────────────────────────

export interface DonneesPaiement {
  type?: TypeTransaction;
  colis_id?: string | null;
  /**
   * Ignoré pour un COLIS : le backend applique le barème par nombre d'articles
   * (100 / 200 / 350 / 500 FCFA selon le contenu du colis).
   */
  montant_fcfa?: number | null;
  moyen: MoyenPaiement;
  telephone?: string | null;
  payeur_id?: string | null;
  /** Clé d'idempotence : un même rejeu ne crée pas de doublon. */
  idempotency_key?: string | null;
}

export interface MoyenPaiementInfo {
  code: MoyenPaiement | string;
  libelle: string;
  immediat: boolean;
}

// ─── Barème des frais de service (par nombre d'articles) ─────────────

export interface PalierTarifaire {
  nb_articles_min: number;
  /** `null` = palier ouvert (« plus de N articles »). */
  nb_articles_max: number | null;
  frais_fcfa: number;
  part_receveur_fcfa: number;
}

/** Tarif applicable à un colis + barème complet (`GET /paiement/tarifs`). */
export interface TarifsColis {
  nombre_articles: number;
  frais_fcfa: number;
  part_receveur_fcfa: number;
  part_plateforme_fcfa: number;
  bareme: PalierTarifaire[];
}

/**
 * Barème local (miroir du back-end) pour afficher le frais **dès la saisie** du
 * nombre d'articles, sans aller-retour réseau. Le barème serveur reste
 * néanmoins la seule référence au moment du paiement.
 */
export const BAREME_FRAIS_SERVICE: PalierTarifaire[] = [
  { nb_articles_min: 1, nb_articles_max: 3, frais_fcfa: 100, part_receveur_fcfa: 25 },
  { nb_articles_min: 4, nb_articles_max: 6, frais_fcfa: 200, part_receveur_fcfa: 50 },
  { nb_articles_min: 7, nb_articles_max: 10, frais_fcfa: 350, part_receveur_fcfa: 80 },
  { nb_articles_min: 11, nb_articles_max: null, frais_fcfa: 500, part_receveur_fcfa: 150 },
];

/** Frais de service (et part receveur) pour un colis de `nombreArticles`. */
export function fraisServicePourArticles(nombreArticles: number): PalierTarifaire {
  const n = Math.max(Math.floor(nombreArticles) || 1, 1);
  return (
    BAREME_FRAIS_SERVICE.find(
      (p) => n >= p.nb_articles_min && (p.nb_articles_max === null || n <= p.nb_articles_max),
    ) ?? BAREME_FRAIS_SERVICE[BAREME_FRAIS_SERVICE.length - 1]
  );
}

// ─── Libellés & couleurs (UI) ────────────────────────────────────────

export const LIBELLES_MOYEN: Record<string, string> = {
  especes: "Espèces (guichet)",
  wave: "Wave (mobile money)",
};

export const LIBELLES_STATUT_TRANSACTION: Record<StatutTransaction, string> = {
  en_attente: "En attente",
  reussi: "Réussi",
  echoue: "Échoué",
  rembourse: "Remboursé",
};

export const VARIANTES_STATUT_TRANSACTION: Record<
  StatutTransaction,
  "info" | "succes" | "terre" | "ocre"
> = {
  en_attente: "ocre",
  reussi: "succes",
  echoue: "terre",
  rembourse: "info",
};

export const LIBELLES_MOTIF: Record<string, string> = {
  commission_colis: "Commission colis",
  commission_api: "Commission API",
  reversement: "Reversement",
  abonnement: "Abonnement",
  ajustement: "Ajustement",
  paiement: "Paiement",
  frais_scan_agent: "Frais de scan (compte prépayé)",
};
