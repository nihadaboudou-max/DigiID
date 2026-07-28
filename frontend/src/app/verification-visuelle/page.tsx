"use client";
/**
 * Page Vérification Visuelle — reconnaissance faciale.
 * 
 * Permet à l'utilisateur de :
 *   - Prendre/uploader une photo pour vérification
 *   - Voir le statut de sa dernière vérification
 *   - Consulter l'historique
 *   - Supprimer/Restaurer une vérification (corbeille)
 *   - ✅ Comparaison AUTOMATIQUE avec la photo de la CNI
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
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
  type DocumentIdentiteDetail,
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

  // --- NOUVEAU : État pour la comparaison automatique ---
  const [documentCNI, setDocumentCNI] = useState<DocumentIdentiteDetail | null>(null);
  const [comparaison, setComparaison] = useState<ResultatComparaisonFaciale | null>(null);
  const [comparaisonChargement, setComparaisonChargement] = useState(false);

  // --- Charger les données ---
  const toutCharger = useCallback(async () => {
    setErreur(null);

    // Statut vérification
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
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
      setHistorique(null);
    } finally {
      setHistoChargement(false);
    }
  }, []);

  // --- Charger le document CNI et lancer la comparaison automatique ---
  useEffect(() => {
    async function chargerEtComparer() {
      try {
        // Charger les documents pour trouver la CNI
        const resultat = await listerDocumentsIdentite("cni");
        if (resultat.documents.length > 0) {
          const cni = resultat.documents[0];
          setDocumentCNI(cni);

          // ✅ Comparaison AUTOMATIQUE si une vérification visuelle existe
          if (statut && statut.statut === "approuve") {
            setComparaisonChargement(true);
            try {
              const resultatComparaison = await comparerPhotoProfilAvecDocument(cni.id);
              setComparaison(resultatComparaison);
            } catch (e) {
              // Erreur de comparaison silencieuse
            } finally {
              setComparaisonChargement(false);
            }
          }
        }
      } catch {
        // Pas de CNI trouvée - c'est OK
      }
    }

    chargerEtComparer();
  }, [statut]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 apparition pb-20">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70">
        <Link href="/identite" className="hover:text-ocre transition-colors">Identité</Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Reconnaissance faciale</span>
      </nav>

      {/* En-tête compact */}
      <div>
        <h1 className="text-2xl font-bold text-ardoise">Vérification Visuelle</h1>
        <p className="text-sm text-ardoise-clair mt-1">
          Reconnaissance faciale pour renforcer ton identité numérique.
        </p>
      </div>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {/* Section : Upload photo */}
      <Carte titre="📸 Nouvelle vérification">
        <p className="text-sm text-ardoise-clair mb-3">
          Prends une photo de ton visage. La comparaison avec ta CNI se fait automatiquement.
        </p>
        <UploadPhoto onSucces={toutCharger} />
      </Carte>

      {/* Section : Statut actuel + Comparaison automatique */}
      <Carte titre="📊 Statut actuel">
        <StatutVerification verification={statut} chargement={statutChargement} />
        
        {/* ✅ RÉSULTAT DE COMPARAISON AUTOMATIQUE */}
        {statut?.statut === "approuve" && (
          <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ardoise">
                🔍 Comparaison avec ta CNI
              </h3>
              {documentCNI && (
                <Badge variante="lagune" taille="petit">
                  CNI trouvée
                </Badge>
              )}
            </div>

            {comparaisonChargement ? (
              <p className="text-sm text-ardoise-clair italic">Comparaison en cours...</p>
            ) : comparaison ? (
              <div className={`rounded-lg p-3 border-2 ${
                comparaison.correspond
                  ? "border-green-300 bg-green-50"
                  : "border-red-300 bg-red-50"
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {comparaison.correspond ? "✅" : ""}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${
                      comparaison.correspond ? "text-green-700" : "text-red-700"
                    }`}>
                      {comparaison.correspond ? "Visage correspondant" : "Visage non correspondant"}
                    </p>
                    <p className="text-xs text-ardoise mt-0.5">
                      {comparaison.message}
                    </p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-ardoise-clair">Score de confiance</span>
                        <span className={`font-bold ${
                          comparaison.correspond ? "text-green-600" : "text-red-600"
                        }`}>
                          {(comparaison.score_confiance * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-sable rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            comparaison.correspond ? "bg-green-500" : "bg-red-500"
                          }`}
                          style={{ width: `${comparaison.score_confiance * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Alerte variante="info" titre="Comparaison disponible">
                <p className="text-xs">
                  Une fois ta photo approuvée, nous la comparerons automatiquement avec celle de ta CNI.
                </p>
              </Alerte>
            )}
          </div>
        )}
      </Carte>

      {/* Section : Historique */}
      <Carte titre="📋 Historique">
        <HistoriqueVerification
          historique={historique?.historique || []}
          total={historique?.total || 0}
          chargement={histoChargement}
          onRafraichir={toutCharger}
        />
      </Carte>

      {/* Navigation compacte */}
      <div className="flex flex-wrap gap-2 justify-between items-center pt-2">
        <div className="flex flex-wrap gap-2">
          <Link href="/identite">
            <button className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              ← Tableau de bord
            </button>
          </Link>
          <Link href="/identite/verification-cni">
            <button className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Scan CNI →
            </button>
          </Link>
        </div>
      </div>

      {/* Info légale */}
      <div className="text-xs text-ardoise-clair/50 border-t border-ardoise-clair/10 pt-3">
        <p>
          🔒 Aucune photo brute n'est conservée. Seul un vecteur facial chiffré est stocké.
        </p>
      </div>
    </div>
  );
}