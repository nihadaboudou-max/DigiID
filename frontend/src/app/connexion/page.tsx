"use client";
/**
 * Page de connexion.
 * Appelle l'API backend /api/v1/auth/connexion et stocke les jetons.
 * Redirige vers l'interface appropriée selon le rôle.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { EnTete } from "@/composants/layouts/EnTete";
import { Logo } from "@/composants/commun/Logo";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import { envoyerCodeConnexion } from "@/services/authentification";

// ✅ NOUVEAU : Mapping des redirections par rôle
const REDIRECTIONS_PAR_ROLE: Record<string, string> = {
  "super_administrateur": "/super-admin/tableau-de-bord",
  "administrateur": "/admin/tableau-de-bord",
  "admin_domaine": "/admin-domaine/tableau-de-bord",
  "chef_ong": "/chef-ong",
  "chef_police": "/chef-police",
  "chef_medical": "/chef-medical",
  "chef_agent": "/chef-enrolement",
  // Anciens noms (rétrocompatibilité)
  "agent": "/tableau-de-bord",
  "medecin": "/medecin/dashboard",
  "police": "/police/dashboard",
  "ong": "/ong/dashboard",
  "citoyen": "/tableau-de-bord",
  // Nouveaux noms
  "agent_medical": "/medecin/dashboard",
  "agent_police": "/police/dashboard",
  "agent_ong": "/ong/dashboard",
  "agent_terrain": "/agent/dashboard",
};

// Code d'erreur : l'email du compte n'est pas encore confirmé (première connexion)
const CODE_EMAIL_NON_VERIFIE = "AUTH_003";
// Code d'erreur : double authentification requise
const CODE_2FA_REQUIS = "AUTH_004";
// Délai minimum avant de renvoyer un code (secondes) — aligné sur le backend (30 s)
const DELAI_RENVOI_CODE_SECONDES = 30;

type EtapeConnexion = "identifiants" | "verification_email" | "2fa";

export default function PageConnexion() {
  return (
    <Suspense fallback={null}>
      <ContenuConnexion />
    </Suspense>
  );
}

function ContenuConnexion() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { seConnecter, utilisateur } = useAuthentification();

  // Page à retrouver après connexion (ex: /police/scan-qr?token=...)
  // — uniquement des chemins internes (pas de redirection ouverte vers l'extérieur).
  const retour = searchParams.get("retour");
  const retourValide =
    !!retour &&
    retour.startsWith("/") &&
    !retour.startsWith("//") &&
    !retour.toLowerCase().startsWith("http");

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");
  const [etape, setEtape] = useState<EtapeConnexion>("identifiants");
  const [methode2fa, setMethode2fa] = useState<"totp" | "email">("totp");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [destinationMasquee, setDestinationMasquee] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [compteARebours, setCompteARebours] = useState(0);

  // ✅ CORRECTION : Redirection automatique après connexion réussie
  useEffect(() => {
    if (utilisateur) {
      // 1. Si l'utilisateur venait d'une page protégée (ex: scan QR),
      //    on l'y ramène automatiquement.
      if (retourValide && retour) {
        router.push(retour);
        return;
      }
      // 2. Sinon, redirection classique selon le rôle
      const pageRedirection = REDIRECTIONS_PAR_ROLE[utilisateur.role] || "/tableau-de-bord";
      router.push(pageRedirection);
    }
  }, [utilisateur, router, retour, retourValide]);

  // ⏱️ Compte à rebours avant de pouvoir renvoyer un code
  useEffect(() => {
    if (compteARebours <= 0) return;
    const id = setInterval(() => {
      setCompteARebours((valeur) => (valeur > 0 ? valeur - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [compteARebours]);

  async function gererSoumission(evt: React.FormEvent) {
    evt.preventDefault();
    setErreur(null);
    setChargement(true);

    try {
      await seConnecter({
        email,
        mot_de_passe: motDePasse,
        ...(etape === "2fa" && code ? { code_2fa: code, canal_2fa: methode2fa } : {}),
        ...(etape === "verification_email" && code ? { code_email: code } : {}),
      });
      
      // La redirection se fera via le useEffect ci-dessus
      // quand l'utilisateur sera mis à jour dans le contexte
    } catch (e) {
      if (e instanceof ErreurAPI) {
        // 📧 Email pas encore confirmé (première connexion)
        if (e.code_erreur === CODE_EMAIL_NON_VERIFIE) {
          const details = (e.details ?? {}) as Record<string, unknown>;
          const destination = (details.destination_masquee as string) || null;

          setEtape("verification_email");
          if (destination) {
            // Le code vient d'être (ré)envoyé par email
            setDestinationMasquee(destination);
            setInfo(
              `Un code de vérification a été envoyé à ${destination}. ` +
              "Saisis-le pour confirmer ton adresse email et finaliser ta connexion.",
            );
            if (details.code_dev) {
              setCode(String(details.code_dev));
            } else {
              setCompteARebours(DELAI_RENVOI_CODE_SECONDES);
            }
          } else {
            // Code incorrect / expiré → on reste sur l'étape avec le message d'erreur
            setErreur(e.message_utilisateur);
          }
          setChargement(false);
          return;
        }

        // 🔐 Double authentification requise
        if (e.code_erreur === CODE_2FA_REQUIS) {
          setEtape("2fa");
          setMethode2fa("totp");
          setCode("");
          setInfo("🔐 Un code supplémentaire est requis pour sécuriser ta connexion.");
          setChargement(false);
          return;
        }

        setErreur(e.message_utilisateur);
      } else {
        setErreur("Erreur inattendue. Réessaie dans un instant.");
      }
      setChargement(false);
    }
  }

  /** 📧 Renvoie le code de vérification d'email (première connexion). */
  async function renvoyerCodeEmail() {
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      // Le backend renvoie le code et relève AUTH_003 avec la destination
      await seConnecter({ email, mot_de_passe: motDePasse });
    } catch (e) {
      if (e instanceof ErreurAPI && e.code_erreur === CODE_EMAIL_NON_VERIFIE) {
        const details = (e.details ?? {}) as Record<string, unknown>;
        const destination = (details.destination_masquee as string) || null;
        if (destination) {
          setDestinationMasquee(destination);
          setInfo(`Un nouveau code de vérification a été envoyé à ${destination}.`);
          if (details.code_dev) {
            setCode(String(details.code_dev));
          } else {
            setCompteARebours(DELAI_RENVOI_CODE_SECONDES);
          }
        } else {
          setErreur(e.message_utilisateur);
        }
      } else if (e instanceof ErreurAPI) {
        setErreur(e.message_utilisateur);
      } else {
        setErreur("Erreur inattendue. Réessaie dans un instant.");
      }
    } finally {
      setEnvoiEnCours(false);
    }
  }

  /** 📧 Envoie un code 2FA de connexion par email (méthode « email »). */
  async function envoyerCodeParEmail2fa() {
    setErreur(null);
    setEnvoiEnCours(true);
    try {
      const reponse = await envoyerCodeConnexion(email, motDePasse);
      setDestinationMasquee(reponse.destination_masquee);
      setInfo(`Un code de connexion a été envoyé à ${reponse.destination_masquee}.`);
      if (reponse.code_dev) {
        setCode(String(reponse.code_dev));
      } else {
        setCompteARebours(DELAI_RENVOI_CODE_SECONDES);
      }
    } catch (e) {
      if (e instanceof ErreurAPI) {
        setErreur(e.message_utilisateur);
      } else {
        setErreur("Erreur inattendue. Réessaie dans un instant.");
      }
    } finally {
      setEnvoiEnCours(false);
    }
  }

  /** Retour à la saisie des identifiants. */
  function revenirAuxIdentifiants() {
    setEtape("identifiants");
    setCode("");
    setInfo(null);
    setErreur(null);
    setDestinationMasquee(null);
    setCompteARebours(0);
    setMethode2fa("totp");
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
              {etape === "identifiants" && "Connexion à ton espace"}
              {etape === "verification_email" && "Vérifie ton adresse email"}
              {etape === "2fa" && "Vérification 2FA"}
            </h1>
            <p className="text-sm text-ardoise-clair">
              {etape === "identifiants" && "Retrouve ton DigiID et ton score."}
              {etape === "verification_email" &&
                "Première connexion : confirme ton email avec le code reçu."}
              {etape === "2fa" &&
                "Étape 2 — confirme ton identité avec un code supplémentaire."}
            </p>
          </div>

          {info && (
            <div className="bg-lagune/10 border-l-4 border-lagune p-4 mb-5 rounded">
              <p className="text-sm text-lagune font-medium">{info}</p>
            </div>
          )}

          {erreur && (
            <div className="bg-terre/10 border-l-4 border-terre p-4 mb-5 rounded">
              <p className="text-sm text-terre font-medium">{erreur}</p>
            </div>
          )}

          <form onSubmit={gererSoumission} className="space-y-4">
            {/* Étape 1 : identifiants */}
            {etape === "identifiants" && (
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
            )}

            {/* Étape 2 : vérification de l'email (première connexion) */}
            {etape === "verification_email" && (
              <div className="space-y-4">
                <div className="bg-sable rounded-lg p-3 text-sm text-ardoise-clair">
                  <span className="font-medium text-ardoise">Email :</span> {email}
                </div>
                <ChampSaisie
                  libelle="Code de vérification"
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={envoiEnCours || compteARebours > 0}
                  onClick={renvoyerCodeEmail}
                  className="w-full text-center text-sm text-lagune hover:underline disabled:text-ardoise-clair/40 disabled:cursor-not-allowed transition-colors"
                >
                  {compteARebours > 0
                    ? `Renvoyer le code dans ${compteARebours} s`
                    : envoiEnCours
                      ? "Envoi en cours…"
                      : "Renvoyer le code"}
                </button>
              </div>
            )}

            {/* Étape 3 : double authentification */}
            {etape === "2fa" && (
              <div className="space-y-4">
                {/* Choix de la méthode 2FA */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethode2fa("totp")}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      methode2fa === "totp"
                        ? "border-lagune bg-lagune/10 text-lagune"
                        : "border-ardoise-clair/20 text-ardoise-clair hover:border-lagune/40"
                    }`}
                  >
                    📱 Application
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethode2fa("email")}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      methode2fa === "email"
                        ? "border-lagune bg-lagune/10 text-lagune"
                        : "border-ardoise-clair/20 text-ardoise-clair hover:border-lagune/40"
                    }`}
                  >
                    📧 Code par email
                  </button>
                </div>

                {methode2fa === "email" && (
                  <div className="space-y-2">
                    <Bouton
                      type="button"
                      variante="secondaire"
                      chargement={envoiEnCours}
                      disabled={compteARebours > 0}
                      onClick={envoyerCodeParEmail2fa}
                      className="w-full"
                    >
                      {compteARebours > 0
                        ? `Recevoir le code dans ${compteARebours} s`
                        : "Recevoir le code par email"}
                    </Bouton>
                    {destinationMasquee && (
                      <p className="text-xs text-ardoise-clair text-center">
                        Code envoyé à{" "}
                        <span className="font-medium text-ardoise">{destinationMasquee}</span>
                      </p>
                    )}
                  </div>
                )}

                <ChampSaisie
                  libelle={methode2fa === "email" ? "Code reçu par email" : "Code 2FA"}
                  type="text"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
            )}

            <Bouton
              type="submit"
              variante="primaire"
              chargement={chargement}
              className="w-full mt-2"
            >
              {etape === "identifiants" ? "Se connecter" : "Valider le code"}
            </Bouton>

            {etape !== "identifiants" && (
              <button
                type="button"
                onClick={revenirAuxIdentifiants}
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