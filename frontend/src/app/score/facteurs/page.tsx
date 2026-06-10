"use client";

/**
 * Page Score → Facteurs d'impact
 * Détaille chaque facteur qui compose le score DigiID.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import {
  obtenirMonScore,
  type ScoreDetail,
  type FacteurScore,
} from "@/services/score";
import { ErreurAPI } from "@/services/client_api";

export default function PageFacteursScore() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [score, setScore] = useState<ScoreDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    obtenirMonScore()
      .then(setScore)
      .catch((e) => setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement"))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <p className="text-ardoise-clair italic">Chargement...</p>;
  if (erreur && !score) return <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>;
  if (!score) return null;

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70">
        <Link href="/score" className="hover:text-ocre transition-colors">Score</Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Facteurs d&apos;impact</span>
      </nav>

      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Analyse détaillée
        </p>
        <h1 className="mt-1">Facteurs d&apos;impact du score</h1>
        <p className="text-ardoise-clair mt-2">
          Chaque facteur contribue à ton score total avec un poids spécifique.
          Plus tu remplis un facteur, plus il rapporte de points.
        </p>
      </header>

      {/* Score global */}
      <div className="flex items-center gap-6 flex-wrap">
        <Carte variante="accent" className="flex items-center gap-4">
          <p className="text-5xl font-bold text-lagune">{score.score_total}</p>
          <div>
            <p className="text-xs uppercase text-ocre font-bold">Score total</p>
            <Badge
              variante={score.niveau === "Élevé" ? "succes" : score.niveau === "Moyen" ? "ocre" : "terre"}
            >
              {score.niveau}
            </Badge>
          </div>
        </Carte>
      </div>

      {/* Liste détaillée des facteurs */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold">Détail des {score.facteurs.length} facteurs</h2>
        {score.facteurs.map((f) => (
          <CarteFacteurCle key={f.nom} facteur={f} />
        ))}
      </div>

      {/* Légende des couleurs */}
      <Carte variante="pointilles" titre="Comprendre les pourcentages">
        <div className="space-y-2 text-sm text-ardoise">
          <p><strong>Pourcentage d'utilisation</strong> : indique à quel point ce facteur est rempli.</p>
          <p><strong>Points gagnés</strong> : ce que tu as déjà obtenu sur ce facteur.</p>
          <p><strong>Poids maximum</strong> : le nombre max de points que ce facteur peut rapporter.</p>
          <div className="flex gap-4 mt-3">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600" /> &ge; 70%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-ocre" /> 40–69%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-terre" /> &lt; 40%</span>
          </div>
        </div>
      </Carte>

      {/* Navigation */}
      <div className="flex gap-3 pt-4 border-t border-ardoise-clair/10">
        <Link href="/score">
          <Bouton variante="ghost" taille="petit">← Vue d&apos;ensemble du score</Bouton>
        </Link>
        <Link href="/score/amelioration">
          <Bouton variante="secondaire" taille="petit">Conseils d&apos;amélioration →</Bouton>
        </Link>
      </div>
    </div>
  );
}

function CarteFacteurCle({ facteur }: { facteur: FacteurScore }) {
  const pct = facteur.pourcentage_utilisation;
  const couleurBarre: "succes" | "ocre" | "terre" = pct >= 70 ? "succes" : pct >= 40 ? "ocre" : "terre";

  return (
    <Carte>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="!text-base !mb-0">{facteur.libelle}</h3>
            <Badge variante={couleurBarre} taille="petit">{pct}%</Badge>
          </div>
          <p className="text-xs text-ardoise-clair italic mb-3">
            Identifiant technique : <code className="text-[10px]">{facteur.nom}</code>
          </p>
          <BarreProgression
            valeur={pct}
            couleur={couleurBarre}
            afficherPourcentage
          />
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-2xl font-bold text-lagune">+{facteur.valeur.toFixed(1)}</p>
          <p className="text-xs text-ardoise-clair">/ {facteur.poids_maximum}</p>
        </div>
      </div>
    </Carte>
  );
}
