/**
 * Page 404 — affichée quand l'URL demandée n'existe pas.
 */
import Link from "next/link";

import { Bouton } from "@/composants/commun/Bouton";
import { Logo } from "@/composants/commun/Logo";
import { EnTete } from "@/composants/layouts/EnTete";

export default function PageIntrouvable() {
  return (
    <>
      <EnTete />
      <main className="flex-grow flex items-center justify-center px-6 py-16 bg-sable-clair">
        <div className="max-w-lg text-center apparition">
          <p className="text-9xl font-bold text-ocre mb-4 leading-none">404</p>
          <h1 className="mb-3">Cette page n'existe pas</h1>
          <p className="text-ardoise-clair mb-8">
            On dirait que tu as suivi un lien cassé, ou que cette page a été déplacée.
            Pas de panique — tout n'est pas perdu.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/">
              <Bouton variante="primaire">Retour à l'accueil</Bouton>
            </Link>
            <Link href="/tableau-de-bord">
              <Bouton variante="ghost">Mon espace</Bouton>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
