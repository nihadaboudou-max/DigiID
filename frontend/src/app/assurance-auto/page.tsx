"use client";

import { useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { uploaderAssurance, type ReponseUploadAssurance } from "@/services/assurance_auto";

export default function PageAssuranceAuto() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [fichier, setFichier] = useState<File | null>(null);
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState<ReponseUploadAssurance | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

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

          {resultat.resultat_ocr.succes && (
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
            </div>
          )}

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