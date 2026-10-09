/**
 * Hook useEtatVerifications — État des vérifications d'identité du citoyen.
 *
 * Croise les indicateurs du profil (email, visage, CNI, 2FA) avec les
 * **documents d'identité réellement fournis** par l'utilisateur — CNI, mais
 * aussi **passeport**, permis de conduire, carte de séjour, carte consulaire
 * et attestation d'assurance — pour produire une liste d'étapes affichable sur
 * la page profil et sur le tableau de bord citoyen.
 *
 * ⚠️ Les documents proviennent de DEUX familles de tables (table commune
 * `document_identite` + une table par document du module OCR) : l'agrégation
 * est faite par `listerDocumentsFournis()`.
 *
 * Le chargement des documents est « best effort » : si une API échoue (réseau,
 * endpoint indisponible…), on retombe sur les seuls indicateurs du profil
 * sans bloquer l'affichage.
 *
 * Utilisation :
 *   const { etapes, completees, total, identiteVerifiee } = useEtatVerifications();
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthentification } from "@/contextes/authentification";
import {
  listerDocumentsFournis,
  contientPhotoTitulaire,
  type DocumentFourni,
} from "@/services/documents_fournis";
import type { Utilisateur } from "@/types/api";

// ---------- Types ----------

export type IdEtapeVerification =
  | "email"
  | "visage"
  | "cni"
  | "passeport"
  | "permis"
  | "assurance"
  | "2fa";

export type StatutEtapeVerification =
  /** Vérifié ou document valide. */
  | "complete"
  /** Document fourni mais pas encore validé. */
  | "en_cours"
  /** Document fourni mais expiré. */
  | "attention"
  /** Rien de fourni. */
  | "a_faire";

export interface EtapeVerification {
  id: IdEtapeVerification;
  titre: string;
  icone: string;
  statut: StatutEtapeVerification;
  /** Libellé court du badge (« Vérifié », « Expiré », « Non fourni »…). */
  libelle: string;
  /** Précision affichée en mode détaillé (n° de document, date d'expiration…). */
  detail?: string;
  /** Page où compléter ou consulter cette vérification. */
  lien: string;
  /** Nombre de documents fournis pour cette étape (0 pour email/visage/2FA). */
  documents: number;
  /**
   * `true` si le document porte la photo de son titulaire — donc utilisable
   * comme référence par la vérification visuelle (selfie). Ex. : un passeport
   * ou une carte de séjour, contrairement à une attestation d'assurance.
   */
  photoDisponible?: boolean;
}

export type NiveauVerification =
  | "aucune"
  | "partielle"
  | "renforcee"
  | "complete";

export interface EtatVerifications {
  etapes: EtapeVerification[];
  completees: number;
  total: number;
  /** Part des étapes complètes, en pourcentage (0-100). */
  pourcentage: number;
  niveau: NiveauVerification;
  /** Identité « forte » : CNI + visage validés. */
  identiteVerifiee: boolean;
  /**
   * Identité confirmée par au moins un titre d'identité **avec photo**
   * (CNI, passeport, permis, carte de séjour, carte consulaire) ET visage
   * vérifié — y compris sans CNI.
   */
  identiteConfirmeeParTitre: boolean;
  /** Nombre total de documents d'identité fournis (toutes tables confondues). */
  documentsFournis: number;
  chargement: boolean;
}

export interface ProprietesEtapeVerification {
  titre: string;
  icone: string;
  /** Page où compléter l'étape. */
  lien: string;
  /** Libellé du badge lorsqu'un document non expiré est présent. */
  libelleFourni: string;
}

// ---------- Constantes ----------

const TYPES_DOCUMENT = ["cni", "passeport", "permis", "assurance"] as const;
type TypeDocumentIdentite = (typeof TYPES_DOCUMENT)[number];

/** Tolérance d'un jour : un document qui expire aujourd'hui reste valide. */
const TOLERANCE_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// ---------- Utilitaires ----------

/** Un document sans date d'expiration n'est jamais considéré comme expiré. */
export function documentExpire(dateExpiration?: string | null): boolean {
  if (!dateExpiration) return false;
  const date = new Date(dateExpiration);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() + TOLERANCE_EXPIRATION_MS < Date.now();
}

/** Formate une date ISO (YYYY-MM-DD) en `jj/mm/aaaa`. */
export function formaterDateVerification(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("fr-FR");
}

