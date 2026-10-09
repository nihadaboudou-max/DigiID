/**
 * Service API — « Documents fournis » par le citoyen (vue unifiée).
 *
 * Pourquoi ce service ?
 * ---------------------
 * Les documents d'identité sont persistés dans DEUX familles de tables :
 *   1. `document_identite`      → CNI (et saisies manuelles permis/assurance) ;
 *   2. une table par document   → passeports, permis_conduire, assurances_auto,
 *      cartes_sejour, cartes_consulaires, cartes_grises (module OCR).
 *
 * Résultat : un **passeport** (ou une carte de séjour / consulaire) scanné
 * n'apparaissait nulle part dans le profil ni dans le tableau de bord, puisque
 * seul `document_identite` était interrogé. Ce service agrège les deux
 * familles pour donner une liste unique et exploitable.
 *
 * ⚠️ Chargement « best effort » : chaque source est interrogée en parallèle via
 * `Promise.allSettled`. Une source indisponible n'empêche jamais l'affichage
 * des autres (et n'affiche pas d'erreur bloquante).
 */
import { clientAPI } from "./client_api";
import {
  listerDocumentsIdentite,
  type DocumentIdentiteDetail,
} from "./documents_identite";

// =============================================================================
// Types
// =============================================================================

export type TypeDocumentFourni =
  | "cni"
  | "passeport"
  | "permis"
  | "carte_sejour"
  | "carte_consulaire"
  | "assurance"
  | "carte_grise";

export interface DocumentFourni {
  id: string;
  type_document: TypeDocumentFourni;
  /** Numéro/référence du document (peut être absent si l'OCR a échoué). */
  numero_document?: string | null;
  date_delivrance?: string | null;
  date_expiration?: string | null;
  /** `false` si le document est expiré ou rejeté à l'extraction. */
  est_valide: boolean;
  /** Origine de l'enregistrement (table commune ou table spécialisée). */
  origine: "document_identite" | "ocr";
}

interface EntreeBrute {
  id?: string;
  utilisateur_id?: string;
  type_document?: string;
  statut?: string;
  est_actif?: boolean;
  est_valide?: boolean;
  est_supprime?: boolean;
  date_delivrance?: string | null;
  date_expiration?: string | null;
  // Champs spécifiques selon le type de document
  numero_document?: string | null;
  numero_permis?: string | null;
  numero_contrat?: string | null;
  numero_titre?: string | null;
  numero_passeport?: string | null;
  numero_immatriculation_consulaire?: string | null;
  numero_immatriculation?: string | null;
  immatriculation_vehicule?: string | null;
  immatriculation?: string | null;
}

// =============================================================================
// Sources agrégées
// =============================================================================

/** Endpoints `/historique` du module OCR : 1 type de document = 1 endpoint. */
const SOURCES_OCR: { type: TypeDocumentFourni; url: string }[] = [
  { type: "passeport", url: "/api/v1/utilisateur/passeport/historique" },
  { type: "permis", url: "/api/v1/utilisateur/permis/historique" },
  { type: "carte_sejour", url: "/api/v1/utilisateur/carte-sejour/historique" },
  { type: "carte_consulaire", url: "/api/v1/utilisateur/consulaire/historique" },
  { type: "assurance", url: "/api/v1/utilisateur/assurance/historique" },
  { type: "carte_grise", url: "/api/v1/utilisateur/carte-grise/historique" },
];

export const LIBELLES_DOCUMENT_FOURNI: Record<TypeDocumentFourni, string> = {
  cni: "Carte Nationale d'Identité",
  passeport: "Passeport",
  permis: "Permis de conduire",
  carte_sejour: "Carte de séjour",
  carte_consulaire: "Carte consulaire",
  assurance: "Attestation d'assurance",
  carte_grise: "Carte grise",
};

/**
 * Documents qui portent la photo de leur titulaire : ce sont les SEULS
 * documents pouvant servir de référence à la vérification visuelle (selfie).
 * L'attestation d'assurance et la carte grise en sont exclues.
 */
export const TYPES_DOCUMENT_AVEC_PHOTO: ReadonlySet<string> = new Set([
  "cni",
  "passeport",
  "permis",
  "carte_sejour",
  "carte_consulaire",
]);

// =============================================================================
// Normalisation
// =============================================================================

