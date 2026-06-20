"use client";

/**
 * Page Score → Conseils d'amélioration
 * Astuces et bonnes pratiques pour augmenter son score DigiID.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import {
  obtenirMonScore,
  type ScoreDetail,
  type FacteurScore,
} from "@/services/score";
import { ErreurAPI } from "@/services/client_api";

interface Conseil {
  niveau: "facile" | "moyen" | "expert";
  icone: string;
  titre: string;
  description: string;
  impact: string;
  points: number;
}

const CONSEILS: Conseil[] = [
  {
    niveau: "facile",
    icone: "📱",
    titre: "Utilise régulièrement le mobile money",
    description:
      "Wave, Orange Money, Free Money ou tout autre service de mobile money que tu utilises au quotidien. Chaque transaction renforce la confiance dans ton profil numérique.",
    impact: "Preuve d'activité financière régulière",
    points: 15,
  },
  {
    niveau: "facile",
    icone: "📸",
    titre: "Vérifie ton identité (faciale + CNI)",
    description:
      "Passe les étapes de vérification dans le menu Identité. La reconnaissance faciale et le scan de ta CNI sont les deux facteurs les plus importants.",
    impact: "Identité vérifiée = confiance maximale",
    points: 25,
  },
  {
    niveau: "facile",
    icone: "📧",
    titre: "Confirme ton adresse email",
    description:
      "Une adresse email vérifiée est un signal fort de stabilité. Tu reçois aussi les notifications importantes de DigiID.",
    impact: "Bonus de +10 points immédiat",
    points: 10,
  },
  {
    niveau: "moyen",
    icone: "🛡️",
    titre: "Active la double authentification (2FA)",
    description:
      "Protège ton compte avec un code à 6 chiffres généré par une app d'authentification. C'est un signe de maturité numérique.",
    impact: "Sécurité renforcée, +15 points",
    points: 15,
  },
  {
    niveau: "moyen",
    icone: "💳",
    titre: "Garde la même carte SIM",
    description:
      "La stabilité de ton numéro de téléphone est un facteur clé. Plus tu gardes la même SIM longtemps, plus ta stabilité perçue est élevée.",
    impact: "Stabilité téléphonique sur la durée",
    points: 20,
  },
  {
    niveau: "moyen",
    icone: "📍",
    titre: "Reste dans une zone géographique stable",
    description:
      "Des déplacements fréquents entre plusieurs villes ou pays peuvent réduire ta stabilité. Pas besoin de rester immobile, juste d'être prévisible.",
    impact: "Cohérence géographique",
    points: 10,
  },
  {
    niveau: "expert",
    icone: "👥",
    titre: "Parraine tes proches",
    description:
      "Invite tes amis et ta famille à rejoindre DigiID. Un réseau de confiance partagé renforce ton propre score. Chaque filleul rapporte +2 points.",
    impact: "Bonus de +2 points par filleul",
    points: 2,
  },
  {
    niveau: "expert",
    icone: "🔗",
    titre: "Connecte tes services en ligne",
    description:
      "Lie tes comptes (mobile money, transport, santé, éducation) à ton identité DigiID. Plus tu as de traces numériques vérifiées, plus ton score est élevé.",
    impact: "Réseau de confiance étendu",
    points: 20,
  },
];

const STYLES_NIVEAU: Record<string, string> = {
  facile: "bg-green-100 text-green-700 border-green-200",
  moyen: "bg-ocre/15 text-ocre-fonce border-ocre/20",
  expert: "bg-terre/10 text-terre border-terre/20",
};

export default function PageAmeliorationScore() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [score, setScore] = useState<ScoreDetail | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    obtenirMonScore()
      .then(setScore)
      .catch(() => {})
      .finally(() => setChargement(false));
  }, []);

  // Grouper par niveau
  const faciles = CONSEILS.filter((c) => c.niveau === "facile");
  const moyens = CONSEILS.filter((c) => c.niveau === "moyen");
  const experts = CONSEILS.filter((c) => c.niveau === "expert");

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70">
        <Link href="/score" className="hover:text-ocre transition-colors">Score</Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Amélioration du score</span>
      </nav>

      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Booste ton score
        </p>
        <h1 className="mt-1">Conseils d&apos;amélioration</h1>
        <p className="text-ardoise-clair mt-2">
          Des actions simples et concrètes pour augmenter ton score de confiance DigiID.
        </p>
      </header>

      {/* Score actuel */}
      {!chargement && score && (
        <div className="bg-lagune/5 border border-lagune/20 rounded-xl p-4 flex items-center gap-4">
          <p className="text-4xl font-bold text-lagune">{score.score_total}</p>
          <div>
            <p className="text-sm font-medium text-ardoise">Ton score actuel</p>
            <Badge
              variante={score.niveau === "Élevé" ? "succes" : score.niveau === "Moyen" ? "ocre" : "terre"}
            >
              {score.niveau}
            </Badge>
          </div>
        </div>
      )}

      {/* Conseils faciles */}
      <section>
        <h2 className="flex items-center gap-2 mb-4">
          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Facile</span>
          <span className="text-ardoise-clair text-sm">— Actions rapides à faire tout de suite</span>
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {faciles.map((conseil) => (
            <CarteConseil key={conseil.titre} conseil={conseil} />
          ))}
        </div>
      </section>

      {/* Conseils moyens */}
      <section>
        <h2 className="flex items-center gap-2 mb-4">
          <span className="bg-ocre/15 text-ocre-fonce px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Moyen</span>
          <span className="text-ardoise-clair text-sm">— Actions à planifier</span>
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {moyens.map((conseil) => (
            <CarteConseil key={conseil.titre} conseil={conseil} />
          ))}
        </div>
      </section>

      {/* Conseils experts */}
      <section>
        <h2 className="flex items-center gap-2 mb-4">
          <span className="bg-terre/10 text-terre px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Expert</span>
          <span className="text-ardoise-clair text-sm">— Pour aller plus loin</span>
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {experts.map((conseil) => (
            <CarteConseil key={conseil.titre} conseil={conseil} />
          ))}
        </div>
      </section>

      {/* Barème */}
      <Carte variante="pointilles" titre="Barème des points">
        <div className="space-y-2 text-sm text-ardoise">
          <p>Chaque conseil rapporte un nombre de points. Plus l&apos;action est impactante, plus elle rapporte.</p>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-700">+5 à +15</p>
              <p className="text-xs text-green-600">Actions faciles</p>
            </div>
            <div className="text-center p-3 bg-ocre/10 rounded-lg">
              <p className="text-lg font-bold text-ocre-fonce">+10 à +20</p>
              <p className="text-xs text-ocre">Actions moyennes</p>
            </div>
            <div className="text-center p-3 bg-terre/10 rounded-lg">
              <p className="text-lg font-bold text-terre">+20 à +35</p>
              <p className="text-xs text-terre">Actions expertes</p>
            </div>
          </div>
        </div>
      </Carte>

      {/* Navigation */}
      <div className="flex gap-3 pt-4 border-t border-ardoise-clair/10">
        <Link href="/score">
          <Bouton variante="ghost" taille="petit">← Vue d&apos;ensemble du score</Bouton>
        </Link>
        <Link href="/score/facteurs">
          <Bouton variante="secondaire" taille="petit">Facteurs d&apos;impact →</Bouton>
        </Link>
      </div>
    </div>
  );
}

function CarteConseil({ conseil }: { conseil: Conseil }) {
  return (
    <Carte>
      <div className="flex items-start gap-3">
        <span className="text-3xl flex-shrink-0">{conseil.icone}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="!text-base !mb-0">{conseil.titre}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STYLES_NIVEAU[conseil.niveau]}`}>
              {conseil.niveau}
            </span>
          </div>
          <p className="text-sm text-ardoise-clair mb-2">{conseil.description}</p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-ardoise-clair italic">{conseil.impact}</span>
            <span className="font-bold text-lagune">+{conseil.points} pts</span>
          </div>
        </div>
      </div>
    </Carte>
  );
}
