"use client";

/**
 * Tableau de bord Citoyen — Identité numérique et score de confiance.
 * Données dynamiques issues de l'API via le contexte d'authentification.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { useAuthentification } from "@/contextes/authentification";
import { obtenirMonScore, type ScoreDetail } from "@/services/score";

export default function CitoyenDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur, chargement: chargementAuth } = useAuthentification();
  const [scoreData, setScoreData] = useState<ScoreDetail | null>(null);
  const [chargementScore, setChargementScore] = useState(true);

  const chargerScore = useCallback(async () => {
    if (!utilisateur) return;
    try {
      const data = await obtenirMonScore();
      setScoreData(data);
    } catch {
      // Pas de score disponible — silencieux
    }
    setChargementScore(false);
  }, [utilisateur]);

  useEffect(() => {
    chargerScore();
  }, [chargerScore]);

  // Rafraîchit le score quand la page redevient visible
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && scoreData) {
        obtenirMonScore().then(setScoreData).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [scoreData]);

  if (chargementAuth) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1>Mon identité numérique</h1>
        <p className="text-ardoise-clair italic py-12">Chargement de ton profil...</p>
      </div>
    );
  }

  if (!utilisateur) return null;

  /* ─── Catégories organisées par priorité ─── */

interface LienAction {
  titre: string;
  href: string;
  icone: string;
  description: string;
}

