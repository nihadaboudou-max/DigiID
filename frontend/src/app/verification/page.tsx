"use client";

/**
 * Page de vérification d'identité — l'utilisateur choisit SON moyen.
 *
 * Principe : un seul canal de vérification (email OU téléphone), pas les deux.
 * En production, imposer les deux ferait fuir les utilisateurs.
 *
 * En mode développement, le code s'affiche à l'écran pour faciliter les tests.
 */
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { Logo } from "@/composants/commun/Logo";
import { EnTete } from "@/composants/layouts/EnTete";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { cheminTableauDeBord } from "@/types/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Etape = "choix" | "code" | "termine";
type Canal = "email" | "sms" | "appel";

interface ReponseEnvoi {
  destination_masquee: string;
  code_dev?: string | null;
}

interface ProfilUtilisateur {
  telephone: string | null;
}

// ─── Configuration des canaux ────────────────────────────────────────────────

interface OptionCanal {
  canal: Canal;
  icone: string;
  titre: string;
  description: string;
}

const OPTIONS_CANAUX: OptionCanal[] = [
  {
    canal: "email",
    icone: "📧",
    titre: "Par email",
    description: "Reçois un code à 6 chiffres sur ta boîte mail",
  },
  {
    canal: "sms",
    icone: "💬",
    titre: "Par SMS",
    description: "Reçois un code par message texte",
  },
  {
    canal: "appel",
    icone: "📞",
    titre: "Par appel",
    description: "Écoute le code dicté par téléphone",
  },
];

// ─── Page principale ─────────────────────────────────────────────────────────

