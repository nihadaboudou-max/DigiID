"use client";

/**
 * Page mot de passe oublié — demande d'envoi d'un lien de réinitialisation.
 * Phase 5d : UI prête. Phase 2 : envoi email réel via Celery + SMTP.
 */
import Link from "next/link";
import { useState } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { EnTete } from "@/composants/layouts/EnTete";
import { Logo } from "@/composants/commun/Logo";

export default function PageMotDePasseOublie() {
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [chargement, setChargement] = useState(false);

  function gererSoumission(evt: React.FormEvent) {
    evt.preventDefault();
    setChargement(true);
    // Simulation — Phase 2 fera un vrai appel POST /api/v1/auth/mot-de-passe/reinitialisation
    setTimeout(() => {
      setEnvoye(true);
      setChargement(false);
    }, 800);
  }

  return (
    <>
      <EnTete />
      <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
        <div className="max-w-md w-full carte apparition">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Logo taille="moyen" />
            </div>
            <h1 className="text-2xl mb-1">Mot de passe oublié ?</h1>
            <p className="text-sm text-ardoise-clair">
              Pas de panique, on t'envoie un lien de réinitialisation.
            </p>
          </div>

          {envoye ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                ✓
              </div>
              <p className="text-ardoise">
                Si un compte existe avec l'adresse <strong>{email}</strong>,
                un email vient d'être envoyé avec un lien de réinitialisation.
              </p>
              <p className="text-xs text-ardoise-clair italic">
                Le lien expire dans 30 minutes. Vérifie aussi tes spams.
              </p>
              <Link href="/connexion" className="inline-block mt-4 text-lagune font-medium">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <Alerte variante="info" className="mb-5">
                Saisis l'email de ton compte. Si on le retrouve, on t'envoie un lien.
                Pour éviter les abus, le message est le même que l'email existe ou non.
              </Alerte>

              <form onSubmit={gererSoumission} className="space-y-4">
                <ChampSaisie
                  libelle="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amadou@exemple.com"
                  autoComplete="email"
                />
                <Bouton
                  type="submit"
                  variante="primaire"
                  chargement={chargement}
                  className="w-full"
                >
                  Envoyer le lien
                </Bouton>
              </form>

              <div className="mt-6 pt-6 border-t border-ardoise-clair/10 text-center text-sm">
                <Link href="/connexion" className="text-ardoise-clair hover:text-lagune">
                  ← Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
