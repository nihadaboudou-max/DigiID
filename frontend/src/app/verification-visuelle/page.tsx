"use client";

/**
 * Page : Vérification Visuelle (Reconnaissance Faciale)
 * 
 * Règle métier : Un selfie ne peut être validé que s'il existe un document 
 * d'identité officiel (CNI, Passeport) déjà validé dans le dossier.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { 
  UploadPhoto, 
  StatutVerification, 
  HistoriqueVerification 
} from "@/composants/verification-visuelle";

import {
  obtenirStatutVerification,
  obtenirHistoriqueVerification,
  comparerPhotoProfilAvecDocument,
  type VerificationDetail,
  type ListeVerifications,
  type ResultatComparaisonFaciale,
} from "@/services/verification_visuelle";

import { ErreurAPI } from "@/services/client_api";

/**
 * Composant principal protégé par les rôles autorisés.
 */
export default function PageVerificationVisuelle() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={[
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical",
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine",
      "administrateur", "super_administrateur"
    ]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

/**
 * Contenu de la page.
 */
function Contenu() {
  // --- États de chargement et données ---
  const [statut, setStatut] = useState<VerificationDetail | null>(null);
  const [statutChargement, setStatutChargement] = useState(true);
  const [historique, setHistorique] = useState<ListeVerifications | null>(null);
  const [histoChargement, setHistoChargement] = useState(true);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);

  // --- États pour la comparaison automatique avec le document d'identité ---
  const [comparaison, setComparaison] = useState<ResultatComparaisonFaciale | null>(null);
  const [comparaisonChargement, setComparaisonChargement] = useState(false);
  const [derniereComparaisonId, setDerniereComparaisonId] = useState<string | null>(null);

  /**
   * Charge le statut actuel et l'historique au montage de la page.
   */
  const toutCharger = useCallback(async () => {
    setErreurGlobale(null);

    // 1. Statut
    setStatutChargement(true);
    try {
      const s = await obtenirStatutVerification();
      setStatut(s);
    } catch (e) {
      setErreurGlobale(e instanceof ErreurAPI ? e.message_utilisateur : "Impossible de charger le statut.");
      setStatut(null);
    } finally {
      setStatutChargement(false);
    }

    // 2. Historique
    setHistoChargement(true);
    try {
      const h = await obtenirHistoriqueVerification(20);
      setHistorique(h);
    } catch (e) {
      setHistorique(null);
    } finally {
      setHistoChargement(false);
    }
  }, []);

  useEffect(() => {
    toutCharger();
  }, [toutCharger]);

  /**
   * Lance la comparaison automatique SI le selfie vient d'être approuvé.
   */
  useEffect(() => {
    async function lancerComparaison() {
      if (!statutChargement && statut?.statut === "approuve" && statut.id !== derniereComparaisonId) {
        setComparaisonChargement(true);
        try {
          // On appelle l'API de comparaison. 
          // Le backend utilisera la CNI/Passport de l'utilisateur comme référence.
          const resultat = await comparerPhotoProfilAvecDocument(statut.id);
          setComparaison(resultat);
          setDerniereComparaisonId(statut.id);
        } catch (e) {
          setComparaison(null);
        } finally {
          setComparaisonChargement(false);
        }
      }
    }
    lancerComparaison();
  }, [statut, statutChargement, derniereComparaisonId]);

  // --- Rendu de l'interface ---
  return (
    <div className="max-w-4xl mx-auto space-y-6 apparition pb-20">
      
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-ardoise">Vérification Visuelle</h1>
        <p className="text-sm text-ardoise-clair mt-1">
          Prends une photo de ton visage. Elle sera comparée à ton document d'identité officiel.
        </p>
      </div>

      {erreurGlobale && <Alerte variante="erreur" titre="Erreur">{erreurGlobale}</Alerte>}

      {/* Section 1 : Upload */}
      <Carte titre="📸 Nouvelle vérification">
        <p className="text-sm text-ardoise-clair mb-4">
          Si tu n'as pas encore scanné ta pièce d'identité (CNI, Passeport), la vérification visuelle sera automatiquement bloquée.
        </p>
        {/* Le composant UploadPhoto gère maintenant ses propres erreurs de manière précise */}
        <UploadPhoto onSucces={toutCharger} />
      </Carte>

      {/* Section 2 : Statut actuel */}
      <Carte titre="📊 Statut actuel">
        {statutChargement ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-ardoise-clair italic">Chargement du statut...</p>
          </div>
        ) : statut ? (
          <>
            <StatutVerification verification={statut} chargement={false} />
            
            {/* Affichage du résultat de la comparaison automatique */}
            {statut.statut === "approuve" && (
              <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
                <h3 className="text-sm font-semibold text-ardoise mb-3">
                  🔍 Comparaison avec ton document d'identité
                </h3>

                {comparaisonChargement ? (
                  <p className="text-sm text-ardoise-clair italic">Comparaison en cours...</p>
                ) : comparaison ? (
                  <div className={`rounded-lg p-4 border-2 ${
                    comparaison.correspond ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
                  }`}>
                    <p className={`text-sm font-bold ${
                      comparaison.correspond ? "text-green-700" : "text-red-700"
                    }`}>
                      {comparaison.correspond ? "✅ Visage correspondant" : "❌ Visage non correspondant"}
                    </p>
                    <p className="text-xs text-ardoise mt-1">{comparaison.message}</p>
                    
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-ardoise-clair">Score de confiance</span>
                        <span className="font-bold">{(comparaison.score_confiance * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-sable rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            comparaison.correspond ? "bg-green-500" : "bg-red-500"
                          }`}
                          style={{ width: `${comparaison.score_confiance * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alerte variante="info" titre="Comparaison indisponible">
                    <p className="text-xs">La comparaison automatique n'a pas pu être effectuée.</p>
                  </Alerte>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-4xl mb-2">📷</p>
            <p className="text-ardoise font-medium">Aucune vérification visuelle</p>
            <p className="text-ardoise-clair text-sm mt-1">
              Envoie une photo pour commencer.
            </p>
          </div>
        )}
      </Carte>

      {/* Section 3 : Historique */}
      <Carte titre=" Historique">
        <HistoriqueVerification
          historique={historique?.historique || []}
          total={historique?.total || 0}
          chargement={histoChargement}
          onRafraichir={toutCharger}
        />
      </Carte>

      {/* Pied de page / Navigation */}
      <div className="flex flex-wrap gap-2 justify-between items-center pt-2">
        <Link href="/identite">
          <button className="px-3 py-1.5 text-xs text-ardoise border border-ardoise/20 rounded-lg hover:bg-sable/30 transition-colors">
            ← Retour à l'identité
          </button>
        </Link>
      </div>

      <div className="text-xs text-ardoise-clair/50 border-t border-ardoise-clair/10 pt-3">
        <p>🔒 Aucune photo brute n'est conservée. Seul un vecteur facial chiffré est stocké.</p>
      </div>
    </div>
  );
}