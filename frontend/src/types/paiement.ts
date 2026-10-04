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
  | "paiement";

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
  frais_plateforme: number;
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
  /** Si absent, le backend reprend les frais du colis. */
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
};

/** Montant par défaut d'un enregistrement de colis (démo) en FCFA. */
export const FRAIS_COLIS_DEFAUT_FCFA = 100;
