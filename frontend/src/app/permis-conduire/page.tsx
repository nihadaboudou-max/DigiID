"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { Badge, type BadgeVariante } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import {
  uploaderPermis,
  obtenirHistoriquePermis,
  type ReponseUploadPermis,
  type VerificationPermisDetail,
  type DonneesPermis,
} from "@/services/permis_conduire";

export default function PagePermisConduire() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

// ---------------------------------------------------------------------------
// Constantes & utilitaires
// ---------------------------------------------------------------------------
const TAILLE_MAX_OCTETS = 15 * 1024 * 1024; // 15 Mo
const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"];

const CONFIG_STATUTS: Record<string, { libelle: string; variante: BadgeVariante; icone: string }> = {
  approuve: { libelle: "Validé", variante: "succes", icone: "✅" },
  rejete: { libelle: "Rejeté", variante: "terre", icone: "❌" },
  expiree: { libelle: "Expirée", variante: "ocre", icone: "⏰" },
  en_attente: { libelle: "En attente", variante: "info", icone: "⏳" },
};

function configStatut(statut: string) {
  return (
    CONFIG_STATUTS[statut] || { libelle: statut, variante: "neutre" as BadgeVariante, icone: "ℹ️" }
  );
}

/** Formate une date OCR (JJ/MM/AAAA, JJ.MM.AAAA ou ISO) en français lisible. */
function formaterDate(value?: string | null): string {
  if (!value) return "";
  const texte = value.trim();

  // Format ISO AAAA-MM-JJ
  if (/^\d{4}-\d{2}-\d{2}/.test(texte)) {
    const d = new Date(texte + "T00:00:00");
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    }
  }

  // Format JJ/MM/AAAA, JJ.MM.AAAA ou JJ-MM-AAAA
  const parties = texte.split(/[./-]/);
  if (parties.length === 3) {
    const [a, b, c] = parties.map((p) => parseInt(p, 10));
    if (!isNaN(a) && !isNaN(b) && !isNaN(c)) {
      const d = new Date(c > 1000 ? c : c + 2000, b - 1, a);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      }
    }
  }

  return texte;
}

/** Valide le fichier avant envoi (type + taille). */
function validerFichier(fichier: File): string | null {
  if (!TYPES_ACCEPTES.includes(fichier.type)) {
    return "Format non supporté. Utilise un fichier JPG, PNG ou WEBP.";
  }
  if (fichier.size > TAILLE_MAX_OCTETS) {
    return "Le fichier dépasse la taille maximale de 15 Mo.";
  }
  return null;
}

/** Compte les champs réellement extraits (hors texte brut / confiance). */
const CHAMPS_PERMIS: (keyof DonneesPermis)[] = [
  "nom_famille",
  "prenoms",
  "numero_permis",
  "categories",
  "date_delivrance",
  "date_expiration",
  "autorite_delivrance",
  "date_naissance",
  "lieu_naissance",
  "pays_emetteur",
];

function compterChampsPermis(donnees: DonneesPermis): number {
  return CHAMPS_PERMIS.filter((cle) => {
    const valeur = donnees[cle];
    if (Array.isArray(valeur)) return valeur.length > 0;
    return valeur !== null && valeur !== undefined && valeur !== "";
  }).length;
}

