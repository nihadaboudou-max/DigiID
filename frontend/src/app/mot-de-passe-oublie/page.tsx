"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Logo } from "@/composants/commun/Logo";
import { ErreurAPI } from "@/services/client_api";
import {
  demanderReinitialisationMotDePasse,
  verifierCodeReinitialisationMotDePasse,
} from "@/services/authentification";

type CanalRecuperation = "email" | "whatsapp";

export default function PageMotDePasseOublie() {
  const router = useRouter();
  const [identifiant, setIdentifiant] = useState("");
  const [canal, setCanal] = useState<CanalRecuperation>("email");
  const [code, setCode] = useState("");
  const [etapeCode, setEtapeCode] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [compteurRenvoi, setCompteurRenvoi] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [information, setInformation] = useState<string | null>(null);

  useEffect(() => {
    if (compteurRenvoi <= 0) return;
    const timer = setTimeout(
      () => setCompteurRenvoi((compteur) => compteur - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [compteurRenvoi]);

  async function demanderCode(canalChoisi: CanalRecuperation) {
    setChargement(true);
    setErreur(null);
    setCanal(canalChoisi);
    try {
      const reponse = await demanderReinitialisationMotDePasse(
        identifiant,
        canalChoisi,
      );
      setInformation(reponse.message);
      setEtapeCode(true);
      setCompteurRenvoi(60);
    } catch (e) {
      if (e instanceof ErreurAPI) {
        setErreur(e.message_utilisateur);
      } else {
        setErreur("Impossible d'envoyer le code. Réessaie.");
      }
    } finally {
      setChargement(false);
    }
  }

  async function gererDemande(evt: FormEvent) {
    evt.preventDefault();
    const canalInitial: CanalRecuperation = identifiant.includes("@")
      ? "email"
      : "whatsapp";
    await demanderCode(canalInitial);
  }

  async function gererVerification(evt: FormEvent) {
    evt.preventDefault();
    setErreur(null);
    if (code.length !== 6) {
      setErreur("Le code doit contenir 6 chiffres.");
      return;
    }

    setChargement(true);
    try {
      const resultat = await verifierCodeReinitialisationMotDePasse(
        identifiant,
        code,
      );
      router.push(
        `/mot-de-passe-oublie/reinitialiser?token=${encodeURIComponent(resultat.token)}`,
      );
    } catch (e) {
      if (e instanceof ErreurAPI) {
        setErreur(e.message_utilisateur);
      } else {
        setErreur("Code incorrect ou expiré. Demande un nouveau code.");
      }
    } finally {
      setChargement(false);
    }
  }

  const canalAlternatif: CanalRecuperation =
    canal === "email" ? "whatsapp" : "email";

  return (
    <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
      <div className="max-w-md w-full carte apparition">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Logo taille="moyen" />
          </div>
          <h1 className="text-2xl mb-1">Mot de passe oublié ?</h1>
          <p className="text-sm text-ardoise-clair">
            {etapeCode
              ? "Si ce compte existe, un code a été envoyé ; saisis-le ici."
              : "Saisis ton numéro de téléphone ou ton adresse e-mail."}
          </p>
        </div>

        {information && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-5 rounded">
            <p className="text-sm text-green-800 font-medium">{information}</p>
          </div>
        )}
        {erreur && (
          <div className="bg-terre/10 border-l-4 border-terre p-4 mb-5 rounded">
            <p className="text-sm text-terre font-medium">{erreur}</p>
          </div>
        )}

        {!etapeCode ? (
          <>
            <p className="text-xs text-ardoise-clair mb-4">
              La réponse reste identique, que le compte existe ou non.
            </p>
            <form onSubmit={gererDemande} className="space-y-4">
              <ChampSaisie
                libelle="Numéro de téléphone ou e-mail"
                type="text"
                required
                minLength={3}
                maxLength={254}
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                placeholder="97 12 34 56 ou amadou@exemple.com"
                autoComplete="username"
                inputMode="text"
              />
              <Bouton
                type="submit"
                variante="primaire"
                chargement={chargement}
                className="w-full min-h-14"
              >
                Envoyer le code
              </Bouton>
            </form>
          </>
        ) : (
          <>
            <form onSubmit={gererVerification} className="space-y-4">
              <ChampSaisie
                libelle="Code à 6 chiffres"
                type="text"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
                autoComplete="one-time-code"
                autoFocus
              />
              <Bouton
                type="submit"
                variante="primaire"
                chargement={chargement}
                className="w-full min-h-14"
              >
                Vérifier le code
              </Bouton>
            </form>

            <div className="mt-5 space-y-3 text-center">
              <button
                type="button"
                onClick={() => void demanderCode(canal)}
                disabled={compteurRenvoi > 0 || chargement}
                className="min-h-11 text-sm text-lagune hover:text-lagune-fonce disabled:text-ardoise-clair/50"
              >
                {compteurRenvoi > 0
                  ? `Renvoyer le code (${compteurRenvoi}s)`
                  : "Renvoyer le code"}
              </button>
              <div>
                <button
                  type="button"
                  onClick={() => void demanderCode(canalAlternatif)}
                  disabled={chargement}
                  className="text-sm underline text-ardoise-clair hover:text-ardoise disabled:opacity-50"
                >
                  Essayer l’autre méthode ({canalAlternatif === "email" ? "E-mail" : "WhatsApp"})
                </button>
              </div>
            </div>
          </>
        )}

        <div className="mt-6 pt-6 border-t border-ardoise-clair/10 text-center text-sm">
          <Link href="/connexion" className="text-ardoise-clair hover:text-lagune">
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    </main>
  );
}