function documentsDuType(
  documents: DocumentFourni[],
  type: TypeDocumentIdentite,
): DocumentFourni[] {
  return documents.filter((doc) => doc.type_document === type);
}

/**
 * Choisit le document le plus représentatif d'un type : le premier encore
 * valide, sinon le premier de la liste.
 */
function choisirDocument(
  documents: DocumentFourni[],
  type: TypeDocumentIdentite,
): DocumentFourni | null {
  const duType = documentsDuType(documents, type);
  if (duType.length === 0) return null;
  return (
    duType.find((doc) => !documentExpire(doc.date_expiration) && doc.est_valide) ??
    duType[0]
  );
}

/** Référence lisible d'un document (n° de passeport, de permis, de contrat…). */
function referenceDocument(doc: DocumentFourni): string | undefined {
  return doc.numero_document ?? undefined;
}

function construireEtapeDocument(
  documents: DocumentFourni[],
  type: TypeDocumentIdentite,
  options: ProprietesEtapeVerification,
): EtapeVerification {
  const nombre = documentsDuType(documents, type).length;
  const doc = choisirDocument(documents, type);

  if (!doc) {
    return {
      id: type,
      titre: options.titre,
      icone: options.icone,
      statut: "a_faire",
      libelle: "Non fourni",
      lien: options.lien,
      documents: 0,
      photoDisponible: false,
    };
  }

  if (documentExpire(doc.date_expiration)) {
    return {
      id: type,
      titre: options.titre,
      icone: options.icone,
      statut: "attention",
      libelle: "Expiré",
      detail: `Expiré le ${formaterDateVerification(doc.date_expiration)}`,
      lien: options.lien,
      documents: nombre,
      photoDisponible: contientPhotoTitulaire(type),
    };
  }

  return {
    id: type,
    titre: options.titre,
    icone: options.icone,
    statut: "complete",
    libelle: options.libelleFourni,
    detail: referenceDocument(doc),
    lien: options.lien,
    documents: nombre,
    photoDisponible: contientPhotoTitulaire(type),
  };
}

/**
 * Niveau global : calculé **relativement** au nombre d'étapes, pour rester
 * juste quel que soit le nombre d'étapes affichées (le passeport en ajoute une).
 */
function niveauDepuis(completees: number, total: number): NiveauVerification {
  if (completees === 0) return "aucune";
  if (total <= 0 || completees >= total) return "complete";
  if (completees <= Math.ceil(total / 3)) return "partielle";
  return "renforcee";
}

function construireEtapeCni(
  utilisateur: Utilisateur,
  documents: DocumentFourni[],
): EtapeVerification {
  const nombre = documentsDuType(documents, "cni").length;

  // La CNI « vérifiée » (contrôle OCR validé) prime sur le simple dépôt.
  if (utilisateur.est_cni_verifiee) {
    return {
      id: "cni",
      titre: "CNI",
      icone: "🆔",
      statut: "complete",
      libelle: "Vérifiée",
      lien: "/documents-identite",
      documents: nombre,
      photoDisponible: true,
    };
  }

  const doc = choisirDocument(documents, "cni");
  if (doc) {
    const expire = documentExpire(doc.date_expiration) || !doc.est_valide;
    return {
      id: "cni",
      titre: "CNI",
      icone: "🆔",
      statut: expire ? "attention" : "en_cours",
      libelle: expire ? "Expirée" : "À valider",
      detail: expire
        ? `Expirée le ${formaterDateVerification(doc.date_expiration)}`
        : "Document fourni",
      lien: "/documents-identite",
      documents: nombre,
      photoDisponible: true,
    };
  }

  return {
    id: "cni",
    titre: "CNI",
    icone: "🆔",
    statut: "a_faire",
    libelle: "Non fournie",
    lien: "/documents-identite",
    documents: 0,
    photoDisponible: false,
  };
}

