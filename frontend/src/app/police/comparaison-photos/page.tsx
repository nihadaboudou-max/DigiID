"use client";

/**
 * Page de comparaison de photos (reconnaissance faciale).
 * Permet à un officier de comparer deux photos pour vérifier une identité.
 */
import { useState, useRef } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { comparerPhotos } from "@/services/police";
import type { ComparaisonPhotos } from "@/services/police";

export default function PageComparaisonPhotos() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [photoSource, setPhotoSource] = useState<string | null>(null);
  const [photoCible, setPhotoCible] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ComparaisonPhotos | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const refSource = useRef<HTMLInputElement>(null);
  const refCible = useRef<HTMLInputElement>(null);

  function lireFichier(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleComparer() {
    if (!photoSource || !photoCible) {
      setErreur("Veuillez sélectionner deux photos.");
      return;
    }

    setChargement(true);
    setErreur("");
    setResultat(null);

    try {
      const data = await comparerPhotos({
        photo_source: photoSource,
        photo_cible: photoCible,
      });
      setResultat(data);
    } catch {
      setErreur("Erreur lors de la comparaison. Vérifie que les photos sont valides.");
    } finally {
      setChargement(false);
    }
  }

  function handleReset() {
    setPhotoSource(null);
    setPhotoCible(null);
    setResultat(null);
    setErreur("");
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Comparaison de photos</span>
      </nav>

      <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>
      <h1>Comparaison de photos</h1>
      <p className="text-ardoise-clair max-w-2xl">
        Compare deux photos pour vérifier qu'il s'agit de la même personne.
        Utilisé pour la vérification d'identité sur le terrain.
      </p>

      {/* Erreur */}
      {erreur && (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">{erreur}</p>
        </div>
      )}

      {/* Sélection des photos */}
      <div className="grid md:grid-cols-2 gap-6">
        <Carte titre="Photo source (référence)">
          <div
            className="border-2 border-dashed border-ardoise-clair/30 rounded-xl p-8 text-center cursor-pointer hover:border-lagune transition-colors"
            onClick={() => refSource.current?.click()}
          >
            {photoSource ? (
              <img src={photoSource} alt="Photo source" className="max-h-64 mx-auto rounded-lg" />
            ) : (
              <div>
                <p className="text-4xl mb-2">📷</p>
                <p className="text-sm text-ardoise-clair">Clique pour sélectionner une photo</p>
                <p className="text-xs text-ardoise-clair/60 mt-1">Photo d'identité, CNI, ou visage</p>
              </div>
            )}
            <input
              ref={refSource}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setPhotoSource(await lireFichier(file));
              }}
            />
          </div>
          {photoSource && (
            <button
              onClick={() => { setPhotoSource(null); refSource.current?.click(); }}
              className="text-xs text-lagune hover:underline mt-2"
            >
              Changer la photo
            </button>
          )}
        </Carte>

        <Carte titre="Photo cible (à vérifier)">
          <div
            className="border-2 border-dashed border-ardoise-clair/30 rounded-xl p-8 text-center cursor-pointer hover:border-lagune transition-colors"
            onClick={() => refCible.current?.click()}
          >
            {photoCible ? (
              <img src={photoCible} alt="Photo cible" className="max-h-64 mx-auto rounded-lg" />
            ) : (
              <div>
                <p className="text-4xl mb-2">📸</p>
                <p className="text-sm text-ardoise-clair">Clique pour sélectionner une photo</p>
                <p className="text-xs text-ardoise-clair/60 mt-1">Photo prise sur le terrain</p>
              </div>
            )}
            <input
              ref={refCible}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setPhotoCible(await lireFichier(file));
              }}
            />
          </div>
          {photoCible && (
            <button
              onClick={() => { setPhotoCible(null); refCible.current?.click(); }}
              className="text-xs text-lagune hover:underline mt-2"
            >
              Changer la photo
            </button>
          )}
        </Carte>
      </div>

      {/* Boutons d'action */}
      <div className="flex gap-3 justify-center">
        <Bouton
          variante="primaire"
          chargement={chargement}
          disabled={!photoSource || !photoCible || chargement}
          onClick={handleComparer}
        >
          🔍 Comparer les photos
        </Bouton>
        <Bouton variante="ghost" onClick={handleReset}>
          Réinitialiser
        </Bouton>
      </div>

      {/* Résultat */}
      {resultat && (
        <Carte titre="Résultat de la comparaison">
          <div className="text-center py-4">
            <p className="text-6xl mb-4">
              {resultat.est_compatible ? "✅" : "❌"}
            </p>
            <p className={`text-2xl font-bold mb-2 ${resultat.est_compatible ? "text-succes" : "text-terre"}`}>
              {resultat.est_compatible ? "CORRESPONDANCE" : "NON CONFORME"}
            </p>
            <div className="max-w-xs mx-auto mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-ardoise-clair">Similarité</span>
                <span className={`font-bold ${resultat.score_similarite >= resultat.seuil_requis ? "text-succes" : "text-terre"}`}>
                  {resultat.score_similarite}%
                </span>
              </div>
              <BarreProgression
                valeur={Math.min(resultat.score_similarite, 100)}
                couleur={resultat.est_compatible ? "succes" : "terre"}
              />
              <p className="text-xs text-ardoise-clair mt-2">
                Seuil requis : {resultat.seuil_requis}%
              </p>
            </div>
            <p className="text-xs text-ardoise-clair">
              Analyse effectuée en {resultat.temps_analyse_ms}ms
            </p>
          </div>

          {resultat.details && Object.keys(resultat.details).length > 0 && (
            <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
              <p className="text-sm font-semibold text-ardoise mb-2">Détails techniques</p>
              <pre className="text-xs text-ardoise-clair bg-sable p-3 rounded overflow-auto max-h-40">
                {JSON.stringify(resultat.details, null, 2)}
              </pre>
            </div>
          )}
        </Carte>
      )}

      <div className="flex gap-3 flex-wrap">
        <Link href="/police/verification">
          <Bouton variante="secondaire">🔍 Nouvelle vérification</Bouton>
        </Link>
        <Link href="/police/dashboard">
          <Bouton variante="ghost">← Retour au dashboard</Bouton>
        </Link>
      </div>

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          ⚠️ Toute comparaison est tracée et horodatée. Utilisation réservée aux officiers habilités.
        </p>
      </div>
    </div>
  );
}
