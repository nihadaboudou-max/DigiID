"use client";

/**
 * Page publique — « où est mon colis / mon passager ? »
 *
 * Le client (ou sa famille) saisit le code du ticket reçu au guichet ou par
 * SMS, et retrouve l'état de l'envoi : enregistré → en route → arrivé, avec les
 * gares de départ et d'arrivée. **Aucune donnée personnelle** n'est affichée :
 * ni nom, ni téléphone, ni adresse — le code du ticket suffit.
 *
 * Cette page ne demande pas de compte : c'est l'entrée des personnes qui ne
 * connaissent pas DigiID et qui viennent d'envoyer un colis.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeColis } from "@/composants/commun/Icones";

export default function PageSuivi() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      router.replace(`/suivi/${encodeURIComponent(token)}`);
    }
  }, [router, searchParams]);

  /**
   * Nettoie ce que le client colle : il arrive souvent avec l'URL entière du
   * SMS (`…/suivi/DKR-2025-000123`) plutôt qu'avec le seul code.
   */
  function extraireCode(valeur: string): string {
    const nettoye = valeur.trim();
    if (!nettoye) return "";
    if (nettoye.startsWith("http://") || nettoye.startsWith("https://")) {
      const dernier = nettoye.replace(/\/+$/, "").split("/").pop() ?? "";
      return decodeURIComponent(dernier).toUpperCase();
    }
    return nettoye.toUpperCase();
  }

  function rechercher(e: React.FormEvent) {
    e.preventDefault();
    const propre = extraireCode(code);
    if (propre.length < 3) {
      setErreur("Saisissez le code inscrit sur le ticket (ex. DKR-2025-000123).");
      return;
    }
    setErreur(null);
    router.push(`/suivi/${encodeURIComponent(propre)}`);
  }

  return (
    <main
      className="flex-grow"
      data-vocal-zone
      data-vocal-annonce="Vous êtes sur le suivi public. Entrez le code écrit sur le ticket, puis touchez Rechercher. Je vous dirai ensuite où se trouve l'envoi, étape par étape."
    >
      <section className="bg-gradient-to-b from-sable-clair to-white py-16">
        <div className="mx-auto max-w-3xl px-6 text-center apparition">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-ocre">
            Suivi public
          </p>
          <h1 className="mb-4 text-4xl font-bold text-lagune md:text-5xl">
            Où est mon envoi ?
          </h1>
          <p className="mb-8 text-lg text-ardoise-clair">
            Colis ou passager : entrez le code du ticket reçu au guichet, aucun compte
            n&apos;est nécessaire.
          </p>

          <Carte className="mx-auto max-w-xl text-left">
            <form onSubmit={rechercher} className="space-y-4">
              <ChampSaisie
                libelle="Code du ticket"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex. DKR-2025-000123"
                autoFocus
                aide="Il figure en haut du ticket, juste à côté du QR code."
                erreur={erreur ?? undefined}
              />
              <Bouton type="submit" variante="primaire" className="w-full">
                <IconeColis className="h-4 w-4" />
                Suivre mon envoi
              </Bouton>
            </form>
          </Carte>

          <p className="mt-6 text-sm text-ardoise-clair">
            Pas de code ? Voyez les{" "}
            <Link href="/horaires" className="font-medium text-lagune underline underline-offset-2">
              prochains départs
            </Link>{" "}
            ou{" "}
            <Link href="/aide" className="font-medium text-lagune underline underline-offset-2">
              le centre d&apos;aide
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="pb-16">
        <div className="mx-auto grid max-w-3xl gap-3 px-6 sm:grid-cols-3">
          {[
            {
              titre: "1. Envoyé",
              texte: "Le guichet (ou le chauffeur) enregistre le colis et remet le ticket.",
            },
            {
              titre: "2. En route",
              texte: "Le chauffeur valide le départ : les proches et le destinataire sont prévenus par SMS.",
            },
            {
              titre: "3. Arrivé",
              texte: "Le colis est remis à l'arrivée, et le suivi affiche « livré ».",
            },
          ].map((etape) => (
            <Carte key={etape.titre}>
              <p className="font-semibold text-lagune">{etape.titre}</p>
              <p className="mt-1 text-sm text-ardoise-clair">{etape.texte}</p>
            </Carte>
          ))}
        </div>
      </section>
    </main>
  );
}
