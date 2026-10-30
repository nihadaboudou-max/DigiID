"use client";

import { useEffect, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ErreurAPI } from "@/services/client_api";
import {
  modeCommercantAPI,
  type StatutModeCommercant,
} from "@/services/authentification";
import { useAuthentification } from "@/contextes/authentification";

export default function PageActivationCommercant() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "commercant"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { rafraichirProfil } = useAuthentification();
  const [statut, setStatut] = useState<StatutModeCommercant | null>(null);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [messageAide, setMessageAide] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    void modeCommercantAPI
      .statut()
      .then((reponse) => {
        if (!annule) setStatut(reponse);
      })
      .catch((cause: unknown) => {
        if (!annule) {
          setErreur(
            cause instanceof ErreurAPI
              ? cause.message_utilisateur
              : "Impossible de vérifier vos justificatifs.",
          );
        }
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  async function activer() {
    setEnvoi(true);
    setErreur(null);
    setMessage(null);
    try {
      await modeCommercantAPI.activer();
      await rafraichirProfil();
      setStatut((courant) =>
        courant ? { ...courant, mode_actif: true, peut_activer: true } : courant,
      );
      setMessage("Mode commerçant activé. Votre compte citoyen reste inchangé.");
    } catch (cause) {
      setErreur(
        cause instanceof ErreurAPI
          ? cause.message_utilisateur
          : "L'activation n'a pas abouti. Réessayez.",
      );
    } finally {
      setEnvoi(false);
    }
  }

  async function demanderAide() {
    setEnvoi(true);
    setErreur(null);
    setMessage(null);
    try {
      const reponse = await modeCommercantAPI.demanderAssistance(messageAide);
      setMessage(reponse.message);
      setMessageAide("");
    } catch (cause) {
      setErreur(
        cause instanceof ErreurAPI
          ? cause.message_utilisateur
          : "Votre demande n'a pas pu être envoyée.",
      );
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ardoise">
          Activer le mode commerçant
        </h1>
        <p className="mt-1 text-sm text-ardoise-clair">
          Le mode commerçant ajoute les dépôts et leur suivi à votre compte
          citoyen. Il ne donne pas accès à une cagnotte.
        </p>
      </header>

      {erreur && <Alerte variante="erreur" titre="Action impossible">{erreur}</Alerte>}
      {message && <Alerte variante="succes" titre="Information">{message}</Alerte>}

      <Carte titre="Justificatifs requis">
        {chargement ? (
          <p className="text-sm text-ardoise-clair">Vérification en cours…</p>
        ) : statut ? (
          <div className="space-y-3">
            <p className="text-sm">
              Document d’identité approuvé :{" "}
              <strong>{statut.document_valide ? "oui" : "non"}</strong>
            </p>
            <p className="text-sm">
              Photo vérifiée :{" "}
              <strong>{statut.photo_validee ? "oui" : "non"}</strong>
            </p>
            {statut.mode_actif ? (
              <Alerte variante="succes" titre="Mode déjà activé">
                Vos accès commerçant sont disponibles dans le menu, sans
                désactiver votre espace citoyen.
              </Alerte>
            ) : (
              <>
                {!statut.document_valide && (
                  <a
                    className="block text-sm font-medium text-lagune underline"
                    href="/inspection"
                  >
                    Ajouter ou faire vérifier une pièce d’identité
                  </a>
                )}
                {!statut.photo_validee && (
                  <a
                    className="block text-sm font-medium text-lagune underline"
                    href="/identite/verification-visuelle"
                  >
                    Ajouter et faire vérifier votre photo
                  </a>
                )}
                <Bouton
                  onClick={() => void activer()}
                  chargement={envoi}
                  disabled={!statut.peut_activer}
                >
                  Activer le mode commerçant
                </Bouton>
              </>
            )}
          </div>
        ) : null}
      </Carte>

      {!statut?.mode_actif && (
        <Carte titre="Besoin d'aide ?">
          <p className="mb-3 text-sm text-ardoise-clair">
            Décrivez le problème rencontré. Votre demande sera transmise au
            super-administrateur.
          </p>
          <textarea
            value={messageAide}
            onChange={(event) => setMessageAide(event.target.value)}
            rows={4}
            maxLength={1000}
            className="w-full rounded-lg border border-ardoise/20 p-3 text-sm"
            placeholder="Expliquez votre difficulté (10 caractères minimum)…"
          />
          <Bouton
            variante="secondaire"
            className="mt-3"
            onClick={() => void demanderAide()}
            chargement={envoi}
            disabled={messageAide.trim().length < 10}
          >
            Demander l'aide du super-administrateur
          </Bouton>
        </Carte>
      )}
    </div>
  );
}
