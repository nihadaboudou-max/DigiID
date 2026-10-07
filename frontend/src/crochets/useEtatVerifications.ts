/**
 * Hook useEtatVerifications — État des vérifications d'identité du citoyen.
 *
 * Croise les indicateurs du profil (email, visage, CNI, 2FA) avec les
 * **documents d'identité réellement fournis** par l'utilisateur (CNI, permis,
 * assurance) pour produire une liste d'étapes affichable sur la page profil
 * et sur le tableau de bord citoyen.
 *
 * Le chargement des documents est « best effort » : si l'API échoue (réseau,
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
  listerDocumentsIdentite,
  type DocumentIdentiteDetail,
} from "@/services/documents_identite";
import type { Utilisateur } from "@/types/api";

// ---------- Types ----------

export type IdEtapeVerification =
  | "email"
  | "visage"
  | "cni"
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
  /** Nombre total de documents d'identité fournis (CNI + permis + assurance). */
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

const TYPES_DOCUMENT = ["cni", "permis", "assurance"] as const;
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
  documents: DocumentIdentiteDetail[],
  type: TypeDocumentIdentite,
): DocumentIdentiteDetail[] {
  return documents.filter((doc) => doc.type_document === type);
}

/**
 * Choisit le document le plus représentatif d'un type : le premier encore
 * valide, sinon le premier de la liste (triée par `modifie_le` décroissant).
 */
function choisirDocument(
  documents: DocumentIdentiteDetail[],
  type: TypeDocumentIdentite,
): DocumentIdentiteDetail | null {
  const duType = documentsDuType(documents, type);
  if (duType.length === 0) return null;
  return duType.find((doc) => !documentExpire(doc.date_expiration)) ?? duType[0];
}

/** Référence lisible d'un document (n° de permis, de contrat, de carte…). */
function referenceDocument(doc: DocumentIdentiteDetail): string | undefined {
  return (
    doc.numero_document ??
    doc.numero_permis ??
    doc.numero_contrat ??
    undefined
  );
}

function construireEtapeDocument(
  documents: DocumentIdentiteDetail[],
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
  };
}

function niveauDepuis(completees: number): NiveauVerification {
  if (completees === 0) return "aucune";
  if (completees <= 2) return "partielle";
  if (completees <= 4) return "renforcee";
  return "complete";
}

function construireEtapeCni(
  utilisateur: Utilisateur,
  documents: DocumentIdentiteDetail[],
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
    };
  }

  const doc = choisirDocument(documents, "cni");
  if (doc) {
    const expire = documentExpire(doc.date_expiration);
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
  };
}

export function construireEtapesVerification(
  utilisateur: Utilisateur,
  documents: DocumentIdentiteDetail[],
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
  const [documents, setDocuments] = useState<DocumentIdentiteDetail[]>([]);
  const [chargement, setChargement] = useState(actif);

  const charger = useCallback(async () => {
    if (!actif || !utilisateur) {
      if (!actif) setChargement(false);
      return;
    }
    try {
      const reponse = await listerDocumentsIdentite();
      setDocuments(reponse.documents ?? []);
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
        documentsFournis: 0,
        chargement,
      };
    }

    const etapes = construireEtapesVerification(utilisateur, documents);
    const completees = etapes.filter((etape) => etape.statut === "complete").length;
    const total = etapes.length;

    return {
      etapes,
      completees,
      total,
      pourcentage: total > 0 ? Math.round((completees / total) * 100) : 0,
      niveau: niveauDepuis(completees),
      identiteVerifiee: Boolean(
        utilisateur.est_cni_verifiee && utilisateur.est_visage_verifie,
      ),
      documentsFournis: documents.length,
      chargement,
    };
  }, [utilisateur, documents, chargement]);
}

export default useEtatVerifications;
