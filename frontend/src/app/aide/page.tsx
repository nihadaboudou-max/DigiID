"use client";

/**
 * Aide & support — **une page par profil**.
 *
 * Le contenu vient de `@/composants/aide/contenus_aide` : chaque utilisateur ne
 * voit que son aide (guichet, chauffeur, commerçant, gérant de gare, police,
 * médical, ONG, agent terrain, administration, super-administration, citoyen,
 * ou l'aide publique quand on n'est pas connecté).
 *
 * Un super-administrateur peut ouvrir l'aide d'un autre profil :
 * `/aide?profil=chauffeur` — pratique pour le support et les démonstrations.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Carte } from "@/composants/commun/Carte";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { useAuthentification } from "@/contextes/authentification";
import { useVoix } from "@/i18n/useLangue";
import {
  CONTENUS_AIDE,
  LIBELLES_PROFIL,
  profilDepuisRole,
  type ProfilAide,
} from "@/composants/aide/contenus_aide";

export default function PageAide() {
  const { utilisateur } = useAuthentification();
  const { lireTexte } = useVoix();
  const [profilForce, setProfilForce] = useState<ProfilAide | null>(null);
  const [recherche, setRecherche] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(null);

  // Aperçu d'un autre profil via l'URL (?profil=chauffeur).
  useEffect(() => {
    const demande = new URLSearchParams(window.location.search).get("profil");
    if (demande && demande in CONTENUS_AIDE) setProfilForce(demande as ProfilAide);
  }, []);

  const profil = profilForce ?? profilDepuisRole(utilisateur?.role);
  const contenu = CONTENUS_AIDE[profil];
  // L'aide d'un autre profil se consulte : administration et super-administration.
  const peutParcourir = profil === "admin" || profil === "super_admin";

  const questions = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return contenu.questions;
    return contenu.questions.filter((item) =>
      `${item.question} ${item.reponse}`.toLowerCase().includes(q),
    );
  }, [contenu, recherche]);

  return (
    <div
      className="flex-grow"
      data-vocal-zone
      data-vocal-annonce={`Aide pour : ${LIBELLES_PROFIL[profil]}. ${contenu.resume} Touchez une question : je lis la réponse à voix haute.`}
    >
      <section className="bg-gradient-to-b from-sable-clair to-white py-14">
        <div className="mx-auto max-w-3xl px-6 text-center apparition">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-ocre">
            Aide et support — {LIBELLES_PROFIL[profil]}
          </p>
          <h1 className="mb-3 text-4xl font-bold text-lagune md:text-5xl">
            {contenu.titre}
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-lg text-ardoise-clair">
            {contenu.resume}
          </p>
          <div className="mx-auto max-w-xl">
            <ChampRecherche
              placeholder="Chercher dans cette aide..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="mx-auto max-w-3xl space-y-8 px-6">
          {/* Les gestes à connaître, cliquables */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ardoise-clair">
              À faire tout de suite
            </h2>
            <div className="flex flex-wrap gap-2">
              {contenu.actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-full border border-lagune/20 bg-lagune/5 px-4 py-2 text-sm font-medium text-lagune transition-colors hover:bg-lagune/10"
                >
                  {action.libelle}
                </Link>
              ))}
            </div>
          </div>

          {/* Questions du profil */}
          <div className="space-y-3">
            {questions.length === 0 ? (
              <Carte>
                <p className="py-6 text-center italic text-ardoise-clair">
                  Aucune réponse ici pour « {recherche} ».
                </p>
              </Carte>
            ) : (
              questions.map((item) => {
                const estOuverte = ouverte === item.question;
                return (
                  <Carte key={item.question} className="!p-0">
                    <button
                      type="button"
                      onClick={() => {
                        const ouvre = !estOuverte;
                        setOuverte(ouvre ? item.question : null);
                        // La réponse est lue à voix haute : l'essentiel de l'aide
                        // est ainsi accessible sans savoir lire.
                        if (ouvre) {
                          lireTexte(
                            item.lien
                              ? `${item.reponse} Touchez ${item.lien.libelle} pour y aller.`
                              : item.reponse,
                          );
                        }
                      }}
                      className="flex w-full items-start justify-between gap-4 rounded-2xl p-5 text-left transition-colors hover:bg-sable-clair"
                    >
                      <span className="font-semibold text-lagune">{item.question}</span>
                      <span
                        className={`flex-shrink-0 text-ocre transition-transform ${
                          estOuverte ? "rotate-45" : ""
                        }`}
                      >
                        <svg
                          width="20"
                          height="20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </span>
                    </button>
                    {estOuverte && (
                      <div className="apparition -mt-1 px-5 pb-5 text-sm leading-relaxed text-ardoise">
                        <p>{item.reponse}</p>
                        {item.lien && (
                          <Link
                            href={item.lien.href}
                            className="mt-3 inline-flex items-center gap-1 font-medium text-lagune underline underline-offset-2 hover:text-ocre"
                          >
                            {item.lien.libelle}
                          </Link>
                        )}
                      </div>
                    )}
                  </Carte>
                );
              })
            )}
          </div>

          {/* Toujours quelqu'un pour répondre */}
          <Carte variante="accent">
            <h3 className="mb-2">Une question qui n&apos;est pas ici ?</h3>
            <p className="mb-4 text-sm text-ardoise-clair">
              L&apos;assistant répond sur les colis, les passagers, les cars, le QR et
              le score.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/chatbot"
                className="rounded-lg bg-lagune px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-lagune-fonce"
              >
                Demander à l&apos;assistant
              </Link>
              {(profil === "visiteur" || profil === "citoyen") && (
                <Link
                  href="/suivi"
                  className="rounded-lg border border-lagune/30 px-4 py-2 text-sm font-medium text-lagune transition-colors hover:bg-lagune/5"
                >
                  Suivre un envoi
                </Link>
              )}
            </div>
          </Carte>

          {/* Aperçu de l'aide des autres profils (support / démonstration) */}
          {peutParcourir && (
            <div className="border-t border-ardoise-clair/15 pt-5">
              <label className="text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
                Voir l&apos;aide d&apos;un autre profil
              </label>
              <select
                className="champ-saisie mt-2 max-w-xs"
                value={profil}
                onChange={(e) => {
                  setRecherche("");
                  setOuverte(null);
                  setProfilForce(e.target.value as ProfilAide);
                }}
              >
                {(Object.keys(CONTENUS_AIDE) as ProfilAide[]).map((p) => (
                  <option key={p} value={p}>
                    {LIBELLES_PROFIL[p]}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-ardoise-clair">
                Lien direct : <code>/aide?profil=chauffeur</code>
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
