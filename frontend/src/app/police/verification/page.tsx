"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { useRoleUI } from "@/crochets/useRoleUI";
import { verifierIdentite, rechercherPersonne } from "@/services/police";
import { uploaderCNI } from "@/services/verification_cni";
import type { PersonneRecherchee } from "@/services/police";
import type { ReponseUploadCNI } from "@/services/verification_cni";

export default function VerificationPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [digiid, setDigiid] = useState("");
  const [personne, setPersonne] = useState<PersonneRecherchee | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [enRecherche, setEnRecherche] = useState(false);

  // État scan CNI
  const [fichierCNI, setFichierCNI] = useState<File | null>(null);
  const [previewCNI, setPreviewCNI] = useState<string | null>(null);
  const [scanEnCours, setScanEnCours] = useState(false);
  const [digiidExtrait, setDigiidExtrait] = useState<string | null>(null);
  const inputCNIRef = useRef<HTMLInputElement>(null);

  async function handleRecherche() {
    if (!digiid) return;
    setEnRecherche(true);
    setErreur("");
    setPersonne(null);
    setResultat(null);
    try {
      const p = await rechercherPersonne(digiid);
      if (p) {
        setPersonne(p);
        setResultat("confirme");
        await verifierIdentite({ personne_digiid: digiid, personne_nom: p.nom });
      } else {
        setErreur("Personne non trouvee dans le systeme DigiID");
        setResultat("infirme");
        await verifierIdentite({ personne_digiid: digiid, notes: "Non trouve" });
      }
    } catch {
      setErreur("Erreur lors de la verification");
      setResultat("infirme");
    } finally {
      setEnRecherche(false);
    }
  }

  /** Scan d une CNI — OCR pour extraire le DigiID */
  function handleFichierCNI(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFichierCNI(f);
    setErreur("");
    setDigiidExtrait(null);
    const lecteur = new FileReader();
    lecteur.onload = (ev) => setPreviewCNI(ev.target?.result as string);
    lecteur.readAsDataURL(f);
  }

  async function lancerScanCNI() {
    if (!fichierCNI) return;
    setScanEnCours(true);
    setErreur("");
    try {
      const resultat: ReponseUploadCNI = await uploaderCNI(fichierCNI, "recto");
      const d = resultat.resultat_ocr?.donnees;
      // Chercher un DigiID ou un numero CNI dans les donnes
      const extrait = d?.numero_cni || d?.nom_famille || "";
      if (extrait) {
        setDigiidExtrait(extrait);
        // Si on a un numero CNI, on essaie de chercher par ce numero
        if (d?.numero_cni) {
          setDigiid(d.numero_cni);
          // Lancer la recherche automatiquement
          setTimeout(() => {
            const btn = document.getElementById("btn-recherche-digiid");
            if (btn) (btn as HTMLButtonElement).click();
          }, 300);
        }
      } else {
        setErreur("Impossible d extraire l identite de cette CNI. Essaie la saisie manuelle.");
      }
    } catch (e: any) {
      setErreur(e?.message || "Erreur lors du scan de la CNI");
    } finally {
      setScanEnCours(false);
    }
  }

  function reinitialiserScan() {
    setFichierCNI(null);
    setPreviewCNI(null);
    setDigiidExtrait(null);
    if (inputCNIRef.current) inputCNIRef.current.value = "";
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/police/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Verification identite</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Forces de l ordre</p>
        <h1 className="mt-1">Verification d identite</h1>
        <p className="text-ardoise-clair mt-2">Scanne la CNI ou saisis le DigiID pour verifier une identite.</p>
      </div>

      {/* ========== SCAN CNI ========== */}
      <Carte titre="📷 Scan CNI (carte d identite physique)">
        <p className="text-sm text-ardoise-clair mb-4">
          Prends en photo le <strong>recto</strong> de la CNI. L OCR extrait automatiquement
          les donnees et remplit le champ DigiID ci-dessous.
        </p>

        <input
          ref={inputCNIRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFichierCNI}
          className="hidden"
        />

        {!previewCNI ? (
          <div
            onClick={() => inputCNIRef.current?.click()}
            className="border-2 border-dashed border-ardoise-clair/20 rounded-xl p-12 text-center cursor-pointer hover:border-ocre/40 hover:bg-ocre/5 transition-all"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-ocre/10 flex items-center justify-center mb-3">
              <svg className="w-8 h-8 text-ocre" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-ardoise font-semibold">Clique pour choisir une photo</p>
            <p className="text-xs text-ardoise-clair mt-1">JPG, PNG ou WEBP</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <img src={previewCNI} alt="Apercu CNI" className="max-h-64 mx-auto rounded-xl border border-ardoise-clair/10" />
              <button onClick={reinitialiserScan}
                className="absolute top-2 right-2 bg-terre text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-terre/80"
                type="button"
              >✕</button>
            </div>
            <Bouton variante="primaire" chargement={scanEnCours} onClick={lancerScanCNI}>
              Lancer l analyse OCR
            </Bouton>
            {digiidExtrait && (
              <div className="p-3 bg-succes/5 border border-succes/20 rounded-lg">
                <p className="text-xs text-succes font-semibold">✓ Identite extraite</p>
                <p className="text-sm text-ardoise mt-1">Numero : <strong>{digiidExtrait}</strong></p>
              </div>
            )}
          </div>
        )}
      </Carte>

      {/* ========== SAISIE MANUELLE ========== */}
      <Carte titre="⌨️ Saisie manuelle du DigiID">
        <div className="max-w-md space-y-4">
          <ChampSaisie libelle="DigiID de la personne" value={digiid}
            onChange={(e) => setDigiid(e.target.value)}
            placeholder="Ex: DIG-A1B2C3D4E5F6" />
          <Bouton variante="primaire" disabled={digiid.length < 4 || enRecherche}
            onClick={handleRecherche} id="btn-recherche-digiid">
            {enRecherche ? "Recherche..." : "Verifier l identite"}
          </Bouton>
        </div>
      </Carte>

      {/* ========== ERREURS ========== */}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* ========== RESULTAT ========== */}
      {resultat === "confirme" && personne && (
        <Carte titre="✅ Identite confirmee">
          <div className="flex items-center gap-4 p-3 bg-succes/5 rounded-lg">
            <div className="w-16 h-16 rounded-full bg-succes/10 flex items-center justify-center text-succes font-bold text-xl">
              {personne.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="font-bold text-lg text-ardoise">{personne.nom}</p>
              <p className="text-sm text-ardoise-clair">{personne.digiid}</p>
              <div className="flex gap-2 mt-2">
                <Badge variante="succes">Actif</Badge>
                <span className="text-xs text-ardoise-clair">Score: {personne.score}</span>
              </div>
            </div>
          </div>
        </Carte>
      )}

      {resultat === "infirme" && !personne && (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre font-semibold">Identite non confirmee</p>
          <p className="text-xs text-ardoise-clair mt-1">{erreur || "Aucune correspondance trouvee"}</p>
        </div>
      )}

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">Cette verification a ete enregistree dans l historique.</p>
      </div>

      <Link href="/police/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
