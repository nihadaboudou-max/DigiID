"use client";

/**
 * Page de recherche d'une personne par photo (reconnaissance faciale).
 * Permet à un agent médical de retrouver les informations d'une personne
 * à partir d'une photo, afin de la prendre en charge rapidement.
 */
import { useState, useRef } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { rechercherPersonneParPhoto } from "@/services/medical";
import type { RecherchePersonne, Personne } from "@/services/medical";

export default function PageRecherchePersonne() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical", "chef_medical"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [resultat, setResultat] = useState<RecherchePersonne | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const refPhoto = useRef<HTMLInputElement>(null);

  function lireFichier(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleRechercher() {
    if (!photo) {
      setErreur("Veuillez sélectionner une photo.");
      return;
    }

    setChargement(true);
    setErreur("");
    setResultat(null);

    try {
      const data = await rechercherPersonneParPhoto({ photo });
      setResultat(data);
    } catch {
      setErreur("Erreur lors de la recherche. Vérifie que la photo est valide.");
    } finally {
      setChargement(false);
    }
  }

  function handleReset() {
    setPhoto(null);
    setResultat(null);
    setErreur("");
  }

  function handlePrendreEnCharge(personne: Personne) {
    // Redirige vers la page de prise en charge avec les infos de la personne
    window.location.href = `/medical/prise-en-charge?personne_id=${personne.id}`;
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/medical/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Recherche par photo</span>
      </nav>

      <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Espace médical</p>
      <h1>Recherche d'une personne par photo</h1>
      <p className="text-ardoise-clair max-w-2xl">
        Prends en photo une personne pour retrouver ses informations dans la base de données
        et la prendre en charge rapidement.
      </p>

      {/* Erreur */}
      {erreur && (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">{erreur}</p>
        </div>
      )}

      {/* Sélection de la photo */}
      <Carte titre="Photo de la personne à identifier">
        <div
          className="border-2 border-dashed border-ardoise-clair/30 rounded-xl p-8 text-center cursor-pointer hover:border-lagune transition-colors"
          onClick={() => refPhoto.current?.click()}
        >
          {photo ? (
            <img src={photo} alt="Photo de la personne" className="max-h-80 mx-auto rounded-lg" />
          ) : (
            <div>
              <p className="text-5xl mb-2">📷</p>
              <p className="text-sm text-ardoise-clair">Clique pour sélectionner ou prendre une photo</p>
              <p className="text-xs text-ardoise-clair/60 mt-1">Photo du visage de la personne</p>
            </div>
          )}
          <input
            ref={refPhoto}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setPhoto(await lireFichier(file));
            }}
          />
        </div>
        {photo && (
          <button
            onClick={() => { setPhoto(null); refPhoto.current?.click(); }}
            className="text-xs text-lagune hover:underline mt-2"
          >
            Changer la photo
          </button>
        )}
      </Carte>

      {/* Boutons d'action */}
      <div className="flex gap-3 justify-center">
        <Bouton
          variante="primaire"
          chargement={chargement}
          disabled={!photo || chargement}
          onClick={handleRechercher}
        >
          🔍 Rechercher dans la base de données
        </Bouton>
        <Bouton variante="ghost" onClick={handleReset}>
          Réinitialiser
        </Bouton>
      </div>

      {/* Résultat */}
      {resultat && (
        <Carte titre="Résultat de la recherche">
          {resultat.trouve ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-6xl mb-2">✅</p>
                <p className="text-2xl font-bold text-succes mb-2">PERSONNE IDENTIFIÉE</p>
                <div className="max-w-xs mx-auto mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-ardoise-clair">Confiance</span>
                    <span className="font-bold text-succes">{resultat.score_confiance}%</span>
                  </div>
                  <BarreProgression
                    valeur={Math.min(resultat.score_confiance, 100)}
                    couleur="succes"
                  />
                </div>
                <p className="text-xs text-ardoise-clair">
                  Analyse effectuée en {resultat.temps_analyse_ms}ms
                </p>
              </div>

              {/* Informations de la personne */}
              <div className="mt-6 pt-4 border-t border-ardoise-clair/10">
                <p className="text-sm font-semibold text-ardoise mb-3">Informations de la personne</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    {resultat.personne?.photo && (
                      <img
                        src={resultat.personne.photo}
                        alt={resultat.personne.nom}
                        className="w-16 h-16 rounded-full object-cover border-2 border-lagune"
                      />
                    )}
                    <div>
                      <p className="font-bold text-ardoise">{resultat.personne?.nom} {resultat.personne?.prenom}</p>
                      <p className="text-xs text-ardoise-clair">ID: {resultat.personne?.id}</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p><span className="text-ardoise-clair">Date de naissance :</span> <span className="text-ardoise font-medium">{resultat.personne?.date_naissance}</span></p>
                    <p><span className="text-ardoise-clair">Groupe sanguin :</span> <span className="text-ardoise font-medium">{resultat.personne?.groupe_sanguin}</span></p>
                    <p><span className="text-ardoise-clair">Téléphone :</span> <span className="text-ardoise font-medium">{resultat.personne?.telephone}</span></p>
                    <p><span className="text-ardoise-clair">Contact urgence :</span> <span className="text-ardoise font-medium">{resultat.personne?.contact_urgence}</span></p>
                  </div>
                </div>

                {/* Antécédents médicaux */}
                {resultat.personne?.antecedents && resultat.personne.antecedents.length > 0 && (
                  <div className="mt-4 p-3 bg-ocre/5 border border-ocre/20 rounded">
                    <p className="text-xs font-semibold text-ocre mb-2">⚠️ Antécédents médicaux</p>
                    <ul className="text-sm text-ardoise space-y-1">
                      {resultat.personne.antecedents.map((a: string, i: number) => (
                        <li key={i}>• {a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Allergies */}
                {resultat.personne?.allergies && resultat.personne.allergies.length > 0 && (
                  <div className="mt-3 p-3 bg-terre/5 border border-terre/20 rounded">
                    <p className="text-xs font-semibold text-terre mb-2">🚫 Allergies connues</p>
                    <ul className="text-sm text-ardoise space-y-1">
                      {resultat.personne.allergies.map((a: string, i: number) => (
                        <li key={i}>• {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Bouton de prise en charge */}
              <div className="mt-6 pt-4 border-t border-ardoise-clair/10 flex gap-3 justify-center">
                <Bouton
                  variante="primaire"
                  onClick={() => handlePrendreEnCharge(resultat.personne!)}
                >
                  🏥 Prendre en charge cette personne
                </Bouton>
                <Link href={`/medical/dossier/${resultat.personne?.id}`}>
                  <Bouton variante="secondaire">📋 Voir le dossier complet</Bouton>
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-6xl mb-4">❓</p>
              <p className="text-2xl font-bold text-terre mb-2">PERSONNE NON TROUVÉE</p>
              <p className="text-sm text-ardoise-clair mb-4">
                Aucune correspondance n'a été trouvée dans la base de données.
              </p>
              {resultat.score_confiance !== undefined && (
                <p className="text-xs text-ardoise-clair mb-4">
                  Score de similarité le plus proche : {resultat.score_confiance}%
                </p>
              )}
              <div className="flex gap-3 justify-center">
                <Link href="/medical/nouveau-dossier">
                  <Bouton variante="primaire">➕ Créer un nouveau dossier</Bouton>
                </Link>
                <Bouton variante="ghost" onClick={handleReset}>
                  Réessayer
                </Bouton>
              </div>
            </div>
          )}
        </Carte>
      )}

      <div className="flex gap-3 flex-wrap">
        <Link href="/medical/dashboard">
          <Bouton variante="ghost">← Retour au dashboard</Bouton>
        </Link>
      </div>

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          ⚠️ Toute recherche est tracée et horodatée. Utilisation réservée aux agents médicaux habilités.
          Les données médicales sont confidentielles et protégées.
        </p>
      </div>
    </div>
  );
}