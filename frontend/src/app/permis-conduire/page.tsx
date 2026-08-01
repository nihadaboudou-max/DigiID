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

          {resultat.resultat_ocr.succes && (
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

      {/* Navigation */}
      <div className="flex flex-wrap gap-2">
        <Link href="/identite">
          <Bouton variante="ghost">← Retour à l'identité</Bouton>
        </Link>
      </div>
    </div>
  );
}