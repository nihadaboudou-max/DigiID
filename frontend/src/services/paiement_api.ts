/**
 * Service API du domaine paiement (S6) — wallet, transactions, commissions.
 */
import { clientAPI } from "@/services/client_api";
import type {
  Commission,
  DonneesPaiement,
  MoyenPaiementInfo,
  MouvementPortefeuille,
  Portefeuille,
  ResultatPaiement,
  TarifsColis,
  TransactionPaiement,
} from "@/types/paiement";

export type {
  Commission, DonneesPaiement, MoyenPaiementInfo, MouvementPortefeuille,
  Portefeuille, ResultatPaiement, TarifsColis, TransactionPaiement,
} from "@/types/paiement";

export interface ReponseListe<T> {
  elements: T[];
  total: number;
  page: number;
  par_page: number;
}

const BASE = "/api/v1/paiement";
const opts = { authentifie: true } as const;

function construireQuery(filtres?: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  Object.entries(filtres ?? {}).forEach(([cle, valeur]) => {
    if (valeur !== undefined && valeur !== null && valeur !== "") {
      qs.set(cle, String(valeur));
    }
  });
  return qs.toString();
}

export const paiementAPI = {
  /** Catalogue des moyens de paiement (espèces, mobile money mock). */
  moyens: () => clientAPI.get<MoyenPaiementInfo[]>(`${BASE}/moyens`, opts),

  /**
   * Frais de service applicables à un colis contenant `nombreArticles`
   * (100 F pour 1-3 articles, 200 F pour 4-6, 350 F pour 7-10, 500 F au-delà)
   * + le barème complet pour l'affichage guichet.
   */
  tarifs: (nombreArticles = 1) =>
    clientAPI.get<TarifsColis>(
      `${BASE}/tarifs?${construireQuery({ nombre_articles: nombreArticles })}`,
      opts,
    ),

  portefeuilles: {
    /** Ma cagnotte (créée à solde nul à la première consultation). */
    moi: () => clientAPI.get<Portefeuille>(`${BASE}/portefeuille/moi`, opts),

    /** Historique des mouvements de ma cagnotte. */
    mesMouvements: (filtres?: { page?: number; par_page?: number }) =>
      clientAPI.get<ReponseListe<MouvementPortefeuille>>(
        `${BASE}/portefeuille/moi/mouvements?${construireQuery({
          page: filtres?.page ?? 1,
          par_page: filtres?.par_page ?? 20,
        })}`,
        opts,
      ),

    /** Cagnotte d'un acteur (support gérant/admin). */
    obtenir: (proprietaireId: string) =>
      clientAPI.get<Portefeuille>(`${BASE}/portefeuille/${proprietaireId}`, opts),

    mouvements: (
      proprietaireId: string,
      filtres?: { page?: number; par_page?: number },
    ) =>
      clientAPI.get<ReponseListe<MouvementPortefeuille>>(
        `${BASE}/portefeuille/${proprietaireId}/mouvements?${construireQuery({
          page: filtres?.page ?? 1,
          par_page: filtres?.par_page ?? 20,
        })}`,
        opts,
      ),
  },

  transactions: {
    /** Payer un colis (crédite la cagnotte du receveur). */
    payer: (donnees: DonneesPaiement) =>
      clientAPI.post<ResultatPaiement>(`${BASE}/transactions`, donnees, opts),

    /** Confirmer une transaction en attente (retour opérateur / démo). */
    confirmer: (reference: string) =>
      clientAPI.post<ResultatPaiement>(
        `${BASE}/transactions/${encodeURIComponent(reference)}/confirmer`,
        {},
        opts,
      ),

    /** Lister les transactions (filtres : colis, payeur, statut). */
    lister: (filtres?: {
      colis_id?: string;
      payeur_id?: string;
      statut?: string;
      page?: number;
      par_page?: number;
    }) =>
      clientAPI.get<ReponseListe<TransactionPaiement>>(
        `${BASE}/transactions?${construireQuery({
          page: filtres?.page ?? 1,
          par_page: filtres?.par_page ?? 20,
          colis_id: filtres?.colis_id,
          payeur_id: filtres?.payeur_id,
          statut: filtres?.statut,
        })}`,
        opts,
      ),
  },

  commissions: {
    /** Mes commissions (reversements reçus sur colis). */
    moi: (filtres?: { page?: number; par_page?: number }) =>
      clientAPI.get<ReponseListe<Commission>>(
        `${BASE}/commissions/moi?${construireQuery({
          page: filtres?.page ?? 1,
          par_page: filtres?.par_page ?? 20,
        })}`,
        opts,
      ),

    /** Commissions d'un receveur (support gérant/admin). */
    lister: (filtres?: {
      receveur_id?: string;
      page?: number;
      par_page?: number;
    }) =>
      clientAPI.get<ReponseListe<Commission>>(
        `${BASE}/commissions?${construireQuery({
          page: filtres?.page ?? 1,
          par_page: filtres?.par_page ?? 20,
          receveur_id: filtres?.receveur_id,
        })}`,
        opts,
      ),
  },
};

/**
 * Génère une clé d'idempotence unique (côté client) pour éviter un double
 * débit si l'utilisateur clique deux fois sur « Payer ».
 */
export function cleIdempotence(prefixe = "ui"): string {
  const alea =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefixe}-${alea}`;
}
