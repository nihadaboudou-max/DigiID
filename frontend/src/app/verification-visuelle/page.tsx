"use client";

/**
 * Page : Vérification Visuelle (Reconnaissance Faciale)
 * 
 * Règle métier : Un selfie ne peut être comparé que s'il existe un document 
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

import {
  listerDocumentsIdentite,
} from "@/services/documents_identite";

import { ErreurAPI } from "@/services/client_api";

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

function Contenu() {
  const [statut, setStatut] = useState<VerificationDetail | null>(null);
  const [statutChargement, setStatutChargement] = useState(true);
  const [historique, setHistorique] = useState<ListeVerifications | null>(null);
  const [histoChargement, setHistoChargement] = useState(true);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);

  const [comparaison, setComparaison] = useState<ResultatComparaisonFaciale | null>(null);
  const [comparaisonChargement, setComparaisonChargement] = useState(false);
  const [derniereComparaisonId, setDerniereComparaisonId] = useState<string | null>(null);

  const toutCharger = useCallback(async () => {
    setErreurGlobale(null);

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
   * ✅ NOUVELLE LOGIQUE DE DIAGNOSTIC :
   * Vérifie d'abord si un document existe avant de tenter la comparaison.
   */
  useEffect(() => {
    async function lancerComparaison() {
      if (!statutChargement && statut?.statut === "approuve" && statut.id !== derniereComparaisonId) {
        setComparaisonChargement(true);
        try {
          // 1. On vérifie d'abord si l'utilisateur a un document d'identité validé
          const docs = await listerDocumentsIdentite("cni"); // Adapte si ton API utilise "tous"
          const docValide = docs.documents?.find((d: any) => d.statut === "approuve" || d.est_valide);

          if (!docValide) {
            // Cas A : Pas de document valide trouvé
            setComparaison({
              correspond: false,
              score_confiance: 0,
              message: "Aucun document d'identité (CNI, Passeport) validé n'a été trouvé dans ton dossier. La comparaison est impossible.",
            });
            setDerniereComparaisonId(statut.id);
            setComparaisonChargement(false);
            return;
          }

          // 2. On lance la comparaison avec l'ID du document valide
          const idReference = docValide.verification_id ?? docValide.id;
          const resultat = await comparerPhotoProfilAvecDocument(idReference);
          
          setComparaison(resultat);
          setDerniereComparaisonId(statut.id);
        } catch (e: any) {
          // Cas B : L'API de comparaison a planté
          console.error("🔴 Échec de la comparaison automatique :", e);
          setComparaison({
            correspond: false,
            score_confiance: 0,
            message: e instanceof ErreurAPI 
              ? e.message_utilisateur 
              : "Erreur technique lors de la comparaison. Vérifie la console (F12) pour les détails.",
          });
        } finally {
          setComparaisonChargement(false);
        }
      }
    }
    lancerComparaison();
  }, [statut, statutChargement, derniereComparaisonId]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 apparition pb-20">
      <div>
        <h1 className="text-2xl font-bold text-ardoise">Vérification Visuelle</h1>
        <p className="text-sm text-ardoise-clair mt-1">
          Prends une photo de ton visage. Elle sera comparée à ton document d'identité officiel.
        </p>
      </div>

      {erreurGlobale && <Alerte variante="erreur" titre="Erreur">{erreurGlobale}</Alerte>}

      <Carte titre="📸 Nouvelle vérification">
        <p className="text-sm text-ardoise-clair mb-4">
          Si tu n'as pas encore scanné ta pièce d'identité (CNI, Passeport), la vérification visuelle sera automatiquement bloquée.
        </p>
        <UploadPhoto onSucces={toutCharger} />
      </Carte>

      <Carte titre="📊 Statut actuel">
        {statutChargement ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-ardoise-clair italic">Chargement du statut...</p>
          </div>
        ) : statut ? (
          <>
            <StatutVerification verification={statut} chargement={false} />
            
            {statut.statut === "approuve" && (
              <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
                <h3 className="text-sm font-semibold text-ardoise mb-3">
                  🔍 Comparaison avec ton document d'identité
                </h3>

                {comparaisonChargement ? (
                  <div className="flex items-center gap-2 text-sm text-ardoise-clair italic">
                    <div className="animate-spin h-4 w-4 border-2 border-lagune border-t-transparent rounded-full" />
                    Comparaison en cours...
                  </div>
                ) : comparaison ? (
                  <div className={`rounded-lg p-4 border-2 ${
                    comparaison.correspond ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
                  }`}>
                    <p className={`text-sm font-bold ${
                      comparaison.correspond ? "text-green-700" : "text-red-700"
                    }`}>
                      {comparaison.correspond ? "✅ Visage correspondant" : "❌ Comparaison impossible"}
                    </p>
                    <p className="text-xs text-ardoise mt-1">{comparaison.message}</p>
                    
                    {comparaison.correspond && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-ardoise-clair">Score de confiance</span>
                          <span className="font-bold">{(comparaison.score_confiance * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-sable rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${comparaison.score_confiance * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Bouton d'action si le problème est l'absence de document */}
                    {!comparaison.correspond && comparaison.message.includes("Aucun document") && (
                      <Link href="/inspection" className="inline-block mt-3 text-xs font-bold text-white bg-lagune px-3 py-1.5 rounded hover:bg-lagune/90 transition">
                        Scanner un document d'identité →
                      </Link>
                    )}
                  </div>
                ) : null}
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

      <Carte titre="📋 Historique">
        <HistoriqueVerification
          historique={historique?.historique || []}
          total={historique?.total || 0}
          chargement={histoChargement}
          onRafraichir={toutCharger}
        />
      </Carte>

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