import Link from "next/link";

import { Bouton } from "@/composants/commun/Bouton";
import { Logo } from "@/composants/commun/Logo";
import { SelecteurLangue } from "@/composants/accessibilite/SelecteurLangue";
import { PiedDePage } from "@/composants/layouts/PiedDePage";

const INDICATEURS_SCORE = [
  { libelle: "Satisfaction des voyageurs", valeur: 92, couleur: "bg-succes" },
  { libelle: "Ponctualité des départs", valeur: 84, couleur: "bg-lagune" },
  { libelle: "Fiabilité des trajets", valeur: 78, couleur: "bg-ocre" },
  { libelle: "Sécurité des colis", valeur: 88, couleur: "bg-terre" },
];

const SERVICES = [
  {
    titre: "Voyages",
    description: "Planifiez les départs et suivez leur déroulement.",
  },
  {
    titre: "Colis et passagers",
    description: "Enregistrez chaque prise en charge et son paiement.",
  },
  {
    titre: "Suivi à destination",
    description: "Consultez les étapes du trajet et confirmez l’arrivée.",
  },
];

export default function PageAccueil() {
  return (
    <main className="flex-grow">
      <header className="border-b border-ardoise-clair/10 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-contenu items-center justify-between gap-3">
          <Link href="/" aria-label="DigiID — accueil">
            <Logo taille="moyen" />
          </Link>
          <nav aria-label="Compte" className="flex items-center gap-2">
            <Link
              href="/connexion"
              className="rounded-lg px-3 py-2 text-sm font-medium text-ardoise-clair transition-colors hover:bg-sable hover:text-lagune"
            >
              Connexion
            </Link>
            <Link href="/inscription">
              <Bouton variante="primaire" taille="petit">
                Inscription
              </Bouton>
            </Link>
          </nav>
        </div>
      </header>

      <section
        aria-label="Choix de la langue"
        className="border-b border-ardoise-clair/10 bg-white px-6 py-3"
      >
        <div className="mx-auto max-w-contenu">
          <SelecteurLangue variante="ligne" />
        </div>
      </section>

      <section className="bg-sable-clair px-6 py-14 md:py-20">
        <div className="mx-auto grid max-w-contenu items-center gap-10 md:grid-cols-2">
          <div className="space-y-5 text-center md:text-left">
            <p className="inline-flex rounded-full bg-lagune/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-lagune">
              Gestion logistique
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-ardoise md:text-5xl">
              Vos trajets et vos envois,
              <span className="text-lagune"> suivis simplement.</span>
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-ardoise-clair md:mx-0">
              DigiID transforme l'identité numérique des transporteurs et des
              expéditeurs en un outil de traçabilité qui sécurise les échanges. Elle
              donne aussi aux petites activités sans plateforme dédiée des outils
              simples pour gérer trajets, colis, paiements et clients.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
              <Link href="/connexion">
                <Bouton variante="primaire" taille="grand" className="w-full sm:w-auto">
                  Accéder à mon espace
                </Bouton>
              </Link>
              <Link href="/suivi">
                <Bouton
                  variante="ghost"
                  taille="grand"
                  className="w-full border-ardoise-clair/30 text-ardoise sm:w-auto"
                >
                  Suivre un envoi
                </Bouton>
              </Link>
            </div>
          </div>

          <section
            aria-labelledby="score-logistique-titre"
            className="mx-auto w-full max-w-md rounded-2xl border border-ardoise-clair/10 bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ocre">
                  Indicateurs de service
                </p>
                <h2 id="score-logistique-titre" className="mt-1 text-lg font-bold text-ardoise">
                  Score logistique
                </h2>
              </div>
              <span className="rounded-full bg-lagune/10 px-3 py-1 text-xs font-semibold text-lagune">
                Exemple
              </span>
            </div>

            <div className="mb-5 flex items-baseline gap-2">
              <span className="text-6xl font-black text-ardoise">86</span>
              <span className="text-xl font-semibold text-ardoise-clair">/ 100</span>
            </div>

            <div className="space-y-4">
              {INDICATEURS_SCORE.map((indicateur) => (
                <div key={indicateur.libelle}>
                  <div className="mb-1 flex justify-between gap-3 text-xs">
                    <span className="font-medium text-ardoise-clair">
                      {indicateur.libelle}
                    </span>
                    <span className="font-bold text-ardoise">{indicateur.valeur}%</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-sable"
                    role="progressbar"
                    aria-label={indicateur.libelle}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={indicateur.valeur}
                  >
                    <div
                      className={`h-full rounded-full ${indicateur.couleur}`}
                      style={{ width: `${indicateur.valeur}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 border-t border-ardoise-clair/10 pt-3 text-xs text-ardoise-clair">
              Aperçu de démonstration des critères de qualité du service.
            </p>
          </section>
        </div>
      </section>

      <section className="border-y border-ardoise-clair/10 bg-white px-6 py-12">
        <div className="mx-auto max-w-contenu">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-ardoise md:text-3xl">
              L’essentiel de vos opérations
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {SERVICES.map((service) => (
              <article
                key={service.titre}
                className="rounded-2xl border border-ardoise-clair/10 bg-sable-clair p-5"
              >
                <h3 className="mb-2 text-lg font-bold text-ardoise">
                  {service.titre}
                </h3>
                <p className="text-sm leading-relaxed text-ardoise-clair">
                  {service.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ardoise px-6 py-12 text-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">
              Prêt à gérer vos opérations ?
            </h2>
            <p className="mt-2 text-sm text-white/75">
              Connectez-vous pour organiser vos trajets et vos envois.
            </p>
          </div>
          <Link href="/connexion">
            <Bouton
              variante="primaire"
              taille="grand"
              className="border-none bg-ocre font-bold text-ardoise hover:bg-ocre/90"
            >
              Se connecter
            </Bouton>
          </Link>
        </div>
      </section>

      <PiedDePage />
    </main>
  );
}
