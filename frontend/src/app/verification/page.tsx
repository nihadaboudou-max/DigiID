"use client";

/**
 * Page de verification d'identite.
 * Apres inscription, l'utilisateur doit confirmer son email et telephone.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { Logo } from "@/composants/commun/Logo";
import { EnTete } from "@/composants/layouts/EnTete";
import { clientAPI, ErreurAPI } from "@/services/client_api";

type EtapeVerif = "email" | "telephone" | "termine";

/**
 * Interface pour la réponse d'envoi qui peut contenir le code en dev.
 */
interface ReponseEnvoi {
  destination_masquee: string;
  code_dev?: string | null;
}

export default function PageVerification() {
  const router = useRouter();
  const [etape, setEtape] = useState<EtapeVerif>("email");
  const [codeEmail, setCodeEmail] = useState("");
  const [codeTelephone, setCodeTelephone] = useState("");
  const [canalTel, setCanalTel] = useState<"sms" | "appel">("sms");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [destinationMasquee, setDestinationMasquee] = useState("");
  const [codeVisible, setCodeVisible] = useState<string | null>(null);
  const [compteur, setCompteur] = useState(0);

  // Envoyer le code email au montage
  useEffect(() => {
    envoyerCodeEmail();
  }, []);

  async function envoyerCodeEmail() {
    setChargement(true);
    setMessage(null);
    setErreur(null);
    setCodeVisible(null);
    try {
      const reponse = await clientAPI.post<ReponseEnvoi>(
        "/api/v1/auth/verification/envoyer",
        { canal: "email" },
        { authentifie: true },
      );
      setDestinationMasquee(reponse.destination_masquee);
      setMessage("Un code a 6 chiffres t'a ete envoye par email.");
      // En mode developpement, le code est renvoye directement
      if (reponse.code_dev) {
        setCodeVisible(reponse.code_dev);
      }
      lancerCompteur();
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur d'envoi");
    } finally {
      setChargement(false);
    }
  }

  async function envoyerCodeTelephone() {
    setChargement(true);
    setMessage(null);
    setErreur(null);
    setCodeVisible(null);
    try {
      const reponse = await clientAPI.post<ReponseEnvoi>(
        "/api/v1/auth/verification/envoyer",
        { canal: canalTel },
        { authentifie: true },
      );
      setDestinationMasquee(reponse.destination_masquee);
      setMessage(`Un code t'a ete envoye par ${canalTel === "sms" ? "SMS" : "appel"}.`);
      if (reponse.code_dev) {
        setCodeVisible(reponse.code_dev);
      }
      lancerCompteur();
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur d'envoi");
    } finally {
      setChargement(false);
    }
  }

  function lancerCompteur() {
    setCompteur(60);
    const interval = setInterval(() => {
      setCompteur((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function verifierEmail() {
    if (codeEmail.length !== 6) return;
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await clientAPI.post<{ succes: boolean; message: string }>(
        "/api/v1/auth/verification/verifier",
        { code: codeEmail, canal: "email" },
        { authentifie: true },
      );
      if (reponse.succes) {
        setMessage("Email confirme !");
        setEtape("telephone");
        setTimeout(() => envoyerCodeTelephone(), 500);
      } else {
        setErreur("Code invalide. Demande un nouveau code.");
      }
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de verification");
    } finally {
      setChargement(false);
    }
  }

  async function verifierTelephone() {
    if (codeTelephone.length !== 6) return;
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await clientAPI.post<{ succes: boolean; message: string }>(
        "/api/v1/auth/verification/verifier",
        { code: codeTelephone, canal: "sms" },
        { authentifie: true },
      );
      if (reponse.succes) {
        setMessage("Telephone confirme !");
        setEtape("termine");
      } else {
        setErreur("Code invalide. Demande un nouveau code.");
      }
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de verification");
    } finally {
      setChargement(false);
    }
  }

  if (etape === "termine") {
    return (
      <>
        <EnTete />
        <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
          <div className="max-w-md carte text-center apparition">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-green-700">✓</span>
            </div>
            <h1 className="text-2xl mb-2">Identite confirmee !</h1>
            <p className="text-ardoise-clair mb-6">
              Ton email et ton telephone sont verifies. Tu peux maintenant utiliser pleinement DigiID.
            </p>
            <Bouton variante="primaire" onClick={() => router.push("/tableau-de-bord")}>
              Acceder a mon espace
            </Bouton>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <EnTete />
      <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
        <div className="max-w-lg w-full carte apparition">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Logo taille="moyen" />
            </div>
            <h1 className="text-2xl mb-1">Verifie ton identite</h1>
            <p className="text-sm text-ardoise-clair">
              On a besoin de confirmer que tu es bien toi pour eviter les faux profils.
            </p>
          </div>

          {/* Barre de progression */}
          <div className="flex gap-2 mb-6">
            <div className={`h-2 flex-1 rounded-full ${etape === "email" ? "bg-lagune" : "bg-lagune/30"}`} />
            <div className={`h-2 flex-1 rounded-full ${etape === "email" ? "bg-lagune/30" : "bg-lagune"}`} />
          </div>

          {erreur && (
            <Alerte variante="erreur" className="mb-4">{erreur}</Alerte>
          )}
          {message && (
            <Alerte variante="info" className="mb-4">{message}</Alerte>
          )}

          {etape === "email" && (
            <div className="space-y-4">
              <p className="text-ardoise font-medium">
                Etape 1 — Verifie ton email
              </p>
              <p className="text-sm text-ardoise-clair">
                On a envoye un code a {destinationMasquee || "ton email"}.
              </p>
              {codeVisible && (
                <div className="bg-lagune/10 border-2 border-dashed border-lagune rounded-xl p-4 text-center">
                  <p className="text-xs text-ardoise-clair mb-1">
                    🔧 Mode développement — code de vérification :
                  </p>
                  <p className="text-3xl font-mono font-bold text-lagune tracking-widest">
                    {codeVisible}
                  </p>
                  <p className="text-xs text-terre mt-2">
                    ⚠️ Ce code ne sera pas affiché en production. Il sera envoyé par email.
                  </p>
                </div>
              )}
              <ChampSaisie
                libelle="Code de verification"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={codeEmail}
                onChange={(e) => setCodeEmail(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                autoComplete="one-time-code"
                aide="Code a 6 chiffres recu par email"
              />
              <Bouton
                variante="primaire"
                className="w-full"
                chargement={chargement}
                onClick={verifierEmail}
                disabled={codeEmail.length !== 6 || chargement}
              >
                Confirmer mon email
              </Bouton>
              <div className="text-center">
                {compteur > 0 ? (
                  <span className="text-xs text-ardoise-clair">
                    Renvoyer dans {compteur}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={envoyerCodeEmail}
                    className="text-sm text-lagune hover:underline"
                  >
                    Renvoyer le code
                  </button>
                )}
              </div>
            </div>
          )}

          {etape === "telephone" && (
            <div className="space-y-4">
              <p className="text-ardoise font-medium">
                Etape 2 — Confirme ton telephone
              </p>
              <p className="text-sm text-ardoise-clair">
                Choisis comment recevoir le code de verification.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setCanalTel("sms"); envoyerCodeTelephone(); }}
                  className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                    canalTel === "sms"
                      ? "border-lagune bg-lagune/5"
                      : "border-ardoise-clair/20 hover:border-lagune/50"
                  }`}
                >
                  <span className="text-2xl block mb-1">💬</span>
                  <span className="text-sm font-medium">SMS</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setCanalTel("appel"); envoyerCodeTelephone(); }}
                  className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                    canalTel === "appel"
                      ? "border-lagune bg-lagune/5"
                      : "border-ardoise-clair/20 hover:border-lagune/50"
                  }`}
                >
                  <span className="text-2xl block mb-1">📞</span>
                  <span className="text-sm font-medium">Appel</span>
                </button>
              </div>

              {codeVisible && (
                <div className="bg-lagune/10 border-2 border-dashed border-lagune rounded-xl p-4 text-center">
                  <p className="text-xs text-ardoise-clair mb-1">
                    🔧 Mode développement — code de vérification :
                  </p>
                  <p className="text-3xl font-mono font-bold text-lagune tracking-widest">
                    {codeVisible}
                  </p>
                  <p className="text-xs text-terre mt-2">
                    ⚠️ Ce code ne sera pas affiché en production.
                  </p>
                </div>
              )}
              <ChampSaisie
                libelle="Code de verification"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={codeTelephone}
                onChange={(e) => setCodeTelephone(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                autoComplete="one-time-code"
                aide={`Code recu par ${canalTel === "sms" ? "SMS au " + destinationMasquee : "appel"}`}
              />

              <Bouton
                variante="primaire"
                className="w-full"
                chargement={chargement}
                onClick={verifierTelephone}
                disabled={codeTelephone.length !== 6 || chargement}
              >
                Confirmer mon telephone
              </Bouton>
              <div className="text-center">
                {compteur > 0 ? (
                  <span className="text-xs text-ardoise-clair">
                    Renvoyer dans {compteur}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={envoyerCodeTelephone}
                    className="text-sm text-lagune hover:underline"
                  >
                    Renvoyer le code
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
