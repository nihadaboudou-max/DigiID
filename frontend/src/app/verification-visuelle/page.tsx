"use client";

/**
 * ==============================================================================
 * PAGE : Vérification Visuelle (Reconnaissance Faciale)
 * ==============================================================================
 * 
 * RÈGLE MÉTIER CRITIQUE : 
 * Un selfie ne peut être validé que s'il existe déjà un document d'identité 
 * officiel (CNI, Passeport, Permis) avec une photo de référence dans le dossier 
 * de l'utilisateur. 
 * 
 * Si aucun document valide n'existe, la vérification visuelle est automatiquement 
 * rejetée par le backend, et l'interface doit guider l'utilisateur pour qu'il 
 * scanne d'abord un document.
 * ==============================================================================
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// Composants d'interface utilisateur réutilisables
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { 
  UploadPhoto, 
  StatutVerification, 
  HistoriqueVerification 
} from "@/composants/verification-visuelle";

// Services API pour la vérification visuelle et les documents d'identité
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
  type DocumentIdentiteDetail,
} from "@/services/documents_identite";

import { ErreurAPI } from "@/services/client_api";

/**
 * Composant principal protégé.
 * Seul les rôles listés peuvent accéder à cette page de vérification.
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
 * Contenu de la page : Gère toute la logique d'état, de chargement et d'affichage.
 */
