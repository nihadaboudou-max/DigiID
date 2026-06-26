"use client";

/**
 * Page de scan QR — Saisie manuelle d'un DigiID pour consultation rapide.
 * Le scan proprement dit (caméra) nécessiterait une lib comme `html5-qrcode`.
 * Ici, on propose la saisie du DigiID + redirection vers le profil.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { scannerQR } from "@/services/police";
import type { ScanQRResultat } from "@/services/police";

export default function PageScanQR() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter();
  const [digiid, setDigiid] = useState("");
  const [resultat, setResultat] = useState<ScanQRResultat | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleScan() {
    if (!digiid.trim()) {
      setErreur("Veuillez saisir un DigiID.");
      return;
    }

    setChargement(true);
    setErreur("");
    setResultat(null);

    try {
      const data = await scannerQR(digiid.trim().toUpperCase());
      setResultat(data);
    } catch {
      setErreur("DigiID introuvable ou invalide.");
    } finally {
      setChargement(false);
    }
  }

  function voirProfilComplet() {
    router.push(`/police/profil/${digiid.trim().toUpperCase()}`);
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Scan QR</span>
      </nav>

      <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>
      <h1>Scan QR citoyen</h1>
      <p className="text-ardoise-clair max-w-2xl">
        Scanne le QR code d'un citoyen pour accéder rapidement à ses informations.
        Tu peux aussi saisir manuellement un DigiID.
      </p>

      {/* Saisie manuelle */}
      <Carte titre="Saisie du DigiID">
        <div className="flex gap-2">
          <ChampSaisie
            libelle="DigiID"
            placeholder="ex: AB12CD34EF56GH78"
            value={digiid}
            onChange={(e) => setDigiid(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") handleScan(); }}
            className="font-mono uppercase"
            maxLength={16}
          />
          <div className="flex items-end">
            <Bouton variante="primaire" chargement={chargement} disabled={!digiid || chargement} onClick={handleScan}>
              🔍 Scanner
            </Bouton>
          </div>
        </div>
        {erreur && (
          <p className="text-sm text-terre mt-2">{erreur}</p>
        )}
        <p className="text-xs text-ardoise-clair mt-2">
          Le DigiID fait 16 caractères (lettres et chiffres). Ex: AB12CD34EF56GH78
        </p>
      </Carte>

      {/* Résultat du scan */}
      {resultat && (
        <Carte titre="Résultat">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-20 h-20 rounded-full bg-lagune/10 flex items-center justify-center text-lagune text-3xl font-bold flex-shrink-0">
              {resultat.nom ? resultat.nom.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-ardoise">{resultat.nom || "Inconnu"}</h2>
                <BadgeCompat est_actif={resultat.est_actif} est_verifie={resultat.est_verifie} />
              </div>
              <p className="text-sm text-ardoise-clair font-mono">{resultat.digiid}</p>
              {resultat.email && <p className="text-sm text-ardoise-clair mt-1">✉️ {resultat.email}</p>}
            </div>
          </div>

          {resultat.documents && resultat.documents.length > 0 && (
            <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
              <p className="text-sm font-semibold text-ardoise mb-2">Documents associés :</p>
              <div className="flex flex-wrap gap-2">
                {resultat.documents.map((doc: any, i: number) => (
                  <span key={i} className="text-xs px-3 py-1.5 bg-sable rounded-full text-ardoise-clair">
                    {doc.type || "Document"} {doc.est_valide ? "✅" : "❌"}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Bouton variante="primaire" onClick={voirProfilComplet}>
              Voir le profil complet →
            </Bouton>
            <Bouton variante="ghost" onClick={() => { setResultat(null); setDigiid(""); }}>
              Nouveau scan
            </Bouton>
          </div>
        </Carte>
      )}

      <Link href="/police/dashboard">
        <Bouton variante="ghost">← Retour au dashboard</Bouton>
      </Link>
    </div>
  );
}

function BadgeCompat({ est_actif, est_verifie }: { est_actif: boolean; est_verifie: boolean }) {
  if (!est_actif) return <span className="text-xs px-2 py-0.5 bg-terre/10 text-terre rounded-full">Inactif</span>;
  if (!est_verifie) return <span className="text-xs px-2 py-0.5 bg-ocre/10 text-ocre rounded-full">Non vérifié</span>;
  return <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Vérifié</span>;
}
