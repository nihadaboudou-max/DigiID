"use client";

/**
 * Tableau de bord des vérifications d'identité — Compact & Connecté.
 * Interface unifiée pour toutes les étapes de vérification.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Utilisateur } from "@/types/api";
import { useAuthentification } from "@/contextes/authentification";
import {
  obtenirStatutVerification,
  type VerificationDetail,
} from "@/services/verification_visuelle";
import {
  obtenirSynthese,
  type SyntheseVerificationCNI,
} from "@/services/verification_cni";
// Imports pour les nouvelles vérifications (à adapter selon tes fichiers de service)
import { obtenirHistoriquePermis } from "@/services/permis_conduire";
import { obtenirHistoriqueAssurance } from "@/services/assurance_auto";

// =============================================================================
// Types
// =============================================================================

interface EtapeVerification {
  id: "email" | "visage" | "cni" | "permis" | "assurance" | "role" | "2fa";
  titre: string;
  description: string;
  icone: string;
  statut: "complete" | "en_cours" | "a_faire" | "indisponible";
  lien?: string;
  action?: string;
  detail?: string;
}

// =============================================================================
// Composant principal
// =============================================================================

export default function TableauBordVerifications() {
  const { utilisateur } = useAuthentification();
  
  // États des vérifications
  const [verifVisage, setVerifVisage] = useState<VerificationDetail | null>(null);
  const [syntheseCNI, setSyntheseCNI] = useState<SyntheseVerificationCNI | null>(null);
  const [hasPermis, setHasPermis] = useState(false);
  const [hasAssurance, setHasAssurance] = useState(false);
  
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!utilisateur) return;

    const chargerDonnees = async () => {
      try {
        const [visage, cni, permis, assurance] = await Promise.allSettled([
          obtenirStatutVerification(),
          obtenirSynthese(),
          obtenirHistoriquePermis(1),
          obtenirHistoriqueAssurance(1),
        ]);

        if (visage.status === "fulfilled") setVerifVisage(visage.value);
        if (cni.status === "fulfilled") setSyntheseCNI(cni.value);
        if (permis.status === "fulfilled") setHasPermis(permis.value.total > 0);
        if (assurance.status === "fulfilled") setHasAssurance(assurance.value.total > 0);
      } catch (err) {
        console.error("Erreur chargement tableau de bord:", err);
      } finally {
        setChargement(false);
      }
    };

    chargerDonnees();
  }, [utilisateur]);

  if (!utilisateur || chargement) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-lagune border-t-transparent rounded-full" />
      </div>
    );
  }

  const etapes = construireEtapes(utilisateur, verifVisage, syntheseCNI, hasPermis, hasAssurance);
  const progres = utilisateur.progres_verifications ?? 0;
  const niveau = utilisateur.niveau_verification ?? "aucune";
  const totalEtapes = 7; // Email, Visage, CNI, Permis, Assurance, Role, 2FA

  return (
    <div className="space-y-4">
      {/* Barre de progression globale compacte */}
      <CarteProgression
        titre="Progression de ton identité"
        etapes={etapes}
        progres={progres}
        total={totalEtapes}
        niveau={niveau}
      />

      {/* Grille des étapes (Compacte : 1 col mobile, 2 col tablette, 3 col desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {etapes.map((etape) => (
          <CarteEtape
            key={etape.id}
            etape={etape}
            estPremierInscrit={estPremierInscrit(utilisateur)}
          />
        ))}
      </div>

      {/* Résumé du score */}
      <CarteScoreVerification
        utilisateur={utilisateur}
        verifVisage={verifVisage}
        syntheseCNI={syntheseCNI}
        hasPermis={hasPermis}
        hasAssurance={hasAssurance}
      />
    </div>
  );
}

// =============================================================================
// Sous-composants (Optimisés pour la compacité)
// =============================================================================

