"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Bouton } from "@/composants/commun/Bouton";
import { IconeCamion, IconeFlecheRetour, IconeUtilisateur } from "@/composants/commun/Icones";
import { SelecteurLangue } from "@/composants/accessibilite/SelecteurLangue";
import { PiedDePage } from "@/composants/layouts/PiedDePage";

export default function PageAccueil() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  function suivre(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codeSaisi = code.trim();
    if (codeSaisi.length < 3) {
      setErreur("Saisissez le code indiqué sur le ticket.");
      return;
    }

    setErreur(null);
    router.push(`/suivi/${encodeURIComponent(codeSaisi)}`);
  }

  return (
    <main className="flex-grow">
      <section
        aria-label="Choix de la langue"
        className="border-b border-ardoise-clair/10 bg-white px-4 py-2 sm:px-6"
      >
        <div className="mx-auto flex max-w-contenu justify-end">
          <SelecteurLangue variante="menu" className="w-full sm:w-auto" />
        </div>
      </section>

      <section className="bg-sable-clair px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-xl apparition">
          <header className="mb-6 text-center">
            <h1 className="text-3xl font-extrabold leading-tight text-lagune sm:text-4xl">
              Suivez votre envoi.
            </h1>
            <p className="mt-2 text-lg text-ardoise-clair">
              Entrez le code inscrit sur le ticket.
            </p>
          </header>

          <form
            onSubmit={suivre}
            className="space-y-4 rounded-2xl border border-ardoise-clair/10 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="code-envoi" className="font-semibold text-lg text-ardoise">
                Code de votre colis ou enfant
              </label>
              <input
                id="code-envoi"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Ex. DKR-2025-000123"
                autoComplete="off"
                className="min-h-14 w-full rounded-xl border-2 border-ardoise-clair/20 px-4 text-lg text-ardoise focus:border-lagune focus:outline-none"
                aria-describedby={erreur ? "erreur-code-envoi" : undefined}
              />
              {erreur && (
                <p id="erreur-code-envoi" role="alert" className="text-lg font-semibold text-terre">
                  {erreur}
                </p>
              )}
            </div>
            <Bouton
              type="submit"
              variante="primaire"
              taille="grand"
              className="min-h-14 w-full"
            >
              <IconeCamion className="h-5 w-5" aria-hidden="true" />
              Suivre
            </Bouton>
          </form>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/horaires"
              className="bouton-secondaire inline-flex min-h-14 items-center justify-center gap-2 text-lg"
            >
              <IconeFlecheRetour className="h-5 w-5 rotate-180" aria-hidden="true" />
              Voir les horaires
            </Link>
            <Link
              href="/connexion"
              className="bouton-ghost inline-flex min-h-14 items-center justify-center gap-2 border-ardoise-clair/30 text-lg text-ardoise"
            >
              <IconeUtilisateur className="h-5 w-5" aria-hidden="true" />
              Me connecter
            </Link>
          </div>
        </div>
      </section>

      <PiedDePage />
    </main>
  );
}
