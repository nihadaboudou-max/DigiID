"use client";

/**
 * Page Partage — génération d'un QR code visuel et partage par lien.
 * Phase 5b : QR factice (grille) + copie du DigiID.
 * Phase 2  : vrai QR code via une lib (qrcode.react ou via API backend).
 */
import { useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { IconeCopier, IconeCheck } from "@/composants/commun/Icones";
import { useAuthentification } from "@/contextes/authentification";

export default function PagePartage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [copie, setCopie] = useState(false);

  if (!utilisateur || !utilisateur.digiid_public) return null;
  const digiId = utilisateur.digiid_public;

  async function copier() {
    await navigator.clipboard.writeText(digiId);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Partager mon DigiID
        </p>
        <h1 className="mt-1">Mon identifiant numérique</h1>
        <p className="text-ardoise-clair mt-2">
          Présente ce code à une banque, à un hôpital, ou à toute institution
          qui demande à vérifier ton identité.
        </p>
      </header>

      {/* QR code + identifiant */}
      <div className="grid md:grid-cols-2 gap-6">
        <Carte className="flex flex-col items-center text-center">
          <p className="text-xs uppercase text-ocre font-bold mb-4 tracking-wider">
            Code à scanner
          </p>
          <FauxQrCode contenu={digiId} />
          <p className="text-xs text-ardoise-clair italic mt-4">
            La banque scanne ce code, interroge notre API et reçoit ton score et tes facteurs.
          </p>
        </Carte>

        <Carte>
          <p className="text-xs uppercase text-ocre font-bold mb-3 tracking-wider">
            Mon identifiant
          </p>
          <p className="text-2xl font-mono font-bold text-lagune break-all mb-6">
            {digiId}
          </p>

          <Bouton variante="secondaire" onClick={copier} className="w-full mb-3">
            {copie ? (
              <>
                <IconeCheck className="w-4 h-4" />
                Copié !
              </>
            ) : (
              <>
                <IconeCopier className="w-4 h-4" />
                Copier mon DigiID
              </>
            )}
          </Bouton>

          <Bouton variante="ghost" disabled className="w-full mb-3">
            Envoyer par SMS
          </Bouton>
          <Bouton variante="ghost" disabled className="w-full">
            Télécharger en PDF
          </Bouton>

          <p className="text-xs text-ardoise-clair italic mt-4">
            Les options d'envoi SMS et PDF arrivent en Phase 2.
          </p>
        </Carte>
      </div>

      {/* Conseils sécurité */}
      <Alerte variante="avertissement" titre="Conseils de sécurité">
        Ne partage ton DigiID qu'avec des institutions de confiance. Si quelqu'un te demande
        ton code par téléphone sans raison claire, c'est probablement une tentative de fraude.
        DigiID ne te contactera jamais pour te demander ton code.
      </Alerte>

      {/* Qui peut utiliser mon DigiID */}
      <Carte titre="Qui peut interroger mon DigiID ?">
        <div className="grid sm:grid-cols-3 gap-4">
          <BlocUsage titre="Banques" detail="Pour vérifier ton identité avant ouverture de compte ou demande de crédit." statut="actif" />
          <BlocUsage titre="Hôpitaux" detail="Pour accéder à ton dossier médical aux urgences." statut="phase-3" />
          <BlocUsage titre="Administration" detail="Pour recevoir des aides ou voter électroniquement." statut="phase-4" />
        </div>
      </Carte>
    </div>
  );
}

function BlocUsage({ titre, detail, statut }: {
  titre: string; detail: string; statut: "actif" | "phase-3" | "phase-4";
}) {
  return (
    <div className="bg-sable-clair rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-lagune">{titre}</h4>
        {statut === "actif" ? (
          <Badge variante="succes">Actif</Badge>
        ) : (
          <Badge variante="ocre">{statut === "phase-3" ? "Phase 3" : "Phase 4"}</Badge>
        )}
      </div>
      <p className="text-xs text-ardoise-clair">{detail}</p>
    </div>
  );
}

/**
 * Faux QR code visuel généré à partir d'une chaîne.
 * En Phase 2 on remplace par un vrai QR via une lib.
 */
function FauxQrCode({ contenu }: { contenu: string }) {
  // Génère une grille pseudo-aléatoire stable à partir du contenu
  const taille = 21;
  const cellules: boolean[][] = [];

  // Hash simple de la chaîne pour réutiliser comme graine
  let graine = 0;
  for (let i = 0; i < contenu.length; i++) graine = (graine * 31 + contenu.charCodeAt(i)) >>> 0;

  function rng() {
    graine = (graine * 1664525 + 1013904223) >>> 0;
    return graine / 4294967296;
  }

  for (let i = 0; i < taille; i++) {
    const ligne: boolean[] = [];
    for (let j = 0; j < taille; j++) {
      // Coins de positionnement (3 carrés 7x7 dans les angles)
      const coin =
        (i < 7 && j < 7) ||
        (i < 7 && j >= taille - 7) ||
        (i >= taille - 7 && j < 7);
      if (coin) {
        const dans = (k: number) => k === 0 || k === 6;
        const ii = i < 7 ? i : i - (taille - 7);
        const jj = j < 7 ? j : j - (taille - 7);
        if (dans(ii) || dans(jj)) ligne.push(true);
        else if (ii >= 2 && ii <= 4 && jj >= 2 && jj <= 4) ligne.push(true);
        else ligne.push(false);
      } else {
        ligne.push(rng() > 0.5);
      }
    }
    cellules.push(ligne);
  }

  return (
    <div className="bg-white p-4 border-2 border-ardoise/10 rounded-2xl shadow-sm">
      <div
        className="grid gap-0 mx-auto"
        style={{
          gridTemplateColumns: `repeat(${taille}, 1fr)`,
          width: "240px",
          height: "240px",
        }}
      >
        {cellules.map((ligne, i) =>
          ligne.map((c, j) => (
            <div
              key={`${i}-${j}`}
              className={c ? "bg-ardoise" : "bg-white"}
            />
          ))
        )}
      </div>
      <p className="text-center text-xs text-ardoise-clair italic mt-3">
        QR de démonstration · vrai QR généré en Phase 2
      </p>
    </div>
  );
}
