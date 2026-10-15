"use client";

/**
 * RechercheCarteDigiID — « le client présente son code, la fiche se remplit ».
 *
 * Deux entrées, dans cet ordre :
 *
 *  1. **Scan du QR dynamique** (bouton principal) : le citoyen affiche son code
 *     de 30 secondes, à **usage unique** — impossible à rejouer si un tiers
 *     photographie l'écran. C'est le chemin à la fois le plus rapide et le plus
 *     sûr : plus de nom ni de numéro ressaisis (donc SMS de suivi corrects).
 *  2. **Saisie du code** (DigiID public, ou lien collé) : toujours disponible —
 *     client sans écran, caméra refusée, code abîmé. Le code est bon, mais il
 *     prend du temps : c'est l'option de repli.
 *
 * Le composant reste volontairement autonome : il ne connaît ni colis ni
 * passager, il remonte le contact trouvé via `surSelection`.
 */
import { useEffect, useId, useRef, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeIdentite } from "@/composants/commun/Icones";
import {
  chercherContactParCarte,
  type ContactDigiID,
} from "@/services/identite_api";
import { LecteurQRCode } from "./LecteurQRCode";

/** Libellé lisible de l'origine du code présenté au guichet. */
const LIBELLES_ORIGINE: Record<string, string> = {
  digiid: "DigiID saisi",
  qr: "QR de la carte",
  qr_dynamique: "QR dynamique (30 s)",
};

interface ProprietesRechercheCarte {
  /** Appelé quand un contact est trouvé (ou `null` quand on repart de zéro). */
  surSelection: (contact: ContactDigiID | null) => void;
  /** Libellé du champ (adapter au contexte : expéditeur, destinataire…). */
  libelle?: string;
  titre?: string;
  description?: string;
  /**
   * DigiID / lien de QR à rechercher automatiquement au montage.
   *
   * Utilisé quand l'agent arrive depuis la page `/guichet/carte` (scan de la
   * carte du client) : le formulaire s'ouvre déjà pré-rempli.
   */
  rechercheInitiale?: string;
}

export function RechercheCarteDigiID({
  surSelection,
  libelle = "Carte DigiID du client",
  titre = "Client avec un compte DigiID ?",
  description = "Scannez le QR affiché par le client (code dynamique de 30 secondes, à usage unique) — ou saisissez son DigiID public : la fiche se pré-remplit automatiquement.",
  rechercheInitiale,
}: ProprietesRechercheCarte) {
  const [valeur, setValeur] = useState(rechercheInitiale ?? "");
  const [chargement, setChargement] = useState(false);
  const [contact, setContact] = useState<ContactDigiID | null>(null);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);
  // Évite une double recherche (React 18 StrictMode monte deux fois en dev).
  const dejaCherche = useRef(false);
  // Identifiant DOM unique : plusieurs lecteurs peuvent cohabiter sur un même
  // écran (expéditeur ET destinataire d'un même colis).
  const idLecteur = `qr-client-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  async function rechercher(depuisValeur?: string) {
    const requete = (depuisValeur ?? valeur).trim();
    if (!requete) {
      setMessageErreur("Saisissez un DigiID ou collez le lien du QR.");
      return;
    }
    setChargement(true);
    setMessageErreur(null);
    // `chercherContactParCarte` renvoie null (sans lever) si aucune carte ne
    // correspond : le guichet continue alors en saisie manuelle.
    const trouve = await chercherContactParCarte(requete);
    setChargement(false);
    setContact(trouve);
    surSelection(trouve);
    if (!trouve) {
      setMessageErreur(
        "Aucune carte DigiID pour ce code. Vérifiez la saisie ou continuez en saisie manuelle.",
      );
    }
  }

  useEffect(() => {
    if (!rechercheInitiale || dejaCherche.current) return;
    dejaCherche.current = true;
    setValeur(rechercheInitiale);
    void rechercher(rechercheInitiale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rechercheInitiale]);

  function effacer() {
    setValeur("");
    setContact(null);
    setMessageErreur(null);
    surSelection(null);
  }

  return (
    <div className="rounded-xl border border-lagune/20 bg-lagune/5 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <IconeIdentite className="h-5 w-5 text-lagune shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-ardoise">{titre}</p>
          <p className="text-xs text-ardoise-clair">{description}</p>
        </div>
      </div>

            {/* Scan d'abord : c'est le geste rapide. Le code dynamique du citoyen
          (30 s, usage unique) ne peut pas être rejoué par un tiers. */}
      <LecteurQRCode
        id={idLecteur}
        libelleBouton="Scanner le QR du client"
        messageIndisponible="Caméra indisponible ou accès refusé. Saisissez le code à la main ci-dessous."
        surDecode={(texte) => {
          setValeur(texte);
          void rechercher(texte);
        }}
      />

      <p className="text-xs italic text-ardoise-clair">
        Sans scan possible ? Le code reste accepté, mais il est plus lent à saisir.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1">
          <ChampSaisie
            libelle={libelle}
            value={valeur}
            placeholder="Ex. A1B2C3D4E5F6 ou https://…/identite/carte?token=…"
            onChange={(e) => setValeur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void rechercher();
              }
            }}
          />
        </div>
        <div className="flex gap-2">
          <Bouton
            type="button"
            variante="primaire"
            disabled={chargement}
            onClick={() => void rechercher()}
          >
            {chargement ? "Recherche…" : "Pré-remplir"}
          </Bouton>
          {(contact || valeur) && (
            <Bouton type="button" variante="ghost" onClick={effacer}>
              Effacer
            </Bouton>
          )}
        </div>
      </div>

      {messageErreur && (
        <Alerte variante="avertissement" titre="Carte non reconnue">
          {messageErreur}
        </Alerte>
      )}

      {contact && (
        <div className="rounded-lg bg-white p-3 border border-lagune/20 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-ardoise">{contact.nom_complet}</p>
            {contact.digiid_public && (
              <Badge variante="lagune">{contact.digiid_public}</Badge>
            )}
                        <Badge variante="neutre">
              {LIBELLES_ORIGINE[contact.correspondance] ?? contact.correspondance}
            </Badge>
          </div>
          <p className="text-sm text-ardoise-clair">
            {contact.telephone ? `📞 ${contact.telephone}` : "Téléphone non renseigné"}
            {contact.ville ? ` · ${contact.ville}` : ""}
          </p>
          {contact.adresse && (
            <p className="text-xs text-ardoise-clair">{contact.adresse}</p>
          )}
        </div>
      )}
    </div>
  );
}
