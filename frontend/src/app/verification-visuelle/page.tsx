"use client";

/**
 * Page Vérification Visuelle — reconnaissance faciale.
 * 
 * Permet à l'utilisateur de :
 *   - Prendre/uploader une photo pour vérification
 *   - Voir le statut de sa dernière vérification
 *   - Consulter l'historique
 *   - Supprimer/Restaurer une vérification (corbeille)
 *   - ✅ NOUVEAU : Comparer sa photo de profil avec un document d'identité
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { UploadPhoto, StatutVerification, HistoriqueVerification } from "@/composants/verification-visuelle";
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
  LIBELLES_TYPE_DOCUMENT,
  ICONES_TYPE_DOCUMENT,
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
  // --- État existant ---
  const [statut, setStatut] = useState<VerificationDetail | null>(null);
  const [statutChargement, setStatutChargement] = useState(true);
  const [historique, setHistorique] = useState<ListeVerifications | null>(null);
  const [histoChargement, setHistoChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // --- NOUVEAU : État pour la comparaison faciale ---
  const [documents, setDocuments] = useState<any[]>([]);
  const [documentSelectionne, setDocumentSelectionne] = useState<string>("");
  const [comparaison, setComparaison] = useState<ResultatComparaisonFaciale | null>(null);
  const [comparaisonChargement, setComparaisonChargement] = useState(false);

  // --- Charger les données ---
  const toutCharger = useCallback(async () => {
    setErreur(null);

    // Statut
    setStatutChargement(true);
    try {
      const s = await obtenirStatutVerification();
      setStatut(s);
    } catch {
      setStatut(null);
    } finally {
      setStatutChargement(false);
    }

    // Historique
    setHistoChargement(true);
    try {
      const h = await obtenirHistoriqueVerification(20);
      setHistorique(h);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement de l'historique.");
      setHistorique(null);
    } finally {
      setHistoChargement(false);
    }
  }, []);

  // Charger la liste des documents au montage pour le sélecteur de comparaison
  useEffect(() => {
    async function chargerDocuments() {
      try {
        const resultat = await listerDocumentsIdentite();
        setDocuments(resultat.documents);
      } catch {
        // Silencieux : pas de documents = le composant de comparaison affichera un message informatif
      }
    }
    chargerDocuments();
  }, []);

  useEffect(() => {
    toutCharger();
  }, [toutCharger]);

  // --- NOUVEAU : Gestionnaire de comparaison ---
  async function lancerComparaison() {
    if (!documentSelectionne) return;
    
    setComparaisonChargement(true);
    setComparaison(null);
    
    try {
      const resultat = await comparerPhotoProfilAvecDocument(documentSelectionne);
      setComparaison(resultat);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la comparaison.";
      setErreur(msg);
    } finally {
      setComparaisonChargement(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70">
        <Link href="/identite" className="hover:text-ocre transition-colors">Identité</Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Reconnaissance faciale</span>
      </nav>

      {/* En-tête */}
      <header>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1>Vérification Visuelle</h1>
            <p className="text-ardoise-clair mt-1">
              Reconnaissance faciale pour renforcer ton identité numérique.
              Ta photo n&apos;est pas stockée, seul un vecteur facial chiffré est conservé.
            </p>
          </div>
          <Link href="/identite">
            <button className="px-4 py-2 text-sm text-lagune border border-lagune rounded-lg hover:bg-lagune hover:text-white transition-colors">
              ← Retour au menu Identité
            </button>
          </Link>
        </div>
      </header>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {/* Section : Upload photo */}
      <Carte titre="📸 Nouvelle vérification">
        <p className="text-sm text-ardoise-clair mb-4">
          Prends une photo de ton visage ou choisis un fichier.
          Assure-toi d&apos;avoir un bon éclairage et un visage bien visible.
        </p>
        <UploadPhoto onSucces={toutCharger} />
      </Carte>

      {/* Section : Statut actuel */}
      <Carte titre="📊 Statut actuel">
        <StatutVerification verification={statut} chargement={statutChargement} />
      </Carte>

      {/* ✅ NOUVEAU : Section Comparaison avec document */}
      <Carte titre="🔍 Comparaison avec document d'identité">
        <p className="text-sm text-ardoise-clair mb-4">
          Comparez votre photo de profil avec la photo extraite de votre document d'identité.
          Cette vérification renforce la cohérence de votre identité numérique.
        </p>

        {documents.length === 0 ? (
          <Alerte variante="info" titre="Aucun document disponible">
            <p className="text-sm">
              Vous devez d'abord ajouter un document d'identité (CNI, Permis, Assurance) pour pouvoir comparer votre photo de profil.
            </p>
            <Link href="/citoyen/documents-identite">
              <Bouton variante="primaire" taille="petit" className="mt-3">
                ➕ Ajouter un document
              </Bouton>
            </Link>
          </Alerte>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ardoise mb-2">
                Sélectionnez un document à comparer
              </label>
              <select
                value={documentSelectionne}
                onChange={(e) => setDocumentSelectionne(e.target.value)}
                className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-ocre/50 focus:border-ocre outline-none"
              >
                <option value="">— Choisir un document —</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {ICONES_TYPE_DOCUMENT[doc.type_document]} {LIBELLES_TYPE_DOCUMENT[doc.type_document]}
                    {doc.nom_complet ? ` — ${doc.nom_complet}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <Bouton
              variante="primaire"
              onClick={lancerComparaison}
              chargement={comparaisonChargement}
              disabled={!documentSelectionne}
            >
              🔍 Lancer la comparaison faciale
            </Bouton>

            {comparaison && (
              <div className={`rounded-lg border-2 p-4 ${
                comparaison.correspond ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
              }`}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{comparaison.correspond ? "✅" : "❌"}</div>
                  <div className="flex-1">
                    <p className={`font-semibold text-lg ${
                      comparaison.correspond ? "text-green-700" : "text-red-700"
                    }`}>
                      {comparaison.correspond ? "Visage correspondant" : "Visage non correspondant"}
                    </p>
                    <p className="text-sm text-ardoise mt-1">{comparaison.message}</p>

                    {/* Barre de score de confiance */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-ardoise-clair">Score de confiance</span>
                          <span className={`text-sm font-bold ${
                            comparaison.correspond ? "text-green-600" : "text-red-600"
                          }`}>
                            {(comparaison.score_confiance * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 bg-sable rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              comparaison.correspond ? "bg-green-500" : "bg-red-500"
                            }`}
                            style={{ width: `${comparaison.score_confiance * 100}%` }}
                          />
                        </div>
                        {comparaison.seuil && (
                          <p className="text-xs text-ardoise-clair mt-1">
                            Seuil de validation : {(comparaison.seuil * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Conseils en cas d'échec */}
                    {!comparaison.correspond && (
                      <Alerte variante="avertissement" titre="Que faire ?" className="mt-3">
                        <ul className="text-xs space-y-1 list-disc list-inside">
                          <li>Vérifiez que votre photo de profil est récente et nette</li>
                          <li>Assurez-vous que le document contient une photo claire</li>
                          <li>Retentez l'upload avec un meilleur éclairage</li>
                        </ul>
                      </Alerte>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Carte>

      {/* Section : Historique */}
      <Carte titre="📋 Historique des vérifications">
        <HistoriqueVerification
          historique={historique?.historique || []}
          total={historique?.total || 0}
          chargement={histoChargement}
          onRafraichir={toutCharger}
        />
      </Carte>

      {/* Navigation vers les autres pages d'identité */}
      <div className="flex flex-wrap gap-3 justify-between items-center pt-4">
        <div className="flex flex-wrap gap-2">
          <Link href="/identite">
            <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              ← Tableau de bord
            </button>
          </Link>
          <Link href="/identite/verification-cni">
            <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Scan CNI →
            </button>
          </Link>
        </div>
        <Link href="/identite/role">
          <button className="px-4 py-2 text-sm text-lagune hover:underline transition-colors">
            Voir mon rôle →
          </button>
        </Link>
      </div>

      {/* Info légale */}
      <div className="text-xs text-ardoise-clair/50 border-t border-ardoise-clair/10 pt-4">
        <p>
          🔒 Conformité : Aucune photo brute n&apos;est conservée. 
          Seul un vecteur facial chiffré (embedding 512D) est stocké dans ta base de données.
          Tu peux supprimer une vérification à tout moment via la corbeille.
        </p>
      </div>
    </div>
  );
}