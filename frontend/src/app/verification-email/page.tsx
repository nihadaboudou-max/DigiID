"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Logo } from "@/composants/commun/Logo";
import {
  envoyerCodeVerification,
  verifierCode,
} from "@/services/authentification";
import { ErreurAPI } from "@/services/client_api";
import { useAuthentification } from "@/contextes/authentification";
import { cheminTableauDeBord } from "@/types/api";

type CanalConfirmation = "email" | "whatsapp";

function masquerEmail(email: string): string {
  const [local, domaine] = email.split("@");
  if (!local || !domaine) return email;
  return `${local[0]}***@${domaine}`;
}

function masquerTelephone(telephone: string): string {
  return `+229 ******${telephone.replace(/\D/g, "").slice(-3)}`;
}

export default function PageVerificationEmail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const apresInscription = searchParams.get("apres_inscription") === "1";
  const { utilisateur, seDeconnecter, rafraichirProfil } = useAuthentification();

  const [code, setCode] = useState("");
  const [canal, setCanal] = useState<CanalConfirmation | null>(null);
  const [destinationMasquee, setDestinationMasquee] = useState("");
  const [messageErreur, setMessageErreur] = useState<string | null>(null);
  const [messageSucces, setMessageSucces] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [verifie, setVerifie] = useState(false);
  const [compteurRenvoi, setCompteurRenvoi] = useState(0);
  const [codeDemande, setCodeDemande] = useState(false);
  useEffect(() => {
    if (compteurRenvoi <= 0) return;
    const timer = setTimeout(() => setCompteurRenvoi((compteur) => compteur - 1), 1000);
    return () => clearTimeout(timer);
  }, [compteurRenvoi]);

  async function envoyer(canalChoisi: CanalConfirmation) {
    setChargement(true);
    setMessageErreur(null);
    setMessageSucces(null);
    setCanal(canalChoisi);

    let canalEffectif = canalChoisi;
    try {
      let reponse = await envoyerCodeVerification(canalChoisi);
      if (!reponse.succes && canalChoisi === "whatsapp") {
        setMessageSucces("WhatsApp indisponible ; nous essayons par e-mail.");
        canalEffectif = "email";
        reponse = await envoyerCodeVerification("email");
      }

      if (!reponse.succes) {
        setMessageErreur(reponse.message);
        setCodeDemande(false);
        return;
      }

      setCanal(canalEffectif);
      setDestinationMasquee(reponse.destination_masquee);
      setCodeDemande(true);
      setCompteurRenvoi(60);
      setMessageErreur(null);
      if (canalEffectif === canalChoisi) setMessageSucces(null);
    } catch (erreur) {
      if (erreur instanceof ErreurAPI) {
        setMessageErreur(erreur.message_utilisateur);
      } else {
        setMessageErreur("Impossible d'envoyer le code. Réessaie.");
      }
      setCodeDemande(false);
    } finally {
      setChargement(false);
    }
  }

  async function gererVerification(evt: React.FormEvent) {
    evt.preventDefault();
    setMessageErreur(null);
    if (!canal || code.length !== 6) {
      setMessageErreur("Saisis le code à 6 chiffres reçu.");
      return;
    }

    setChargement(true);
    try {
      const reponse = await verifierCode(code, canal);
      if (reponse.succes && (reponse.est_email_verifie || reponse.est_telephone_verifie)) {
        setVerifie(true);
        setMessageSucces("Compte confirmé avec succès !");
        await rafraichirProfil();
        setTimeout(() => {
          if (apresInscription) {
            router.push("/verification");
          } else if (utilisateur) {
            router.push(cheminTableauDeBord(utilisateur.role));
          } else {
            router.push("/tableau-de-bord");
          }
        }, 1200);
      }
    } catch (erreur) {
      if (erreur instanceof ErreurAPI) {
        setMessageErreur(erreur.message_utilisateur);
      } else {
        setMessageErreur("Erreur lors de la vérification. Réessaie.");
      }
    } finally {
      setChargement(false);
    }
  }

  if (verifie) {
    return (
      <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
        <div className="max-w-md w-full carte apparition text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl text-green-700">✓</span>
          </div>
          <h1 className="text-2xl mb-2">Compte confirmé !</h1>
          <p className="text-ardoise-clair">Tu vas être redirigé...</p>
        </div>
      </main>
    );
  }

  const telephoneMasque = utilisateur?.telephone
    ? masquerTelephone(utilisateur.telephone)
    : null;
  const emailMasque = utilisateur?.email ? masquerEmail(utilisateur.email) : null;

  return (
    <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
      <div className="max-w-md w-full carte apparition">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <Logo taille="moyen" />
          </div>
          <h1 className="text-2xl mb-2">
            {codeDemande ? "Confirme ton compte" : "Choisis ton moyen de confirmation"}
          </h1>
          <p className="text-sm text-ardoise-clair">
            {codeDemande
              ? `Un code à 6 chiffres a été envoyé à ${destinationMasquee}.`
              : "Choisissez comment recevoir votre code de confirmation."}
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

        {!codeDemande ? (
          <div className="space-y-3">
            {telephoneMasque && (
              <Bouton
                type="button"
                variante="primaire"
                chargement={chargement && canal === "whatsapp"}
                disabled={chargement}
                className="w-full min-h-14"
                onClick={() => void envoyer("whatsapp")}
              >
                WhatsApp <span className="font-normal">({telephoneMasque})</span>
              </Bouton>
            )}
            {emailMasque && (
              <Bouton
                type="button"
                variante="secondaire"
                chargement={chargement && canal === "email"}
                disabled={chargement}
                className="w-full min-h-14"
                onClick={() => void envoyer("email")}
              >
                E-mail <span className="font-normal">({emailMasque})</span>
              </Bouton>
            )}
            <p className="text-xs text-center text-ardoise-clair">
              Le code expire après 2 minutes.
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={gererVerification} className="space-y-5">
              <ChampSaisie
                libelle="Code de confirmation"
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
                Confirmer mon compte
              </Bouton>
            </form>

            <div className="mt-5 space-y-3 text-center">
              <button
                type="button"
                onClick={() => void envoyer(canal!)}
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
                  onClick={() => {
                    setCanal(null);
                    setCode("");
                    setCodeDemande(false);
                    setCompteurRenvoi(0);
                    setMessageErreur(null);
                    setMessageSucces(null);
                  }}
                  className="text-sm underline text-ardoise-clair hover:text-ardoise"
                >
                  Changer de méthode
                </button>
              </div>
            </div>
          </>
        )}

        <div className="mt-6 pt-4 border-t border-ardoise-clair/10 text-center">
          <button
            type="button"
            onClick={async () => {
              await seDeconnecter();
              router.push("/connexion");
            }}
            className="text-sm text-ardoise-clair hover:text-terre"
          >
            ← Utiliser un autre compte
          </button>
        </div>
      </div>
    </main>
  );
}
