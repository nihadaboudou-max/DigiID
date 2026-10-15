"use client";

/**
 * ReglagesVoix — réglages de la voix, page Paramètres (S5).
 *
 * Dit clairement quelle voix française est utilisée, permet de l'écouter, de
 * choisir un débit lent ou normal, et d'activer le guide parlé. C'est le seul
 * endroit où l'on vérifie « est-ce que ça parle bien sur cet appareil ? ».
 */
import { useEffect, useState } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { gestionnaireAudio } from "@/i18n/gestionnaire_audio";
import { useVoix } from "@/i18n/useLangue";

const PHRASE_TEST =
  "Bonjour. Je suis la voix de Digi ID. Je vais vous guider : " +
  "je lis ce qui est écrit à l'écran et je vous dis quoi toucher.";

export function ReglagesVoix() {
  const { lireTexte, vitesse, definirVitesse, guide, basculerGuide, muet, definirMuet } = useVoix();
  const [voix, setVoix] = useState<string | null>(null);
  const [disponible, setDisponible] = useState(true);

  useEffect(() => {
    setDisponible(gestionnaireAudio.voixDisponible());
    const lireVoix = () => setVoix(gestionnaireAudio.voixFrancaise());
    lireVoix();
    // Sur Chrome, la liste des voix arrive après le premier rendu.
    const minuteries = [200, 800, 2000].map((delai) =>
      window.setTimeout(lireVoix, delai),
    );
    return () => minuteries.forEach((m) => window.clearTimeout(m));
  }, []);

  const lent = vitesse < 0.85;

  return (
    <div className="space-y-3" data-vocal-ignorer>
      <p className="text-xs text-ardoise-clair">
        Voix française utilisée :{" "}
        <span className="font-medium text-ardoise">
          {!disponible
            ? "lecture vocale non disponible sur cet appareil (utilisez Chrome, Edge ou Safari)"
            : (voix ?? "voix par défaut de l'appareil")}
        </span>
      </p>

      <div className="flex flex-wrap gap-2">
        <Bouton
          variante="secondaire"
          taille="petit"
          onClick={() => {
            if (muet) definirMuet(false);
            lireTexte(PHRASE_TEST);
          }}
        >
          🔊 Tester la voix
        </Bouton>

        <Bouton
          variante={lent ? "primaire" : "ghost"}
          taille="petit"
          onClick={() => {
            definirVitesse(lent ? 0.92 : 0.75);
            lireTexte(lent ? "Je reprends le rythme normal." : "Je vais parler plus lentement.");
          }}
        >
          🐢 {lent ? "Parler normalement" : "Parler lentement"}
        </Bouton>

        <Bouton
          variante={guide ? "primaire" : "ghost"}
          taille="petit"
          onClick={() => {
            basculerGuide();
            if (muet) definirMuet(false);
            lireTexte(
              guide
                ? "Guide vocal désactivé."
                : "Guide vocal activé. À chaque écran, je vous dis ce qu'il y a à faire.",
            );
          }}
        >
          🧑‍🏫 {guide ? "Désactiver le guide parlé" : "Activer le guide parlé"}
        </Bouton>
      </div>

      <p className="text-xs text-ardoise-clair">
        Le guide parlé annonce chaque écran, chacun de vos touchers et le résultat de
        vos actions. Il fonctionne sur toutes les pages, y compris le suivi d&apos;un
        colis.
      </p>
    </div>
  );
}
