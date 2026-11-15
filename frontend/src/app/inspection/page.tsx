"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  TypeDocument,
  StatutVerification,
  DetailVerification,
  ReponseDocumentUnifie,
} from "@/types/inspection";
import {
  uploadDocument,
  obtenirHistorique,
  supprimerVerification,
} from "@/services/inspectionApi";
import {
  IconeFlecheRetour,
  IconeIdentite,
  IconeMoins,
  IconePlus,
  IconeScan,
  IconeVue,
} from "@/composants/commun/Icones";

const LIMITE_HISTORIQUE = 5;

const LIBELLES_TYPE_DOCUMENT: Record<TypeDocument, string> = {
  [TypeDocument.CNI_BIOMETRIQUE]: "CNI biométrique",
  [TypeDocument.CNI_PAPIER]: "CNI papier",
  [TypeDocument.CIP]: "CIP",
  [TypeDocument.PASSEPORT]: "Passeport",
  [TypeDocument.PERMIS_CONDUIRE]: "Permis de conduire",
  [TypeDocument.CARTE_ASSURANCE]: "Carte d'assurance",
  [TypeDocument.CARTE_SEJOUR]: "Carte de séjour",
  [TypeDocument.CARTE_GRISE]: "Carte grise",
  [TypeDocument.CARTE_CONSULAIRE]: "Carte consulaire",
  [TypeDocument.CARTE_VOTE]: "Carte de vote",
  [TypeDocument.CARTE_ETUDIANT]: "Carte étudiant",
  [TypeDocument.INCONNU]: "Document non reconnu",
};

const OPTIONS_TYPE_DOCUMENT = Object.entries(LIBELLES_TYPE_DOCUMENT)
  .filter(([type]) => type !== TypeDocument.INCONNU)
  .map(([valeur, libelle]) => ({
    valeur: valeur as TypeDocument,
    libelle,
  }));

type EtatDocument = "lu" | "a-verifier" | "illisible";

const AFFICHAGE_ETAT: Record<
  EtatDocument,
  { libelle: string; classe: string; explication: string }
> = {
  lu: {
    libelle: "Document lu",
    classe: "border-green-300 bg-green-50 text-green-900",
    explication:
      "Les informations ont été lues ; vérifiez-les avant de les utiliser.",
  },
  "a-verifier": {
    libelle: "À vérifier",
    classe: "border-orange-300 bg-orange-50 text-orange-900",
    explication:
      "Vérifiez les informations détectées et la date de validité.",
  },
  illisible: {
    libelle: "Document non lisible",
    classe: "border-red-300 bg-red-50 text-red-900",
    explication:
      "La photo est difficile à lire ; reprenez-la avec plus de lumière.",
  },
};

function etatPourStatut(statut: string): EtatDocument {
  if (statut === "approuve") return "lu";
  if (statut === "rejete") return "illisible";
  return "a-verifier";
}

function valeurTexte(valeur: unknown): string {
  if (typeof valeur === "string" || typeof valeur === "number") {
    return String(valeur);
  }
  if (Array.isArray(valeur)) {
    return valeur.map(valeurTexte).filter(Boolean).join(", ");
  }
  return "";
}

function premierChamp(
  donnees: Record<string, unknown>,
  cles: string[]
): string {
  for (const cle of cles) {
    const valeur = valeurTexte(donnees[cle]);
    if (valeur) return valeur;
  }
  return "";
}

function nomComplet(donnees: Record<string, unknown>): string {
  const nom = premierChamp(donnees, ["nom_complet"]);
  if (nom) return nom;
  return [
    premierChamp(donnees, ["nom_famille", "nom"]),
    premierChamp(donnees, ["prenoms", "prenom"]),
  ]
    .filter(Boolean)
    .join(" ");
}

function libelleType(type: TypeDocument): string {
  return LIBELLES_TYPE_DOCUMENT[type] ?? type;
}

function libelleStatutHistorique(statut: StatutVerification): string {
  return AFFICHAGE_ETAT[etatPourStatut(statut)].libelle;
}

function classeStatutHistorique(statut: StatutVerification): string {
  return AFFICHAGE_ETAT[etatPourStatut(statut)].classe;
}

