"use client";

/**
 * Page Vérification Visuelle — reconnaissance faciale.
 * 
 * Permet à l'utilisateur de :
 *   - Prendre/uploader une photo pour vérification
 *   - Voir le statut de sa dernière vérification
 *   - Consulter l'historique
 *   - Supprimer/Restaurer une vérification (corbeille)
 */
import { useCallback, useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Alerte } from "@/composants/commun/Alerte";
import { UploadPhoto, StatutVerification, HistoriqueVerification } from "@/composants/verification-visuelle";
import {
  obtenirStatutVerification,
  obtenirHistoriqueVerification,
  type VerificationDetail,
  type ListeVerifications,
} from "@/services/verification_visuelle";
import { ErreurAPI } from "@/services/client_api";

export default function PageVerificationVisuelle() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={[      
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  // --- État ---
  const [statut, setStatut] = useState<VerificationDetail | null>(null);
  const [statutChargement, setStatutChargement] = useState(true);
  const [historique, setHistorique] = useState<ListeVerifications | null>(null);
  const [histoChargement, setHistoChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

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

  useEffect(() => {
    toutCharger();
  }, [toutCharger]);

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70">
        <a href="/identite" className="hover:text-ocre transition-colors">Identité</a>
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
          <a href="/identite">
            <button className="px-4 py-2 text-sm text-lagune border border-lagune rounded-lg hover:bg-lagune hover:text-white transition-colors">
              ← Retour au menu Identité
            </button>
          </a>
        </div>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

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
          <a href="/identite">
            <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              ← Tableau de bord
            </button>
          </a>
          <a href="/identite/verification-cni">
            <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Scan CNI →
            </button>
          </a>
        </div>
        <a href="/identite/role">
          <button className="px-4 py-2 text-sm text-lagune hover:underline transition-colors">
            Voir mon rôle →
          </button>
        </a>
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
