"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { 
  uploaderAssurance, 
  obtenirHistoriqueAssurance, 
  type ReponseUploadAssurance,
  type VerificationAssuranceDetail
} from "@/services/assurance_auto";

export default function PageAssuranceAuto() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [chargement, setChargement] = useState(true); // ✅ Commence à true
  const [resultat, setResultat] = useState<ReponseUploadAssurance | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [afficherTexteBrut, setAfficherTexteBrut] = useState(false);

  // ✅ Charger les données existantes au montage
  useEffect(() => {
    async function chargerDonneesExistantes() {
      try {
        const hist = await obtenirHistoriqueAssurance(1);
        if (hist && hist.historique.length > 0) {
          const dernier: VerificationAssuranceDetail = hist.historique[0];
          
          setResultat({
            id: dernier.id,
            statut: dernier.statut as "approuve" | "rejete" | "expiree",
            message: "Document déjà enregistré dans votre profil.",
            resultat_ocr: {
              succes: dernier.statut === "approuve",
              donnees: {
                compagnie_assurance: dernier.compagnie_assurance,
                numero_contrat: dernier.numero_contrat,
                immatriculation_vehicule: dernier.immatriculation_vehicule,
                marque_vehicule: dernier.marque_vehicule,
                modele_vehicule: null, // Non stocké dans VerificationAssuranceDetail
                date_effet: null,      // Non stocké
                date_expiration: dernier.date_expiration,
              },
              erreurs: [],
              champs_extraits: dernier.numero_contrat ? 4 : 0,
            }
          });
        }
      } catch (err) {
        console.error("Erreur chargement historique assurance:", err);
      } finally {
        setChargement(false);
      }
    }
    
    chargerDonneesExistantes();
  }, []);

  async function gererUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFichier(file);
    setErreur(null);
    setResultat(null);
    setChargement(true);

    try {
      const res = await uploaderAssurance(file);
      setResultat(res);
    } catch (err: any) {
      setErreur(err.message || "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }

  // ✅ Écran de chargement
  if (chargement && !resultat) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 apparition pb-20 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full" />
        <p className="text-ardoise-clair ml-3">Chargement de vos données...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 apparition pb-20">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/identite" className="hover:text-lagune">Identité</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Assurance Auto</span>
      </nav>

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-ardoise">Assurance Automobile</h1>
        <p className="text-ardoise-clair mt-1">
          Scanne ta carte verte ou attestation d'assurance.
        </p>
      </div>

      <Alerte variante="info" titre="ℹ️ Format accepté">
        <p className="text-sm">JPG, PNG ou WEBP. Taille max : 15 Mo.</p>
      </Alerte>

      {/* Upload */}
      <Carte>
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-ardoise-clair/30 rounded-lg cursor-pointer hover:bg-sable/30 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <p className="text-4xl mb-2">🚗</p>
            <p className="text-sm text-ardoise-clair">
              {fichier ? fichier.name : "Clique pour choisir un nouveau fichier"}
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={gererUpload}
            disabled={chargement}
          />
        </label>

        {chargement && !resultat && (
          <div className="text-center py-4">
            <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-ardoise-clair mt-2">Analyse en cours...</p>
          </div>
        )}
      </Carte>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          <p className="text-sm">{erreur}</p>
        </Alerte>
      )}

      {/* Résultat */}
      {resultat && (
        <Carte>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ardoise">Résultat de l'extraction</h2>
            <Badge variante={resultat.statut === "approuve" ? "succes" : "terre"}>
              {resultat.statut === "approuve" ? "Validé" : resultat.statut}
            </Badge>
          </div>

          <p className="text-sm text-ardoise-clair mb-4">{resultat.message}</p>

          {/* ✅ AFFICHAGE DE TOUTES LES DONNÉES EXTRAITES (MÊME EN CAS D'ÉCHEC) */}
          <div className="space-y-2 text-sm">
            {resultat.resultat_ocr.donnees.compagnie_assurance && (
              <p><strong>Compagnie :</strong> {resultat.resultat_ocr.donnees.compagnie_assurance}</p>
            )}
            {resultat.resultat_ocr.donnees.numero_contrat && (
              <p><strong>N° Contrat :</strong> <span className="font-mono">{resultat.resultat_ocr.donnees.numero_contrat}</span></p>
            )}
            {resultat.resultat_ocr.donnees.immatriculation_vehicule && (
              <p><strong>Immatriculation :</strong> <span className="font-mono font-semibold text-lagune">{resultat.resultat_ocr.donnees.immatriculation_vehicule}</span></p>
            )}
            {resultat.resultat_ocr.donnees.marque_vehicule && (
              <p><strong>Marque :</strong> {resultat.resultat_ocr.donnees.marque_vehicule}</p>
            )}
            {resultat.resultat_ocr.donnees.modele_vehicule && (
              <p><strong>Modèle :</strong> {resultat.resultat_ocr.donnees.modele_vehicule}</p>
            )}
            {resultat.resultat_ocr.donnees.date_effet && (
              <p><strong>Date d'effet :</strong> {resultat.resultat_ocr.donnees.date_effet}</p>
            )}
            {resultat.resultat_ocr.donnees.date_expiration && (
              <p><strong>Expiration :</strong> {resultat.resultat_ocr.donnees.date_expiration}</p>
            )}
            
            {/* Indicateur si aucun champ extrait */}
            {!resultat.resultat_ocr.donnees.compagnie_assurance && 
             !resultat.resultat_ocr.donnees.numero_contrat && 
             !resultat.resultat_ocr.donnees.immatriculation_vehicule && (
              <p className="text-terre italic">⚠️ Aucun champ extrait du document</p>
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

          {/* ✅ BOUTON POUR AFFICHER LE TEXTE BRUT OCR (DÉBOGAGE) */}
          <div className="mt-6 pt-6 border-t border-ardoise-clair/20">
            <button
              onClick={() => setAfficherTexteBrut(!afficherTexteBrut)}
              className="text-xs text-lagune hover:underline font-medium"
            >
              {afficherTexteBrut ? "🔽 Masquer" : "🔍 Voir le texte brut extrait par l'OCR"}
            </button>
            
            {afficherTexteBrut && resultat.resultat_ocr.donnees.texte_brut && (
              <div className="mt-3 p-3 bg-ardoise-clair/10 rounded-lg">
                <p className="text-xs font-semibold text-ardoise mb-2">
                  Texte brut extrait ({resultat.resultat_ocr.donnees.texte_brut.length} caractères) :
                </p>
                <pre className="text-xs text-ardoise whitespace-pre-wrap font-mono bg-white p-2 rounded border border-ardoise-clair/20 max-h-64 overflow-auto">
                  {resultat.resultat_ocr.donnees.texte_brut}
                </pre>
                <p className="text-xs text-ardoise-clair mt-2">
                  Confiance OCR : <span className="font-semibold">{resultat.resultat_ocr.donnees.taux_confiance_moyen?.toFixed(1) || 0}%</span>
                </p>
              </div>
            )}
          </div>
        </Carte>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/identite">
          <Bouton variante="ghost">← Retour à l'identité</Bouton>
        </Link>
      </div>
    </div>
  );
}