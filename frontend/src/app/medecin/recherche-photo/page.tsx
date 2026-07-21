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
  const [apercu, setApercu] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [resultat, setResultat] = useState<RecherchePersonne | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const refPhoto = useRef<HTMLInputElement>(null);

  async function handleSelectionFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Garder le fichier pour l'upload
    setFichier(file);

    // Générer un aperçu base64 pour l'affichage uniquement
    const reader = new FileReader();
    reader.onload = () => setApercu(reader.result as string);
    reader.onerror = () => setErreur("Impossible de lire le fichier.");
    reader.readAsDataURL(file);
  }

  async function handleRechercher() {
    if (!fichier) {
      setErreur("Veuillez sélectionner une photo.");
      return;
    }

    setChargement(true);
    setErreur("");
    setResultat(null);

    try {
      const data = await rechercherPersonneParPhoto(fichier);
      setResultat(data);
    } catch {
      setErreur("Erreur lors de la recherche. Vérifie que la photo est valide.");
    } finally {
      setChargement(false);
    }
  }

  function handleReset() {
    setApercu(null);
    setFichier(null);
    setResultat(null);
    setErreur("");
  }

    function handlePrendreEnCharge(personne: Personne) {
    window.location.href = `/medecin/nouveau-dossier?personne_id=${personne.id}`;
  }

  return (
    <div className="space-y-8 apparition">
            <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/medecin/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Recherche par photo</span>
      </nav>

      <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Espace médical</p>
      <h1>Recherche d'une personne par photo</h1>
            <p className="text-ardoise-clair max-w-2xl">
              Prends en photo une personne pour retrouver ses informations dans la base de données
              et la prendre en charge rapidement. Les données sont protégées et tracées.
            </p>

            {/* Bandeau info embeddings */}
            {!resultat && (
              <div className="bg-lagune/10 border border-lagune/30 p-4 rounded-lg">
                <p className="text-sm font-semibold text-lagune mb-1">
                  🤖 Reconnaissance faciale active
                </p>
                <p className="text-xs text-ardoise-clair">
                  Deepface (Facenet512) est opérationnel. Les embeddings sont générés automatiquement
                  lors de chaque vérification visuelle des citoyens.
                </p>
              </div>
            )}

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
                    {apercu ? (
            <img src={apercu} alt="Photo de la personne" className="max-h-80 mx-auto rounded-lg" />
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
            onChange={handleSelectionFichier}
          />
        </div>
                {apercu && (
          <button
            onClick={() => { refPhoto.current?.click(); }}
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
          disabled={!fichier || chargement}
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
              <>
                                {resultat.trouve && (
                  <Carte titre="✅ Personne identifiée">
                    <div className="space-y-6">
                      {/* Score de confiance */}
                      <div className="text-center">
                        <div className="max-w-xs mx-auto">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-ardoise-clair font-medium">Confiance</span>
                            <span className={`font-bold ${resultat.score_confiance >= 70 ? "text-succes" : resultat.score_confiance >= 45 ? "text-ambre" : "text-terre"}`}>
                              {resultat.score_confiance}%
                            </span>
                          </div>
                          <BarreProgression
                            valeur={Math.min(resultat.score_confiance, 100)}
                            couleur={resultat.score_confiance >= 70 ? "succes" : resultat.score_confiance >= 45 ? "ocre" : "terre"}
                          />
                        </div>
                        <p className="text-xs text-ardoise-clair/60 mt-2">
                          Analyse en {resultat.temps_analyse_ms}ms • Facenet512
                        </p>
                      </div>

                      {/* Identité */}
                      <div className="bg-ardoise-clair/5 rounded-xl p-5">
                        <p className="text-sm font-semibold text-ardoise mb-4 flex items-center gap-2">
                          <span>👤</span> Identité
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-ardoise-clair/60 uppercase tracking-wider">Nom complet</p>
                            <p className="text-lg font-bold text-ardoise">{resultat.personne?.nom} {resultat.personne?.prenom}</p>
                          </div>
                          <div>
                            <p className="text-xs text-ardoise-clair/60 uppercase tracking-wider">ID DigiID</p>
                            <p className="text-sm font-mono text-ardoise">{resultat.personne?.digiid || resultat.personne?.id}</p>
                          </div>
                          <div>
                            <p className="text-xs text-ardoise-clair/60 uppercase tracking-wider">Date de naissance</p>
                            <p className="text-sm text-ardoise font-medium">{resultat.personne?.date_naissance || "Non renseignée"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-ardoise-clair/60 uppercase tracking-wider">Groupe sanguin</p>
                            <p className="text-sm text-ardoise font-medium">{resultat.personne?.groupe_sanguin || "Non renseigné"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Contact */}
                      <div className="bg-ardoise-clair/5 rounded-xl p-5">
                        <p className="text-sm font-semibold text-ardoise mb-4 flex items-center gap-2">
                          <span>📞</span> Contact
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-ardoise-clair/60 uppercase tracking-wider">Téléphone</p>
                            <p className="text-sm text-ardoise font-medium">{resultat.personne?.telephone || "Non renseigné"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-ardoise-clair/60 uppercase tracking-wider">Contact urgence</p>
                            <p className="text-sm text-ardoise font-medium">{resultat.personne?.contact_urgence || "Non renseigné"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Antécédents médicaux */}
                      {resultat.personne?.antecedents && resultat.personne.antecedents.length > 0 && (
                        <div className="bg-ocre/5 border border-ocre/20 rounded-xl p-5">
                          <p className="text-xs font-semibold text-ocre mb-3 flex items-center gap-2">
                            <span>⚠️</span> Antécédents médicaux
                          </p>
                          <ul className="text-sm text-ardoise space-y-1.5">
                            {resultat.personne.antecedents.map((a: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-ocre mt-0.5">•</span>
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Allergies */}
                      {resultat.personne?.allergies && resultat.personne.allergies.length > 0 && (
                        <div className="bg-terre/5 border border-terre/20 rounded-xl p-5">
                          <p className="text-xs font-semibold text-terre mb-3 flex items-center gap-2">
                            <span>🚫</span> Allergies connues
                          </p>
                          <ul className="text-sm text-ardoise space-y-1.5">
                            {resultat.personne.allergies.map((a: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-terre mt-0.5">•</span>
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                        <Bouton
                          variante="primaire"
                          onClick={() => handlePrendreEnCharge(resultat.personne!)}
                        >
                          🏥 Créer un dossier de prise en charge
                        </Bouton>
                        <Link href={`/medecin/dossiers/${resultat.personne?.id}`}>
                          <Bouton variante="secondaire">📋 Voir le dossier médical</Bouton>
                        </Link>
                      </div>
                    </div>
                  </Carte>
                )}

                                {!resultat.trouve && (
                  <Carte titre="❓ Personne non trouvée">
                    <div className="text-center py-4">
                      <p className="text-6xl mb-4">❓</p>
                      <p className="text-xl font-bold text-terre mb-2">PERSONNE NON TROUVÉE</p>
                      <p className="text-sm text-ardoise-clair mb-4 max-w-md mx-auto">
                        Aucune correspondance trouvée dans la base de données.
                        {resultat.score_confiance > 0 && (
                          <span> Score maximum : {resultat.score_confiance}% (en dessous du seuil de 45%).</span>
                        )}
                      </p>
                      <div className="bg-ardoise-clair/5 rounded-lg p-3 mb-4 max-w-xs mx-auto">
                        <div className="flex justify-between text-xs text-ardoise-clair">
                          <span>Temps d'analyse</span>
                          <span className="font-medium text-ardoise">{resultat.temps_analyse_ms}ms</span>
                        </div>
                        <div className="flex justify-between text-xs text-ardoise-clair mt-1">
                          <span>Score max</span>
                          <span className="font-medium text-ardoise">{resultat.score_confiance}%</span>
                        </div>
                        <div className="flex justify-between text-xs text-ardoise-clair mt-1">
                          <span>Seuil requis</span>
                          <span className="font-medium text-ardoise">45%</span>
                        </div>
                      </div>
                      <div className="flex gap-3 justify-center flex-wrap">
                        <Link href="/medecin/nouveau-dossier">
                          <Bouton variante="primaire">➕ Créer un nouveau dossier</Bouton>
                        </Link>
                        <Bouton variante="ghost" onClick={handleReset}>
                          Réessayer
                        </Bouton>
                      </div>
                    </div>
                  </Carte>
                )}
              </>
            )}

      <div className="flex gap-3 flex-wrap">
                <Link href="/medecin/dashboard">
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