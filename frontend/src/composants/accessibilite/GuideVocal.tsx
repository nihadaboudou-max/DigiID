"use client";

/**
 * GuideVocal — commande vocale présente sur **toutes** les pages (S5).
 *
 * Trois commandes, pensées pour une personne qui ne lit pas :
 *   🔊 « Écouter cette page » : lit l'écran (titre, messages, champs, actions) ;
 *   🧑‍🏫 « Guide » : à chaque écran et à chaque toucher, la voix explique ;
 *   🐢 « Lentement » : ralentit la voix pour les personnes âgées.
 *
 * Le composant est monté dans le layout racine : il fonctionne donc aussi sur
 * les pages publiques (suivi d'un colis, horaires, connexion…).
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import {
  activerEcouteInteractive,
  annoncerEcran,
  definirGuide,
  lireGuideEnregistre,
  lirePage,
  surChangementGuide,
} from "@/i18n/guide_vocal";
import { gestionnaireAudio } from "@/i18n/gestionnaire_audio";
import { useLangue, useVoix } from "@/i18n/useLangue";

export function GuideVocal() {
  const { t } = useLangue();
  const { muet, definirMuet } = useVoix();
  const pathname = usePathname();

  const [guide, setGuide] = useState(false);
  const [enLecture, setEnLecture] = useState(false);
  const [lent, setLent] = useState(false);
  const [panneauOuvert, setPanneauOuvert] = useState(false);

  // Restauration des préférences au premier rendu client.
  useEffect(() => {
    setGuide(lireGuideEnregistre());
    setLent(gestionnaireAudio.vitesseActuelle() < 0.85);
    setEnLecture(gestionnaireAudio.estEnLecture());
    const desabonner = gestionnaireAudio.surChangementLecture(setEnLecture);
    const desabonnerGuide = surChangementGuide(setGuide);
    return () => {
      desabonner();
      desabonnerGuide();
    };
  }, []);

  // Mode guidé : annonce chaque nouvel écran, et explique chaque toucher.
  useEffect(() => {
    if (!guide) return;
    annoncerEcran(700);
    return activerEcouteInteractive();
  }, [guide, pathname]);

  useEffect(() => {
    setPanneauOuvert(false);
  }, [pathname]);

  // Le navigateur met parfois la voix en pause au retour d'onglet.
  useEffect(() => {
    const auRetour = () => gestionnaireAudio.reprendre();
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, []);

  function ecouterCettePage() {
    if (muet) definirMuet(false);
    if (lirePage()) setEnLecture(true);
  }

  function arreter() {
    gestionnaireAudio.arreter();
    setEnLecture(false);
  }

  function basculerGuide() {
    const nouvelle = !guide;
    definirGuide(nouvelle);
    setGuide(nouvelle);
    if (muet) definirMuet(false);
    gestionnaireAudio.parler(
      nouvelle
        ? "Guide vocal activé. À chaque écran, je vous dis ce qu'il y a à faire, et ce que vous touchez."
        : "Guide vocal désactivé.",
    );
  }

  function basculerVitesse() {
    const nouvelle = !lent;
    setLent(nouvelle);
    gestionnaireAudio.definirVitesse(nouvelle ? 0.75 : 0.92);
    gestionnaireAudio.parler(
      nouvelle ? "Je vais parler plus lentement." : "Je reprends le rythme normal.",
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 print:hidden"
      data-vocal-ignorer
    >
      <div
        id="panneau-guide-vocal"
        aria-hidden={!panneauOuvert}
        role="group"
        aria-label={t("guide.groupe")}
        className={`${panneauOuvert ? "flex" : "hidden"} w-[min(20rem,calc(100vw-2rem))] max-h-[min(70vh,28rem)] max-w-full flex-col items-stretch gap-2 overflow-y-auto rounded-2xl border border-ardoise-clair/20 bg-white p-3 shadow-xl`}
      >
        <button
          type="button"
          onClick={ecouterCettePage}
          aria-pressed={enLecture}
          aria-label={t("guide.ecouter")}
          className="flex items-center gap-2 rounded-xl bg-lagune px-4 py-3 text-left text-sm font-medium text-white hover:bg-lagune-fonce"
        >
          <span aria-hidden="true">{enLecture ? "🔊" : "🔈"}</span>
          {t("guide.ecouter")}
        </button>

        {enLecture && (
          <button
            type="button"
            onClick={arreter}
            aria-label={t("guide.arreter")}
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium text-lagune ring-1 ring-lagune/20 hover:bg-sable-clair"
          >
            <span aria-hidden="true">⏹</span>
            {t("guide.arreter")}
          </button>
        )}

        <button
          type="button"
          onClick={basculerGuide}
          aria-pressed={guide}
          aria-label={guide ? t("guide.desactiver") : t("guide.activer")}
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium ${
            guide
              ? "bg-ocre text-ardoise hover:brightness-95"
              : "text-lagune ring-1 ring-lagune/20 hover:bg-sable-clair"
          }`}
        >
          <span aria-hidden="true">🧑‍🏫</span>
          {guide ? t("guide.actif") : t("guide.activer")}
        </button>

        {guide && (
          <button
            type="button"
            onClick={basculerVitesse}
            aria-pressed={lent}
            aria-label={lent ? t("guide.vitesse_normale") : t("guide.vitesse_lente")}
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium text-lagune ring-1 ring-lagune/20 hover:bg-sable-clair"
          >
            <span aria-hidden="true">🐢</span>
            {lent ? t("guide.vitesse_normale") : t("guide.vitesse_lente")}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPanneauOuvert((ouvert) => !ouvert)}
        aria-expanded={panneauOuvert}
        aria-controls="panneau-guide-vocal"
        aria-label={panneauOuvert ? "Fermer le guide vocal" : "Ouvrir le guide vocal"}
        className="flex min-h-11 items-center gap-2 rounded-full bg-lagune px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-lagune-fonce focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lagune"
      >
        <span aria-hidden="true">🧑‍🏫</span>
        <span>{panneauOuvert ? "Fermer" : "Guide vocal"}</span>
      </button>
    </div>
  );
}
