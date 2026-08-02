"use client";

import { useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { uploaderPermis, type ReponseUploadPermis } from "@/services/permis_conduire";

export default function PagePermisConduire() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState<ReponseUploadPermis | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [afficherTexteBrut, setAfficherTexteBrut] = useState(false);

  async function gererUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFichier(file);
    setErreur(null);
    setResultat(null);
    setChargement(true);

    try {
      const res = await uploaderPermis(file);
      setResultat(res);
    } catch (err: any) {
      setErreur(err.message || "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  }

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
              {fichier ? fichier.name : "Clique pour choisir un fichier"}
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

        {chargement && (
          <div className="text-center py-4">
            <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-ardoise-clair mt-2">Analyse en cours...</p>
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
      {resultat && (
        <Carte>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ardoise">Résultat de l'extraction</h2>
            <Badge variante={resultat.statut === "approuve" ? "succes" : "terre"}>
              {resultat.statut}
            </Badge>
          </div>

          <p className="text-sm text-ardoise-clair mb-4">{resultat.message}</p>

          {/* ✅ AFFICHAGE DES DONNÉES EXTRAITES (TOUJOURS, MÊME EN CAS D'ÉCHEC) */}
          <div className="space-y-2 text-sm">
            {resultat.resultat_ocr.donnees.nom_famille && (
              <p><strong>Nom :</strong> {resultat.resultat_ocr.donnees.nom_famille}</p>
            )}
            {resultat.resultat_ocr.donnees.prenoms && (
              <p><strong>Prénoms :</strong> {resultat.resultat_ocr.donnees.prenoms}</p>
            )}
            {resultat.resultat_ocr.donnees.numero_permis && (
              <p><strong>N° Permis :</strong> <span className="font-mono">{resultat.resultat_ocr.donnees.numero_permis}</span></p>
            )}
            {resultat.resultat_ocr.donnees.categories && resultat.resultat_ocr.donnees.categories.length > 0 && (
              <p>
                <strong>Catégories :</strong>{" "}
                {resultat.resultat_ocr.donnees.categories.map((c) => (
                  <Badge key={c} variante="lagune" taille="petit" className="ml-1">{c}</Badge>
                ))}
              </p>
            )}
            {resultat.resultat_ocr.donnees.date_delivrance && (
              <p><strong>Délivré le :</strong> {resultat.resultat_ocr.donnees.date_delivrance}</p>
            )}
            {resultat.resultat_ocr.donnees.date_expiration && (
              <p><strong>Expire le :</strong> {resultat.resultat_ocr.donnees.date_expiration}</p>
            )}
            {resultat.resultat_ocr.donnees.autorite_delivrance && (
              <p><strong>Autorité :</strong> {resultat.resultat_ocr.donnees.autorite_delivrance}</p>
            )}
            
            {/* Indicateur visuel si aucun champ extrait */}
            {!resultat.resultat_ocr.donnees.nom_famille && 
             !resultat.resultat_ocr.donnees.prenoms && 
             !resultat.resultat_ocr.donnees.numero_permis && (
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
              {afficherTexteBrut ? " Masquer" : "🔍 Voir le texte brut extrait par l'OCR"}
            </button>
            
            {afficherTexteBrut && resultat.resultat_ocr.donnees.texte_brut && (
              <div className="mt-3 p-3 bg-ardoise-clair/10 rounded-lg">
                <p className="text-xs font-semibold text-ardoise mb-2">Texte brut extrait ({resultat.resultat_ocr.donnees.texte_brut.length} caractères) :</p>
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

      {/* Navigation */}
      <div className="flex flex-wrap gap-2">
        <Link href="/identite">
          <Bouton variante="ghost">← Retour à l'identité</Bouton>
        </Link>
      </div>
    </div>
  );
}