function Contenu() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [chargementInitial, setChargementInitial] = useState(true);
  const [enAnalyse, setEnAnalyse] = useState(false);
  const [resultat, setResultat] = useState<ReponseUploadPermis | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [afficherTexteBrut, setAfficherTexteBrut] = useState(false);
    const refEntreeFichier = useRef<HTMLInputElement>(null);

  // ✅ Charger les données existantes au montage de la page (comme la CNI)
  useEffect(() => {
    let annule = false;

    async function chargerDonneesExistantes() {
      try {
        const hist = await obtenirHistoriquePermis(1); // Récupère le dernier document
        if (!annule && hist && hist.historique.length > 0) {
          const dernier: VerificationPermisDetail = hist.historique[0];

          // ✅ Reconstruit un objet compatible avec ReponseUploadPermis SANS perdre de champs
          const donnees: DonneesPermis = {
            nom_famille: dernier.nom_famille,
            prenoms: dernier.prenoms,
            numero_permis: dernier.numero_permis,
            categories: dernier.categories || [],
            date_delivrance: dernier.date_delivrance,
            date_expiration: dernier.date_expiration,
            autorite_delivrance: dernier.autorite_delivrance,
            date_naissance: dernier.date_naissance,
            lieu_naissance: dernier.lieu_naissance,
            taux_confiance_moyen: dernier.taux_confiance_ocr,
          };

          const dateScan = dernier.cree_le
            ? new Date(dernier.cree_le).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : null;

          setResultat({
            id: dernier.id,
            statut: dernier.statut,
            message: dateScan
              ? `Document déjà enregistré dans votre profil (scanné le ${dateScan}).`
              : "Document déjà enregistré dans votre profil.",
            resultat_ocr: {
              succes: dernier.statut === "approuve",
              donnees,
              erreurs: [],
              champs_extraits: compterChampsPermis(donnees),
            },
          });
        }
      } catch (err) {
        console.error("Erreur lors du chargement de l'historique:", err);
      } finally {
        if (!annule) setChargementInitial(false);
      }
    }

    chargerDonneesExistantes();
    return () => {
      annule = true;
    };
  }, []);

    async function gererUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // ✅ Validation côté client avant envoi
    const messageValidation = validerFichier(file);
    if (messageValidation) {
      setErreur(messageValidation);
      setFichier(null);
      e.target.value = "";
      return;
    }

    setFichier(file);
    setErreur(null);
    setEnAnalyse(true);
    setAfficherTexteBrut(false);

    try {
      const res = await uploaderPermis(file);
      setResultat(res);
    } catch (err: any) {
      setErreur(err?.message || "Erreur inconnue lors de l'analyse.");
    } finally {
      setEnAnalyse(false);
            if (refEntreeFichier.current) refEntreeFichier.current.value = "";
    }
  }

  // ✅ Écran de chargement initial (historique) uniquement
  if (chargementInitial) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 apparition pb-20 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full" />
        <p className="text-ardoise-clair">Chargement de vos données...</p>
      </div>
    );
  }

  const config = resultat ? configStatut(resultat.statut) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 apparition pb-20">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/identite" className="hover:text-lagune">Identité</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Permis de Conduire</span>
      </nav>

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-ardoise">Permis de Conduire</h1>
        <p className="text-ardoise-clair mt-1">
          Scanne ton permis pour extraire automatiquement les informations.
        </p>
      </div>

      {/* Alerte info */}
      <Alerte variante="info" titre="ℹ️ Format accepté">
        <p className="text-sm">JPG, PNG ou WEBP. Taille max : 15 Mo.</p>
      </Alerte>

      {/* Upload */}
      <Carte>
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-ardoise-clair/30 rounded-lg cursor-pointer hover:bg-sable/30 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <p className="text-4xl mb-2">📄</p>
            <p className="text-sm text-ardoise-clair">
              {fichier ? fichier.name : "Clique pour choisir un fichier (JPG, PNG, WEBP)"}
            </p>
          </div>
          <input
            ref={refEntreeFichier}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={gererUpload}
            disabled={enAnalyse}
          />
        </label>

        {enAnalyse && (
          <div className="text-center py-4">
            <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-ardoise-clair mt-2">Analyse en cours, extraction des données...</p>
          </div>
        )}
      </Carte>

      {/* Erreur */}
      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          <p className="text-sm">{erreur}</p>
                </Alerte>
      )}

      {/* Résultat */}
      {resultat && config && (
        <Carte>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-ardoise">Résultat de l'extraction</h2>
            <Badge variante={config.variante}>
              {config.icone} {config.libelle}
            </Badge>
          </div>

          <p className="text-sm text-ardoise-clair mb-4">{resultat.message}</p>

          {/* Résumé extraction */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variante="neutre" taille="petit">
              {resultat.resultat_ocr.champs_extraits} champ{resultat.resultat_ocr.champs_extraits > 1 ? "s" : ""} extrait{resultat.resultat_ocr.champs_extraits > 1 ? "s" : ""}
            </Badge>
            {typeof resultat.resultat_ocr.donnees.taux_confiance_moyen === "number" && (
              <span className="text-xs text-ardoise-clair">
                Confiance OCR : <span className="font-semibold">{resultat.resultat_ocr.donnees.taux_confiance_moyen.toFixed(1)}%</span>
              </span>
                        )}
          </div>

          {/* ✅ Affichage de TOUTES les données extraites (même en cas d'échec partiel) */}
          <div className="space-y-2 text-sm">
            {resultat.resultat_ocr.donnees.nom_famille && (
              <p><strong>Nom :</strong> {resultat.resultat_ocr.donnees.nom_famille}</p>
            )}
            {resultat.resultat_ocr.donnees.prenoms && (
              <p><strong>Prénoms :</strong> {resultat.resultat_ocr.donnees.prenoms}</p>
            )}
            {resultat.resultat_ocr.donnees.date_naissance && (
              <p><strong>Né(e) le :</strong> {formaterDate(resultat.resultat_ocr.donnees.date_naissance)}</p>
            )}
            {resultat.resultat_ocr.donnees.lieu_naissance && (
              <p><strong>Lieu de naissance :</strong> {resultat.resultat_ocr.donnees.lieu_naissance}</p>
            )}
            {resultat.resultat_ocr.donnees.numero_permis && (
              <p><strong>N° Permis :</strong> <span className="font-mono">{resultat.resultat_ocr.donnees.numero_permis}</span></p>
            )}
            {resultat.resultat_ocr.donnees.categories && resultat.resultat_ocr.donnees.categories.length > 0 && (
              <div className="flex items-center gap-2">
                <strong>Catégories :</strong>
                <div className="flex flex-wrap gap-1">
                  {resultat.resultat_ocr.donnees.categories.map((c) => (
                    <Badge key={c} variante="lagune" taille="petit">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
            {resultat.resultat_ocr.donnees.date_delivrance && (
              <p><strong>Délivré le :</strong> {formaterDate(resultat.resultat_ocr.donnees.date_delivrance)}</p>
            )}
            {resultat.resultat_ocr.donnees.date_expiration && (
              <p><strong>Expire le :</strong> {formaterDate(resultat.resultat_ocr.donnees.date_expiration)}</p>
            )}
            {resultat.resultat_ocr.donnees.autorite_delivrance && (
              <p><strong>Autorité :</strong> {resultat.resultat_ocr.donnees.autorite_delivrance}</p>
            )}
            {resultat.resultat_ocr.donnees.pays_emetteur && (
              <p><strong>Pays émetteur :</strong> {resultat.resultat_ocr.donnees.pays_emetteur}</p>
            )}

            {resultat.resultat_ocr.champs_extraits === 0 && (
              <p className="text-terre italic">⚠️ Aucun champ extrait du document.</p>
            )}
          </div>

          {/* Erreurs */}
          {resultat.resultat_ocr.erreurs.length > 0 && (
            <div className="mt-4 p-3 bg-terre/10 rounded-lg">
              <p className="text-sm font-semibold text-terre mb-1">Erreurs :</p>
              <ul className="list-disc list-inside text-sm text-terre">
                {resultat.resultat_ocr.erreurs.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                            </ul>
            </div>
          )}

          {/* ✅ Texte brut OCR (débogage) */}
          <div className="mt-6 pt-6 border-t border-ardoise-clair/20">
            <button
              type="button"
              onClick={() => setAfficherTexteBrut(!afficherTexteBrut)}
              className="text-xs text-lagune hover:underline font-medium"
            >
              {afficherTexteBrut ? "🔽 Masquer le texte brut" : "🔍 Voir le texte brut extrait par l'OCR"}
            </button>

            {afficherTexteBrut && (
              <div className="mt-3 p-3 bg-ardoise-clair/10 rounded-lg">
                {resultat.resultat_ocr.donnees.texte_brut ? (
                  <>
                    <p className="text-xs font-semibold text-ardoise mb-2">
                      Texte brut extrait ({resultat.resultat_ocr.donnees.texte_brut.length} caractères) :
                    </p>
                    <pre className="text-xs text-ardoise whitespace-pre-wrap font-mono bg-white p-2 rounded border border-ardoise-clair/20 max-h-64 overflow-auto">
                      {resultat.resultat_ocr.donnees.texte_brut}
                    </pre>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-ardoise-clair italic mb-2">🔒 Texte brut non disponible</p>
                    <p className="text-xs text-ardoise-clair">
                      Le texte brut de l'OCR n'est conservé que temporairement juste après le scan.
                      Pour des raisons de sécurité et de confidentialité, il n'est pas stocké en base de données.
                    </p>
                    {resultat.message.includes("déjà enregistré") && (
                      <p className="text-xs text-ardoise-clair mt-2 font-medium">
                        💡 Pour voir le texte brut, scannez à nouveau le document.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Carte>
      )}

      {/* Navigation */}
      <div className="flex flex-wrap gap-2">
        <Link href="/identite">
          <Bouton variante="ghost">← Retour à l'identité</Bouton>
        </Link>
      </div>
    </div>
  );
}