/**
 * File d'attente des colis saisis hors-ligne (S3).
 *
 * Le guichet peut **enregistrer un colis sans réseau** : le formulaire complet
 * (destinataire, voyage, sacs…) est stocké localement, avec un identifiant
 * `id_local` qui sert de clé d'idempotence. À la reconnexion, la file est
 * rejouée sur `POST /api/v1/logistique/colis/synchroniser` : le serveur ne crée
 * jamais deux fois le même colis, même si la première tentative avait abouti
 * sans que la réponse nous parvienne.
 */
import { ErreurAPI, clientAPI, estErreurReseau } from "@/services/client_api";

import { ecrire, lister, lire, supprimer } from "./base_locale";

export type StatutColisLocal = "en_attente" | "synchronise" | "refuse";

export interface ColisEnAttente {
  id_local: string;
  /** Corps envoyé à `POST /colis` (identique au formulaire en ligne). */
  charge: Record<string, unknown>;
  statut: StatutColisLocal;
  cree_le: number;
  derniere_erreur?: string;
  /** Colis créé côté serveur une fois synchronisé. */
  code_colis?: string;
}

/** Identifiant d'idempotence généré sur le poste (UUID v4). */
export function genererIdLocal(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Met un colis en attente de synchronisation. */
export async function mettreEnFile(
  charge: Record<string, unknown>,
): Promise<ColisEnAttente> {
  const element: ColisEnAttente = {
    id_local: genererIdLocal(),
    charge,
    statut: "en_attente",
    cree_le: Date.now(),
  };
  await ecrire("file_colis", element);
  return element;
}

/** Colis en attente (les plus anciens d'abord). */
export async function fileEnAttente(): Promise<ColisEnAttente[]> {
  return (await lister<ColisEnAttente>("file_colis"))
    .filter((element) => element.statut === "en_attente")
    .sort((a, b) => a.cree_le - b.cree_le);
}

export interface BilanSynchronisation {
  envoyes: number;
  restants: number;
  erreurs: string[];
}

/**
 * ⚠️ `authentifie: true` est **obligatoire** : sans le jeton Bearer, la route
 * `POST /colis/synchroniser` répondait 401 et la file ne partait jamais.
 * Le client HTTP renouvelle désormais le jeton d'accès avant l'envoi quand le
 * cookie (15 min) a expiré pendant la coupure.
 */
const OPTIONS_SYNC = { authentifie: true } as const;

const CHEMIN_SYNC = "/api/v1/logistique/colis/synchroniser";

/**
 * Refus d'authentification (401) : la file est **conservée** et repartira
 * après reconnexion de l'agent. Ce n'est jamais un motif de rejet du colis.
 */
function estErreurAuthentification(erreur: unknown): boolean {
  return erreur instanceof ErreurAPI && erreur.code_http === 401;
}

/**
 * Rejoue la file d'attente sur le serveur.
 * Appelée à la reconnexion (`online`), après une connexion, et par le bouton
 * « Synchroniser » de l'interface.
 */
export async function synchroniserFile(): Promise<BilanSynchronisation> {
  const enAttente = await fileEnAttente();
  if (enAttente.length === 0) {
    return { envoyes: 0, restants: 0, erreurs: [] };
  }

  const bilan: BilanSynchronisation = { envoyes: 0, restants: 0, erreurs: [] };

  try {
    const reponses = await clientAPI.post<
      { colis: { code_clair?: string } }[]
    >(
      CHEMIN_SYNC,
      enAttente.map((element) => ({
        ...element.charge,
        id_local: element.id_local,
      })),
      OPTIONS_SYNC,
    );

    for (let index = 0; index < enAttente.length; index += 1) {
      const element = enAttente[index];
      const reponse = reponses[index];
      await ecrire("file_colis", {
        ...element,
        statut: "synchronise",
        code_colis: reponse?.colis?.code_clair,
        derniere_erreur: undefined,
      } satisfies ColisEnAttente);
      bilan.envoyes += 1;
    }
    return bilan;
  } catch (erreur) {
    // Réseau toujours coupé : on garde tout tel quel, sans marquer d'erreur
    // métier (l'indicateur affichera simplement encore N en attente).
    if (estErreurReseau(erreur)) {
      bilan.restants = enAttente.length;
      return bilan;
    }

    // Session refusée (401) : inutile de rejouer colis par colis — tous seront
    // refusés de la même façon. La file reste intacte pour la prochaine session.
    if (estErreurAuthentification(erreur)) {
      bilan.restants = enAttente.length;
      return bilan;
    }

    // Un lot peut être refusé (voyage clôturé, permission…). On tente alors
    // colis par colis : un élément invalide ne bloque pas les autres.
    for (const element of enAttente) {
      try {
        await clientAPI.post(
          CHEMIN_SYNC,
          [{ ...element.charge, id_local: element.id_local }],
          OPTIONS_SYNC,
        );
        await ecrire("file_colis", {
          ...element,
          statut: "synchronise",
        } satisfies ColisEnAttente);
        bilan.envoyes += 1;
      } catch (erreurColis) {
        // Une coupure en cours de route n'est pas un refus : on réessaiera.
        // Un 401 non plus : le colis reste en attente, il partira à la
        // prochaine session (ne jamais le marquer « refusé »).
        const message = estErreurAuthentification(erreurColis)
          ? "Session expirée — le colis partira après reconnexion"
          : estErreurReseau(erreurColis)
            ? "Réseau indisponible — nouvel essai à la reconnexion"
            : erreurColis instanceof Error
              ? erreurColis.message
              : "Erreur inconnue";
        await ecrire("file_colis", {
          ...element,
          derniere_erreur: message,
        } satisfies ColisEnAttente);
        bilan.erreurs.push(element.id_local);
      }
    }
    bilan.restants = (await fileEnAttente()).length;
    return bilan;
  }
}

/** Supprime les entrées déjà synchronisées (entretien local). */
export async function purgerColisSynchronises(): Promise<void> {
  const tous = await lister<ColisEnAttente>("file_colis");
  for (const element of tous) {
    if (element.statut === "synchronise") {
      await supprimer("file_colis", element.id_local);
    }
  }
}

export async function lireColisLocal(idLocal: string) {
  return lire<ColisEnAttente>("file_colis", idLocal);
}
