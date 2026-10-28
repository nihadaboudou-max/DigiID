"use client";
/**
 * Mon dossier professionnel logistique.
 *
 * Chaque acteur du transport (chauffeur, receveur ou gérant de gare) tient un
 * dossier vérifiable. Les agents de guichet indiquent aussi leur gare
 * d'appartenance afin que les remises de colis et d'enfants soient attribuées.
 *
 * Règle importante : **modifier un élément contrôlé remet le dossier en attente**.
 * On ne peut pas se faire valider puis changer discrètement d'immatriculation.
 *
 * L'OCR passe par l'**extraction universelle** (interface unique
 * `POST /api/v1/inspection-documents/upload`) : une seule route, une seule
 * réponse (`ReponseDocumentUnifie`) et **le type de document est détecté
 * automatiquement**. Une seule photo suffit pour chacun de vos documents — pièce
 * d'identité, permis, carte verte, carte grise… — au lieu des endpoints
 * individuels (`/permis/upload`, `/assurance/upload`…) qui obligeaient à choisir
 * le document à l'avance.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ChampOCR } from "@/composants/logistique/ChampOCR";
import { StatutVerification, UploadPhoto } from "@/composants/verification-visuelle";
import { useAuthentification } from "@/contextes/authentification";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { logistiqueAPI, type Gare } from "@/services/logistique_api";
import { uploadDocument } from "@/services/inspectionApi";
import { obtenirStatutVerification, type VerificationDetail } from "@/services/verification_visuelle";
import { TypeDocument } from "@/types/inspection";
import {
  identiteAPI,
  LIBELLES_CHAMPS_PROFIL,
  LIBELLES_VERIFICATION_PROFIL,
  type DonneesProfilLogistique,
  type ProfilLogistique,
  type TypeProfilLogistique,
} from "@/services/identite_api";

/** Rôles ayant un dossier professionnel logistique. */
const ROLES_PROFIL = [
  "chauffeur",
  "receveur",
  "gerant_gare",
  "commercant",
  "super_administrateur",
  "super_admin",
];

export default function PageMonDossierLogistique() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_PROFIL}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

const FORMULAIRE_VIDE: DonneesProfilLogistique = {
  type_profil: "chauffeur",
  gare_id: null,
  type_piece: "",
  numero_piece: "",
  permis_numero: "",
  permis_categorie: "",
  permis_expiration: null,
  vehicule_immatriculation: "",
  vehicule_marque: "",
  vehicule_modele: "",
  vehicule_capacite: null,
};

/**
 * Type de document choisi pour le scan. « auto » laisse l'extraction universelle
 * reconnaître le document ; les autres forcent le type (utile si la
 * reconnaissance automatique hésite).
 */
type TypeScan = "auto" | "piece" | "permis" | "assurance" | "carte_grise";

/**
 * Libellé de pièce d'identité inscrit au dossier selon le document reconnu par
 * l'extraction universelle (CNI, passeport, séjour…).
 */
const LIBELLES_PIECE: Partial<Record<TypeDocument, string>> = {
  [TypeDocument.CNI_BIOMETRIQUE]: "CNI",
  [TypeDocument.CNI_PAPIER]: "CNI",
  [TypeDocument.CIP]: "CIP",
  [TypeDocument.PASSEPORT]: "Passeport",
  [TypeDocument.CARTE_SEJOUR]: "Carte de séjour",
  [TypeDocument.CARTE_CONSULAIRE]: "Carte consulaire",
  [TypeDocument.CARTE_VOTE]: "Carte de vote",
  [TypeDocument.CARTE_ETUDIANT]: "Carte étudiant",
};

/**
 * Convertit une date lue par l'OCR en `AAAA-MM-JJ` (format attendu par un
 * `<input type="date">`). L'OCR renvoie aussi bien `12.05.2027`, `12/05/2027`
 * qu'une date ISO : on tolère les trois, et on renvoie `null` si illisible —
 * mieux vaut un champ vide qu'une date fausse dans un dossier vérifié.
 */
