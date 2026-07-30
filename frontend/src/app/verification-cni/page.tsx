"use client";

/**
 * Page de vérification d'identité par scan de la Carte Nationale d'Identité.
 *
 * Permet à l'utilisateur de :
 * 1. Uploader le recto et le verso de sa CNI
 * 2. Lancer l'analyse OCR pour extraire les données
 * 3. Voir les résultats de la vérification (avec rejet si incohérent)
 * 4. Consulter l'historique de ses vérifications
 *
 * @module verification-cni
 */
import React, { useCallback, useEffect, useState } from "react";
import UploadCNI from "@/composants/verification-cni/UploadCNI";
import ResultatCNI from "@/composants/verification-cni/ResultatCNI";
import { Alerte } from "@/composants/commun/Alerte";
import {
  listerVerifications,
  obtenirSynthese,
  ReponseUploadCNI,
  SyntheseVerificationCNI,
  VerificationCNIDetail,
  ListeVerificationsCNI,
  supprimerVerification,
  restaurerVerification,
  iconeStatutCNI,
  classeStatutCNI,
} from "@/services/verification_cni";

type OngletType = "scan" | "resultats" | "historique";

export default function PageVerificationCNI() {
  // --- État ---
  const [ongletActif, setOngletActif] = useState<OngletType>("scan");
  const [dernierResultatRecto, setDernierResultatRecto] = useState<ReponseUploadCNI | null>(null);
  const [dernierResultatVerso, setDernierResultatVerso] = useState<ReponseUploadCNI | null>(null);
  const [imageRecto, setImageRecto] = useState<string | null>(null);
  const [imageVerso, setImageVerso] = useState<string | null>(null);
  const [synthese, setSynthese] = useState<SyntheseVerificationCNI | null>(null);
  const [historique, setHistorique] = useState<ListeVerificationsCNI | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [cniRejetee, setCniRejetee] = useState(false);

  // --- Chargement initial ---
  useEffect(() => {
    chargerDonnees();
  }, []);

  const chargerDonnees = async () => {
    setChargement(true);
    try {
      const [syntheseData, historiqueData] = await Promise.all([
        obtenirSynthese().catch(() => null),
        listerVerifications(20).catch(() => null),
      ]);
      setSynthese(syntheseData);
      setHistorique(historiqueData);
      
      // ✅ Vérifier si la CNI a été rejetée
      if (syntheseData && syntheseData.statut === "rejete") {
        setCniRejetee(true);
      } else {
        setCniRejetee(false);
      }
    } catch {
      // Erreur silencieuse si aucune donnée
    } finally {
      setChargement(false);
    }
  };

  // --- Gestion des succès d'upload (Mise à jour optimiste) ---
  const handleSuccesRecto = useCallback(
    (resultat: ReponseUploadCNI, imageUrl?: string) => {
      setDernierResultatRecto(resultat);
      setErreur(null);
      if (imageUrl) setImageRecto(imageUrl);
      
      // ✅ CORRECTION : Vérifier si la CNI est rejetée (incohérence)
      if (resultat.resultat_ocr && !resultat.resultat_ocr.succes) {
        setErreur("L'OCR n'a pas pu extraire les données. Vérifie la qualité de l'image.");
      } else if (resultat.resultat_ocr?.erreurs && resultat.resultat_ocr.erreurs.length > 0) {
        const erreursIncoherence = resultat.resultat_ocr.erreurs.filter(e => 
          e.includes("⚠️") || e.includes("Incohérence") || e.includes("ne correspond pas")
        );
        if (erreursIncoherence.length > 0) {
          setCniRejetee(true);
          setErreur(erreursIncoherence.join("\n"));
          return; // On s'arrête ici
        }
      }

      // ✅ Mise à jour OPTIMISTE pour un affichage instantané sans rechargement
      setCniRejetee(false);
      setSynthese(prevSynthese => ({
        id_recto: resultat.id,
        id_verso: prevSynthese?.id_verso || null,
        statut: resultat.statut || "approuve",
        message: resultat.message || "Recto scanné avec succès",
        donnees_recto: resultat.resultat_ocr?.donnees || null,
        donnees_verso: prevSynthese?.donnees_verso || null,
        validation_globale: null, // ✅ Requis par le type SyntheseVerificationCNI
        champs_verifies: resultat.resultat_ocr?.champs_extraits || 0,
        champs_total: 10,
      }));

      setOngletActif("resultats"); // Changement d'onglet immédiat

      // Rechargement en arrière-plan pour synchronisation finale avec le backend
      chargerDonnees();
    },
    []
  );

  const handleSuccesVerso = useCallback(
    (resultat: ReponseUploadCNI, imageUrl?: string) => {
      setDernierResultatVerso(resultat);
      setErreur(null);
      if (imageUrl) setImageVerso(imageUrl);
      
      if (resultat.resultat_ocr && !resultat.resultat_ocr.succes) {
        setErreur("L'OCR n'a pas pu extraire les données. Vérifie la qualité de l'image.");
      } else if (resultat.resultat_ocr?.erreurs && resultat.resultat_ocr.erreurs.length > 0) {
        const erreursIncoherence = resultat.resultat_ocr.erreurs.filter(e => 
          e.includes("⚠️") || e.includes("Incohérence")
        );
        if (erreursIncoherence.length > 0) {
          setCniRejetee(true);
          setErreur(erreursIncoherence.join("\n"));
          return;
        }
      }

      // ✅ Mise à jour OPTIMISTE
      setCniRejetee(false);
      setSynthese(prevSynthese => ({
        id_recto: prevSynthese?.id_recto || null,
        id_verso: resultat.id,
        statut: resultat.statut || "approuve",
        message: resultat.message || "Verso scanné avec succès",
        donnees_recto: prevSynthese?.donnees_recto || null,
        donnees_verso: resultat.resultat_ocr?.donnees || null,
        validation_globale: null, // ✅ Requis par le type SyntheseVerificationCNI
        champs_verifies: (prevSynthese?.champs_verifies || 0) + (resultat.resultat_ocr?.champs_extraits || 0),
        champs_total: 10,
      }));

      setOngletActif("resultats");
      chargerDonnees();
    },
    []
  );

  const handleErreur = useCallback((msg: string) => {
    setErreur(msg);
    setCniRejetee(true);
  }, []);

  // --- Réinitialiser l'erreur quand on change d'onglet ---
  useEffect(() => {
    if (ongletActif === "scan") {
      setErreur(null);
      setCniRejetee(false);
    }
  }, [ongletActif]);

  // --- Gestion historique ---
  const handleSupprimer = async (id: string) => {
    try {
      await supprimerVerification(id);
      chargerDonnees();
    } catch {
      setErreur("Erreur lors de la suppression.");
    }
  };

  const handleRestaurer = async (id: string) => {
    try {
      await restaurerVerification(id);
      chargerDonnees();
    } catch {
      setErreur("Erreur lors de la restauration.");
    }
  };

  // --- Navigation ---
  const onglets: { id: OngletType; label: string; icone: string }[] = [
    { id: "scan", label: "Scanner", icone: "📷" },
    { id: "resultats", label: "Résultats", icone: "📋" },
    { id: "historique", label: "Historique", icone: "📜" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair mb-6">
        <a href="/identite" className="hover:text-lagune transition-colors">Identité</a>
        <span>/</span>
        <span className="text-ardoise font-semibold">Scan CNI</span>
      </nav>

      {/* En-tête */}
      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ardoise">
              Vérification d&apos;identité — CNI
            </h1>
            <p className="text-ardoise-clair mt-1">
              Scanne ta Carte Nationale d&apos;Identité pour vérifier ton identité.
              Les données sont extraites automatiquement par OCR et validées.
            </p>
          </div>
          <a href="/identite">
            <button className="px-4 py-2 text-sm text-lagune border border-lagune rounded-lg hover:bg-lagune hover:text-white transition-colors">
              ← Retour au menu Identité
            </button>
          </a>
        </div>
      </div>

      {/* ✅ CORRECTION : Message d'erreur principal */}
      {erreur && (
        <Alerte 
          variante={cniRejetee ? "erreur" : "avertissement"} 
          titre={cniRejetee ? "CNI rejetée" : "Attention"}
          className="mb-6"
        >
          <div className="whitespace-pre-line">{erreur}</div>
          {cniRejetee && (
            <div className="mt-3 text-sm">
              <p className="font-semibold mb-2">Que faire ?</p>
              <ul className="list-disc list-inside space-y-1 text-sm opacity-90">
                <li>Vérifie que les informations sur ta CNI correspondent à ton profil DigiID</li>
                <li>Si ton profil est incorrect, <a href="/parametres" className="underline font-semibold">modifie-le ici</a></li>
                <li>Si la CNI est correcte mais rejetée, contacte le support</li>
              </ul>
            </div>
          )}
        </Alerte>
      )}

      {/* ✅ CORRECTION : Synthèse rapide UNIQUEMENT si approuvée ou rejetée */}
      {synthese && synthese.statut !== "en_attente" && (
        <div
          className={`mb-6 p-4 rounded-lg border ${classeStatutCNI(
            synthese.statut
          )}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{iconeStatutCNI(synthese.statut)}</span>
            <div className="flex-1">
              <p className="font-semibold">
                {synthese.statut === "approuve"
                  ? "✅ Identité vérifiée avec succès"
                  : "❌ Vérification d'identité échouée"}
              </p>
              <p className="text-sm opacity-80">{synthese.message}</p>
              {synthese.champs_verifies !== undefined && (
                <p className="text-xs mt-1 opacity-70">
                  {synthese.champs_verifies}/{synthese.champs_total} champs vérifiés
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Onglets de navigation */}
      <div className="flex border-b border-ardoise-clair/20 mb-6">
        {onglets.map((onglet) => (
          <button
            key={onglet.id}
            onClick={() => {
              setOngletActif(onglet.id);
              if (onglet.id === "historique") chargerDonnees();
            }}
            className={`
              flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors
              ${
                ongletActif === onglet.id
                  ? "border-b-2 border-lagune text-lagune"
                  : "text-ardoise-clair hover:text-ardoise hover:border-ardoise-clair/30"
              }
            `}
          >
            <span>{onglet.icone}</span>
            <span>{onglet.label}</span>
          </button>
        ))}
      </div>

      {/* Contenu selon onglet */}
      {ongletActif === "scan" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recto */}
          <UploadCNI
            face="recto"
            label="Recto de la CNI"
            description="La face avant avec ta photo et ton identité"
            onSucces={handleSuccesRecto}
            onErreur={handleErreur}
            desactive={cniRejetee || (dernierResultatRecto?.statut === "approuve" && !synthese?.id_verso)}
          />

          {/* Verso */}
          <UploadCNI
            face="verso"
            label="Verso de la CNI"
            description="La face arrière avec les informations complémentaires"
            onSucces={handleSuccesVerso}
            onErreur={handleErreur}
            desactive={cniRejetee}
          />
          
          {cniRejetee && (
            <div className="md:col-span-2">
              <Alerte variante="info" titre="🔁 Nouvelle tentative">
                <p className="text-sm">
                  Tu peux scanner une nouvelle CNI ou corriger les informations. 
                  Le système rejettera automatiquement les CNI incohérentes avec ton profil.
                </p>
              </Alerte>
            </div>
          )}
        </div>
      )}

      {ongletActif === "resultats" && (
        <div className="space-y-6">
          {/* ✅ CORRECTION : Afficher UNIQUEMENT la synthèse globale (pas de répétition) */}
          {synthese ? (
            <div>
              <h3 className="text-sm font-bold text-ardoise uppercase tracking-wide mb-3">
                Résultat de la vérification
              </h3>
              <ResultatCNI
                resultat={null}
                synthese={synthese}
                imageUrl={imageRecto}
                face="recto"
              />
              
              {/* ✅ NOUVEAU : Afficher les détails recto avec Nationalité et Pays émetteur */}
              {synthese.donnees_recto && (
                <div className="mt-6">
                  <h4 className="text-xs font-semibold text-ardoise-clair uppercase mb-2">
                    Détails extraits (Recto)
                  </h4>
                  <div className="bg-sable/30 p-4 rounded-lg text-sm space-y-2 border border-ardoise-clair/10">
                    {synthese.donnees_recto.nom_famille && (
                      <p><strong>Nom :</strong> {synthese.donnees_recto.nom_famille}</p>
                    )}
                    {synthese.donnees_recto.prenoms && (
                      <p><strong>Prénoms :</strong> {synthese.donnees_recto.prenoms}</p>
                    )}
                    {/* ✅ Affichage de la nationalité corrigée */}
                    {synthese.donnees_recto.nationalite && (
                      <p><strong>Nationalité :</strong> <span className="text-lagune font-semibold">{synthese.donnees_recto.nationalite}</span></p>
                    )}
                    {synthese.donnees_recto.pays_emetteur && (
                      <p><strong>Pays émetteur :</strong> {synthese.donnees_recto.pays_emetteur}</p>
                    )}
                    {synthese.donnees_recto.numero_cni && (
                      <p><strong>N° CNI :</strong> <span className="font-mono">{synthese.donnees_recto.numero_cni}</span></p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 bg-sable/30 rounded-lg border border-ardoise-clair/10">
              <p className="text-4xl mb-2">📋</p>
              <p className="text-ardoise font-medium">
                Aucune vérification disponible.
              </p>
              <p className="text-ardoise-clair text-sm mt-1">
                Scanne ta CNI pour voir les résultats.
              </p>
              <button
                onClick={() => setOngletActif("scan")}
                className="mt-4 px-4 py-2 bg-lagune text-white rounded-lg hover:bg-lagune/90 transition-colors"
              >
                Scanner ma CNI
              </button>
            </div>
          )}
        </div>
      )}

      {ongletActif === "historique" && (
        <div>
          <h3 className="text-sm font-bold text-ardoise uppercase tracking-wide mb-4">
            Historique des vérifications CNI
          </h3>

          {chargement && (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full mx-auto" />
              <p className="text-ardoise-clair mt-2">Chargement...</p>
            </div>
          )}

          {!chargement && (!historique || historique.historique.length === 0) && (
            <div className="text-center py-12 bg-sable/30 rounded-lg border border-ardoise-clair/10">
              <p className="text-4xl mb-2">📜</p>
              <p className="text-ardoise font-medium">
                Aucune vérification CNI pour le moment.
              </p>
              <p className="text-ardoise-clair text-sm mt-1">
                Scanne ta carte d&apos;identité pour commencer.
              </p>
            </div>
          )}

          {historique && historique.historique.length > 0 && (
            <div className="space-y-3">
              {historique.historique.map((verif: VerificationCNIDetail) => (
                <div
                  key={verif.id}
                  className={`p-4 rounded-lg border ${classeStatutCNI(
                    verif.statut
                  )} ${
                    verif.est_supprime ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">
                        {iconeStatutCNI(verif.statut)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ardoise">
                            {verif.face === "recto" ? "Recto" : "Verso"}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-ardoise-clair/20 text-ardoise">
                            {verif.statut}
                          </span>
                          {verif.est_supprime && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-terre/20 text-terre">
                              Corbeille
                            </span>
                          )}
                          {verif.est_valide === false && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-200 text-red-700">
                              Rejetée
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-ardoise-clair mt-1">
                          {verif.nom_fichier}
                        </p>
                        {verif.numero_cni && (
                          <p className="text-xs text-ardoise-clair mt-1 font-mono">
                            N°: {verif.numero_cni}
                          </p>
                        )}
                        <p className="text-xs text-ardoise-clair/60 mt-1">
                          {new Date(verif.cree_le).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {!verif.est_supprime ? (
                        <button
                          onClick={() => handleSupprimer(verif.id)}
                          className="text-xs text-terre hover:text-terre/80 px-2 py-1 rounded hover:bg-terre/10"
                        >
                          Supprimer
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRestaurer(verif.id)}
                          className="text-xs text-lagune hover:text-lagune/80 px-2 py-1 rounded hover:bg-lagune/10"
                        >
                          Restaurer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Navigation vers les autres pages d'identité */}
      <div className="mt-8 flex flex-wrap gap-3 justify-between items-center border-t border-ardoise-clair/10 pt-6">
        <div className="flex flex-wrap gap-2">
          <a href="/identite">
            <button className="px-4 py-2 text-sm text-ardoise-clair border border-ardoise-clair/30 rounded-lg hover:bg-ardoise-clair/10 transition-colors">
              ← Tableau de bord
            </button>
          </a>
          <a href="/identite/verification-visuelle">
            <button className="px-4 py-2 text-sm text-ardoise-clair border border-ardoise-clair/30 rounded-lg hover:bg-ardoise-clair/10 transition-colors">
              Reconnaissance faciale →
            </button>
          </a>
        </div>
        <a href="/identite/email">
          <button className="px-4 py-2 text-sm text-lagune hover:underline transition-colors">
            Vérifier mon email →
          </button>
        </a>
      </div>

      {/* Pied de page avec info sécurité */}
      <div className="mt-4 p-4 bg-lagune/5 rounded-lg border border-lagune/20">
        <div className="flex items-start gap-3">
          <span className="text-lagune text-lg">🔒</span>
          <div>
            <h4 className="text-sm font-semibold text-lagune">
              Tes données sont protégées
            </h4>
            <p className="text-xs text-ardoise-clair mt-1">
              Les données extraites de ta CNI sont stockées de manière sécurisée
              et ne sont accessibles que par toi. Elles sont utilisées uniquement
              pour la vérification d&apos;identité dans le cadre du système DigiID.
              Tu peux supprimer ces données à tout moment depuis l&apos;historique.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}