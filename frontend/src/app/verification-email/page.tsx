"use client";

/**
 * Page de vérification email.
 * Apparaît après l'inscription ou si l'utilisateur tente de se connecter
 * sans avoir vérifié son email.
 */
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { EnTete } from "@/composants/layouts/EnTete";
import { Logo } from "@/composants/commun/Logo";
import {
  envoyerCodeVerification,
  verifierCode,
  obtenirStatutVerification,
} from "@/services/authentification";
import { ErreurAPI } from "@/services/client_api";
import { useAuthentification } from "@/contextes/authentification";
import { cheminTableauDeBord } from "@/types/api";

export default function PageVerificationEmail() {
  const router = useRouter();
  const { utilisateur, seDeconnecter, rafraichirProfil } = useAuthentification();

  const [code, setCode] = useState("");
  const [destinationMasquee, setDestinationMasquee] = useState("");
  const [canal, setCanal] = useState<"email" | "sms" | "appel">("email");
  const [messageErreur, setMessageErreur] = useState<string | null>(null);
  const [messageSucces, setMessageSucces] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [verifie, setVerifie] = useState(false);
  const [compteurRenvoi, setCompteurRenvoi] = useState(0);
  const [codeVisible, setCodeVisible] = useState<string | null>(null);
  const codeEnvoyeRef = useRef(false);

  // Envoie le premier code au chargement (une seule fois, même en StrictMode)
  useEffect(() => {
    if (codeEnvoyeRef.current) return;
    codeEnvoyeRef.current = true;
    envoyerPremierCode();
  }, []);

  async function envoyerCode(canalChoisi: "email" | "sms" | "appel") {
    try {
      const reponse = await envoyerCodeVerification(canalChoisi);
      setDestinationMasquee(reponse.destination_masquee);
      setMessageErreur(null);
      setCompteurRenvoi(30); // 30 secondes avant de pouvoir renvoyer
      // Si l'envoi a échoué (aucun service email configuré), le code est renvoyé directement
      if (reponse.code_dev) {
        setCodeVisible(reponse.code_dev);
      }
      return reponse;
    } catch (e) {
      if (e instanceof ErreurAPI) {
        setMessageErreur(e.message_utilisateur);
      } else {
        setMessageErreur("Impossible d'envoyer le code. Réessaie.");
      }
      return null;
    }
  }

  async function envoyerPremierCode() {
    await envoyerCode(canal);
  }

  // Compte à rebours pour le renvoi
  useEffect(() => {
    if (compteurRenvoi <= 0) return;
    const timer = setTimeout(() => setCompteurRenvoi((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [compteurRenvoi]);

  async function gererEnvoiCode() {
    setMessageErreur(null);
    setChargement(true);
    const reponse = await envoyerCode(canal);
    if (reponse) {
      setMessageSucces("Nouveau code envoyé !");
    }
    setChargement(false);
  }

  async function gererVerification(evt: React.FormEvent) {
    evt.preventDefault();
    setMessageErreur(null);
    setMessageSucces(null);

    if (code.length !== 6) {
      setMessageErreur("Le code doit faire 6 chiffres.");
      return;
    }

    setChargement(true);
    try {
      const reponse = await verifierCode(code, canal);
      if (reponse.succes && reponse.est_email_verifie) {
        setVerifie(true);
        setMessageSucces("Email vérifié avec succès !");

        // dans le contexte d'authentification AVANT de rediriger
        await rafraichirProfil();

        // Rediriger vers le bon tableau de bord selon le rôle
        setTimeout(() => {
          if (utilisateur) {
            router.push(cheminTableauDeBord(utilisateur.role));
          } else {
            router.push("/tableau-de-bord");
          }
        }, 1500);
      }
    } catch (e) {
      if (e instanceof ErreurAPI) {
        setMessageErreur(e.message_utilisateur);
      } else {
        setMessageErreur("Erreur lors de la vérification. Réessaie.");
      }
    } finally {
      setChargement(false);
    }
  }

  // Si déjà vérifié, rediriger
  if (verifie) {
    return (
      <>
        <EnTete />
        <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
          <div className="max-w-md w-full carte apparition text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-green-700">✓</span>
            </div>
            <h1 className="text-2xl mb-2">Email vérifié !</h1>
            <p className="text-ardoise-clair mb-6">
              Ton compte est maintenant actif. Tu es redirigé...
            </p>
          </div>
        </main>
      </>
    );
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
            <h1 className="text-2xl mb-1">Vérifie ton email</h1>
            <p className="text-sm text-ardoise-clair">
              Un code à 6 chiffres a été envoyé à{" "}
              <span className="font-medium text-ardoise">
                {destinationMasquee || "ton adresse email"}
              </span>
            </p>
          </div>

          {messageSucces && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-5 rounded">
              <p className="text-sm text-green-800 font-medium">{messageSucces}</p>
            </div>
          )}

          {messageErreur && (
            <div className="bg-terre/10 border-l-4 border-terre p-4 mb-5 rounded">
              <p className="text-sm text-terre font-medium">{messageErreur}</p>
            </div>
          )}

          {codeVisible && (
            <div className="bg-lagune/10 border-2 border-dashed border-lagune rounded-xl p-4 mb-6 text-center">
              <p className="text-xs text-ardoise-clair mb-1">
                ✉️ Code de vérification (affiché car l'envoi automatique n'est pas disponible) :
              </p>
              <p className="text-3xl font-mono font-bold text-lagune tracking-widest">
                {codeVisible}
              </p>
              <p className="text-xs text-terre mt-2">
                ⚠️ Copie ce code et colle-le ci-dessous pour vérifier ton email.
              </p>
            </div>
          )}

          <form onSubmit={gererVerification} className="space-y-6">
            <div className="text-center">
              <ChampSaisie
                libelle="Code de vérification"
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
            </div>

            <Bouton
              type="submit"
              variante="primaire"
              chargement={chargement}
              className="w-full"
            >
              Vérifier mon email
            </Bouton>
          </form>

          <div className="mt-6 space-y-3 text-center">
            {/* Renvoyer le code */}
            <div>
              <button
                type="button"
                onClick={gererEnvoiCode}
                disabled={compteurRenvoi > 0 || chargement}
                className="text-sm text-lagune hover:text-lagune-fonce transition-colors disabled:text-ardoise-clair/50 disabled:cursor-not-allowed"
              >
                {compteurRenvoi > 0
                  ? `Renvoyer le code (${compteurRenvoi}s)`
                  : "Renvoyer le code"}
              </button>
            </div>

            {/* Changer de canal */}
            <div className="flex justify-center gap-4 text-sm text-ardoise-clair">
              <span>Recevoir par :</span>
              <button
                type="button"
                onClick={() => { setCanal("email"); setCodeVisible(null); envoyerPremierCode(); }}
                className={`${canal === "email" ? "font-medium text-lagune" : "hover:text-ardoise"}`}
              >
                Email
              </button>
              {utilisateur?.telephone && (
                <>
                  <button
                    type="button"
                    onClick={() => { setCanal("sms"); setCodeVisible(null); envoyerPremierCode(); }}
                    className={`${canal === "sms" ? "font-medium text-lagune" : "hover:text-ardoise"}`}
                  >
                    SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCanal("appel"); setCodeVisible(null); envoyerPremierCode(); }}
                    className={`${canal === "appel" ? "font-medium text-lagune" : "hover:text-ardoise"}`}
                  >
                    Appel
                  </button>
                </>
              )}
            </div>

            {/* Se déconnecter */}
            <div className="pt-4 border-t border-ardoise-clair/10">
              <button
                type="button"
                onClick={async () => {
                  await seDeconnecter();
                  router.push("/connexion");
                }}
                className="text-sm text-ardoise-clair hover:text-terre transition-colors"
              >
                ← Utiliser un autre compte
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
