"use client";

/**
 * Page d'erreur globale — affichée quand une exception non gérée survient.
 * Next.js l'isole automatiquement pour ne pas crasher toute l'application.
 */
import { useEffect } from "react";
import Link from "next/link";

import { Bouton } from "@/composants/commun/Bouton";
import { EnTete } from "@/composants/layouts/EnTete";
import { Alerte } from "@/composants/commun/Alerte";

export default function PageErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En Phase 6, on enverra ça à Sentry
    console.error("Erreur capturée :", error);
  }, [error]);

  return (
    <>
      <EnTete />
      <main className="flex-grow flex items-center justify-center px-6 py-16 bg-sable-clair">
        <div className="max-w-lg w-full apparition">
          <div className="text-center mb-6">
            <p className="text-7xl font-bold text-terre mb-4 leading-none">!</p>
            <h1 className="mb-3">Une erreur est survenue</h1>
            <p className="text-ardoise-clair">
              On a noté l'incident. Réessaie dans un instant, ou retourne à l'accueil.
            </p>
          </div>

          {error.digest && (
            <Alerte variante="erreur" titre="Référence de l'incident" className="mb-6">
              Si tu contactes le support, communique cette référence :{" "}
              <code className="font-mono text-xs bg-white px-2 py-1 rounded">{error.digest}</code>
            </Alerte>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            <Bouton variante="primaire" onClick={reset}>
              Réessayer
            </Bouton>
            <Link href="/">
              <Bouton variante="ghost">Retour à l'accueil</Bouton>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