export function construireEtapesVerification(
  utilisateur: Utilisateur,
  documents: DocumentFourni[],
): EtapeVerification[] {
  return [
    {
      id: "email",
      titre: "Email",
      icone: "📧",
      statut: utilisateur.est_email_verifie ? "complete" : "a_faire",
      libelle: utilisateur.est_email_verifie ? "Vérifié" : "À vérifier",
      lien: utilisateur.est_email_verifie ? "/parametres" : "/verification",
      documents: 0,
    },
    {
      id: "visage",
      titre: "Visage",
      icone: "👤",
      statut: utilisateur.est_visage_verifie ? "complete" : "a_faire",
      libelle: utilisateur.est_visage_verifie ? "Vérifié" : "À faire",
      lien: "/verification-visuelle",
      documents: 0,
    },
    construireEtapeCni(utilisateur, documents),
    // ✅ Le passeport est un titre d'identité à part entière : avant cette
    //    étape, il n'était nulle part affiché alors qu'il porte une photo.
    construireEtapeDocument(documents, "passeport", {
      titre: "Passeport",
      icone: "🛂",
      lien: "/inspection",
      libelleFourni: "Fourni",
    }),
    construireEtapeDocument(documents, "permis", {
      titre: "Permis",
      icone: "🚗",
      lien: "/permis-conduire",
      libelleFourni: "Fourni",
    }),
    construireEtapeDocument(documents, "assurance", {
      titre: "Assurance",
      icone: "🛡️",
      lien: "/assurance-auto",
      libelleFourni: "Fournie",
    }),
    {
      id: "2fa",
      titre: "Double authentification",
      icone: "🔐",
      statut: utilisateur.deux_fa_active ? "complete" : "a_faire",
      libelle: utilisateur.deux_fa_active ? "Activée" : "Inactive",
      lien: "/parametres/2fa",
      documents: 0,
    },
  ];
}

// ---------- Hook ----------

/**
 * @param actif  `false` pour désactiver le chargement (ex. un état déjà calculé
 *               est fourni par le parent) — évite un appel API inutile.
 */
export function useEtatVerifications(actif: boolean = true): EtatVerifications {
  const { utilisateur } = useAuthentification();
  const [documents, setDocuments] = useState<DocumentFourni[]>([]);
  const [chargement, setChargement] = useState(actif);

  const charger = useCallback(async () => {
    if (!actif || !utilisateur) {
      if (!actif) setChargement(false);
      return;
    }
    try {
      setDocuments(await listerDocumentsFournis());
    } catch (erreur) {
      // Best effort : le détail documentaire est un bonus, les indicateurs du
      // profil (email/visage/CNI/2FA) restent affichés.
      console.warn("État des vérifications : documents indisponibles", erreur);
      setDocuments([]);
    } finally {
      setChargement(false);
    }
  }, [actif, utilisateur]);

  useEffect(() => {
    if (!actif) return;
    void charger();
  }, [actif, charger]);

  // L'utilisateur revient souvent d'un scan : on rafraîchit au retour d'onglet.
  useEffect(() => {
    if (!actif) return;
    function surChangementVisibilite() {
      if (document.visibilityState === "visible") void charger();
    }
    document.addEventListener("visibilitychange", surChangementVisibilite);
    return () =>
      document.removeEventListener("visibilitychange", surChangementVisibilite);
  }, [actif, charger]);

  return useMemo<EtatVerifications>(() => {
    if (!utilisateur) {
      return {
        etapes: [],
        completees: 0,
        total: 0,
        pourcentage: 0,
        niveau: "aucune",
        identiteVerifiee: false,
        identiteConfirmeeParTitre: false,
        documentsFournis: 0,
        chargement,
      };
    }

    const etapes = construireEtapesVerification(utilisateur, documents);
    const completees = etapes.filter((etape) => etape.statut === "complete").length;
    const total = etapes.length;

    // Un titre d'identité AVEC photo et non expiré suffit à confirmer l'identité
    // — y compris un passeport, une carte de séjour ou une carte consulaire :
    // la CNI n'est plus le seul document accepté.
    const titreAvecPhoto = etapes.find(
      (etape) =>
        etape.photoDisponible &&
        etape.id !== "cni" &&
        etape.statut === "complete",
    );

    return {
      etapes,
      completees,
      total,
      pourcentage: total > 0 ? Math.round((completees / total) * 100) : 0,
      niveau: niveauDepuis(completees, total),
      identiteVerifiee: Boolean(
        utilisateur.est_cni_verifiee && utilisateur.est_visage_verifie,
      ),
      identiteConfirmeeParTitre: Boolean(
        utilisateur.est_visage_verifie &&
          (utilisateur.est_cni_verifiee || titreAvecPhoto),
      ),
      documentsFournis: documents.length,
      chargement,
    };
  }, [utilisateur, documents, chargement]);
}

export default useEtatVerifications;
