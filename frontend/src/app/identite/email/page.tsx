"use client";

/**
 * Page Identité → Vérification Email.
 * Permet de vérifier son adresse email directement depuis le menu Identité.
 */
import { useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import {
  envoyerCodeVerification as envoyerCodeAPI,
  verifierCode as verifierCodeAPI,
} from "@/services/authentification";

export default function PageIdentiteEmail() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
        "citoyen", "agent", "medecin", "police", "ong",
        "administrateur", "super_administrateur",
      ]}
    >
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur, rafraichirProfil } = useAuthentification();
  const [etape, setEtape] = useState<"initial" | "code_envoye" | "verifie">(
    utilisateur?.est_email_verifie ? "verifie" : "initial",
  );
  const [code, setCode] = useState("");
  const [destinationMasquee, setDestinationMasquee] = useState("");
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [compteurRenvoi, setCompteurRenvoi] = useState(0);

  if (!utilisateur) return null;

  async function envoyerCode() {
    setChargement(true);
    setMessage(null);
    setErreur(null);
    try {
      const reponse = await envoyerCodeAPI("email");
      setDestinationMasquee(reponse.destination_masquee);
      setEtape("code_envoye");
      setMessage("Un code de vérification t'a été envoyé par email.");
      setCompteurRenvoi(30);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible d'envoyer le code. Réessaie plus tard.",
      );
    } finally {
      setChargement(false);
    }
  }

  async function renvoyerCode() {
    if (compteurRenvoi > 0) return;
    await envoyerCode();
  }

  async function verifierCodeSaisi(evt: React.FormEvent) {
    evt.preventDefault();
    if (code.length !== 6) {
      setErreur("Le code doit faire 6 chiffres.");
      return;
    }

    setChargement(true);
    setMessage(null);
    setErreur(null);
    try {
      const reponse = await verifierCodeAPI(code, "email");
      if (reponse.succes && reponse.est_email_verifie) {
        setEtape("verifie");
        setMessage("Email vérifié avec succès !");
        await rafraichirProfil();
      }
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Erreur lors de la vérification. Réessaie.",
      );
    } finally {
      setChargement(false);
    }
  }

  // Compte à rebours pour le renvoi
  if (compteurRenvoi > 0) {
    setTimeout(() => setCompteurRenvoi((c) => c - 1), 1000);
  }

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70 mb-2">
        <a href="/identite" className="hover:text-ocre transition-colors">Identité</a>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Vérification email</span>
      </nav>

      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Étape 1 — Identité
        </p>
        <h1 className="mt-1">Vérification de l&apos;email</h1>
        <p className="text-ardoise-clair mt-2">
          Confirme ton adresse email pour sécuriser ton compte et recevoir
          les notifications importantes.
        </p>
      </header>

      {message && <Alerte variante="succes">{message}</Alerte>}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Carte infos email */}
      <Carte>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="mb-1">Adresse email</h3>
            <p className="text-lg font-mono font-bold text-lagune">
              {utilisateur.email}
            </p>
            <Badge
              variante={etape === "verifie" ? "succes" : "neutre"}
              className="mt-2"
            >
              {etape === "verifie"
                ? "Email vérifié ✓"
                : "Non vérifié"}
            </Badge>
          </div>

          {etape === "initial" && (
            <Bouton
              variante="primaire"
              onClick={envoyerCode}
              chargement={chargement}
            >
              Envoyer le code de vérification
            </Bouton>
          )}
        </div>
      </Carte>

      {/* Saisie du code */}
      {etape === "code_envoye" && (
        <>
          <Carte>
            <form onSubmit={verifierCodeSaisi} className="space-y-4">
              <p className="text-sm text-ardoise-clair">
                Un code à 6 chiffres a été envoyé à{" "}
                <span className="font-medium text-ardoise">
                  {destinationMasquee || utilisateur.email}
                </span>
              </p>

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

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={renvoyerCode}
                  className="text-sm text-lagune hover:text-lagune-fonce transition-colors disabled:text-ardoise-clair/50 disabled:cursor-not-allowed"
                  disabled={compteurRenvoi > 0 || chargement}
                >
                  {compteurRenvoi > 0
                    ? `Renvoyer (${compteurRenvoi}s)`
                    : "Renvoyer le code"}
                </button>
                <Bouton
                  type="submit"
                  variante="primaire"
                  chargement={chargement}
                >
                  Vérifier
                </Bouton>
              </div>
            </form>
          </Carte>

          <Carte variante="pointilles" titre="Comment ça marche">
            <ol className="space-y-2 text-sm text-ardoise list-decimal list-inside">
              <li>Clique sur « Envoyer le code de vérification ».</li>
              <li>Un code à 6 chiffres t&apos;est envoyé par email.</li>
              <li>Saisis ce code dans le champ ci-dessus.</li>
              <li>Ton email est vérifié ! Tu gagnes +10 points sur ton score.</li>
            </ol>
          </Carte>
        </>
      )}

      {etape === "verifie" && (
        <Carte variante="pointilles" titre="Comment ça marche">
          <ol className="space-y-2 text-sm text-ardoise list-decimal list-inside">
            <li>Clique sur « Envoyer le code de vérification ».</li>
            <li>Un code à 6 chiffres t&apos;est envoyé par email.</li>
            <li>Saisis ce code dans le champ prévu à cet effet.</li>
            <li>Ton email est vérifié ! Tu gagnes +10 points sur ton score.</li>
          </ol>
        </Carte>
      )}

      {/* Info bonus */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
        <p className="font-semibold mb-1">Bonus de vérification</p>
        <p>La vérification de ton email te rapporte <strong>+10 points</strong> sur ton score DigiID.</p>
      </div>
    </div>
  );
}