function Contenu() {
  // --------------------------------------------------------------------------
  // 1. ÉTATS (STATE) DE LA PAGE
  // --------------------------------------------------------------------------
  
  // Statut de la dernière vérification faciale de l'utilisateur
  const [statut, setStatut] = useState<VerificationDetail | null>(null);
  const [statutChargement, setStatutChargement] = useState(true);
  
  // Historique des tentatives de vérification
  const [historique, setHistorique] = useState<ListeVerifications | null>(null);
  const [histoChargement, setHistoChargement] = useState(true);
  
  // Message d'erreur global (réseau, API, etc.)
  const [erreur, setErreur] = useState<string | null>(null);

  // États spécifiques à la comparaison automatique avec le document d'identité
  const [documentReference, setDocumentReference] = useState<DocumentIdentiteDetail | null>(null);
  const [comparaison, setComparaison] = useState<ResultatComparaisonFaciale | null>(null);
  const [comparaisonChargement, setComparaisonChargement] = useState(false);
  
  // Mémoization : empêche de relancer la comparaison en boucle si le composant se re-rend
  // pour la même vérification (évite les appels API inutiles).
  const [derniereComparaisonId, setDerniereComparaisonId] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // 2. FONCTIONS DE CHARGEMENT DES DONNÉES
  // --------------------------------------------------------------------------

  /**
   * Charge le statut actuel et l'historique des vérifications en parallèle.
   * Cette fonction est passée en dépendance du useEffect initial.
   */
  const toutCharger = useCallback(async () => {
    setErreur(null); // Réinitialiser les erreurs précédentes

    // A. Chargement du statut
    setStatutChargement(true);
    try {
      const s = await obtenirStatutVerification();
      setStatut(s);
    } catch {
      setStatut(null); // En cas d'échec, on considère qu'il n'y a pas de statut
    } finally {
      setStatutChargement(false);
    }

    // B. Chargement de l'historique
    setHistoChargement(true);
    try {
      const h = await obtenirHistoriqueVerification(20); // Limite à 20 entrées
      setHistorique(h);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement de l'historique");
      setHistorique(null);
    } finally {
      setHistoChargement(false);
    }
  }, []);

  // Déclenche le chargement initial au montage du composant
  useEffect(() => {
    toutCharger();
  }, [toutCharger]);

  // --------------------------------------------------------------------------
  // 3. LOGIQUE DE COMPARAISON AUTOMATIQUE (Cœur de la règle métier)
  // --------------------------------------------------------------------------

  /**
   * Ce useEffect se déclenche lorsque le statut de vérification change.
   * Il vérifie si nous pouvons lancer une comparaison avec un document d'identité.
   */
  useEffect(() => {
    async function chargerEtComparer() {
      // CONDITIONS DE DÉCLENCHEMENT :
      // 1. Le chargement du statut est terminé (!statutChargement)
      // 2. Le statut est "approuve" (le selfie est techniquement valide)
      // 3. Nous n'avons pas déjà effectué la comparaison pour CETTE vérification spécifique
      if (!statutChargement && statut?.statut === "approuve" && statut.id !== derniereComparaisonId) {
        try {
          // A. Récupérer les documents d'identité de l'utilisateur (ex: "cni")
          // Note: Adapter le filtre si l'API accepte "tous" ou une liste de types valides.
          const resultat = await listerDocumentsIdentite("cni"); 
          
          // B. Filtrer pour ne garder que les documents qui sont eux-mêmes validés/approuvés
          // On ne peut pas utiliser une CNI en attente ou rejetée comme référence fiable.
          const docValide = resultat.documents.find(
            (doc: any) => doc.statut === "approuve" || doc.est_valide
          );
          
          if (docValide) {
            // C. Un document de référence valide a été trouvé
            setDocumentReference(docValide);
            setComparaisonChargement(true);
            
            try {
              // D. Lancer l'appel API de comparaison faciale
              // On utilise verification_id en priorité (plus précis), sinon l'ID du document
              const idReference = docValide.verification_id ?? docValide.id;
              const resultatComparaison = await comparerPhotoProfilAvecDocument(idReference);
              
              setComparaison(resultatComparaison);
              setDerniereComparaisonId(statut.id); // Marquer comme traité pour éviter la boucle
            } catch (e) {
              // Si la comparaison échoue (ex: problème de modèle IA), on affiche null
              setComparaison(null);
            } finally {
              setComparaisonChargement(false);
            }
          } else {
            // Aucun document valide trouvé, on réinitialise la référence
            setDocumentReference(null);
          }
        } catch {
          // Erreur silencieuse lors de la récupération des documents
          setDocumentReference(null);
        }
      }
    }

    chargerEtComparer();
  }, [statut, statutChargement, derniereComparaisonId]);

  // --------------------------------------------------------------------------
  // 4. RENDU DE L'INTERFACE (JSX)
  // --------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto space-y-6 apparition pb-20">
      
      {/* A. Fil d'Ariane (Navigation) */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70">
        <Link href="/identite" className="hover:text-lagune transition-colors">Identité</Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Reconnaissance faciale</span>
      </nav>

      {/* B. En-tête de la page */}
      <div>
        <h1 className="text-2xl font-bold text-ardoise">Vérification Visuelle</h1>
        <p className="text-sm text-ardoise-clair mt-1">
          Prends une photo de ton visage. Elle est comparée automatiquement à la photo 
          de ton document d'identité officiel pour renforcer ta sécurité.
        </p>
      </div>

      {/* C. Affichage des erreurs globales */}
      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {/* D. Section : Upload de la photo (Selfie) */}
      <Carte titre="📸 Nouvelle vérification">
        {/* Le composant UploadPhoto gère la caméra, l'upload et appelle onSucces (toutCharger) à la fin */}
        <UploadPhoto onSucces={toutCharger} />
      </Carte>

      {/* E. Section : Statut actuel et Résultat de la comparaison */}
      <Carte titre="📊 Statut actuel">
        {statutChargement ? (
          // État de chargement initial
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-ardoise-clair italic">Chargement du statut...</p>
          </div>
        ) : statut ? (
          // Le statut a été chargé
          <>
            <StatutVerification verification={statut} chargement={false} />
            
            {/* 
              AFFICHAGE CONDITIONNEL DE LA COMPARAISON :
              On n'affiche ce bloc que si le selfie a été techniquement "approuvé" 
              (visage détecté, vivant, etc.). La comparaison avec la CNI est une étape supplémentaire.
            */}
            {statut.statut === "approuve" && (
              <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-ardoise">
                    🔍 Comparaison avec ton document d'identité
                  </h3>
                  {documentReference && (
                    <Badge variante="lagune" taille="petit">
                      {documentReference.type_document || "CNI"} trouvée
                    </Badge>
                  )}
                </div>

                {comparaisonChargement ? (
                  // La comparaison est en cours d'exécution par le backend
                  <div className="flex items-center gap-2 text-sm text-ardoise-clair italic">
                    <div className="animate-spin h-4 w-4 border-2 border-lagune border-t-transparent rounded-full" />
                    Comparaison en cours...
                  </div>
                ) : comparaison ? (
                  // La comparaison est terminée : on affiche le résultat (Succès ou Échec)
                  <div className={`rounded-lg p-4 border-2 ${
                    comparaison.correspond 
                      ? "border-green-300 bg-green-50/50" 
                      : "border-red-300 bg-red-50/50"
                  }`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{comparaison.correspond ? "✅" : "❌"}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${
                          comparaison.correspond ? "text-green-700" : "text-red-700"
                        }`}>
                          {comparaison.correspond ? "Visage correspondant" : "Visage non correspondant"}
                        </p>
                        <p className="text-xs text-ardoise mt-1">
                          {comparaison.message}
                        </p>
                        
                        {/* Barre de progression du score de confiance */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-ardoise-clair font-medium">Score de confiance</span>
                            <span className={`font-bold ${
                              comparaison.correspond ? "text-green-600" : "text-red-600"
                            }`}>
                              {(comparaison.score_confiance * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-sable rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                comparaison.correspond ? "bg-green-500" : "bg-red-500"
                              }`}
                              style={{ width: `${comparaison.score_confiance * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : !documentReference ? (
                  // CAS CRITIQUE : Le selfie est bon, mais aucune CNI valide n'est trouvée.
                  // C'est ici qu'on applique la règle métier : on bloque et on redirige.
                  <Alerte variante="avertissement" titre="Document d'identité requis">
                    <p className="text-xs">
                      Pour valider ton visage, tu dois d'abord scanner un document officiel 
                      avec photo (CNI, Passeport ou Permis) et attendre qu'il soit validé.
                      <Link href="/inspection" className="underline font-semibold ml-1 text-lagune hover:text-lagune/80">
                        Scanner un document →
                      </Link>
                    </p>
                  </Alerte>
                ) : (
                  // Fallback technique inattendu
                  <Alerte variante="info" titre="Comparaison en attente">
                    <p className="text-xs">
                      Une donnée technique empêche la comparaison automatique. Réessaie ou contacte le support.
                    </p>
                  </Alerte>
                )}
              </div>
            )}
            
            {/* 
              CAS DE REJET EXPLICITE PAR LE BACKEND :
              Si le backend a rejeté le selfie spécifiquement parce qu'il manquait 
              un document d'identité (action_requise === "ajouter_document_identite").
            */}
            {statut.statut === "rejete" && statut.details?.action_requise === "ajouter_document_identite" && (
              <Alerte variante="erreur" titre="Validation impossible" className="mt-4">
                <p className="text-sm">
                  Nous ne pouvons pas vérifier ton visage car aucun document d'identité 
                  (CNI, Passeport, Permis) n'a été trouvé ou validé dans ton dossier.
                </p>
                <Link href="/inspection" className="inline-block mt-2 text-xs font-bold text-white bg-terre px-3 py-1.5 rounded hover:bg-terre/90 transition">
                  Ajouter un document d'identité
                </Link>
              </Alerte>
            )}
          </>
        ) : (
          // État initial : aucune vérification n'a jamais été tentée
          <div className="text-center py-8">
            <p className="text-4xl mb-2">📷</p>
            <p className="text-ardoise font-medium">Aucune vérification visuelle</p>
            <p className="text-ardoise-clair text-sm mt-1">
              Prends une photo pour commencer la vérification de ton identité.
            </p>
          </div>
        )}
      </Carte>

      {/* F. Section : Historique des tentatives */}
      <Carte titre="📋 Historique">
        <HistoriqueVerification
          historique={historique?.historique || []}
          total={historique?.total || 0}
          chargement={histoChargement}
          onRafraichir={toutCharger}
        />
      </Carte>

      {/* G. Navigation secondaire (Pied de page de la section) */}
      <div className="flex flex-wrap gap-2 justify-between items-center pt-2">
        <div className="flex flex-wrap gap-2">
          <Link href="/identite">
            <button className="px-3 py-1.5 text-xs text-ardoise border border-ardoise/20 rounded-lg hover:bg-sable/30 transition-colors">
              ← Tableau de bord
            </button>
          </Link>
          <Link href="/inspection">
            <button className="px-3 py-1.5 text-xs text-ardoise border border-ardoise/20 rounded-lg hover:bg-sable/30 transition-colors">
              Scan de documents →
            </button>
          </Link>
        </div>
      </div>

      {/* H. Mention légale / RGPD simplifiée */}
      <div className="text-xs text-ardoise-clair/50 border-t border-ardoise-clair/10 pt-3">
        <p>
          🔒 Aucune photo brute n'est conservée sur nos serveurs. 
          Seul un vecteur facial mathématique chiffré est stocké pour la comparaison.
        </p>
      </div>
    </div>
  );
}