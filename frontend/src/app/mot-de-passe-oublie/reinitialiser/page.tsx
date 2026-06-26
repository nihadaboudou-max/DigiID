"use client";

/**
 * Page de réinitialisation de mot de passe.
 * L'utilisateur arrive ici après avoir cliqué sur le lien dans l'email.
 * Le token est dans l'URL (paramètre ?token=...).
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { EnTete } from "@/composants/layouts/EnTete";
import { Logo } from "@/composants/commun/Logo";
import { reinitialiserMotDePasse, ErreurAPI } from "@/services/authentification";

function ContenuReinitialisation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reussi, setReussi] = useState(false);

  async function gererSoumission(evt: React.FormEvent) {
    evt.preventDefault();
    setErreur(null);

    // Vérifier que les mots de passe correspondent
    if (nouveauMotDePasse !== confirmation) {
      setErreur("Les mots de passe ne correspondent pas.");
      return;
    }

    setChargement(true);

    try {
      const reponse = await reinitialiserMotDePasse(token!, nouveauMotDePasse);
      setReussi(true);
    } catch (e) {
      if (e instanceof ErreurAPI) {
        setErreur(e.message_utilisateur);
      } else {
        setErreur("Erreur inattendue. Réessaie dans un instant.");
      }
    } finally {
      setChargement(false);
    }
  }

  // Pas de token dans l'URL
  if (!token) {
    return (
      <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
        <div className="max-w-md w-full carte apparition text-center">
          <div className="w-16 h-16 bg-terre/10 text-terre rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
            ⚠
          </div>
          <h1 className="text-2xl mb-2">Lien invalide</h1>
          <p className="text-ardoise-clair mb-6">
            Ce lien de réinitialisation est invalide. Vérifie que tu as bien
            cliqué sur le lien complet reçu par email.
          </p>
          <Link
            href="/mot-de-passe-oublie"
            className="inline-block text-lagune font-medium"
          >
            ← Demander un nouveau lien
          </Link>
        </div>
      </main>
    );
  }

  // Succès
  if (reussi) {
    return (
      <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
        <div className="max-w-md w-full carte apparition text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl mb-4">
            ✓
          </div>
          <h1 className="text-2xl mb-2">Mot de passe réinitialisé !</h1>
          <p className="text-ardoise-clair mb-6">
            Ton mot de passe a été modifié avec succès. Tu peux maintenant
            te connecter avec ton nouveau mot de passe.
          </p>
          <Bouton
            variante="primaire"
            onClick={() => router.push("/connexion")}
            className="w-full"
          >
            Se connecter
          </Bouton>
        </div>
      </main>
    );
  }

  // Formulaire
  return (
    <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
      <div className="max-w-md w-full carte apparition">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Logo taille="moyen" />
          </div>
          <h1 className="text-2xl mb-1">Nouveau mot de passe</h1>
          <p className="text-sm text-ardoise-clair">
            Choisis un mot de passe sécurisé pour ton compte DigiID.
          </p>
        </div>

        {erreur && (
          <div className="bg-terre/10 border-l-4 border-terre p-4 mb-5 rounded">
            <p className="text-sm text-terre font-medium">{erreur}</p>
          </div>
        )}

        <Alerte variante="info" className="mb-5">
          Le mot de passe doit contenir au moins 12 caractères, une majuscule,
          une minuscule, un chiffre et un caractère spécial.
        </Alerte>

        <form onSubmit={gererSoumission} className="space-y-4">
          <ChampSaisie
            libelle="Nouveau mot de passe"
            type="password"
            required
            minLength={12}
            value={nouveauMotDePasse}
            onChange={(e) => setNouveauMotDePasse(e.target.value)}
            autoComplete="new-password"
            placeholder="Minimum 12 caractères"
          />
          <ChampSaisie
            libelle="Confirmer le mot de passe"
            type="password"
            required
            minLength={12}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="new-password"
            placeholder="Ressaisis le mot de passe"
          />
          <Bouton
            type="submit"
            variante="primaire"
            chargement={chargement}
            className="w-full"
          >
            Réinitialiser mon mot de passe
          </Bouton>
        </form>

        <div className="mt-6 pt-6 border-t border-ardoise-clair/10 text-center text-sm">
          <Link href="/connexion" className="text-ardoise-clair hover:text-lagune">
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PageReinitialiserMotDePasse() {
  return (
    <>
      <EnTete />
      <Suspense
        fallback={
          <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
            <p className="text-ardoise-clair">Chargement...</p>
          </main>
        }
      >
        <ContenuReinitialisation />
      </Suspense>
    </>
  );
}
