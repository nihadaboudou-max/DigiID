"use client";

/**
 * Page Score — Phase 2 : vraies données depuis l'API backend.
 */
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
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
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { rafraichirProfil } = useAuthentification();
  const { notifier } = useNotifications();

  const [score, setScore] = useState<ScoreDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recalculEnCours, setRecalculEnCours] = useState(false);

  useEffect(() => {
    obtenirMonScore()
      .then(setScore)
      .catch((e) => {
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement du score");
      })
      .finally(() => setChargement(false));
  }, []);

  async function gererRecalcul() {
    setRecalculEnCours(true);
    setErreur(null);
    try {
      const nouveau = await recalculerMonScore();
      setScore(nouveau);
      await rafraichirProfil();
      notifier(`Score recalculé : ${nouveau.score_total}/100`, "succes");
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

  return (
    <div className="space-y-8 apparition">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            Mon score de confiance
          </p>
          <h1 className="mt-1">Score DigiID</h1>
          <p className="text-ardoise-clair mt-2">
            Une note sur 100 qui reflète la fiabilité de tes traces numériques.
          </p>
        </div>
        <Bouton variante="secondaire" onClick={gererRecalcul} chargement={recalculEnCours}>
          Recalculer maintenant
        </Bouton>
      </header>

      {/* Score principal */}
      <div className="grid md:grid-cols-3 gap-6">
        <Carte variante="accent" className="md:col-span-1 flex flex-col items-center text-center">
          <p className="text-xs uppercase text-ocre font-bold mb-3 tracking-wider">
            Score actuel
          </p>
          <p className="text-8xl font-bold text-lagune mb-2">{score.score_total}</p>
          <p className="text-lg text-ardoise-clair mb-4">/ 100</p>
          <Badge
            variante={score.niveau === "Élevé" ? "succes" : score.niveau === "Moyen" ? "ocre" : "terre"}
            taille="moyen"
          >
            {score.niveau}
          </Badge>
          <p className="text-xs text-ardoise-clair italic mt-4">
            Calculé le {new Date(score.date_calcul).toLocaleDateString("fr-FR")}
          </p>
        </Carte>

        <Carte className="md:col-span-2">
          <h3 className="mb-2">Que veut dire ce score ?</h3>
          <p className="text-sm text-ardoise mb-4">{score.interpretation}</p>
          <h4 className="text-ocre font-semibold mb-3 text-sm uppercase tracking-wide">Décomposition par facteur</h4>
          <div className="space-y-4">
            {score.facteurs.map((f) => (
              <FacteurBarre key={f.nom} facteur={f} />
            ))}
          </div>
        </Carte>
      </div>

      {/* Métadonnées */}
      <Carte titre="Détails techniques">
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <DetailLigne libelle="Méthode utilisée" valeur={score.methode} />
          <DetailLigne
            libelle="Calculé le"
            valeur={new Date(score.date_calcul).toLocaleString("fr-FR")}
          />
          <DetailLigne
            libelle="Prochaine mise à jour"
            valeur={
              score.prochaine_mise_a_jour
                ? new Date(score.prochaine_mise_a_jour).toLocaleDateString("fr-FR")
                : "—"
            }
          />
        </div>
      </Carte>

      {/* Comment améliorer */}
      <Carte variante="pointilles" titre="Comment améliorer mon score">
        <ul className="space-y-3 text-sm text-ardoise">
          <li className="flex items-start gap-3">
            <span className="bg-ocre text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">1</span>
            <span>Utiliser régulièrement ton mobile money (Wave, Orange Money, Free Money).</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="bg-ocre text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">2</span>
            <span>Garder la même carte SIM longtemps — la stabilité compte beaucoup.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="bg-ocre text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">3</span>
            <span>Rester dans une zone géographique stable. Pas besoin de bouger, juste être prévisible.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="bg-ocre text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0">4</span>
            <span>Inviter tes proches à rejoindre DigiID — un réseau partagé renforce ton score.</span>
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