const CATEGORIES: { titre: string; icone: string; couleur: string; liens: LienAction[] }[] = [
  {
    titre: "Identité & Vérification",
    icone: "🪪",
    couleur: "border-l-lagune",
    liens: [
      { titre: "Documents d'identité", href: "/documents-identite", icone: "🆔", description: "CNI, permis, assurance" },
      { titre: "Vérifier ma CNI", href: "/identite/verification-cni", icone: "📄", description: "Scanner ta carte d'identité" },
      { titre: "Reconnaissance faciale", href: "/identite/verification-visuelle", icone: "📸", description: "Vérification biométrique" },
    ],
  },
  {
    titre: "Santé",
    icone: "🏥",
    couleur: "border-l-lagune",
    liens: [
      { titre: "Mon dossier médical", href: "/citoyen/mon-dossier-medical", icone: "📋", description: "Consultations, prescriptions" },
      { titre: "Mes ordonnances", href: "/citoyen/mes-ordonnances", icone: "💊", description: "Consultez vos prescriptions" },
    ],
  },
  {
    titre: "Sécurité & Données",
    icone: "🔒",
    couleur: "border-l-ocre",
    liens: [
      { titre: "Mes consentements", href: "/consentements", icone: "✅", description: "Gérer les accès autorisés" },
      { titre: "Mes autorisations", href: "/autorisations", icone: "🔐", description: "Qui a accès à mes données" },
      { titre: "Partager mon DigiID", href: "/partage", icone: "📱", description: "QR code et lien de partage" },
      { titre: "Mes documents", href: "/documents", icone: "📁", description: "Documents et justificatifs" },
    ],
  },
  {
    titre: "Engagement & Outils",
    icone: "🌟",
    couleur: "border-l-terre",
    liens: [
      { titre: "Mon score", href: "/score", icone: "📊", description: "Suis ton score de confiance" },
      { titre: "Mes badges", href: "/badges", icone: "🏆", description: "Gamification et récompenses" },
      { titre: "Parrainage", href: "/parrainage", icone: "📨", description: "Invite tes proches" },
      { titre: "Assistant DigiID", href: "/chatbot", icone: "🤖", description: "Pose tes questions" },
    ],
  },
];

  // Initiales pour l'avatar
  const initiales = ((utilisateur.prenom?.[0] || "") + (utilisateur.nom?.[0] || "")).toUpperCase() || "?";
  const nomComplet = [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || utilisateur.email;

  // Niveau de vérification
  const niveauIdentite = (() => {
    const verif = [
      utilisateur.est_email_verifie,
      utilisateur.est_visage_verifie,
      utilisateur.est_cni_verifiee,
    ];
    const completees = verif.filter(Boolean).length;
    if (completees >= 3) return { texte: "Identité complète ✓", variante: "succes" as const };
    if (completees >= 1) return { texte: "Partiellement vérifié", variante: "ocre" as const };
    return { texte: "Non vérifié", variante: "neutre" as const };
  })();

  const scoreTotal = scoreData?.score_total ?? 0;
  const niveauScore = scoreData?.niveau ?? "—";

  return (
    <div className="space-y-6 apparition pb-20">
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1 className="mt-1">Tableau de bord</h1>
        <p className="text-ardoise-clair mt-1 text-sm">
          Bienvenue {nomComplet.split(" ")[0]} ✨ — Accède rapidement à tes données et services.
        </p>
      </div>

      {/* Barre identité + Score + Progression */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Carte Identité */}
        <Carte className="lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-ocre/10 flex items-center justify-center text-ocre text-xl font-bold flex-shrink-0">
              {initiales}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-ardoise truncate">{nomComplet}</h2>
              <p className="text-xs text-ardoise-clair font-mono truncate">{utilisateur.digiid_public || "—"}</p>
              <Badge variante={niveauIdentite.variante} taille="petit" className="mt-1">{niveauIdentite.texte}</Badge>
            </div>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link href="/parametres">
              <Badge variante="ocre" taille="petit" className="cursor-pointer hover:opacity-80">⚙️ Modifier</Badge>
            </Link>
            <Link href="/profil">
              <Badge variante="lagune" taille="petit" className="cursor-pointer hover:opacity-80">👤 Profil complet</Badge>
            </Link>
          </div>
        </Carte>

        {/* Score */}
        {scoreData && !chargementScore ? (
          <Link href="/score" className="lg:col-span-1 block group">
            <Carte className="cursor-pointer hover:shadow-lg transition-all h-full group">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase text-ardoise-clair font-semibold">Score de confiance</p>
                <span className="flex items-center gap-1 text-[10px] text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Live
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-lagune transition-all duration-500">{scoreTotal}</span>
                <span className="text-sm text-ardoise-clair">/100</span>
              </div>
              <BarreProgression valeur={scoreTotal} couleur="lagune" />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-ardoise-clair">Niveau : {niveauScore}</span>
                <span className="text-xs text-ocre font-semibold group-hover:translate-x-1 transition-transform">
                  Détails →
                </span>
              </div>
            </Carte>
          </Link>
        ) : (
          <div className="lg:col-span-1">
            <Carte>
              <p className="text-xs text-ardoise-clair italic">Chargement du score...</p>
            </Carte>
          </div>
        )}

        {/* Mini progression des vérifications */}
        <Carte className="lg:col-span-1">
          <p className="text-xs uppercase text-ardoise-clair font-semibold mb-3">Vérifications</p>
          <div className="space-y-2">
            <MiniVerif icone="📧" label="Email" fait={!!utilisateur.est_email_verifie} />
            <MiniVerif icone="📸" label="Visage" fait={!!utilisateur.est_visage_verifie} />
            <MiniVerif icone="🆔" label="CNI" fait={!!utilisateur.est_cni_verifiee} />
            <MiniVerif icone="🔐" label="2FA" fait={!!utilisateur.deux_fa_active} />
          </div>
          <Link href="/parametres" className="block text-center mt-3 text-xs text-ocre hover:underline font-semibold">
            Compléter mes vérifications →
          </Link>
        </Carte>
      </div>

      {/* Catégories organisées */}
      <div className="grid md:grid-cols-2 gap-4">
        {CATEGORIES.map((categorie) => (
          <Carte key={categorie.titre} className={`border-l-4 ${categorie.couleur}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{categorie.icone}</span>
              <h2 className="font-bold text-ardoise">{categorie.titre}</h2>
            </div>
            <div className="divide-y divide-ardoise-clair/5">
              {categorie.liens.map((lien) => (
                <Link
                  key={lien.href}
                  href={lien.href}
                  className="flex items-center gap-3 py-2.5 group hover:bg-sable/50 -mx-4 px-4 rounded transition-colors"
                >
                  <span className="text-base w-6 text-center flex-shrink-0">{lien.icone}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ardoise group-hover:text-ocre transition-colors truncate">
                      {lien.titre}
                    </p>
                    <p className="text-xs text-ardoise-clair truncate">{lien.description}</p>
                  </div>
                  <span className="text-ocre text-xs opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </Link>
              ))}
            </div>
          </Carte>
        ))}
      </div>

      {/* Lien vers paramètres */}
      <div className="text-center pt-4">
        <Link
          href="/parametres"
          className="inline-flex items-center gap-2 text-sm text-ardoise-clair hover:text-ocre transition-colors"
        >
          ⚙️ Paramètres du compte et préférences →
        </Link>
      </div>
    </div>
  );
}

/* ─── Sous-composants ─── */

function MiniVerif({ icone, label, fait }: { icone: string; label: string; fait: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        <span className="text-xs">{icone}</span>
        <span className="text-xs text-ardoise">{label}</span>
      </div>
      {fait ? (
        <span className="text-xs text-green-600 font-semibold">✓</span>
      ) : (
        <span className="text-xs text-ardoise-clair">—</span>
      )}
    </div>
  );
}
