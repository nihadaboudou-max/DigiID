"use client";

/**
 * Flux d'activation / désactivation 2FA (TOTP + QR code).
 * Utilisé sur /parametres et /profil.
 */
import { useState } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Modal } from "@/composants/commun/Modal";
import { useAuthentification } from "@/contextes/authentification";
import { useNotifications } from "@/contextes/notifications";
import { ErreurAPI } from "@/services/client_api";
import {
  activer2FA,
  desactiver2FA,
  preparerActivation2FA,
  type Preparation2FA,
} from "@/services/profil";

interface ProprietesGestion2FA {
  varianteBouton?: "ghost" | "secondaire" | "primaire";
  className?: string;
}

export function Gestion2FA({
  varianteBouton,
  className,
}: ProprietesGestion2FA) {
  const { utilisateur, rafraichirProfil } = useAuthentification();
  const { notifier } = useNotifications();

  const [modalOuvert, setModalOuvert] = useState(false);
  const [mode, setMode] = useState<"activation" | "desactivation">("activation");
  const [preparation, setPreparation] = useState<Preparation2FA | null>(null);
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  if (!utilisateur) return null;

  const deuxFaActive = utilisateur.deux_fa_active;

  function fermerModal() {
    setModalOuvert(false);
    setPreparation(null);
    setCode("");
    setErreur(null);
    setChargement(false);
  }

  async function ouvrirActivation() {
    setMode("activation");
    setErreur(null);
    setCode("");
    setChargement(true);
    setModalOuvert(true);
    try {
      const data = await preparerActivation2FA();
      setPreparation(data);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de préparer la 2FA.",
      );
    } finally {
      setChargement(false);
    }
  }

  function ouvrirDesactivation() {
    setMode("desactivation");
    setPreparation(null);
    setCode("");
    setErreur(null);
    setModalOuvert(true);
  }

  async function confirmer() {
    if (code.length !== 6) {
      setErreur("Le code doit contenir 6 chiffres.");
      return;
    }

    setErreur(null);
    setChargement(true);
    try {
      const reponse =
        mode === "activation"
          ? await activer2FA(code)
          : await desactiver2FA(code);

      await rafraichirProfil();
      notifier(reponse.message, "succes");
      fermerModal();
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Opération impossible. Réessaie.",
      );
    } finally {
      setChargement(false);
    }
  }

  const variante =
    varianteBouton ?? (deuxFaActive ? "ghost" : "secondaire");

  return (
    <>
      <Bouton
        variante={variante}
        className={className}
        onClick={deuxFaActive ? ouvrirDesactivation : ouvrirActivation}
      >
        {deuxFaActive ? "Désactiver la 2FA" : "Activer la 2FA"}
      </Bouton>

      <Modal
        ouvert={modalOuvert}
        surFermeture={fermerModal}
        titre={
          mode === "activation"
            ? "Activer la double authentification"
            : "Désactiver la double authentification"
        }
        description={
          mode === "activation"
            ? "Scanne le QR code avec Google Authenticator, Authy ou équivalent, puis saisis le code généré."
            : "Saisis le code actuel de ton application d'authentification pour confirmer."
        }
        taille="moyen"
      >
        <div className="space-y-5">
          {mode === "activation" && preparation && (
            <>
              <div className="flex flex-col items-center gap-3">
                <img
                  src={`data:image/png;base64,${preparation.qr_code_base64}`}
                  alt="QR code pour configurer la 2FA"
                  className="w-48 h-48 border border-ardoise-clair/20 rounded-lg"
                />
                <p className="text-xs text-ardoise-clair text-center">
                  Impossible de scanner ? Saisis cette clé manuellement :
                </p>
                <code className="text-sm font-mono bg-sable-clair px-3 py-2 rounded break-all text-center">
                  {preparation.secret_manuel}
                </code>
              </div>
            </>
          )}

          <ChampSaisie
            libelle="Code à 6 chiffres"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
            autoComplete="one-time-code"
            erreur={erreur ?? undefined}
          />

          <div className="flex gap-3 justify-end pt-2">
            <Bouton variante="ghost" onClick={fermerModal} disabled={chargement}>
              Annuler
            </Bouton>
            <Bouton
              variante="primaire"
              chargement={chargement}
              onClick={confirmer}
              disabled={mode === "activation" && !preparation}
            >
              {mode === "activation" ? "Activer" : "Désactiver"}
            </Bouton>
          </div>
        </div>
      </Modal>
    </>
  );
}