/** Clés essayées, dans l'ordre, pour retrouver la référence d'un document. */
const CLES_REFERENCE = [
  "numero_document",
  "numero_passeport",
  "numero_permis",
  "numero_titre",
  "numero_contrat",
  "numero_immatriculation_consulaire",
  "numero_immatriculation",
  "immatriculation_vehicule",
  "immatriculation",
] as const;

function referenceDepuis(entree: EntreeBrute): string | null | undefined {
  for (const cle of CLES_REFERENCE) {
    const valeur = entree[cle];
    if (typeof valeur === "string" && valeur.trim() !== "") return valeur;
  }
  return null;
}

/** Un statut autre que « approuve » (expiré, rejeté…) invalide le document. */
function estValide(entree: EntreeBrute): boolean {
  if (entree.est_supprime === true) return false;
  if (entree.est_valide === false) return false;
  const statut = (entree.statut ?? "").toLowerCase();
  if (statut === "expiree" || statut === "expiré" || statut === "rejete" || statut === "rejeté") {
    return false;
  }
  return true;
}

function normaliser(
  entree: EntreeBrute,
  type: TypeDocumentFourni,
  origine: DocumentFourni["origine"],
): DocumentFourni | null {
  if (!entree || typeof entree !== "object") return null;
  if (entree.est_supprime === true) return null;

  return {
    id: String(entree.id ?? ""),
    type_document: type,
    numero_document: referenceDepuis(entree),
    date_delivrance: entree.date_delivrance ?? null,
    date_expiration: entree.date_expiration ?? null,
    est_valide: estValide(entree),
    origine,
  };
}

function typeConnu(valeur?: string): TypeDocumentFourni | null {
  if (!valeur) return null;
  return (valeur in LIBELLES_DOCUMENT_FOURNI
    ? (valeur as TypeDocumentFourni)
    : null);
}

/** Clé de déduplication : évite qu'un même document (CNI…) soit compté deux fois. */
function cleDocument(doc: DocumentFourni): string {
  return `${doc.type_document}|${doc.numero_document ?? doc.id}`;
}

// =============================================================================
// API
// =============================================================================

/**
 * Liste **tous** les documents fournis par l'utilisateur, toutes tables
 * confondues (CNI + passeport + permis + carte de séjour + carte consulaire +
 * assurance + carte grise).
 *
 * Ne lève jamais : retourne au pire la liste partielle des sources joignables.
 */
export async function listerDocumentsFournis(): Promise<DocumentFourni[]> {
  const [documentsIdentite, ...historiques] = await Promise.allSettled([
    listerDocumentsIdentite(),
    ...SOURCES_OCR.map((source) =>
      clientAPI.get<{ historique?: EntreeBrute[] }>(source.url, {
        authentifie: true,
      }),
    ),
  ]);

  const resultats: DocumentFourni[] = [];

  // 1. Table commune `document_identite` (CNI + saisies manuelles).
  if (documentsIdentite.status === "fulfilled") {
    for (const brut of documentsIdentite.value?.documents ?? []) {
      const type = typeConnu((brut as DocumentIdentiteDetail).type_document);
      if (!type) continue;
      const doc = normaliser(brut as EntreeBrute, type, "document_identite");
      if (doc) resultats.push(doc);
    }
  } else {
    console.warn(
      "Documents fournis : table commune indisponible",
      documentsIdentite.reason,
    );
  }

  // 2. Tables spécialisées du module OCR (passeport, permis, séjour…).
  historiques.forEach((resultat, index) => {
    const source = SOURCES_OCR[index];
    if (resultat.status !== "fulfilled") {
      console.warn(
        `Documents fournis : source ${source.type} indisponible`,
        resultat.reason,
      );
      return;
    }
    for (const brut of resultat.value?.historique ?? []) {
      const doc = normaliser(brut, source.type, "ocr");
      if (doc) resultats.push(doc);
    }
  });

  // 3. Déduplication (un même document peut exister dans les deux familles).
  const vus = new Set<string>();
  return resultats.filter((doc) => {
    const cle = cleDocument(doc);
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

/** Le document porte-t-il la photo de son titulaire (référence biométrique) ? */
export function contientPhotoTitulaire(type: string): boolean {
  return TYPES_DOCUMENT_AVEC_PHOTO.has(type);
}
