/**
 * Tableau de bord des vérifications d'identité — Étape 3.
 *
 * Interface unifiée pour les 3 fonctionnalités :
 *   🔹 Étape 1 : Reconnaissance faciale
 *   🔹 Étape 2 : Extension RBAC (rôles)
 *   🔹 Étape 3 : OCR CNI (scan carte d'identité)
 *
 * Chaque nouvel inscrit voit les 3 étapes à compléter.
 * Le niveau global de vérification est affiché.
 */
"use client";

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

// =============================================================================
// Types
// =============================================================================

interface EtapeVerification {
  id: "email" | "visage" | "cni" | "role" | "2fa";
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
  const [verifVisage, setVerifVisage] = useState<VerificationDetail | null>(
    null
  );
  const [syntheseCNI, setSyntheseCNI] =
    useState<SyntheseVerificationCNI | null>(null);
  const [chargementVisage, setChargementVisage] = useState(true);
  const [chargementCNI, setChargementCNI] = useState(true);

  useEffect(() => {
    if (utilisateur) {
      obtenirStatutVerification()
        .then(setVerifVisage)
        .catch(() => setVerifVisage(null))
        .finally(() => setChargementVisage(false));

      obtenirSynthese()
        .then(setSyntheseCNI)
        .catch(() => setSyntheseCNI(null))
        .finally(() => setChargementCNI(false));
    }
  }, [utilisateur]);

  if (!utilisateur) return null;

  const etapes = construireEtapes(
    utilisateur,
    verifVisage,
    syntheseCNI,
    chargementVisage,
    chargementCNI
  );

  const progres = utilisateur.progres_verifications ?? 0;
  const niveau = utilisateur.niveau_verification ?? "aucune";

  return (
    <div className="space-y-6">
      {/* Barre de progression globale */}
      <CarteProgression
        titre="Niveau de vérification de ton identité"
        description="Plus tu vérifies ton identité, plus tu débloques de fonctionnalités et plus ton score DigiID augmente."
        etapes={etapes}
        progres={progres}
        total={5}
        niveau={niveau}
      />

      {/* Grille des étapes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {etapes.map((etape) => (
          <CarteEtape
            key={etape.id}
            etape={etape}
            estPremierInscrit={estPremierInscrit(utilisateur)}
          />
        ))}
      </div>

      {/* Résumé du score de vérification */}
      <CarteScoreVerification
        utilisateur={utilisateur}
        verifVisage={verifVisage}
        syntheseCNI={syntheseCNI}
      />
    </div>
  );
}

// =============================================================================
// Sous-composants
// =============================================================================

