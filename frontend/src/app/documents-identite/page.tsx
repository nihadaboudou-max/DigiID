"use client";
/**
 * Page Documents d'Identité — CNI, Permis de Conduire, Assurance.
 * L'utilisateur :
 *   - Saisit/modifie ses informations d'identité
 *   - Peut corriger les champs mal extraits par l'OCR
 *   - Voit l'impact sur son score
 *   - Les modifications récentes réduisent temporairement le score (stabilité)
 */
import { useCallback, useEffect, useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { useNotifications } from "@/contextes/notifications";
import {
  listerDocumentsIdentite,
  ajouterDocumentIdentite,
  modifierDocumentIdentite,
  supprimerDocumentIdentite,
  champsParType,
  LIBELLES_TYPE_DOCUMENT,
  ICONES_TYPE_DOCUMENT,
  COULEURS_TYPE_DOCUMENT,
  COULEURS_BORDURE,
  OPTIONS_COUVERTURE,
  OPTIONS_SEXE,
  type DocumentIdentiteDetail,
  type DocumentIdentitePayload,
} from "@/services/documents_identite";
import { ErreurAPI } from "@/services/client_api";

type OngletType = "cni" | "permis" | "assurance";

// =============================================================================
// Champs obligatoires par type de document
// =============================================================================
const CHAMPS_OBLIGATOIRES: Record<OngletType, string[]> = {
  cni: ["nom_complet", "date_naissance", "numero_document", "nationalite"],
  permis: ["nom_complet", "date_naissance", "numero_permis", "categories_permis"],
  assurance: ["compagnie_assurance", "type_couverture", "numero_contrat", "date_expiration"],
};

// Libellés lisibles pour les messages d'erreur
const LIBELLES_CHAMPS: Record<string, string> = {
  nom_complet: "Nom complet",
  date_naissance: "Date de naissance",
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
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong"]}>
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
    try {
      const resultat = await listerDocumentsIdentite();
      setDocuments(resultat.documents);
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
      {/* En-tête */}
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Mon identité
        </p>
        <h1 className="mt-1">Mes documents d'identité</h1>
        <p className="text-ardoise-clair mt-2 max-w-3xl">
          Ajoute tes documents d'identité (CNI, Permis de Conduire, Assurance)
          pour renforcer ton profil. Tu peux corriger chaque champ à tout moment.
          Plus tes documents sont stables (pas de modifications récentes),
          plus ton score de confiance est élevé.
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
          {aUnDocument ? (
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
          ) : (
            <Alerte variante="info" titre={`Ajoute ta ${LIBELLES_TYPE_DOCUMENT[onglet].toLowerCase()}`}>
              Tu n&apos;as pas encore enregistré ce document. Clique ci-dessous pour le renseigner.
              Les données que tu fournis sont privées et sécurisées.
            </Alerte>
          )}

          {/* Formulaire */}
          {editionId || !aUnDocument ? (
            <FormulaireDocument
              typeDocument={onglet}
              document={editionId ? docCourant : null}
              onSauvegarder={async (donnees) => {
                try {
                  if (editionId) {
                    await modifierDocumentIdentite(editionId, donnees);
                    notifier("Document mis à jour", "succes");
                  } else {
                    await ajouterDocumentIdentite({ ...donnees, type_document: onglet });
                    notifier(`${LIBELLES_TYPE_DOCUMENT[onglet]} ajouté`, "succes");
                  }
                  setEditionId(null);
                  chargerDocuments();
                } catch (e) {
                  const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur";
                  notifier(msg, "erreur");
                }
              }}
              onAnnuler={() => setEditionId(null)}
            />
          ) : (
            <div className="text-center">
              <Bouton
                variante="primaire"
                onClick={() => setEditionId(docCourant!.id)}
              >
                ✏️ Modifier les informations
              </Bouton>
            </div>
          )}

          {/* Impact score */}
          <Carte variante="pointilles" titre=" Impact sur ton score">
            <div className="space-y-2 text-sm">
              <p className="text-ardoise">
                Chaque document d&apos;identité que tu renseignes améliore ton score :
              </p>
              <ul className="space-y-1.5 text-ardoise-clair">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-lagune" />
                  <strong>CNI présente</strong> — jusqu&apos;à <strong className="text-lagune">4 pts</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <strong>Permis de conduire</strong> — jusqu&apos;à <strong className="text-amber-600">3 pts</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <strong>Assurance</strong> — jusqu&apos;à <strong className="text-green-600">2 pts</strong>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-lagune" />
                  <strong>Stabilité</strong> — pas de modification depuis 3 mois → <strong className="text-lagune">2 pts</strong>
                </li>
              </ul>
              <p className="text-xs text-ardoise-clair italic mt-3">
                Total possible pour les documents : <strong>11 pts</strong> sur 20 dédiés à l&apos;identité.
                Les champs mal extraits par l&apos;OCR peuvent être corrigés ici.
              </p>
            </div>
          </Carte>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Vue d'un document existant (lecture)
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
  const sourceLabel = doc.source === "ocr" ? "Extrait par OCR" : "Saisi manuellement";
  const modifDate = new Date(doc.modifie_le).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
  const modifDays = Math.floor((Date.now() - new Date(doc.modifie_le).getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className={`carte border-l-4 ${COULEURS_BORDURE[doc.type_document]}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COULEURS_TYPE_DOCUMENT[doc.type_document]}`}>
              {ICONES_TYPE_DOCUMENT[doc.type_document]} {sourceLabel}
            </span>
            {doc.a_ete_corrige && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                ⚠️ Corrigé
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Bouton variante="secondaire" taille="petit" onClick={onModifier}>
            ✏️ Modifier
          </Bouton>
          <Bouton
            variante="danger"
            taille="petit"
            onClick={async () => {
              if (confirm(`Supprimer ce ${LIBELLES_TYPE_DOCUMENT[doc.type_document].toLowerCase()} ?`)) {
                await onSupprimer();
              }
            }}
          >
            🗑️ Supprimer
          </Bouton>
        </div>
      </div>

      {/* Grille des champs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {champs.map((champ) => {
          const valeur = (doc as any)[champ.key];
          if (!valeur && valeur !== 0) return null;
          return (
            <div key={champ.key} className="bg-sable rounded-lg p-3">
              <p className="text-xs text-ardoise-clair font-medium uppercase tracking-wider mb-1">
                {champ.libelle}
              </p>
              <p className="text-sm font-medium text-ardoise">
                {champ.key === "sexe" ? (valeur === "M" ? "Masculin" : valeur === "F" ? "Féminin" : valeur) : String(valeur)}
              </p>
            </div>
          );
        })}
      </div>

      {/* Métadonnées */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-ardoise-clair border-t border-ardoise-clair/10 pt-4">
        <span>Créé le {new Date(doc.cree_le).toLocaleDateString("fr-FR")}</span>
        <span>Modifié le {modifDate}</span>
        <span>
          Stabilité : {modifDays < 30 ? (
            <Badge variante="neutre" taille="petit">Récemment modifié</Badge>
          ) : modifDays < 90 ? (
            <Badge variante="ocre" taille="petit">Stable</Badge>
          ) : (
            <Badge variante="succes" taille="petit">Très stable ✓</Badge>
          )}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// Formulaire d'édition / création
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
  const champs = champsParType(typeDocument);
  const [valeurs, setValeurs] = useState<Record<string, any>>({});
  const [sauvegarde, setSauvegarde] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const obligatoires = CHAMPS_OBLIGATOIRES[typeDocument];

  useEffect(() => {
    if (document) {
      const initiales: Record<string, any> = {};
      champs.forEach((c) => {
        initiales[c.key] = (document as any)[c.key] ?? "";
      });
      setValeurs(initiales);
    } else {
      const initiales: Record<string, any> = {};
      champs.forEach((c) => { initiales[c.key] = ""; });
      setValeurs(initiales);
    }
    setErreurs({});
  }, [document, champs]);

  function setValeur(key: string, valeur: any) {
    setValeurs((v) => ({ ...v, [key]: valeur }));
    // Supprimer l'erreur dès que l'utilisateur modifie le champ
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
        const libelle = LIBELLES_CHAMPS[champKey] || champKey;
        nouvellesErreurs[champKey] = `${libelle} est obligatoire`;
      }
    }

    setErreurs(nouvellesErreurs);
    return Object.keys(nouvellesErreurs).length === 0;
  }

  async function soumettre() {
    if (!validerFormulaire()) {
      return;
    }

    setSauvegarde(true);
    try {
      // Nettoyer les valeurs vides
      const donnees: Record<string, any> = {};
      for (const [key, valeur] of Object.entries(valeurs)) {
        if (valeur !== "" && valeur !== null) {
          donnees[key] = key === "taille_cm" || key === "annee_vehicule"
            ? Number(valeur)
            : valeur;
        }
      }
      await onSauvegarder(donnees);
    } finally {
      setSauvegarde(false);
    }
  }

  const nombreErreurs = Object.keys(erreurs).length;

  return (
    <Carte titre={document ? `✏️ Corriger ${LIBELLES_TYPE_DOCUMENT[typeDocument].toLowerCase()}` : `➕ Ajouter ${LIBELLES_TYPE_DOCUMENT[typeDocument].toLowerCase()}`}>
      <p className="text-sm text-ardoise-clair mb-4">
        {document?.source === "ocr"
          ? "Les données ont été extraites automatiquement. Corrige les champs mal lus."
          : "Renseigne les informations de ton document."}
      </p>

      {/* Indicateur de champs obligatoires */}
      <p className="text-xs text-ardoise-clair mb-6 flex items-center gap-2">
        <span className="text-red-500 font-bold">*</span>
        <span>Champs obligatoires pour {LIBELLES_TYPE_DOCUMENT[typeDocument]}</span>
      </p>

      {/* Alerte d'erreurs */}
      {nombreErreurs > 0 && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-700 mb-1">
            ️ {nombreErreurs} champ{nombreErreurs > 1 ? "s" : ""} obligatoire{nombreErreurs > 1 ? "s" : ""} manquant{nombreErreurs > 1 ? "s" : ""} :
          </p>
          <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
            {Object.entries(erreurs).map(([key, message]) => (
              <li key={key}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {champs.map((champ) => {
          const valeur = valeurs[champ.key] ?? "";
          const estObligatoire = obligatoires.includes(champ.key);
          const aErreur = !!erreurs[champ.key];

          if (champ.type_champ === "select") {
            const options = champ.key === "sexe" ? OPTIONS_SEXE
              : champ.key === "type_couverture" ? OPTIONS_COUVERTURE
              : [];
            return (
              <div key={champ.key}>
                <label className="block text-xs font-medium text-ardoise mb-1">
                  {champ.libelle}
                  {estObligatoire && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <select
                  value={valeur}
                  onChange={(e) => setValeur(champ.key, e.target.value)}
                  required={estObligatoire}
                  className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:ring-2 outline-none ${
                    aErreur
                      ? "border-red-400 focus:ring-red-300 focus:border-red-500"
                      : estObligatoire
                      ? "border-ocre/40 focus:ring-ocre/50 focus:border-ocre"
                      : "border-ardoise-clair/20 focus:ring-ocre/50 focus:border-ocre"
                  }`}
                >
                  <option value="">
                    {estObligatoire ? `— Choisir ${champ.libelle} —` : "— Non renseigné —"}
                  </option>
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {aErreur && (
                  <p className="text-xs text-red-500 mt-1">{erreurs[champ.key]}</p>
                )}
              </div>
            );
          }

          return (
            <div key={champ.key}>
              <label className="block text-xs font-medium text-ardoise mb-1">
                {champ.libelle}
                {estObligatoire && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              <input
                type={champ.type_champ}
                value={valeur}
                onChange={(e) => setValeur(champ.key, e.target.value)}
                placeholder={estObligatoire ? `${champ.libelle} (obligatoire)` : champ.libelle}
                required={estObligatoire}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:ring-2 outline-none ${
                  aErreur
                    ? "border-red-400 focus:ring-red-300 focus:border-red-500"
                    : estObligatoire
                    ? "border-ocre/40 focus:ring-ocre/50 focus:border-ocre"
                    : "border-ardoise-clair/20 focus:ring-ocre/50 focus:border-ocre"
                }`}
              />
              {aErreur && (
                <p className="text-xs text-red-500 mt-1">{erreurs[champ.key]}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-6 pt-4 border-t border-ardoise-clair/10">
        <Bouton variante="primaire" onClick={soumettre} chargement={sauvegarde}>
          💾 Enregistrer
        </Bouton>
        <Bouton variante="secondaire" onClick={onAnnuler}>
          Annuler
        </Bouton>
      </div>
    </Carte>
  );
}
