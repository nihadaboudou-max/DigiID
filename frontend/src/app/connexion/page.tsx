"use client";

/**
 * Page de connexion.
 * Appelle l'API backend /api/v1/auth/connexion et stocke les jetons.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { EnTete } from "@/composants/layouts/EnTete";
import { Logo } from "@/composants/commun/Logo";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";

export default function PageConnexion() {
  const router = useRouter();
  const { seConnecter } = useAuthentification();

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code2fa, setCode2fa] = useState("");
  const [afficher2fa, setAfficher2fa] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [info2fa, setInfo2fa] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function gererSoumission(evt: React.FormEvent) {
    evt.preventDefault();
    setErreur(null);
    setChargement(true);

    try {
      await seConnecter({
        email,
        mot_de_passe: motDePasse,
        ...(afficher2fa && code2fa ? { code_2fa: code2fa } : {}),
      });
      router.push("/tableau-de-bord");
    } catch (e) {
      if (e instanceof ErreurAPI) {
        if (e.code_erreur === "AUTH_004") {
          // 2FA requise — afficher le champ 2FA sans effacer les champs déjà remplis
          setAfficher2fa(true);
          setInfo2fa("🔐 Un code supplémentaire est requis. Saisis le code à 6 chiffres de ton application d'authentification.");
          // Remettre le focus sur le code 2FA
          setChargement(false);
          return; // Ne pas effacer les champs
        } else {
          setErreur(e.message_utilisateur);
        }
      } else {
        setErreur("Erreur inattendue. Réessaie dans un instant.");
      }
      setChargement(false);
    }
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
            <h1 className="text-2xl mb-1">
              {afficher2fa ? "Vérification 2FA" : "Connexion à ton espace"}
            </h1>
            <p className="text-sm text-ardoise-clair">
              {afficher2fa
                ? "Étape 2 — confirme ton identité avec ton application d'authentification."
                : "Retrouve ton DigiID et ton score."}
            </p>
          </div>

          {info2fa && (
            <div className="bg-lagune/10 border-l-4 border-lagune p-4 mb-5 rounded">
              <p className="text-sm text-lagune font-medium">{info2fa}</p>
            </div>
          )}

          {erreur && (
            <div className="bg-terre/10 border-l-4 border-terre p-4 mb-5 rounded">
              <p className="text-sm text-terre font-medium">{erreur}</p>
            </div>
          )}

          <form onSubmit={gererSoumission} className="space-y-4">
            {/* Champs email + mot de passe (masqués si 2FA affichée) */}
            {!afficher2fa ? (
              <>
                <ChampSaisie
                  libelle="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amadou@exemple.com"
                  autoComplete="email"
                />
                <ChampSaisie
                  libelle="Mot de passe"
                  type="password"
                  required
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  autoComplete="current-password"
                />
                <div className="text-right -mt-2">
                  <Link
                    href="/mot-de-passe-oublie"
                    className="text-xs text-ardoise-clair hover:text-lagune transition-colors"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
              </>
            ) : (
              // En mode 2FA, afficher les champs en lecture seule + le champ code
              <>
                <div className="bg-sable rounded-lg p-3 text-sm text-ardoise-clair">
                  <span className="font-medium text-ardoise">Email :</span> {email}
                </div>
                <ChampSaisie
                  libelle="Code 2FA"
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code2fa}
                  onChange={(e) => setCode2fa(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </>
            )}

            <Bouton
              type="submit"
              variante="primaire"
              chargement={chargement}
              className="w-full mt-2"
            >
              {afficher2fa ? "Valider le code" : "Se connecter"}
            </Bouton>

            {afficher2fa && (
              <button
                type="button"
                onClick={() => {
                  setAfficher2fa(false);
                  setCode2fa("");
                  setInfo2fa(null);
                }}
                className="w-full text-center text-sm text-ardoise-clair hover:text-lagune transition-colors"
              >
                ← Revenir à la connexion
              </button>
            )}
          </form>

          <div className="mt-6 pt-6 border-t border-ardoise-clair/10 text-center text-sm">
            <p className="text-ardoise-clair">
              Pas encore de compte ?{" "}
              <Link href="/inscription" className="font-medium">
                Créer un DigiID
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