export default function PageInspectionDocument() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [typeDocument, setTypeDocument] = useState<TypeDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReponseDocumentUnifie | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historique, setHistorique] = useState<DetailVerification[]>([]);
  const [loadingHistorique, setLoadingHistorique] = useState(true);
  const [errorHistorique, setErrorHistorique] = useState<string | null>(null);
  const [totalHistorique, setTotalHistorique] = useState(0);
  const [pageHistorique, setPageHistorique] = useState(1);
  const [detailsOuverts, setDetailsOuverts] = useState<string | null>(null);
  const inputFichierRef = useRef<HTMLInputElement>(null);

  const nombrePages = Math.max(
    1,
    Math.ceil(totalHistorique / LIMITE_HISTORIQUE)
  );

  const chargerHistorique = async (page: number) => {
    setLoadingHistorique(true);
    setErrorHistorique(null);
    try {
      const data = await obtenirHistorique(
        LIMITE_HISTORIQUE,
        (page - 1) * LIMITE_HISTORIQUE
      );
      setHistorique(data.historique);
      setTotalHistorique(data.total);
    } catch (err) {
      setErrorHistorique(
        err instanceof Error
          ? err.message
          : "Impossible de charger l'historique."
      );
    } finally {
      setLoadingHistorique(false);
    }
  };

  useEffect(() => {
    void chargerHistorique(pageHistorique);
    // Le chargement initial est déclenché une seule fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageHistorique]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleAnalyse = async () => {
    if (!selectedFile) {
      setError("Choisissez une photo de votre document.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await uploadDocument(
        selectedFile,
        typeDocument || undefined,
        "recto"
      );
      setResult(response);
      setDetailsOuverts(null);
      if (pageHistorique === 1) {
        await chargerHistorique(1);
      } else {
        setPageHistorique(1);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'analyser ce document."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSupprimer = async (id: string) => {
    if (!confirm("Supprimer cette vérification ?")) return;
    try {
      await supprimerVerification(id);
      setDetailsOuverts(null);
      if (historique.length === 1 && pageHistorique > 1) {
        setPageHistorique(pageHistorique - 1);
      } else {
        await chargerHistorique(pageHistorique);
      }
    } catch (err) {
      setErrorHistorique(
        err instanceof Error
          ? err.message
          : "Impossible de supprimer cette vérification."
      );
    }
  };

  const recommencer = () => {
    setSelectedFile(null);
    setPreview(null);
    setTypeDocument(null);
    setResult(null);
    setError(null);
    if (inputFichierRef.current) inputFichierRef.current.value = "";
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 text-lg text-gray-900 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <div className="flex items-center gap-3 text-blue-700">
            <IconeIdentite aria-hidden="true" className="h-7 w-7" />
            <p className="font-semibold">Vérifier mon identité</p>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Mon document d'identité
          </h1>
          <p className="text-lg text-gray-700">
            Envoyez une photo de votre CNI, passeport ou permis. Nous lisons les
            informations pour vous.
          </p>
        </header>

        <section
          aria-labelledby="titre-analyse"
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h2 id="titre-analyse" className="text-2xl font-semibold text-gray-900">
            Envoyer une photo
          </h2>

          <input
            ref={inputFichierRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/tiff"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Choisir une photo de votre document"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => inputFichierRef.current?.click()}
              className="flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-blue-700 px-5 py-3 font-semibold text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
            >
              <IconePlus aria-hidden="true" />
              Choisir une photo
            </button>
            <button
              type="button"
              onClick={handleAnalyse}
              disabled={!selectedFile || loading}
              className="flex min-h-14 items-center justify-center gap-3 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              <IconeScan aria-hidden="true" />
              {loading ? "Analyse en cours…" : "Analyser"}
            </button>
          </div>

          {selectedFile && (
            <p className="text-base text-gray-700" aria-live="polite">
              Photo choisie : {selectedFile.name}
            </p>
          )}

          {preview && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 font-semibold text-gray-800">Aperçu de la photo</p>
              <img
                src={preview}
                alt="Aperçu du document choisi"
                className="max-h-80 w-full rounded-lg object-contain"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="type-document"
              className="mb-2 block font-semibold text-gray-800"
            >
              Type de document
            </label>
            <select
              id="type-document"
              value={typeDocument ?? ""}
              onChange={(event) =>
                setTypeDocument(
                  event.target.value
                    ? (event.target.value as TypeDocument)
                    : null
                )
              }
              className="min-h-14 w-full rounded-xl border-2 border-gray-300 bg-white px-4 py-3 text-lg focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700"
            >
              <option value="">Détection automatique</option>
              {OPTIONS_TYPE_DOCUMENT.map((option) => (
                <option key={option.valeur} value={option.valeur}>
                  {option.libelle}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={recommencer}
            className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-300 px-5 py-3 font-semibold text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            <IconeFlecheRetour aria-hidden="true" />
            Recommencer
          </button>

          {error && (
            <div
              role="alert"
              className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-900"
            >
              {error}
            </div>
          )}
        </section>

        {result && <ResultatAnalyse resultat={result} />}

        <section
          aria-labelledby="titre-historique"
          className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div>
            <h2 id="titre-historique" className="text-2xl font-semibold">
              Historique
            </h2>
            <p className="mt-1 text-gray-700">
              Retrouvez vos vérifications précédentes.
            </p>
          </div>

          {loadingHistorique ? (
            <p className="py-6 text-center text-gray-700" role="status">
              Chargement de l'historique…
            </p>
          ) : errorHistorique ? (
            <div
              role="alert"
              className="rounded-xl border-2 border-red-300 bg-red-50 p-4 text-red-900"
            >
              {errorHistorique}
            </div>
          ) : historique.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-4 py-6 text-center font-medium text-gray-700">
              Aucune vérification pour l'instant
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {historique.map((verification) => (
                  <article
                    key={verification.id}
                    className="space-y-3 rounded-xl border border-gray-200 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2">
                        <p className="font-semibold text-gray-900">
                          {new Date(verification.cree_le).toLocaleDateString(
                            "fr-FR",
                            { dateStyle: "long" }
                          )}
                        </p>
                        <p className="text-gray-700">
                          {libelleType(verification.type_document)}
                        </p>
                        <span
                          className={`inline-flex min-h-10 items-center rounded-full border px-4 py-1 font-semibold ${classeStatutHistorique(
                            verification.statut
                          )}`}
                        >
                          {libelleStatutHistorique(verification.statut)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setDetailsOuverts(
                            detailsOuverts === verification.id
                              ? null
                              : verification.id
                          )
                        }
                        aria-expanded={detailsOuverts === verification.id}
                        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-blue-700 px-5 py-3 font-semibold text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
                      >
                        <IconeVue aria-hidden="true" />
                        {detailsOuverts === verification.id
                          ? "Masquer les détails"
                          : "Détails"}
                      </button>
                    </div>

                    {detailsOuverts === verification.id && (
                      <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                        <p>
                          <span className="font-semibold">Nom : </span>
                          {[verification.nom_famille, verification.prenoms]
                            .filter(Boolean)
                            .join(" ") || "Non lu"}
                        </p>
                        <p>
                          <span className="font-semibold">Numéro : </span>
                          {verification.numero_document || "Non lu"}
                        </p>
                        <p>
                          <span className="font-semibold">
                            Date de naissance :{" "}
                          </span>
                          {verification.date_naissance || "Non lue"}
                        </p>
                        <p>
                          <span className="font-semibold">Confiance de lecture : </span>
                          {verification.taux_confiance_ocr.toFixed(1)} %
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleSupprimer(verification.id)}
                          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-red-700 px-5 py-3 font-semibold text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2"
                        >
                          <IconeMoins aria-hidden="true" />
                          Supprimer cette vérification
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              {nombrePages > 1 && (
                <nav
                  aria-label="Pagination de l'historique"
                  className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-4 sm:flex-row"
                >
                  <button
                    type="button"
                    onClick={() => setPageHistorique((page) => page - 1)}
                    disabled={pageHistorique <= 1 || loadingHistorique}
                    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-300 px-4 py-3 font-semibold text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    <IconeFlecheRetour aria-hidden="true" />
                    Précédent
                  </button>
                  <p className="font-semibold text-gray-800" aria-live="polite">
                    Page {pageHistorique} sur {nombrePages}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPageHistorique((page) => page + 1)}
                    disabled={
                      pageHistorique >= nombrePages || loadingHistorique
                    }
                    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-300 px-4 py-3 font-semibold text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    Suivant
                    <span aria-hidden="true">→</span>
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function ResultatAnalyse({
  resultat,
}: {
  resultat: ReponseDocumentUnifie;
}) {
  const etat = AFFICHAGE_ETAT[etatPourStatut(resultat.statut)];
  const donnees = resultat.donnees as Record<string, unknown>;
  const expiration = premierChamp(donnees, [
    "date_expiration",
    "date_expiration_date",
    "date_validite",
  ]);

  return (
    <section
      aria-labelledby="titre-resultat"
      aria-live="polite"
      className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 id="titre-resultat" className="text-2xl font-semibold">
        Résultat
      </h2>

      <div
        className={`flex min-h-16 items-center rounded-xl border-2 px-5 py-4 text-xl font-bold ${etat.classe}`}
      >
        {etat.libelle}
      </div>
      <p className="text-lg text-gray-800">{etat.explication}</p>

      <dl className="grid gap-4 sm:grid-cols-2">
        <ChampResultat label="Nom" valeur={nomComplet(donnees)} />
        <ChampResultat
          label="Numéro"
          valeur={premierChamp(donnees, [
            "numero_document",
            "numero_passeport",
            "numero_titre",
            "numero_immatriculation_consulaire",
            "npi",
          ])}
        />
        <ChampResultat
          label="Date de naissance"
          valeur={premierChamp(donnees, ["date_naissance"])}
        />
        <ChampResultat label="Validité" valeur={expiration} />
      </dl>
    </section>
  );
}

function ChampResultat({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <dt className="font-semibold text-gray-700">{label}</dt>
      <dd className="mt-1 break-words text-gray-950">{valeur || "Non détecté"}</dd>
    </div>
  );
}
