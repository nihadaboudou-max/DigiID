"use client";
/**
 * Carte « Téléphone » du profil — complétion et vérification OTP (S3).
 *
 * Contraintes appliquées :
 *  - format international Bénin **obligatoire** (indicatif +229 fixe) ;
 *  - unicité stricte côté serveur (un numéro = un compte) ;
 *  - le numéro n'est **vérifié** qu'après validation du code OTP/SMS.
 *
 * Design : indicateur de statut coloré + un seul champ, pas de texte explicatif.
 */
import { useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeCheck, IconeIdentite } from "@/composants/commun/Icones";
import { useAuthentification } from "@/contextes/authentification";
import { clientAPI, ErreurAPI } from "@/services/client_api";

const INDICATIF = "+229";

interface ReponseEnvoi {
  succes: boolean;
  telephone: string;
  destination_masquee?: string;
  duree_validite_minutes?: number;
  code_dev?: string;
}

function normaliserLocal(saisie: string): string {
  return saisie.replace(/\D/g, "").slice(-10);
}

export function CarteTelephone() {
  const { utilisateur, rafraichirProfil } = useAuthentification();
  const [edition, setEdition] = useState(false);
  const [local, setLocal] = useState("");
  const [code, setCode] = useState("");
  const [etape, setEtape] = useState<"saisie" | "otp">("saisie");
  const [envoi, setEnvoi] = useState<ReponseEnvoi | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  if (!utilisateur) return null;

  const verifie = utilisateur.est_telephone_verifie === true;
  const renseigne = Boolean(utilisateur.telephone);
  const statut = !renseigne
    ? { libelle: "Absent", couleur: "text-terre", fond: "bg-terre/10" }
    : verifie
      ? { libelle: "Vérifié", couleur: "text-lagune", fond: "bg-lagune/10" }
      : { libelle: "À vérifier", couleur: "text-ambre", fond: "bg-ambre/10" };

  async function envoyerCode() {
    setErreur(null);
    const chiffres = normaliserLocal(local);
    if (chiffres.length < 8) {
      setErreur("Numéro incomplet : 8 chiffres minimum.");
      return;
    }
    setOccupe(true);
    try {
      const reponse = await clientAPI.put<ReponseEnvoi>(
        "/api/v1/utilisateur/telephone",
        { telephone: `${INDICATIF}${chiffres}`, canal: "sms" },
      );
      setEnvoi(reponse);
      setEtape("otp");
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI ? e.message_utilisateur : "Envoi impossible.",
      );
    } finally {
      setOccupe(false);
    }
  }

  async function validerCode() {
    setErreur(null);
    setOccupe(true);
    try {
      await clientAPI.post("/api/v1/auth/verification/verifier", {
        code: code.trim(),
        canal: "sms",
      });
      await rafraichirProfil();
      setEdition(false);
      setEtape("saisie");
      setCode("");
      setLocal("");
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI ? e.message_utilisateur : "Code invalide.",
      );
    } finally {
      setOccupe(false);
    }
  }

  return (
    <Carte>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lagune/10 text-lagune">
            <IconeIdentite className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ardoise">Téléphone</p>
            <p className="font-mono text-sm text-ardoise-clair">
              {utilisateur.telephone || "—"}
            </p>
          </div>
        </div>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${statut.fond} ${statut.couleur}`}
        >
          {verifie && <IconeCheck className="h-3.5 w-3.5" />}
          {statut.libelle}
        </span>
      </div>

      {!edition && (
        <Bouton
          variante="secondaire"
          taille="petit"
          className="mt-4"
          onClick={() => {
            setEdition(true);
            setEtape("saisie");
            setLocal(utilisateur.telephone?.slice(-10) ?? "");
          }}
        >
          {renseigne ? "Modifier" : "Ajouter mon numéro"}
        </Bouton>
      )}

      {edition && etape === "saisie" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-end gap-2">
            <span className="mb-2 rounded-lg bg-ardoise-clair/10 px-3 py-2 font-mono text-sm text-ardoise">
              {INDICATIF}
            </span>
            <ChampSaisie
              libelle="Numéro"
              value={local}
              onChange={(evenement) => setLocal(evenement.target.value)}
              placeholder="01 97 12 34 56"
              inputMode="tel"
              className="flex-1"
            />
          </div>
          <div className="flex gap-2">
            <Bouton
              variante="primaire"
              taille="petit"
              onClick={() => void envoyerCode()}
              disabled={occupe}
              chargement={occupe}
            >
              Recevoir le code
            </Bouton>
            <Bouton
              variante="ghost"
              taille="petit"
              onClick={() => setEdition(false)}
            >
              Annuler
            </Bouton>
          </div>
        </div>
      )}

      {edition && etape === "otp" && (
        <div className="mt-4 space-y-3">
          <ChampSaisie
            libelle={`Code reçu par SMS${envoi?.destination_masquee ? ` (${envoi.destination_masquee})` : ""}`}
            value={code}
            onChange={(evenement) => setCode(evenement.target.value)}
            placeholder="123456"
            inputMode="numeric"
          />
          <div className="flex gap-2">
            <Bouton
              variante="primaire"
              taille="petit"
              onClick={() => void validerCode()}
              disabled={occupe || code.trim().length < 4}
              chargement={occupe}
            >
              Vérifier
            </Bouton>
            <Bouton
              variante="ghost"
              taille="petit"
              onClick={() => setEtape("saisie")}
            >
              Numéro
            </Bouton>
          </div>
          {envoi?.code_dev && (
            <p className="text-xs text-ardoise-clair">
              Code de test : <code>{envoi.code_dev}</code>
            </p>
          )}
        </div>
      )}

      {erreur && (
        <Alerte variante="erreur" titre="Numéro">
          {erreur}
        </Alerte>
      )}
    </Carte>
  );
}