function versDateISO(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  const texte = valeur.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texte)) return texte;
  const correspondance = texte.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!correspondance) return null;
  const [, jour, mois, annee] = correspondance;
  return `${annee}-${mois.padStart(2, "0")}-${jour.padStart(2, "0")}`;
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [dossier, setDossier] = useState<ProfilLogistique | null>(null);
  const [formulaire, setFormulaire] =
    useState<DonneesProfilLogistique>(FORMULAIRE_VIDE);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  /** Retour de la dernière lecture OCR (permis ou assurance). */
  const [messageOCR, setMessageOCR] = useState<string | null>(null);
  const [erreurOCR, setErreurOCR] = useState<string | null>(null);
  /** Type de document à scanner (auto-détection par défaut). */
  const [typeScan, setTypeScan] = useState<TypeScan>("auto");
  const [gares, setGares] = useState<Gare[]>([]);
  const [rechercheGare, setRechercheGare] = useState("");

  const garesFiltrees = useMemo(() => {
    const terme = rechercheGare.trim().toLocaleLowerCase("fr");
    if (!terme) return gares;
    return gares.filter((gare) =>
      gare.id === formulaire.gare_id ||
      `${gare.nom} ${gare.ville} ${gare.code}`
        .toLocaleLowerCase("fr")
        .includes(terme),
    );
  }, [formulaire.gare_id, gares, rechercheGare]);

  const typesProfilDisponibles: [TypeProfilLogistique, string][] =
    utilisateur?.role === "receveur"
      ? [["receveur", "Receveur"]]
      : utilisateur?.role === "gerant_gare"
        ? [["gerant_gare", "Gérant de gare"]]
        : utilisateur?.role === "chauffeur"
          ? [["chauffeur", "Chauffeur"]]
          : [
              ["chauffeur", "Chauffeur"],
              ["receveur", "Receveur"],
              ["gerant_gare", "Gérant de gare"],
            ];

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      try {
        const existant = await identiteAPI.profils.mien();
        if (annule) return;
        setDossier(existant);
        setFormulaire({
          type_profil:
            utilisateur?.role === "gerant_gare"
              ? "gerant_gare"
              : utilisateur?.role === "receveur"
                ? "receveur"
                : utilisateur?.role === "chauffeur"
                  ? "chauffeur"
                  : existant.type_profil,
          gare_id: existant.gare_id ?? null,
          type_piece: existant.type_piece ?? "",
          numero_piece: existant.numero_piece ?? "",
          permis_numero: existant.permis_numero ?? "",
          permis_categorie: existant.permis_categorie ?? "",
          permis_expiration: existant.permis_expiration,
          vehicule_immatriculation: existant.vehicule_immatriculation ?? "",
          vehicule_marque: existant.vehicule_marque ?? "",
          vehicule_modele: existant.vehicule_modele ?? "",
          vehicule_capacite: existant.vehicule_capacite,
        });
      } catch (e) {
        // 404 = aucun dossier : ce n'est pas une erreur, c'est le premier passage.
        if (e instanceof ErreurAPI && e.code_http === 404) {
          if (!annule) {
            setDossier(null);
            setFormulaire((precedent) => ({
              ...precedent,
              type_profil:
                utilisateur?.role === "gerant_gare"
                  ? "gerant_gare"
                  : utilisateur?.role === "receveur"
                    ? "receveur"
                    : utilisateur?.role === "chauffeur"
                      ? "chauffeur"
                      : precedent.type_profil,
            }));
          }
        } else if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger votre dossier.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [utilisateur?.role]);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const premierePage = await logistiqueAPI.gares.lister({
          est_actif: true,
          page: 1,
          par_page: 100,
        });
        const nombrePages = Math.ceil(
          premierePage.total / premierePage.par_page,
        );
        const autresPages = await Promise.all(
          Array.from({ length: Math.max(0, nombrePages - 1) }, (_, index) =>
            logistiqueAPI.gares.lister({
              est_actif: true,
              page: index + 2,
              par_page: 100,
            }),
          ),
        );
        if (!annule) {
          setGares([
            ...premierePage.elements,
            ...autresPages.flatMap((page) => page.elements),
          ]);
        }
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger la liste des gares.",
          );
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  function modifier<K extends keyof DonneesProfilLogistique>(
    cle: K,
    valeur: DonneesProfilLogistique[K],
  ) {
    setFormulaire((precedent) => ({ ...precedent, [cle]: valeur }));
    setSucces(null);
  }

  /** Applique d'un coup les champs lus par l'OCR (sans écraser par du vide). */
  function fusionner(patch: Partial<DonneesProfilLogistique>) {
    setFormulaire((precedent) => ({ ...precedent, ...patch }));
    setSucces(null);
  }

  /** Remplit le dossier à partir des données d'un permis de conduire. */
  function appliquerPermis(donnees: Record<string, any>, extraits: number) {
    const expiration = versDateISO(donnees.date_expiration);
    const categories = Array.isArray(donnees.categories)
      ? donnees.categories.join(", ")
      : (donnees.categories ?? "");
    fusionner({
      permis_numero: donnees.numero_document ?? formulaire.permis_numero ?? "",
      permis_categorie: categories || formulaire.permis_categorie || "",
      permis_expiration: expiration ?? formulaire.permis_expiration,
    });
    setMessageOCR(
      `Permis reconnu : ${extraits} champ(s) lu(s). Vérifiez les valeurs ci-dessous avant d'enregistrer (elles restent modifiables).`,
    );
    if (!expiration && donnees.date_expiration) {
      setErreurOCR(
        `Date d'expiration lue « ${donnees.date_expiration} » : saisissez-la à la main, elle n'a pas pu être convertie.`,
      );
    }
  }

  /** Remplit le dossier à partir des données d'une carte verte d'assurance. */
  function appliquerAssurance(donnees: Record<string, any>, extraits: number) {
    fusionner({
      vehicule_immatriculation:
        donnees.immatriculation ?? formulaire.vehicule_immatriculation ?? "",
      vehicule_marque: donnees.marque_vehicule ?? formulaire.vehicule_marque ?? "",
      vehicule_modele: donnees.modele_vehicule ?? formulaire.vehicule_modele ?? "",
    });
    const validite = donnees.date_expiration
      ? ` Contrat valable jusqu'au ${donnees.date_expiration}${donnees.compagnie_assurance ? ` (${donnees.compagnie_assurance})` : ""}.`
      : "";
    setMessageOCR(
      `Assurance reconnue : ${extraits} champ(s) lu(s).${validite} Vérifiez le véhicule ci-dessous avant d'enregistrer.`,
    );
  }

  /** Remplit la pièce d'identité du dossier (CNI, passeport, séjour…). */
  function appliquerPiece(
    type: TypeDocument,
    donnees: Record<string, any>,
    extraits: number,
  ) {
    const libelle = LIBELLES_PIECE[type] ?? "Pièce d'identité";
    fusionner({
      type_piece: libelle,
      numero_piece:
        donnees.numero_document ??
        donnees.numero_passeport ??
        formulaire.numero_piece ??
        "",
    });
    setMessageOCR(
      `${libelle} reconnue : ${extraits} champ(s) lu(s). Vérifiez le type et le numéro ci-dessus avant d'enregistrer.`,
    );
  }

  /** Remplit le véhicule du dossier à partir d'une carte grise. */
  function appliquerCarteGrise(donnees: Record<string, any>, extraits: number) {
    const capacite = donnees.nombre_places;
    fusionner({
      vehicule_immatriculation:
        donnees.numero_immatriculation ?? formulaire.vehicule_immatriculation ?? "",
      vehicule_marque: donnees.marque ?? formulaire.vehicule_marque ?? "",
      vehicule_modele: donnees.modele ?? formulaire.vehicule_modele ?? "",
      vehicule_capacite:
        typeof capacite === "number" ? capacite : formulaire.vehicule_capacite,
    });
    setMessageOCR(
      `Carte grise reconnue : ${extraits} champ(s) lu(s). Vérifiez le véhicule ci-dessous avant d'enregistrer.`,
    );
  }

  /**
   * Extraction **universelle** : un seul appel à l'interface unique
   * (`POST /api/v1/inspection-documents/upload`), qui renvoie toujours la même
   * réponse. Le type est détecté automatiquement ; le routage vers la bonne
   * partie du dossier se fait sur le type renvoyé, avec un repli sur les champs
   * réellement extraits si l'auto-détection est indécise.
   */
  async function analyserDocument(fichier: File) {
    setErreurOCR(null);
    setMessageOCR(null);
    try {
      // « auto » → on ne transmet aucun type : le backend détecte tout seul.
      const typeForce =
        typeScan === "piece"
          ? TypeDocument.CNI_BIOMETRIQUE
          : typeScan === "permis"
            ? TypeDocument.PERMIS_CONDUIRE
            : typeScan === "assurance"
              ? TypeDocument.CARTE_ASSURANCE
              : typeScan === "carte_grise"
                ? TypeDocument.CARTE_GRISE
                : undefined;

      const reponse = await uploadDocument(fichier, typeForce);
      const donnees = (reponse.donnees ?? {}) as Record<string, any>;
      const extraits = reponse.champs_extraits ?? 0;
      const type = reponse.type_document;

      // 1) Le type renvoyé par le backend décide du routage.
      if (type === TypeDocument.PERMIS_CONDUIRE) {
        appliquerPermis(donnees, extraits);
        return;
      }
      if (type === TypeDocument.CARTE_ASSURANCE) {
        appliquerAssurance(donnees, extraits);
        return;
      }
      if (type === TypeDocument.CARTE_GRISE) {
        appliquerCarteGrise(donnees, extraits);
        return;
      }
      if (LIBELLES_PIECE[type]) {
        appliquerPiece(type, donnees, extraits);
        return;
      }

      // 2) Auto-détection indécise : on se fie aux champs réellement lus.
      if (
        "compagnie_assurance" in donnees ||
        "immatriculation" in donnees ||
        "marque_vehicule" in donnees
      ) {
        appliquerAssurance(donnees, extraits);
        return;
      }
      if (
        "numero_immatriculation" in donnees ||
        "numero_chassis" in donnees ||
        "marque" in donnees
      ) {
        appliquerCarteGrise(donnees, extraits);
        return;
      }
      if ("categories" in donnees) {
        appliquerPermis(donnees, extraits);
        return;
      }
      if ("npi" in donnees) {
        appliquerPiece(TypeDocument.CIP, donnees, extraits);
        return;
      }
      if ("numero_document" in donnees || "numero_passeport" in donnees) {
        // Document d'identité reconnu uniquement par ses champs.
        appliquerPiece(TypeDocument.CNI_BIOMETRIQUE, donnees, extraits);
        return;
      }

      // 3) Rien d'exploitable : on invite à préciser le type ou à reprendre la photo.
      setErreurOCR(
        "Impossible de reconnaître le document. Précisez son type ci-dessus, ou reprenez une photo plus nette.",
      );
    } catch (e) {
      setErreurOCR(
        e instanceof Error ? e.message : "Lecture impossible. Reprenez la photo de plus près.",
      );
    }
  }

  async function enregistrer() {
    setErreur(null);
    setSucces(null);
    if (
      (formulaire.type_profil === "receveur" ||
        formulaire.type_profil === "gerant_gare") &&
      !formulaire.gare_id
    ) {
      setErreur("Sélectionnez votre gare d'appartenance avant l'enregistrement.");
      return;
    }
    setEnregistrement(true);
    try {
      const reponse = await identiteAPI.profils.enregistrer(formulaire);
      setDossier(reponse);
      setSucces(
        reponse.est_verifie
          ? "Dossier enregistré. Il était déjà vérifié : vos éléments contrôlés n'ont pas changé."
          : "Dossier enregistré. Un gérant de gare doit maintenant vérifier vos pièces.",
      );
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Échec de l'enregistrement du dossier.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) {
    return (
      <p className="text-ardoise-clair italic py-12 text-center">
        Chargement de votre dossier…
      </p>
    );
  }

  const estChauffeur = formulaire.type_profil === "chauffeur";
  const estGuichet = !estChauffeur;
  // Une information déjà lue sur un document et enregistrée ne se réécrit
  // plus depuis le dossier : elle sert de preuve pour la vérification.
  const pieceVerrouillee = !!(dossier?.type_piece || dossier?.numero_piece);
  const permisVerrouille = !!dossier?.permis_numero;
  const vehiculeVerrouille = !!dossier?.vehicule_immatriculation;

  return (
    <div className="space-y-6 apparition">
      <header className="flex flex-col gap-4 rounded-2xl border border-ardoise-clair/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-ardoise">
            {estChauffeur ? "Mon profil chauffeur" : "Mon dossier professionnel"}
          </h1>
          <p className="text-sm text-ardoise-clair">
            {estChauffeur
              ? "Gérez vos informations, votre permis et votre véhicule."
              : "Gérez les informations de votre activité et votre identité."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {estChauffeur && (
            <>
              <Link href="/chauffeur/voyages">
                <Bouton variante="ghost" taille="petit">Mes voyages</Bouton>
              </Link>
              <Link href="/chauffeur/colis">
                <Bouton variante="ghost" taille="petit">Mes colis</Bouton>
              </Link>
            </>
          )}
          <Link href="/identite/carte">
            <Bouton variante="secondaire" taille="petit">Ma carte DigiID</Bouton>
          </Link>
        </div>
      </header>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}
      {succes && (
        <Alerte variante="succes" titre="Enregistré">
          {succes}
        </Alerte>
      )}

      {dossier && <ResumeDossier dossier={dossier} />}

      <Carte
        titre={
          estChauffeur
            ? dossier ? "Mon dossier chauffeur" : "Créer mon dossier chauffeur"
            : dossier ? "Mettre à jour mes informations" : "Créer mon dossier"
        }
        description={
          estChauffeur
            ? "Complétez les rubriques ci-dessous pour faire vérifier votre profil."
            : "Les changements de pièce ou de gare peuvent demander une nouvelle vérification."
        }
      >
        <div className="space-y-4">
          <section className="space-y-3 rounded-xl border border-ardoise-clair/10 bg-sable-clair/50 p-4">
            <div>
              <h4 className="font-semibold text-ardoise">1. Mon activité</h4>
              <p className="text-xs text-ardoise-clair">Choisissez le profil associé à votre compte.</p>
            </div>
            <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ardoise">
              Mon activité <span className="text-terre">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {typesProfilDisponibles.map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => {
                    modifier("type_profil", valeur);
                    if (valeur === "chauffeur") modifier("gare_id", null);
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    formulaire.type_profil === valeur
                      ? "border-lagune bg-lagune-teinte text-lagune"
                      : "border-ardoise/20 bg-white text-ardoise hover:bg-lagune-teinte/40"
                  }`}
                >
                  {libelle}
                </button>
              ))}
            </div>
            </div>

            {estGuichet && (
              <div className="space-y-2 rounded-xl border border-lagune/20 bg-lagune/5 p-4">
              <div>
                <label
                  htmlFor="recherche-gare"
                  className="mb-1 block text-sm font-medium text-ardoise"
                >
                  Rechercher une gare
                </label>
                <input
                  id="recherche-gare"
                  type="search"
                  value={rechercheGare}
                  onChange={(e) => setRechercheGare(e.target.value)}
                  placeholder="Nom, ville ou code de gare"
                  className="champ-saisie"
                />
              </div>
              <div>
                <label
                  htmlFor="gare-appartenance"
                  className="mb-1 block text-sm font-medium text-ardoise"
                >
                  Ma gare d&apos;appartenance <span className="text-terre">*</span>
                </label>
                <select
                  id="gare-appartenance"
                  value={formulaire.gare_id ?? ""}
                  onChange={(e) => modifier("gare_id", e.target.value || null)}
                  className="champ-saisie"
                  required
                >
                  <option value="">Choisir une gare</option>
                  {garesFiltrees.map((gare) => (
                    <option key={gare.id} value={gare.id}>
                      {gare.nom} — {gare.ville} ({gare.code})
                    </option>
                  ))}
                </select>
                {gares.length === 0 && (
                  <p className="mt-1 text-xs text-terre">
                    Aucune gare active n&apos;est disponible. Contactez un administrateur.
                  </p>
                )}
              </div>
              <p className="text-xs text-ardoise-clair">
                Cette gare permettra d&apos;identifier les agents du guichet qui
                peuvent recevoir les colis et enfants à destination.
              </p>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-ardoise-clair/10 p-4">
            <div>
              <h4 className="font-semibold text-ardoise">2. Mon identité</h4>
              <p className="text-xs text-ardoise-clair">Les informations servent à vérifier votre dossier.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ChampSaisie
              libelle="Type de pièce d'identité"
              value={formulaire.type_piece ?? ""}
              onChange={(e) => modifier("type_piece", e.target.value)}
              placeholder="Ex : CNI, passeport"
              disabled={pieceVerrouillee}
              aide={pieceVerrouillee ? "Lu sur votre pièce : non modifiable." : undefined}
            />
            <ChampSaisie
              libelle="Numéro de la pièce"
              value={formulaire.numero_piece ?? ""}
              onChange={(e) => modifier("numero_piece", e.target.value)}
              placeholder="Ex : 1234567890123"
              disabled={pieceVerrouillee}
              aide={pieceVerrouillee ? "Lu sur votre pièce : non modifiable." : undefined}
            />
            </div>

          {/* Scan OCR (extraction universelle) : remplit les champs selon le
              document — pièce d'identité pour tout le monde, et en plus permis /
              véhicule pour les chauffeurs. */}
          <div className="rounded-xl border border-lagune/20 bg-lagune/5 px-4 py-3">
            <p className="text-sm font-bold text-ardoise">
              Scanner un document (OCR)
            </p>
            <p className="mt-0.5 text-xs text-ardoise-clair">
              Prenez une photo de votre pièce d&apos;identité, de votre permis, de
              votre carte verte ou de votre carte grise : le système reconnaît le
              document et remplit les bons champs. Vous gardez la main — rien
              n&apos;est enregistré avant que vous ne validiez.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["auto", "Auto-détection"],
                  ["piece", "Pièce d'identité"],
                  ["permis", "Permis de conduire"],
                  ["assurance", "Carte verte"],
                  ["carte_grise", "Carte grise"],
                ] as [TypeScan, string][]
              ).map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => setTypeScan(valeur)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    typeScan === valeur
                      ? "border-lagune bg-lagune-teinte text-lagune"
                      : "border-ardoise/20 bg-white text-ardoise hover:bg-lagune-teinte/40"
                  }`}
                >
                  {libelle}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ardoise-clair">
              L&apos;auto-détection suffit la plupart du temps ; précisez le type
              seulement si la reconnaissance se trompe.
            </p>

            <div className="mt-2">
              <ChampOCR
                libelle="Photo du document"
                description="Une photo suffit : le type de document est reconnu automatiquement (extraction universelle)."
                surFichier={analyserDocument}
              />
            </div>

            {messageOCR && (
              <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-ardoise">
                {messageOCR}
              </p>
            )}
            {erreurOCR && (
              <p className="mt-3 rounded-lg bg-terre/10 px-3 py-2 text-xs font-medium text-terre">
                {erreurOCR}
              </p>
            )}
          </div>
          </section>

          {estChauffeur && (
            <section className="space-y-4 rounded-xl border border-ardoise-clair/10 bg-sable-clair/50 p-4">
              <div>
                <h4 className="font-semibold text-ardoise">3. Mon permis</h4>
                <p className="text-xs text-ardoise-clair">Vérifiez les informations inscrites sur votre permis.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ChampSaisie
                  libelle="Numéro de permis"
                  value={formulaire.permis_numero ?? ""}
                  onChange={(e) => modifier("permis_numero", e.target.value)}
                  disabled={permisVerrouille}
                  aide={permisVerrouille ? "Lu sur le permis : non modifiable." : undefined}
                />
                <ChampSaisie
                  libelle="Catégorie du permis"
                  value={formulaire.permis_categorie ?? ""}
                  onChange={(e) => modifier("permis_categorie", e.target.value)}
                  placeholder="Ex : C, D"
                  disabled={permisVerrouille}
                />
                <ChampSaisie
                  libelle="Expiration du permis"
                  type="date"
                  value={formulaire.permis_expiration ?? ""}
                  onChange={(e) =>
                    modifier("permis_expiration", e.target.value || null)
                  }
                  disabled={permisVerrouille}
                  aide={
                    formulaire.permis_expiration
                      ? `Valable jusqu'au ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(`${formulaire.permis_expiration}T00:00:00`))}.`
                      : "Date d'échéance lue sur le permis."
                  }
                />
              </div>

              <div className="border-t border-ardoise-clair/10 pt-4">
                <h4 className="mb-3 font-semibold text-ardoise">4. Mon véhicule</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ChampSaisie
                  libelle="Immatriculation"
                  value={formulaire.vehicule_immatriculation ?? ""}
                  onChange={(e) =>
                    modifier("vehicule_immatriculation", e.target.value)
                  }
                  placeholder="Ex : AB-1234-RB"
                  disabled={vehiculeVerrouille}
                  aide={
                    vehiculeVerrouille
                      ? "Véhicule lu sur vos documents et déjà affecté à votre compte : non modifiable."
                      : undefined
                  }
                />
                <ChampSaisie
                  libelle="Marque"
                  value={formulaire.vehicule_marque ?? ""}
                  onChange={(e) => modifier("vehicule_marque", e.target.value)}
                  disabled={vehiculeVerrouille}
                />
                <ChampSaisie
                  libelle="Modèle"
                  value={formulaire.vehicule_modele ?? ""}
                  onChange={(e) => modifier("vehicule_modele", e.target.value)}
                  disabled={vehiculeVerrouille}
                />
                <ChampSaisie
                  libelle="Capacité (places)"
                  inputMode="numeric"
                  value={
                    formulaire.vehicule_capacite === null
                      ? ""
                      : String(formulaire.vehicule_capacite)
                  }
                  disabled={vehiculeVerrouille}
                  onChange={(e) => {
                    const chiffres = e.target.value.replace(/\D/g, "");
                    modifier(
                      "vehicule_capacite",
                      chiffres === "" ? null : Number(chiffres),
                    );
                  }}
                />
              </div>
              </div>
            </section>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-ardoise-clair/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ardoise-clair">
              Les informations déjà vérifiées ne peuvent pas toujours être modifiées.
            </p>
            <Bouton
              variante="primaire"
              chargement={enregistrement}
              disabled={enregistrement}
              onClick={() => void enregistrer()}
            >
              Enregistrer mon dossier
            </Bouton>
          </div>
        </div>
      </Carte>

      {/*
       * Sécurité personnelle, en deux cartes compactes :
       * changer son mot de passe et montrer son visage. Texte court et
       * boutons simples pour rester compréhensible par tout le monde.
       */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CarteMotDePasse />
        <CarteVisage />
      </div>
    </div>
  );
}

/** État du dossier : statut, éléments manquants et éléments déjà validés. */
function ResumeDossier({ dossier }: { dossier: ProfilLogistique }) {
  const manquants = dossier.champs_manquants ?? [];
  const variante =
    dossier.statut_verification === "verifie"
      ? "succes"
      : dossier.statut_verification === "rejete"
        ? "terre"
        : "ocre";

  return (
    <Carte titre="État de mon dossier" variante={dossier.est_verifie ? "accent" : "standard"}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge variante={variante} taille="moyen">
          {LIBELLES_VERIFICATION_PROFIL[dossier.statut_verification]}
        </Badge>
        {dossier.identifiant_public && (
          <Badge variante="neutre">{dossier.identifiant_public}</Badge>
        )}
        {dossier.utilisateur_nom && (
          <span className="text-sm text-ardoise-clair">{dossier.utilisateur_nom}</span>
        )}
      </div>

        {dossier.gare_nom && (
          <p className="mb-3 text-sm text-ardoise-clair">
            Gare d&apos;appartenance :{" "}
            <span className="font-semibold text-ardoise">{dossier.gare_nom}</span>
          </p>
        )}

        <ul className="text-sm space-y-1.5">
        <Element valide={dossier.piece_verifiee} libelle="Pièce d'identité" />
        {dossier.type_profil === "chauffeur" && (
          <>
            <Element valide={dossier.permis_verifie} libelle="Permis de conduire" />
            <Element
              valide={!!dossier.vehicule_immatriculation}
              libelle="Véhicule renseigné"
            />
          </>
        )}
        <Element valide={dossier.photo_verifiee} libelle="Photo d'identité" />
      </ul>

      {/*manquants.length > 0 && (
        <div className="mt-3 pt-3 border-t border-ardoise-clair/10">
          <p className="text-sm font-semibold text-ocre-fonce mb-1">
            Reste à vérifier :
          </p>
          <ul className="text-sm text-ardoise-clair list-disc list-inside">
            {manquants.map((champ) => (
              <li key={champ}>{LIBELLES_CHAMPS_PROFIL[champ] ?? champ}</li>
            ))}
          </ul>
        </div>
      )*/}

      {dossier.type_profil === "chauffeur" && (
        <div className="mt-3 space-y-0.5 text-xs text-ardoise-clair">
          {dossier.permis_expiration && (
            <p>
              Permis valable jusqu&apos;au{" "}
              <span className="font-semibold text-ardoise">
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
                  new Date(`${dossier.permis_expiration}T00:00:00`),
                )}
              </span>
              .
            </p>
          )}
          {dossier.vehicule_immatriculation && (
            <p>
              Véhicule affecté à votre compte :{" "}
              <span className="font-semibold text-ardoise">
                {dossier.vehicule_immatriculation}
              </span>
              .
            </p>
          )}
        </div>
      )}

      {dossier.verifie_le && (
        <p className="text-xs text-ardoise-clair mt-3">
          Vérifié le{" "}
          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(
            new Date(dossier.verifie_le),
          )}
          {dossier.verifie_par_nom ? ` par ${dossier.verifie_par_nom}` : ""}.
        </p>
      )}
    </Carte>
  );
}

