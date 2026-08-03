"use client";

/**
 * Page Documents d'Identité — CNI, Permis de Conduire, Assurance.
 * Affiche un bouton de redirection vers l'upload si le document n'existe pas,
 * ou les données avec option de modification si présent.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { useNotifications } from "@/contextes/notifications";
import { ErreurAPI } from "@/services/client_api";

// Services pour la CNI et la logique de formulaire
import {
  listerDocumentsIdentite,
  ajouterDocumentIdentite,
  modifierDocumentIdentite,
  supprimerDocumentIdentite,
  champsParType,
  champsOfficielsDocument,
  LIBELLES_TYPE_DOCUMENT,
  ICONES_TYPE_DOCUMENT,
  COULEURS_TYPE_DOCUMENT,
  COULEURS_BORDURE,
  OPTIONS_COUVERTURE,
  OPTIONS_SEXE,
  type DocumentIdentiteDetail,
  type DocumentIdentitePayload,
} from "@/services/documents_identite";

// NOUVEAUX SERVICES DÉDIÉS
import { obtenirHistoriquePermis, type VerificationPermisDetail } from "@/services/permis_conduire";
import { obtenirHistoriqueAssurance, type VerificationAssuranceDetail } from "@/services/assurance_auto";

type OngletType = "cni" | "permis" | "assurance";

const CHAMPS_OBLIGATOIRES: Record<OngletType, string[]> = {
  cni: ["nom_complet", "numero_document", "nationalite"],
  permis: ["nom_complet", "numero_permis", "categories_permis"],
  assurance: ["compagnie_assurance", "type_couverture", "numero_contrat", "date_expiration"],
};

const LIBELLES_CHAMPS: Record<string, string> = {
  nom_complet: "Nom complet",
  numero_document: "Numéro du document",
  nationalite: "Nationalité",
  numero_permis: "Numéro du permis",
  categories_permis: "Catégories de permis",
  compagnie_assurance: "Compagnie d'assurance",
  type_couverture: "Type de couverture",
  numero_contrat: "Numéro de contrat",
  date_expiration: "Date d'expiration",
};

export default function PageDocumentsIdentite() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
        "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical",
        "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine",
        "administrateur", "super_administrateur"
      ]}
    >
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [documents, setDocuments] = useState<DocumentIdentiteDetail[]>([]);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState<OngletType>("cni");
  const [editionId, setEditionId] = useState<string | null>(null);

  const chargerDocuments = useCallback(async () => {
    setChargement(true);
    try {
      // 1. Récupérer la CNI
      const resCni = await listerDocumentsIdentite();
      const docsCni = resCni.documents.filter((d: any) => d.type_document === "cni");

      // 2. Récupérer le Permis
      let docPermis: DocumentIdentiteDetail | null = null;
      try {
        const resPermis = await obtenirHistoriquePermis(1);
        if (resPermis.historique.length > 0) {
          const p = resPermis.historique[0];
          docPermis = {
            id: p.id,
            type_document: "permis",
            source: "ocr",
            a_ete_corrige: false,
            nom_complet: `${p.nom_famille || ""} ${p.prenoms || ""}`.trim(),
            numero_permis: p.numero_permis,
            categories_permis: p.categories?.join(", "),
            date_expiration: p.date_expiration,
            _off_numero_permis: p.numero_permis,
            _off_nom_famille: p.nom_famille,
            _off_prenoms: p.prenoms,
            _off_date_naissance: p.date_naissance,
            _off_lieu_naissance: p.lieu_naissance,
            _off_date_delivrance: p.date_delivrance,
            _off_date_expiration: p.date_expiration,
            _off_autorite_delivrance: p.autorite_delivrance,
            _off_categories: p.categories,
            cree_le: p.cree_le,
            modifie_le: p.cree_le,
          } as any;
        }
      } catch (e) {
        console.error("Erreur chargement permis:", e);
      }

      // 3. Récupérer l'Assurance
      let docAssurance: DocumentIdentiteDetail | null = null;
      try {
        const resAssurance = await obtenirHistoriqueAssurance(1);
        if (resAssurance.historique.length > 0) {
          const a = resAssurance.historique[0];
          docAssurance = {
            id: a.id,
            type_document: "assurance",
            source: "ocr",
            a_ete_corrige: false,
            compagnie_assurance: a.compagnie_assurance,
            numero_contrat: a.numero_contrat,
            _off_nom_famille: a.nom_famille,
            _off_prenoms: a.prenoms,
            _off_date_naissance: a.date_naissance,
            _off_lieu_naissance: a.lieu_naissance,
            _off_date_delivrance: a.date_delivrance,
            date_expiration: a.date_expiration,
            _off_compagnie: a.compagnie_assurance,
            _off_numero_contrat: a.numero_contrat,
            _off_immatriculation: a.immatriculation_vehicule,
            _off_date_expiration: a.date_expiration,
            cree_le: a.cree_le,
            modifie_le: a.cree_le,
          } as any;
        }
      } catch (e) {
        console.error("Erreur chargement assurance:", e);
      }

      setDocuments([
        ...docsCni,
        ...(docPermis ? [docPermis] : []),
        ...(docAssurance ? [docAssurance] : []),
      ]);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement";
      notifier(msg, "erreur");
    } finally {
      setChargement(false);
    }
  }, [notifier]);

  useEffect(() => {
    chargerDocuments();
  }, [chargerDocuments]);

  const docCourant = documents.find((d) => d.type_document === onglet);
  const aUnDocument = !!docCourant;

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon identité</p>
        <h1 className="mt-1">Mes documents d'identité</h1>
        <p className="text-ardoise-clair mt-2 max-w-3xl">
          Consulte les données officielles extraites automatiquement par l'OCR. 
          Ces informations sont verrouillées pour garantir l'intégrité et la traçabilité de ton identité numérique.
        </p>
      </header>

      {/* Onglets */}
      <div className="flex gap-2 border-b border-ardoise-clair/10 pb-2 overflow-x-auto">
        {(["cni", "permis", "assurance"] as const).map((type) => {
          const doc = documents.find((d) => d.type_document === type);
          return (
            <button
              key={type}
              onClick={() => { setOnglet(type); setEditionId(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition-all whitespace-nowrap text-sm font-medium ${
                onglet === type
                  ? "bg-ocre/10 text-ocre border-b-2 border-ocre"
                  : "text-ardoise-clair hover:text-ardoise hover:bg-sable"
              }`}
            >
              <span className="text-lg">{ICONES_TYPE_DOCUMENT[type]}</span>
              <span>{LIBELLES_TYPE_DOCUMENT[type]}</span>
              {doc && <Badge variante="succes" taille="petit">✓</Badge>}
            </button>
          );
        })}
      </div>

      {chargement ? (
        <p className="text-center text-ardoise-clair italic py-8">Chargement de tes documents...</p>
      ) : (
        <>
          {/* ✅ REDIRECTION VERS L'UPLOAD SI AUCUN DOCUMENT */}
          {!aUnDocument ? (
            <Alerte variante="info" titre={`Aucun ${LIBELLES_TYPE_DOCUMENT[onglet].toLowerCase()} enregistré`}>
              <p className="mb-4">
                Tu n'as pas encore scanné ce document. Les données seront extraites automatiquement 
                et de manière sécurisée via notre moteur OCR.
              </p>
              <Bouton 
                variante="primaire" 
                onClick={() => {
                  const lien = onglet === "permis" 
                    ? "/permis-conduire" 
                    : onglet === "assurance" 
                    ? "/assurance-auto" 
                    : "/verification-cni";
                  window.location.href = lien;
                }}
              >
                📷 Scanner mon document
              </Bouton>
            </Alerte>
          ) : (
            /* ✅ AFFICHAGE ET MODIFICATION SI DOCUMENT PRÉSENT */
            <>
              <VueDocument
                document={docCourant!}
                onModifier={() => setEditionId(docCourant!.id)}
                onSupprimer={async () => {
                  await supprimerDocumentIdentite(docCourant!.id);
                  notifier("Document supprimé", "info");
                  chargerDocuments();
                }}
                notifier={notifier}
              />

              {editionId && (
                <FormulaireDocument
                  typeDocument={onglet}
                  document={docCourant!}
                  onSauvegarder={async (donnees) => {
                    try {
                      await modifierDocumentIdentite(editionId, donnees);
                      notifier("Document mis à jour avec succès", "succes");
                      setEditionId(null);
                      chargerDocuments();
                    } catch (e) {
                      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
                      notifier(msg, "erreur");
                    }
                  }}
                  onAnnuler={() => setEditionId(null)}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Vue d'un document existant
// =============================================================================
function VueDocument({
  document: doc,
  onModifier,
  onSupprimer,
  notifier,
}: {
  document: DocumentIdentiteDetail;
  onModifier: () => void;
  onSupprimer: () => Promise<void>;
  notifier: (msg: string, type: "succes" | "erreur" | "info") => void;
}) {
  const champs = champsParType(doc.type_document);
  const champsOfficielsOriginaux = doc.type_document === "cni" ? champsOfficielsDocument() : [];
  
  const modifDate = new Date(doc.modifie_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // Champs officiels spécifiques au Permis et à l'Assurance
  const champsOfficielsSpecifiques = 
    doc.type_document === "permis" ? [
      { key: "_off_numero_permis", libelle: "N° Permis (extrait)" },
      { key: "_off_nom_famille", libelle: "Nom (extrait)", compare: true },
      { key: "_off_prenoms", libelle: "Prénoms (extrait)", compare: true },
      { key: "_off_date_naissance", libelle: "Date de naissance", isDate: true },
      { key: "_off_lieu_naissance", libelle: "Lieu de naissance" },
      { key: "_off_date_delivrance", libelle: "Délivré le", isDate: true },
      { key: "_off_date_expiration", libelle: "Expire le", isDate: true, checkExpiration: true },
      { key: "_off_autorite_delivrance", libelle: "Autorité de délivrance" },
      { key: "_off_categories", libelle: "Catégories", isList: true },
    ] : doc.type_document === "assurance" ? [
      { key: "_off_compagnie", libelle: "Compagnie (extraite)" },
      { key: "_off_numero_contrat", libelle: "N° Contrat (extrait)" },
      { key: "_off_immatriculation", libelle: "Immatriculation (extraite)" },
      { key: "_off_nom_famille", libelle: "Nom (extrait)", compare: true },
      { key: "_off_prenoms", libelle: "Prénoms (extrait)", compare: true },
      { key: "_off_date_naissance", libelle: "Date de naissance", isDate: true },
      { key: "_off_lieu_naissance", libelle: "Lieu de naissance" },
      { key: "_off_date_delivrance", libelle: "Délivré le", isDate: true },
      { key: "_off_date_expiration", libelle: "Valable jusqu'au", isDate: true, checkExpiration: true },
    ] : [];

  const tousChampsOfficiels = [...champsOfficielsOriginaux, ...champsOfficielsSpecifiques];

  return (
    <div className={`carte border-l-4 ${COULEURS_BORDURE[doc.type_document]}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_TYPE_DOCUMENT[doc.type_document]}`}>
              {ICONES_TYPE_DOCUMENT[doc.type_document]} {doc.source === "ocr" ? "Extrait par OCR" : "Saisi manuellement"}
            </span>
            {doc.a_ete_corrige && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                ⚠️ Corrigé manuellement
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Bouton variante="secondaire" taille="petit" onClick={onModifier}>
            ✏️ Modifier
          </Bouton>
          <Bouton variante="danger" taille="petit" onClick={async () => {
            if (confirm(`Supprimer ce ${LIBELLES_TYPE_DOCUMENT[doc.type_document].toLowerCase()} ?`)) await onSupprimer();
          }}>
            🗑️ Supprimer
          </Bouton>
        </div>
      </div>

      {/* Grille des champs MODIFIABLES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {champs.map((champ) => {
          const valeur = (doc as any)[champ.key];
          if (!valeur && valeur !== 0) return null;
          return (
            <div key={champ.key} className="bg-sable rounded-lg p-3">
              <p className="text-xs text-ardoise-clair font-medium uppercase tracking-wider mb-1">{champ.libelle}</p>
              <p className="text-sm font-medium text-ardoise">
                {champ.key === "sexe" ? (valeur === "M" ? "Masculin" : valeur === "F" ? "Féminin" : valeur) : String(valeur)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Grille des champs OFFICIELS (Lecture seule) */}
      {tousChampsOfficiels.length > 0 && (
        <div className="mt-6 pt-6 border-t border-ardoise-clair/10">
          <p className="text-xs uppercase text-ardoise-clair font-semibold mb-3 flex items-center gap-2">
            <span>🔒</span>
            <span>Données officielles du document (non modifiables)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tousChampsOfficiels.map((champ: any) => {
              const valeur = (doc as any)[champ.key];
              if (!valeur) return null;
              
              let valeurAffichee = String(valeur);
              
              if (champ.isDate) {
                try {
                  const date = new Date(valeur);
                  valeurAffichee = date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
                } catch { /* ignore */ }
              }
              
              let alerteExpiration = null;
              if (champ.checkExpiration) {
                try {
                  const dateExp = new Date(valeur);
                  const joursRestants = Math.ceil((dateExp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  if (joursRestants < 0) {
                    alerteExpiration = <span className="text-xs text-red-600 font-semibold ml-2">️ Expiré</span>;
                  } else if (joursRestants < 90) {
                    alerteExpiration = <span className="text-xs text-amber-600 font-semibold ml-2">⚠️ Expire dans {joursRestants} j.</span>;
                  }
                } catch { /* ignore */ }
              }
              
              return (
                <div key={champ.key} className="bg-sable/50 rounded-lg p-3 border border-ardoise-clair/10">
                  <p className="text-xs text-ardoise-clair font-medium uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>🔒</span> {champ.libelle}
                  </p>
                  <p className="text-sm font-medium text-ardoise">{valeurAffichee} {alerteExpiration}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ardoise-clair italic mt-3">
            💡 Ces données sont extraites automatiquement. Utilise le bouton "Modifier" ci-dessus pour corriger les champs autorisés.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-ardoise-clair border-t border-ardoise-clair/10 pt-4">
        <span>Créé le {new Date(doc.cree_le).toLocaleDateString("fr-FR")}</span>
        <span>Modifié le {modifDate}</span>
      </div>
    </div>
  );
}

// =============================================================================
// Formulaire d'édition
// =============================================================================
function FormulaireDocument({
  typeDocument,
  document,
  onSauvegarder,
  onAnnuler,
}: {
  typeDocument: OngletType;
  document: DocumentIdentiteDetail | null | undefined;
  onSauvegarder: (donnees: Partial<DocumentIdentitePayload>) => Promise<void>;
  onAnnuler: () => void;
}) {
  const champs = useMemo(() => champsParType(typeDocument), [typeDocument]);
  const [valeurs, setValeurs] = useState<Record<string, any>>({});
  const [sauvegarde, setSauvegarde] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const obligatoires = CHAMPS_OBLIGATOIRES[typeDocument];

  useEffect(() => {
    const initiales: Record<string, any> = {};
    champs.forEach((c) => {
      initiales[c.key] = document ? (document as any)[c.key] ?? "" : "";
    });
    setValeurs(initiales);
    setErreurs({});
  }, [document, typeDocument, champs]);

  function setValeur(key: string, valeur: any) {
    setValeurs((v) => ({ ...v, [key]: valeur }));
    if (erreurs[key]) {
      setErreurs((prev) => {
        const copie = { ...prev };
        delete copie[key];
        return copie;
      });
    }
  }

  function validerFormulaire(): boolean {
    const nouvellesErreurs: Record<string, string> = {};
    for (const champKey of obligatoires) {
      const valeur = valeurs[champKey];
      if (!valeur || (typeof valeur === "string" && valeur.trim() === "")) {
        nouvellesErreurs[champKey] = `${LIBELLES_CHAMPS[champKey] || champKey} est obligatoire`;
      }
    }
    setErreurs(nouvellesErreurs);
    return Object.keys(nouvellesErreurs).length === 0;
  }

  async function soumettre() {
    if (!validerFormulaire()) return;
    setSauvegarde(true);
    try {
      const donnees: Record<string, any> = {};
      for (const [key, valeur] of Object.entries(valeurs)) {
        if (valeur !== "" && valeur !== null) {
          donnees[key] = key === "taille_cm" || key === "annee_vehicule" ? Number(valeur) : valeur;
        }
      }
      await onSauvegarder(donnees);
    } finally {
      setSauvegarde(false);
    }
  }

  return (
    <Carte titre={`✏️ Corriger ${LIBELLES_TYPE_DOCUMENT[typeDocument].toLowerCase()}`}>
      <p className="text-sm text-ardoise-clair mb-4">
        Les données ont été extraites automatiquement. Corrige uniquement les champs modifiables ci-dessous si l'OCR a fait une erreur.
      </p>

      {Object.keys(erreurs).length > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700 mb-1">⚠️ Champs obligatoires manquants :</p>
          <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
            {Object.entries(erreurs).map(([key, message]) => <li key={key}>{message}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {champs.map((champ) => {
          const valeur = valeurs[champ.key] ?? "";
          const estObligatoire = obligatoires.includes(champ.key);
          const aErreur = !!erreurs[champ.key];
          
          if (champ.type_champ === "select") {
            const options = champ.key === "sexe" ? OPTIONS_SEXE : champ.key === "type_couverture" ? OPTIONS_COUVERTURE : [];
            return (
              <div key={champ.key}>
                <label className="block text-xs font-medium text-ardoise mb-1">
                  {champ.libelle} {estObligatoire && <span className="text-red-500">*</span>}
                </label>
                <select
                  value={valeur}
                  onChange={(e) => setValeur(champ.key, e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:ring-2 outline-none ${aErreur ? "border-red-400" : "border-ardoise-clair/20 focus:border-ocre"}`}
                >
                  <option value="">— Choisir —</option>
                  {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            );
          }
          
          return (
            <div key={champ.key}>
              <label className="block text-xs font-medium text-ardoise mb-1">
                {champ.libelle} {estObligatoire && <span className="text-red-500">*</span>}
              </label>
              <input
                type={champ.type_champ}
                value={valeur}
                onChange={(e) => setValeur(champ.key, e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:ring-2 outline-none ${aErreur ? "border-red-400" : "border-ardoise-clair/20 focus:border-ocre"}`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-ardoise-clair/10">
        <Bouton variante="primaire" onClick={soumettre} chargement={sauvegarde}>💾 Enregistrer les corrections</Bouton>
        <Bouton variante="secondaire" onClick={onAnnuler}>Annuler</Bouton>
      </div>
    </Carte>
  );
}