export default function PageVerification() {
  const router = useRouter();
  const [utilisateur, setUtilisateur] = useState<{ role: string } | null>(null);
  const [etape, setEtape] = useState<Etape>("choix");
  const [canal, setCanal] = useState<Canal>("email");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [destinationMasquee, setDestinationMasquee] = useState("");
  const [codeVisible, setCodeVisible] = useState<string | null>(null);
  const [compteur, setCompteur] = useState(0);
  const [aTelephone, setATelephone] = useState<boolean | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Au montage, récupérer le profil pour adapter les options
  useEffect(() => {
    clientAPI
      .get<ProfilUtilisateur & { role: string }>("/api/v1/auth/moi", { authentifie: true })
      .then((profil) => {
        setATelephone(!!profil.telephone);
        setUtilisateur({ role: profil.role });
      })
      .catch(() => setATelephone(false));
  }, []);

  // Nettoyage de l'intervalle au démontage
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Envoi du code ────────────────────────────────────────────────────────

  async function envoyerCode() {
    setChargement(true);
    setMessage(null);
    setErreur(null);
    setCodeVisible(null);
    try {
      const reponse = await clientAPI.post<ReponseEnvoi>(
        "/api/v1/auth/verification/envoyer",
        { canal },
        { authentifie: true },
      );
      setDestinationMasquee(reponse.destination_masquee);
      setMessage(
        canal === "email"
          ? "Un code à 6 chiffres a été envoyé par email."
          : canal === "sms"
            ? "Un code à 6 chiffres a été envoyé par SMS."
            : "Tu vas recevoir un appel avec le code dicté.",
      );
      // Mode développement : le code est renvoyé directement
      if (reponse.code_dev) {
        setCodeVisible(reponse.code_dev);
      }
      lancerCompteur();
      setEtape("code");
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur d'envoi");
    } finally {
      setChargement(false);
    }
  }

  // ── Validation du code ───────────────────────────────────────────────────

  async function verifierCode() {
    if (code.length !== 6) return;
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await clientAPI.post<{ succes: boolean; message: string }>(
        "/api/v1/auth/verification/verifier",
        { code, canal },
        { authentifie: true },
      );
      if (reponse.succes) {
        setMessage(
          canal === "email"
            ? "Email confirmé !"
            : "Téléphone confirmé !",
        );
        setEtape("termine");
      } else {
        setErreur("Code invalide. Demande un nouveau code.");
      }
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de vérification");
    } finally {
      setChargement(false);
    }
  }

  // ── Compteur de renvoi ──────────────────────────────────────────────────

  function lancerCompteur() {
    setCompteur(60);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCompteur((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Écran terminé ───────────────────────────────────────────────────────

  if (etape === "termine") {
    return (
      <>
        <EnTete />
        <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
          <div className="max-w-md carte text-center apparition">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-green-700">✓</span>
            </div>
            <h1 className="text-2xl mb-2">Identité vérifiée !</h1>
            <p className="text-ardoise-clair mb-6">
              Ton identité est confirmée. Tu peux maintenant utiliser pleinement DigiID.
            </p>
            <Bouton variante="primaire" onClick={() => router.push(utilisateur ? cheminTableauDeBord(utilisateur.role as any) : "/tableau-de-bord")}>
              Accéder à mon espace
            </Bouton>
          </div>
        </main>
      </>
    );
  }

  // ── Rendu principal ─────────────────────────────────────────────────────

  return (
    <>
      <EnTete />
      <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
        <div className="max-w-lg w-full carte apparition">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Logo taille="moyen" />
            </div>
            <h1 className="text-2xl mb-1">Vérifie ton identité</h1>
            <p className="text-sm text-ardoise-clair">
              Choisis le moyen que tu préfères pour recevoir ton code de vérification.
              {etape === "choix" && " Un seul suffit — pas les deux."}
            </p>
          </div>

          {erreur && (
            <Alerte variante="erreur" className="mb-4">
              {erreur}
            </Alerte>
          )}
          {message && (
            <Alerte variante="info" className="mb-4">
              {message}
            </Alerte>
          )}

          {/* ── Écran de choix du canal ─────────────────────────────── */}
          {etape === "choix" && (
            <div className="space-y-3">
              <p className="text-xs uppercase text-ardoise-clair font-semibold tracking-wider">
                Choisis ton moyen de vérification
              </p>

              {OPTIONS_CANAUX.map((opt) => {
                // Désactiver SMS et appel si pas de téléphone
                const desactive =
                  (opt.canal === "sms" || opt.canal === "appel") && !aTelephone;
                return (
                  <button
                    key={opt.canal}
                    type="button"
                    disabled={desactive}
                    onClick={() => {
                      setCanal(opt.canal);
                      setCode("");
                      setMessage(null);
                      setErreur(null);
                      setCodeVisible(null);
                      envoyerCode();
                    }}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                      desactive
                        ? "border-ardoise-clair/10 bg-ardoise-clair/5 text-ardoise-clair/50 cursor-not-allowed"
                        : "border-ardoise-clair/20 hover:border-lagune hover:bg-lagune/5 cursor-pointer"
                    }`}
                  >
                    <span className="text-3xl flex-shrink-0">{opt.icone}</span>
                    <div>
                      <p
                        className={`font-semibold ${
                          desactive ? "text-ardoise-clair/50" : "text-ardoise"
                        }`}
                      >
                        {opt.titre}
                      </p>
                      <p
                        className={`text-sm ${
                          desactive
                            ? "text-ardoise-clair/40"
                            : "text-ardoise-clair"
                        }`}
                      >
                        {desactive
                          ? "Aucun numéro de téléphone enregistré"
                          : opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}

              <div className="text-center pt-4">
                <button
                  type="button"
                  onClick={() => router.push(utilisateur ? cheminTableauDeBord(utilisateur.role as any) : "/tableau-de-bord")}
                  className="text-sm text-ardoise-clair hover:text-ardoise underline"
                >
                  Passer pour l&apos;instant
                </button>
              </div>
            </div>
          )}

          {/* ── Écran de saisie du code ────────────────────────────── */}
          {etape === "code" && (
            <div className="space-y-4">
              <p className="text-ardoise font-medium">
                Entre le code reçu
              </p>
              <p className="text-sm text-ardoise-clair">
                {canal === "email"
                  ? `Un code a été envoyé à ${destinationMasquee || "ton email"}.`
                  : canal === "sms"
                    ? `Un code a été envoyé par SMS au ${destinationMasquee || "téléphone"}.`
                    : "Tu vas recevoir un appel avec le code dicté."}
              </p>

              {/* Code visible en mode développement */}
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
                libelle="Code de vérification"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                autoComplete="one-time-code"
                aide="Code à 6 chiffres"
              />

              <Bouton
                variante="primaire"
                className="w-full"
                chargement={chargement}
                onClick={verifierCode}
                disabled={code.length !== 6 || chargement}
              >
                Confirmer
              </Bouton>

              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setEtape("choix")}
                  className="text-sm text-ardoise-clair hover:text-ardoise underline"
                >
                  Changer de moyen
                </button>

                {compteur > 0 ? (
                  <span className="text-xs text-ardoise-clair">
                    Renvoyer dans {compteur}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={envoyerCode}
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
