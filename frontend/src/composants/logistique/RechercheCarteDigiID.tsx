"use client";

/**
 * RechercheCarteDigiID — « le client présente sa carte, la fiche se remplit ».
 *
 * Point clé du plan : au guichet, l'agent n'a plus à ressaisir le nom et le
 * téléphone du client. Il saisit (ou colle) le **DigiID public** / l'**URL du
 * QR** de la carte, et le formulaire est pré-rempli avec des données exactes —
 * ce qui garantit que les SMS de suivi partiront vers le bon numéro.
 *
 * Le composant est volontairement autonome : il ne connaît ni colis ni passager,
 * il se contente de remonter le contact trouvé via `surSelection`.
 */
import { useEffect, useRef, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeIdentite } from "@/composants/commun/Icones";
import {
  chercherContactParCarte,
  type ContactDigiID,
} from "@/services/identite_api";

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
  description = "Saisissez le DigiID public de sa carte, ou collez le lien du QR scanné : la fiche se pré-remplit automatiquement.",
  rechercheInitiale,
}: ProprietesRechercheCarte) {
  const [valeur, setValeur] = useState(rechercheInitiale ?? "");
  const [chargement, setChargement] = useState(false);
  const [contact, setContact] = useState<ContactDigiID | null>(null);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);
  // Évite une double recherche (React 18 StrictMode monte deux fois en dev).
  const dejaCherche = useRef(false);

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
              {contact.correspondance === "qr" ? "QR scanné" : "DigiID"}
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
