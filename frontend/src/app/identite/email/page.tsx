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
import { useAuthentification } from "@/contextes/authentification";
import { clientAPI, ErreurAPI } from "@/services/client_api";

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
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!utilisateur) return null;

  async function envoyerCodeVerification() {
    setChargement(true);
    setMessage(null);
    setErreur(null);
    try {
      await clientAPI.post(
        "/api/v1/verification/envoyer-email",
        {},
        { authentifie: true },
      );
      setMessage("Un code de vérification t'a été envoyé par email.");
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

      <Carte>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="mb-1">Adresse email</h3>
            <p className="text-lg font-mono font-bold text-lagune">
              {utilisateur.email}
            </p>
            <Badge
              variante={utilisateur.est_email_verifie ? "succes" : "neutre"}
              className="mt-2"
            >
              {utilisateur.est_email_verifie
                ? "Email vérifié ✓"
                : "Non vérifié"}
            </Badge>
          </div>

          {!utilisateur.est_email_verifie && (
            <Bouton
              variante="primaire"
              onClick={envoyerCodeVerification}
              chargement={chargement}
            >
              Envoyer le code de vérification
            </Bouton>
          )}
        </div>
      </Carte>

      {!utilisateur.est_email_verifie && (
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
        <p className="font-semibold mb-1">🏆 Bonus de vérification</p>
        <p>La vérification de ton email te rapporte <strong>+10 points</strong> sur ton score DigiID.</p>
      </div>
    </div>
  );
}