function Element({ valide, libelle }: { valide: boolean; libelle: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
          valide ? "bg-green-100 text-green-700" : "bg-ardoise-clair/20 text-ardoise-clair"
        }`}
      >
        {valide ? "✓" : "–"}
      </span>
      <span className={valide ? "text-ardoise" : "text-ardoise-clair"}>{libelle}</span>
    </li>
  );
}

/**
 * Changer son mot de passe — version simple et compacte.
 *
 * Phrase courte, trois cases, un seul bouton. On explique ce qu'on fait
 * plutôt que d'utiliser du vocabulaire technique.
 */
function CarteMotDePasse() {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  async function changer() {
    setErreur(null);
    setSucces(null);
    if (!ancien || !nouveau || !confirmation) {
      setErreur("Remplis les 3 cases.");
      return;
    }
    if (nouveau !== confirmation) {
      setErreur("Les deux nouveaux mots de passe ne sont pas les mêmes.");
      return;
    }
    if (nouveau.length < 8) {
      setErreur("Le nouveau mot de passe doit avoir au moins 8 signes.");
      return;
    }
    setEnregistrement(true);
    try {
      await clientAPI.patch<{ message: string }>(
        "/api/v1/utilisateur/profil/mot-de-passe",
        { ancien_mot_de_passe: ancien, nouveau_mot_de_passe: nouveau },
        { authentifie: true },
      );
      setSucces("Mot de passe changé. Garde-le secret !");
      setAncien("");
      setNouveau("");
      setConfirmation("");
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de changer le mot de passe.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <Carte
      titre="🔑 Mon mot de passe"
      description="Change ton mot de passe pour protéger ton compte."
    >
      <div className="space-y-3">
        <ChampSaisie
          libelle="Mot de passe d'aujourd'hui"
          type="password"
          value={ancien}
          onChange={(e) => setAncien(e.target.value)}
          autoComplete="current-password"
        />
        <ChampSaisie
          libelle="Nouveau mot de passe"
          type="password"
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          autoComplete="new-password"
          aide="Au moins 8 signes (lettres ou chiffres)."
        />
        <ChampSaisie
          libelle="Répète le nouveau mot de passe"
          type="password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="new-password"
        />
        {erreur && <p className="text-sm font-medium text-terre">{erreur}</p>}
        {succes && <p className="text-sm font-medium text-green-700">✓ {succes}</p>}
        <Bouton
          variante="primaire"
          taille="petit"
          chargement={enregistrement}
          onClick={() => void changer()}
        >
          Changer mon mot de passe
        </Bouton>
      </div>
    </Carte>
  );
}

/**
 * Vérification du visage — version simple et compacte.
 *
 * On prend une photo, on voit le résultat. Pas d'historique ni de réglages
 * pour ne pas surcharger la page.
 */
function CarteVisage() {
  const [statut, setStatut] = useState<VerificationDetail | null>(null);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const resultat = await obtenirStatutVerification();
      setStatut(resultat ?? null);
    } catch {
      setStatut(null);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <Carte
      titre="🙂 Mon visage"
      description="Prends une photo de ton visage pour prouver que c'est bien toi."
    >
      <div className="space-y-3">
        <UploadPhoto onSucces={charger} />
        <StatutVerification verification={statut} chargement={chargement} />
      </div>
    </Carte>
  );
}
