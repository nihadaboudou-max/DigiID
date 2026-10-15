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
  /** Barre latérale présente ? (décalage desktop pour ne pas la recouvrir) */
  const [avecMenu, setAvecMenu] = useState(false);

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

  // Le navigateur met parfois la voix en pause au retour d'onglet.
  useEffect(() => {
    const auRetour = () => gestionnaireAudio.reprendre();
    document.addEventListener("visibilitychange", auRetour);
    return () => document.removeEventListener("visibilitychange", auRetour);
  }, []);

  // Décalage horizontal : sur les pages connectées, la barre de navigation est
  // collée à gauche — la commande vocale se place juste à sa droite.
  useEffect(() => {
    setAvecMenu(Boolean(document.querySelector("aside")));
  }, [pathname]);

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

  const classePilule =
    "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-colors";

  return (
    <div
      className={`fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2 print:hidden ${
        avecMenu ? "md:left-[16rem]" : ""
      }`}
      data-vocal-ignorer
      role="group"
      aria-label={t("guide.groupe")}
    >
      <button
        type="button"
        onClick={ecouterCettePage}
        aria-pressed={enLecture}
        aria-label={t("guide.ecouter")}
        className={`${classePilule} bg-lagune text-white hover:bg-lagune-fonce`}
      >
        <span aria-hidden="true">{enLecture ? "🔊" : "🔈"}</span>
        {t("guide.ecouter")}
      </button>

      {enLecture && (
        <button
          type="button"
          onClick={arreter}
          aria-label={t("guide.arreter")}
          className={`${classePilule} bg-white text-lagune ring-1 ring-lagune/20 hover:bg-sable-clair`}
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
        className={`${classePilule} ${
          guide
            ? "bg-ocre text-ardoise hover:brightness-95"
            : "bg-white text-lagune ring-1 ring-lagune/20 hover:bg-sable-clair"
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
          className={`${classePilule} bg-white text-sm text-lagune ring-1 ring-lagune/20 hover:bg-sable-clair`}
        >
          <span aria-hidden="true">🐢</span>
          {lent ? t("guide.vitesse_normale") : t("guide.vitesse_lente")}
        </button>
      )}
    </div>
  );
}