function CarteProgression({
  titre,
  description,
  etapes,
  progres,
  total,
  niveau,
}: {
  titre: string;
  description: string;
  etapes: EtapeVerification[];
  progres: number;
  total: number;
  niveau: string;
}) {
  const pourcentage = Math.round((progres / total) * 100);

  const couleurs: Record<string, string> = {
    aucune: "bg-gray-200",
    partielle: "bg-amber-400",
    renforcee: "bg-blue-500",
    complete: "bg-green-500",
  };

  const libelles: Record<string, string> = {
    aucune: "Aucune vérification",
    partielle: "Partiellement vérifié",
    renforcee: "Identité renforcée",
    complete: "Identité complète ✓",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">{titre}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${
            niveau === "complete"
              ? "bg-green-100 text-green-700"
              : niveau === "renforcee"
              ? "bg-blue-100 text-blue-700"
              : niveau === "partielle"
              ? "bg-amber-100 text-amber-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {libelles[niveau]}
        </span>
      </div>

      {/* Barre de progression */}
      <div className="relative pt-1">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>
            {progres}/{total} vérifications
          </span>
          <span>{pourcentage}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-700 ${
              couleurs[niveau] || "bg-gray-200"
            }`}
            style={{ width: `${pourcentage}%` }}
          />
        </div>
      </div>

      {/* Légende des étapes */}
      <div className="flex flex-wrap gap-4 mt-4">
        {etapes.map((e) => (
          <div key={e.id} className="flex items-center gap-1.5 text-xs">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                e.statut === "complete"
                  ? "bg-green-500"
                  : e.statut === "en_cours"
                  ? "bg-blue-500 animate-pulse"
                  : e.statut === "a_faire"
                  ? "bg-gray-300"
                  : "bg-gray-200"
              }`}
            />
            <span className="text-gray-600">{e.titre.split(" ")[0]}</span>
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
    complete: {
      border: "border-green-200 bg-green-50",
      badge: "bg-green-500 text-white",
      texte: "Vérifié",
    },
    en_cours: {
      border: "border-blue-200 bg-blue-50",
      badge: "bg-blue-500 text-white",
      texte: "En cours",
    },
    a_faire: {
      border: "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md",
      badge: "bg-gray-300 text-gray-600",
      texte: estPremierInscrit ? "À mettre à jour" : "À faire",
    },
    indisponible: {
      border: "border-gray-100 bg-gray-50 opacity-60",
      badge: "bg-gray-200 text-gray-400",
      texte: "Indisponible",
    },
  };

  const style = statuts[etape.statut];

  const contenu = (
    <div
      className={`rounded-xl border-2 p-5 transition-all duration-200 cursor-pointer ${style.border}`}
    >
      <div className="flex items-start gap-4">
        <span className="text-3xl">{etape.icone}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold text-gray-800 text-sm">{etape.titre}</h4>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${style.badge}`}
            >
              {style.texte}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">{etape.description}</p>

          {etape.detail && (
            <p className="text-xs text-gray-400 mt-2 italic">{etape.detail}</p>
          )}

          {etape.statut === "a_faire" && etape.action && (
            <div className="mt-3">
              <span className="text-xs font-medium text-blue-600 hover:text-blue-800">
                {etape.action} →
              </span>
            </div>
          )}

          {etape.statut === "en_cours" && (
            <div className="mt-3 flex gap-2">
              <span className="text-xs text-blue-600 font-medium">
                {etape.action}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Si l'étape a un lien et est cliquable
  if (etape.lien && etape.statut !== "indisponible") {
    return <Link href={etape.lien}>{contenu}</Link>;
  }

  return contenu;
}

function CarteScoreVerification({
  utilisateur,
  verifVisage,
  syntheseCNI,
}: {
  utilisateur: Utilisateur;
  verifVisage: VerificationDetail | null;
  syntheseCNI: SyntheseVerificationCNI | null;
}) {
  const points: string[] = [];

  // Points bonus selon vérifications
  if (utilisateur.est_email_verifie) points.push("Email vérifié (+10 pts)");
  if (utilisateur.est_visage_verifie)
    points.push("Visage reconnu (+25 pts)");
  if (utilisateur.est_cni_verifiee) points.push("CNI authentifiée (+30 pts)");
  if (utilisateur.deux_fa_active) points.push("2FA active (+15 pts)");

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-5">
      <div className="flex items-start gap-4">
        <span className="text-2xl">🏆</span>
        <div>
          <h4 className="font-bold text-gray-800 text-sm mb-1">
            Impact sur ton score DigiID
          </h4>
          <p className="text-xs text-gray-600 mb-3">
            Chaque vérification d&apos;identité augmente ton score de confiance
            numérique.
          </p>
          {points.length > 0 ? (
            <ul className="space-y-1">
              {points.map((p, i) => (
                <li
                  key={i}
                  className="text-xs text-gray-700 flex items-center gap-2"
                >
                  <span className="text-green-500">✓</span> {p}
                </li>
              ))}
              <li className="text-xs text-gray-500 flex items-center gap-2 mt-2 pt-2 border-t border-blue-200">
                <span className="font-bold text-blue-600">+{points.length * 10} pts</span>
                <span>bonus total estimé</span>
              </li>
            </ul>
          ) : (
            <p className="text-xs text-gray-400 italic">
              Aucune vérification pour le moment. Complète les étapes
              ci-dessus pour débloquer des points bonus.
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

/**
 * Vérifie si l'utilisateur est un premier inscrit (date récente).
 * Un "premier inscrit" est quelqu'un inscrit depuis moins de 7 jours
 * OU qui n'a encore aucune vérification complétée.
 */
function estPremierInscrit(utilisateur: Utilisateur): boolean {
  // Si aucune vérification complétée
  if (
    !utilisateur.est_email_verifie &&
    !utilisateur.est_visage_verifie &&
    !utilisateur.est_cni_verifiee &&
    !utilisateur.deux_fa_active
  ) {
    return true;
  }

  // Si inscrit depuis moins de 7 jours
  if (utilisateur.date_creation) {
    const dateCreation = new Date(utilisateur.date_creation);
    const maintenant = new Date();
    const diffJours =
      (maintenant.getTime() - dateCreation.getTime()) / (1000 * 60 * 60 * 24);
    if (diffJours <= 7) return true;
  }

  return false;
}

/**
 * Construit la liste des étapes avec leurs statuts dynamiques.
 */
function construireEtapes(
  utilisateur: Utilisateur,
  verifVisage: VerificationDetail | null,
  syntheseCNI: SyntheseVerificationCNI | null,
  chargementVisage: boolean,
  chargementCNI: boolean
): EtapeVerification[] {
  const estPremier = estPremierInscrit(utilisateur);

  return [
    {
      id: "email",
      titre: "📧 Vérification email",
      description:
        "Confirme ton adresse email pour sécuriser ton compte et recevoir les notifications.",
      icone: "📧",
      statut: utilisateur.est_email_verifie ? "complete" : "a_faire",
      lien: utilisateur.est_email_verifie ? undefined : "/verification",
      action: "Vérifier mon email",
      detail: utilisateur.est_email_verifie
        ? "Email vérifié"
        : estPremier
        ? "Requis dès l'inscription"
        : undefined,
    },
    {
      id: "visage",
      titre: "🔹 Reconnaissance faciale",
      description:
        "Prends une photo de toi pour vérifier ton identité par reconnaissance faciale.",
      icone: "👤",
      statut: verifVisage?.statut === "approuve"
        ? "complete"
        : verifVisage?.statut === "rejete" ||
          verifVisage?.statut === "en_attente"
        ? "en_cours"
        : chargementVisage
        ? "a_faire"
        : "a_faire",
      lien:
        verifVisage?.statut === "approuve"
          ? undefined
          : "/verification-visuelle",
      action:
        verifVisage?.statut === "rejete"
          ? "Réessayer"
          : verifVisage?.statut === "en_attente"
          ? "En attente de validation..."
          : estPremier
          ? "Mettre à jour ma photo"
          : "Ajouter ma photo",
      detail:
        verifVisage?.statut === "approuve"
          ? `Validé à ${Math.round(verifVisage.score_liveness * 100)}%`
          : verifVisage?.statut === "rejete"
          ? verifVisage.raison || "Photo rejetée"
          : estPremier
          ? "Clique pour configurer"
          : "Recommandé pour +25 pts",
    },
    {
      id: "cni",
      titre: "🔹 Scan CNI (carte d'identité)",
      description:
        "Scanne ta Carte Nationale d'Identité pour authentifier ton identité officielle.",
      icone: "🆔",
      statut: syntheseCNI?.statut === "approuve"
        ? "complete"
        : syntheseCNI?.statut === "rejete"
        ? "en_cours"
        : chargementCNI
        ? "a_faire"
        : "a_faire",
      lien:
        syntheseCNI?.statut === "approuve"
          ? undefined
          : "/verification-cni",
      action:
        syntheseCNI?.statut === "rejete"
          ? "Re-scanner"
          : estPremier
          ? "Mettre à jour ma CNI"
          : "Scanner ma CNI",
      detail:
        syntheseCNI?.statut === "approuve"
          ? "Carte authentifiée ✓"
          : syntheseCNI?.statut === "rejete"
          ? "Échec de validation"
          : estPremier
          ? "Clique pour scanner"
          : "Requis pour les rôles institutionnels",
    },
    {
      id: "role",
      titre: "🔹 Rôle & permissions (RBAC)",
      description:
        "Ton rôle détermine tes accès. Les rôles institutionnels (agent, police, médecin) offrent plus de fonctionnalités.",
      icone: "🔑",
      statut: utilisateur.role !== "citoyen"
        ? "complete"
        : "a_faire",
      lien: "/parametres/role",
      action:
        utilisateur.role !== "citoyen"
          ? "Voir mes permissions"
          : estPremier
          ? "Configurer mon rôle"
          : "Demander un rôle",
      detail:
        utilisateur.role !== "citoyen"
          ? `Rôle actuel : ${utilisateur.role}`
          : estPremier
          ? "Choisis ton rôle dès maintenant"
          : "Rôle citoyen par défaut",
    },
    {
      id: "2fa",
      titre: "🔐 Double authentification (2FA)",
      description:
        "Ajoute une couche de sécurité avec un code TOTP à 6 chiffres généré sur ton téléphone.",
      icone: "🔐",
      statut: utilisateur.deux_fa_active ? "complete" : "a_faire",
      lien: utilisateur.deux_fa_active ? undefined : "/parametres/2fa",
      action: utilisateur.deux_fa_active
        ? "Configurée"
        : estPremier
        ? "Activer la 2FA"
        : "Configurer",
      detail: utilisateur.deux_fa_active
        ? "Protection active"
        : estPremier
        ? "Fortement recommandé"
        : "Recommandé pour +15 pts",
    },
  ];
}
