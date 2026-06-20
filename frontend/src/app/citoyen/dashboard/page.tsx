"use client";

/**
 * Tableau de bord Citoyen — Identité numérique et score de confiance.
 * Données dynamiques issues de l'API via le contexte d'authentification.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRoleUI } from "@/crochets/useRoleUI";
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
  const { can, chargement: chargementUI } = useRoleUI();
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

  if (chargementAuth || chargementUI) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1>Mon identité numérique</h1>
        <p className="text-ardoise-clair italic py-12">Chargement de ton profil...</p>
      </div>
    );
  }

  if (!utilisateur) return null;

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

  // Score total
  const scoreTotal = scoreData?.score_total ?? 0;
  const niveauScore = scoreData?.niveau ?? "—";

  return (
    <div className="space-y-8 apparition">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1 className="mt-1">Mon identité numérique</h1>
        <p className="text-ardoise-clair mt-2">Bienvenue sur ton espace DigiID. Gère ton identité et suis ton score de confiance.</p>
      </div>

      {/* Résumé identité + Score */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Carte identité */}
        <Carte>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-ocre/10 flex items-center justify-center text-ocre text-2xl font-bold flex-shrink-0">
              {initiales}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-ardoise text-lg truncate">{nomComplet}</h2>
              <p className="text-sm text-ardoise-clair font-mono truncate">{utilisateur.digiid_public || "—"}</p>
              <Badge variante={niveauIdentite.variante} className="mt-1">{niveauIdentite.texte}</Badge>
            </div>
          </div>
        </Carte>

        {/* Score de confiance */}
        {can.viewScore && !chargementScore && scoreData && (
          <Link href="/score" className="block group">
            <Carte className="cursor-pointer hover:shadow-lg transition-all group">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs uppercase text-ardoise-clair font-semibold">Score de confiance</p>
                <span className="flex items-center gap-1 text-xs text-green-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Live
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-bold text-lagune transition-all duration-500">{scoreTotal}</span>
                <span className="text-sm text-ardoise-clair">/100</span>
                <div className="flex-1">
                  <BarreProgression valeur={scoreTotal} couleur="lagune" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-ardoise-clair">Niveau : {niveauScore}</span>
                <span className="text-xs text-ocre font-semibold group-hover:translate-x-1 transition-transform">
                  Voir les détails →
                </span>
              </div>
            </Carte>
          </Link>
        )}
        {can.viewScore && chargementScore && (
          <Carte>
            <p className="text-xs text-ardoise-clair italic">Chargement du score...</p>
          </Carte>
        )}
      </div>

      {/* Grille d'accès rapide — liens vers les pages réelles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CarteAction titre="Vérifier ma CNI" description="Scanner ta carte d'identité" href="/identite/verification-cni" icone="🪪" />
        <CarteAction titre="Vérification faciale" description="Reconnaissance biométrique" href="/identite/verification-visuelle" icone="📸" />
        <CarteAction titre="Mes consentements" description="Gérer les accès autorisés" href="/consentements" icone="✅" />
        <CarteAction titre="Mes documents" description="Documents et justificatifs" href="/documents" icone="📄" />
        <CarteAction titre="Parrainage" description="Invite tes proches" href="/parrainage" icone="📨" />
        <CarteAction titre="Mes badges" description="Gamification et récompenses" href="/badges" icone="🏆" />
        <CarteAction titre="Mes ordonnances" description="Consultez et signalez vos prescriptions" href="/citoyen/mes-ordonnances" icone="💊" />
        <CarteAction titre="Mon score" description="Suis ton score de confiance" href="/score" icone="📊" />
        <CarteAction titre="Assistant DigiID" description="Pose tes questions" href="/chatbot" icone="🤖" />
      </div>

      {/* Statut des vérifications */}
      <Carte titre="📋 Progression des vérifications">
        <div className="space-y-3">
          <LigneVerification
            icone="📧"
            label="Email vérifié"
            fait={!!utilisateur.est_email_verifie}
            lien={utilisateur.est_email_verifie ? undefined : "/identite/email"}
          />
          <LigneVerification
            icone="👤"
            label="Reconnaissance faciale"
            fait={!!utilisateur.est_visage_verifie}
            lien={utilisateur.est_visage_verifie ? undefined : "/identite/verification-visuelle"}
          />
          <LigneVerification
            icone="🆔"
            label="CNI vérifiée"
            fait={!!utilisateur.est_cni_verifiee}
            lien={utilisateur.est_cni_verifiee ? undefined : "/identite/verification-cni"}
          />
          <LigneVerification
            icone="🔐"
            label="2FA activée"
            fait={!!utilisateur.deux_fa_active}
            lien={utilisateur.deux_fa_active ? undefined : "/identite/2fa"}
          />
        </div>
      </Carte>
    </div>
  );
}

function CarteAction({ titre, description, href, icone }: { titre: string; description: string; href: string; icone: string }) {
  return (
    <Link href={href} className="block group">
      <div className="carte cursor-pointer hover:shadow-lg transition-all h-full">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{icone}</span>
          <div>
            <h3 className="font-bold text-ardoise group-hover:text-ocre transition-colors">{titre}</h3>
            <p className="text-sm text-ardoise-clair mt-1">{description}</p>
          </div>
        </div>
        <p className="text-xs text-ocre font-semibold mt-3 group-hover:translate-x-1 transition-transform">Accéder →</p>
      </div>
    </Link>
  );
}

function LigneVerification({ icone, label, fait, lien }: { icone: string; label: string; fait: boolean; lien?: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-sable rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-lg">{icone}</span>
        <span className="text-sm font-medium text-ardoise">{label}</span>
      </div>
      {fait ? (
        <Badge variante="succes">✓ Fait</Badge>
      ) : lien ? (
        <Link href={lien} className="text-xs text-ocre hover:underline font-semibold">
          À faire →
        </Link>
      ) : (
        <Badge variante="neutre">—</Badge>
      )}
    </div>
  );
}
