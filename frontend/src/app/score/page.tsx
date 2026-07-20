"use client";

/**
 * Page Score — Phase 2 : vraies donnees depuis l'API backend.
 *
 * Modifications v2 :
 *   - Affichage du NIVEAU (Debitant / Etabli / Fiable / Expert) au lieu du score brut
 *   - Jauge de progression visuelle plutot que le nombre /100
 *   - 5e facteur : Attestations communautaires
 *   - Le score brut reste accessible dans les details techniques (pour l'API institutionnelle)
 */
import { useCallback, useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { useNotifications } from "@/contextes/notifications";
import { useAuthentification } from "@/contextes/authentification";
import {
  obtenirMonScore,
  recalculerMonScore,
  type ScoreDetail,
  type FacteurScore,
} from "@/services/score";
import { ErreurAPI } from "@/services/client_api";

export default function PageScore() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={[      
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function niveauCouleur(niveau: string): { bg: string; text: string; icone: string } {
  switch (niveau) {
    case "Expert":
      return { bg: "bg-emerald-50 border-emerald-300", text: "text-emerald-700", icone: "star" };
    case "Fiable":
      return { bg: "bg-lagune/10 border-lagune/30", text: "text-lagune", icone: "shield" };
    case "Etabli":
      return { bg: "bg-ocre/10 border-ocre/30", text: "text-ocre", icone: "chart" };
    default: // Debutant
      return { bg: "bg-terre/10 border-terre/30", text: "text-terre", icone: "seedling" };
  }
}

function Contenu() {
  const { rafraichirProfil } = useAuthentification();
  const { notifier } = useNotifications();

  const [score, setScore] = useState<ScoreDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recalculEnCours, setRecalculEnCours] = useState(false);
  const [tempsReel, setTempsReel] = useState(false);
  const [afficherScoreBrut, setAfficherScoreBrut] = useState(false);

  const chargerScore = useCallback(async () => {
    try {
      const data = await obtenirMonScore();
      setScore(data);
      setErreur(null);
    } catch (e) {
      if (!score) {
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement du score");
      }
    } finally {
      setChargement(false);
    }
  }, [score]);

  useEffect(() => {
    chargerScore();
  }, []);

  // Rafraichissement automatique quand la page redevient visible
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible" && score) {
        obtenirMonScore().then(setScore).catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [score]);

  async function gererRecalcul() {
    setRecalculEnCours(true);
    setErreur(null);
    setTempsReel(false);
    try {
      const nouveau = await recalculerMonScore();
      setScore(nouveau);
      await rafraichirProfil();
      setTempsReel(true);
      notifier(`Score mis a jour : niveau ${nouveau.niveau}`, "succes");
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors du recalcul";
      setErreur(msg);
      notifier(msg, "erreur");
    } finally {
      setRecalculEnCours(false);
    }
  }

  if (chargement) {
    return <p className="text-ardoise-clair italic">Chargement de ton score...</p>;
  }

  if (erreur && !score) {
    return <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>;
  }

  if (!score) return null;

  const couleurs = niveauCouleur(score.niveau);
  const pctGlobal = Math.min(100, Math.max(0, score.score_total));

  return (
    <div className="space-y-8 apparition">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            Mon niveau de confiance
          </p>
          <h1 className="mt-1">Score DigiID</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Un niveau de confiance qui reflete la fiabilite de tes traces numeriques.
            Le score se recalcule automatiquement apres chaque action sur ton compte.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {tempsReel && !recalculEnCours && (
            <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Temps reel
            </span>
          )}
          <Bouton variante="secondaire" onClick={gererRecalcul} chargement={recalculEnCours}>
            Recalculer maintenant
          </Bouton>
        </div>
      </header>

      {/* Score principal : niveau + jauge (pas de nombre brut) */}
      <div className="grid md:grid-cols-3 gap-6">
        <Carte variante="accent" className={`md:col-span-1 flex flex-col items-center text-center ${couleurs.bg} border-2`}>
          {/* Niveau bien visible */}
          <p className={`text-xs uppercase font-bold mt-2 mb-1 tracking-wider ${couleurs.text}`}>
            Niveau de confiance
          </p>
          <p className={`text-3xl font-bold ${couleurs.text} mb-3`}>
            {score.niveau}
          </p>

          {/* Jauge de progression au lieu du nombre brut */}
          <div className="w-full max-w-[180px] mb-3">
            <div className="flex items-center justify-between text-xs text-ardoise-clair mb-1">
              <span>Vers le prochain niveau</span>
            </div>
            <div className="w-full h-3 bg-white/50 rounded-full overflow-hidden border border-ardoise/10">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  pctGlobal >= 80 ? "bg-emerald-500"
                  : pctGlobal >= 55 ? "bg-lagune"
                  : pctGlobal >= 30 ? "bg-ocre"
                  : "bg-terre"
                }`}
                style={{ width: `${pctGlobal}%` }}
              />
            </div>
          </div>

          {/* Indicateur discret pour les institutions / admins */}
          <button
            onClick={() => setAfficherScoreBrut(!afficherScoreBrut)}
            className="text-xs text-ardoise-clair hover:text-ocre transition-colors underline underline-offset-2"
          >
            {afficherScoreBrut ? `Score technique : ${score.score_total}/100` : "Voir le detail technique"}
          </button>

          <p className="text-xs text-ardoise-clair italic mt-2">
            Calcule le {new Date(score.date_calcul).toLocaleDateString("fr-FR")}
          </p>
        </Carte>

        <Carte className="md:col-span-2">
          <h3 className="mb-2">Que veut dire ce niveau ?</h3>
          <p className="text-sm text-ardoise mb-4">{score.interpretation}</p>
          <h4 className="text-ocre font-semibold mb-3 text-sm uppercase tracking-wide">
            Decomposition par facteur
          </h4>
          <div className="space-y-4">
            {score.facteurs.map((f) => (
              <FacteurBarre key={f.nom} facteur={f} />
            ))}
          </div>
        </Carte>
      </div>

      {/* Metadonnees (depliees si score brut affiche) */}
      {afficherScoreBrut && (
        <Carte titre="Details techniques">
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <DetailLigne libelle="Methode utilisee" valeur={score.methode} />
            <DetailLigne
              libelle="Calcule le"
              valeur={new Date(score.date_calcul).toLocaleString("fr-FR")}
            />
            <DetailLigne
              libelle="Prochaine mise a jour"
              valeur={
                score.prochaine_mise_a_jour
                  ? new Date(score.prochaine_mise_a_jour).toLocaleDateString("fr-FR")
                  : "—"
              }
            />
          </div>
        </Carte>
      )}

      {/* Comment ameliorer */}
      <Carte variante="pointilles" titre="Comment ameliorer mon niveau">
        <ul className="space-y-3 text-sm text-ardoise">
          <li className="flex items-start gap-3">
            <span className="bg-ocre text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">1</span>
            <span><strong>Attestations communautaires</strong> — demande a des proches ou a une ONG de t&apos;attester. C&apos;est le moyen le plus rapide de monter si tu n&apos;as pas de mobile money.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="bg-ocre text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">2</span>
            <span>Utiliser regulierement ton mobile money (Wave, Orange Money, Free Money).</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="bg-ocre text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">3</span>
            <span>Garder la meme carte SIM longtemps — la stabilite compte beaucoup.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="bg-ocre text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">4</span>
            <span>Rester dans une zone geographique stable. Pas besoin de bouger, juste etre previsible.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="bg-ocre text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">5</span>
            <span>Inviter tes proches a rejoindre DigiID — un reseau partage renforce ton score.</span>
          </li>
        </ul>
      </Carte>
    </div>
  );
}

function FacteurBarre({ facteur }: { facteur: FacteurScore }) {
  const pct = facteur.pourcentage_utilisation;
  const couleur =
    pct >= 70 ? "bg-green-600"
    : pct >= 40 ? "bg-ocre"
    : "bg-terre";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-ardoise">{facteur.libelle}</span>
        <span className="text-sm">
          <span className="font-bold text-lagune">+{facteur.valeur.toFixed(1)}</span>
          <span className="text-ardoise-clair"> / {facteur.poids_maximum}</span>
        </span>
      </div>
      <div className="w-full h-2 bg-sable-clair rounded-full overflow-hidden">
        <div
          className={`h-full ${couleur} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function DetailLigne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <p className="text-xs text-ardoise-clair uppercase tracking-wide mb-1">{libelle}</p>
      <p className="text-ardoise font-medium">{valeur}</p>
    </div>
  );
}