function CarteProgression({
  titre,
  etapes,
  progres,
  total,
  niveau,
}: {
  titre: string;
  etapes: EtapeVerification[];
  progres: number;
  total: number;
  niveau: string;
}) {
  const pourcentage = Math.min(100, Math.round((progres / total) * 100));

  const couleurs: Record<string, string> = {
    aucune: "bg-gray-300",
    partielle: "bg-amber-400",
    renforcee: "bg-blue-500",
    complete: "bg-green-500",
  };

  const libelles: Record<string, string> = {
    aucune: "Aucune vérification",
    partielle: "Partiel",
    renforcee: "Renforcée",
    complete: "Complète ✓",
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">{titre}</h3>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
          niveau === "complete" ? "bg-green-100 text-green-700" :
          niveau === "renforcee" ? "bg-blue-100 text-blue-700" :
          niveau === "partielle" ? "bg-amber-100 text-amber-700" :
          "bg-gray-100 text-gray-500"
        }`}>
          {libelles[niveau]}
        </span>
      </div>

      <div className="relative">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
          <span>{progres}/{total} étapes</span>
          <span className="font-semibold">{pourcentage}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${couleurs[niveau] || "bg-gray-300"}`}
            style={{ width: `${pourcentage}%` }}
          />
        </div>
      </div>

      {/* Légende ultra-compacte */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
        {etapes.map((e) => (
          <div key={e.id} className="flex items-center gap-1 text-[10px] text-gray-600">
            <span className={`w-1.5 h-1.5 rounded-full ${
              e.statut === "complete" ? "bg-green-500" :
              e.statut === "en_cours" ? "bg-blue-500 animate-pulse" :
              "bg-gray-300"
            }`} />
            <span>{e.titre.split(" ")[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CarteEtape({
  etape,
  estPremierInscrit,
}: {
  etape: EtapeVerification;
  estPremierInscrit: boolean;
}) {
  const statuts = {
    complete: { border: "border-green-200 bg-green-50/50", badge: "bg-green-500 text-white", texte: "OK" },
    en_cours: { border: "border-blue-200 bg-blue-50/50", badge: "bg-blue-500 text-white", texte: "En cours" },
    a_faire: { border: "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm", badge: "bg-gray-200 text-gray-600", texte: "À faire" },
    indisponible: { border: "border-gray-100 bg-gray-50 opacity-60", badge: "bg-gray-200 text-gray-400", texte: "N/A" },
  };

  const style = statuts[etape.statut];

  const contenu = (
    <div className={`rounded-lg border p-3 transition-all duration-200 cursor-pointer ${style.border}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5">{etape.icone}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-gray-800 text-xs truncate">{etape.titre}</h4>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${style.badge}`}>
              {style.texte}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-tight">{etape.description}</p>

          {etape.detail && (
            <p className="text-[10px] text-gray-400 mt-1.5 italic truncate">{etape.detail}</p>
          )}

          {etape.statut === "a_faire" && etape.action && (
            <div className="mt-2">
              <span className="text-[11px] font-semibold text-blue-600 hover:text-blue-800">
                {etape.action} →
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (etape.lien && etape.statut !== "indisponible") {
    return <Link href={etape.lien}>{contenu}</Link>;
  }

  return contenu;
}

function CarteScoreVerification({
  utilisateur,
  verifVisage,
  syntheseCNI,
  hasPermis,
  hasAssurance,
}: {
  utilisateur: Utilisateur;
  verifVisage: VerificationDetail | null;
  syntheseCNI: SyntheseVerificationCNI | null;
  hasPermis: boolean;
  hasAssurance: boolean;
}) {
  const points: { label: string; pts: number }[] = [];

  if (utilisateur.est_email_verifie) points.push({ label: "Email", pts: 10 });
  if (utilisateur.est_visage_verifie) points.push({ label: "Visage", pts: 25 });
  if (utilisateur.est_cni_verifiee) points.push({ label: "CNI", pts: 30 });
  if (hasPermis) points.push({ label: "Permis", pts: 15 });
  if (hasAssurance) points.push({ label: "Assurance", pts: 10 });
  if (utilisateur.deux_fa_active) points.push({ label: "2FA", pts: 15 });

  const totalPts = points.reduce((sum, p) => sum + p.pts, 0);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
      <div className="flex items-start gap-3">
        <span className="text-xl">🏆</span>
        <div className="flex-1">
          <h4 className="font-bold text-gray-800 text-xs mb-1">Impact sur ton score DigiID</h4>
          {points.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {points.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-white/60 border border-blue-100 rounded px-2 py-1 text-[10px] text-gray-700">
                  <span className="text-green-500">✓</span> {p.label} <span className="font-bold text-blue-600">+{p.pts}</span>
                </span>
              ))}
              <span className="inline-flex items-center gap-1 bg-blue-100 border border-blue-200 rounded px-2 py-1 text-[10px] font-bold text-blue-800 ml-auto">
                Total: +{totalPts} pts
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 italic">
              Complète les étapes ci-dessus pour gagner des points.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Fonctions utilitaires
// =============================================================================

function estPremierInscrit(utilisateur: Utilisateur): boolean {
  if (!utilisateur.est_email_verifie && !utilisateur.est_visage_verifie && !utilisateur.est_cni_verifiee && !utilisateur.deux_fa_active) {
    return true;
  }
  if (utilisateur.date_creation) {
    const diffJours = (Date.now() - new Date(utilisateur.date_creation).getTime()) / (1000 * 60 * 60 * 24);
    if (diffJours <= 7) return true;
  }
  return false;
}

function construireEtapes(
  utilisateur: Utilisateur,
  verifVisage: VerificationDetail | null,
  syntheseCNI: SyntheseVerificationCNI | null,
  hasPermis: boolean,
  hasAssurance: boolean
): EtapeVerification[] {
  const estPremier = estPremierInscrit(utilisateur);

  return [
    {
      id: "email",
      titre: "📧 Email",
      description: "Sécurise ton compte et reçois les notifications.",
      icone: "📧",
      statut: utilisateur.est_email_verifie ? "complete" : "a_faire",
      lien: utilisateur.est_email_verifie ? undefined : "/verification",
      action: "Vérifier",
      detail: utilisateur.est_email_verifie ? "Vérifié" : (estPremier ? "Requis" : undefined),
    },
    {
      id: "visage",
      titre: "👤 Reconnaissance faciale",
      description: "Photo de ton visage pour vérification biométrique.",
      icone: "👤",
      statut: verifVisage?.statut === "approuve" ? "complete" : (verifVisage?.statut ? "en_cours" : "a_faire"),
      lien: verifVisage?.statut === "approuve" ? undefined : "/verification-visuelle",
      action: verifVisage?.statut === "rejete" ? "Réessayer" : (verifVisage?.statut === "en_attente" ? "En attente..." : "Ajouter"),
      detail: verifVisage?.statut === "approuve" ? `${Math.round(verifVisage.score_liveness * 100)}%` : undefined,
    },
    {
      id: "cni",
      titre: "🆔 CNI",
      description: "Scanne ta Carte Nationale d'Identité.",
      icone: "🆔",
      statut: syntheseCNI?.statut === "approuve" ? "complete" : (syntheseCNI?.statut === "rejete" ? "en_cours" : "a_faire"),
      lien: syntheseCNI?.statut === "approuve" ? undefined : "/verification-cni",
      action: syntheseCNI?.statut === "rejete" ? "Re-scanner" : "Scanner",
      detail: syntheseCNI?.statut === "approuve" ? "Authentifiée" : undefined,
    },
    {
      id: "permis",
      titre: "🚗 Permis",
      description: "Scanne ton permis de conduire.",
      icone: "🚗",
      statut: hasPermis ? "complete" : "a_faire",
      lien: "/permis-conduire",
      action: hasPermis ? "Voir" : "Scanner",
      detail: hasPermis ? "Enregistré" : undefined,
    },
    {
      id: "assurance",
      titre: "🛡️ Assurance",
      description: "Carte verte ou attestation d'assurance.",
      icone: "🛡️",
      statut: hasAssurance ? "complete" : "a_faire",
      lien: "/assurance-auto",
      action: hasAssurance ? "Voir" : "Scanner",
      detail: hasAssurance ? "Enregistrée" : undefined,
    },
    {
      id: "role",
      titre: "🔑 Rôle",
      description: "Gère tes accès et permissions.",
      icone: "🔑",
      statut: utilisateur.role !== "citoyen" ? "complete" : "a_faire",
      lien: "/parametres/role",
      action: utilisateur.role !== "citoyen" ? "Voir" : "Demander",
      detail: utilisateur.role !== "citoyen" ? utilisateur.role : undefined,
    },
    {
      id: "2fa",
      titre: "🔐 2FA",
      description: "Double authentification par code TOTP.",
      icone: "🔐",
      statut: utilisateur.deux_fa_active ? "complete" : "a_faire",
      lien: utilisateur.deux_fa_active ? undefined : "/parametres/2fa",
      action: utilisateur.deux_fa_active ? "OK" : "Activer",
      detail: utilisateur.deux_fa_active ? "Active" : undefined,
    },
  ];
}