"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { useRoleUI } from "@/crochets/useRoleUI";
import { uploaderCNI } from "@/services/verification_cni";
import type { ReponseUploadCNI } from "@/services/verification_cni";

export default function ScanPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<"choix" | "camera" | "apercu">("choix");
  const [fichier, setFichier] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState<ReponseUploadCNI | null>(null);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  // Nettoyage camera au demontage (complement du useEffect mode)
  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // Passe en mode camera (le useEffect demarrera le flux automatiquement)
  const demarrerCamera = useCallback(() => {
    setErreur("");
    setMode("camera");
  }, []);

  // Demarre/arrete le flux camera quand le mode change
  useEffect(() => {
    if (mode !== "camera") return;

    let stream: MediaStream | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraActive(true);
      } catch {
        setErreur("Impossible d acceder a la camera. Verifie les permissions.");
        setMode("choix");
      }
    })();

    // Nettoyage : arreter la camera en quittant le mode
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      setCameraActive(false);
    };
  }, [mode]);

  // Arret de la camera
  const arreterCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Capture photo depuis la camera
  const capturerPhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPreview(dataUrl);
    // Convertir dataUrl en File
    canvas.toBlob((blob) => {
      if (blob) {
        setFichier(new File([blob], "capture_cni.jpg", { type: "image/jpeg" }));
      }
    }, "image/jpeg", 0.92);
    arreterCamera();
    setMode("apercu");
  }, [arreterCamera]);

  // Upload fichier depuis le disque
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFichier(f);
    setErreur("");
    setResultat(null);
    setSucces("");
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
    setMode("apercu");
  }, []);

  // Lancer le scan OCR
  const handleScan = useCallback(async () => {
    if (!fichier) return;
    setChargement(true);
    setErreur("");
    setSucces("");
    setResultat(null);
    try {
      const r = await uploaderCNI(fichier, "recto");
      setResultat(r);
      if (r.statut === "approuve") {
        setSucces("✅ CNI analysee avec succes !");
      } else if (r.resultat_ocr?.succes) {
        setSucces("✅ OCR reussi — verification en cours");
      } else {
        setErreur("L OCR n a pas pu extraire les donnees. Essaie une autre photo.");
      }
    } catch (e: any) {
      setErreur(e?.message || "Erreur lors du scan");
    } finally {
      setChargement(false);
    }
  }, [fichier]);

  // Reinitialiser
  const reinitialiser = useCallback(() => {
    setFichier(null);
    setPreview(null);
    setResultat(null);
    setErreur("");
    setSucces("");
    setMode("choix");
    arreterCamera();
  }, [arreterCamera]);

  if (!can.scanCNI) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1>Scan CNI</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module scan desactive.</p>
        </div>
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  const donnees = resultat?.resultat_ocr?.donnees;

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/agent/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Scan CNI</span>
      </nav>

      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1 className="mt-1">Scan de carte d identite</h1>
        <p className="text-ardoise-clair mt-2">Prends une photo ou selectionne un fichier pour extraire les donnees de la CNI par OCR.</p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}
      {succes && <Alerte variante="succes">{succes}</Alerte>}

      <Carte titre="Scanner une CNI">
        {/* ---------- MODE CHOIX ---------- */}
        {mode === "choix" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-ardoise-clair mb-2">Choisis une methode :</p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={demarrerCamera}
                className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-ardoise-clair/10 hover:border-ocre/40 hover:bg-ocre/5 transition-all w-48"
                type="button"
              >
                <span className="text-5xl">📷</span>
                <span className="text-sm font-semibold text-ardoise">Prendre une photo</span>
                <span className="text-xs text-ardoise-clair">Utilise l appareil photo</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-ardoise-clair/10 hover:border-ocre/40 hover:bg-ocre/5 transition-all w-48"
                type="button"
              >
                <span className="text-5xl">📁</span>
                <span className="text-sm font-semibold text-ardoise">Choisir un fichier</span>
                <span className="text-xs text-ardoise-clair">JPG, PNG, WEBP</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        )}

        {/* ---------- MODE CAMERA ---------- */}
        {mode === "camera" && (
          <div className="space-y-4 apparition">
            <div className="relative rounded-xl overflow-hidden bg-black border border-ardoise-clair/10">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-80 object-cover"
              />
              {/* Cadre guide */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-40 border-2 border-ocre/60 rounded-lg" />
              </div>
              <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/70 drop-shadow-md">
                Place la CNI dans le cadre
              </p>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Bouton variante="primaire" onClick={capturerPhoto}>
                📸 Capturer
              </Bouton>
              <Bouton variante="ghost" onClick={reinitialiser}>
                Annuler
              </Bouton>
            </div>
          </div>
        )}

        {/* ---------- MODE APERCU ---------- */}
        {mode === "apercu" && preview && (
          <div className="space-y-4">
            <div className="relative">
              <img
                src={preview}
                alt="Apercu CNI"
                className="max-h-72 mx-auto rounded-xl border border-ardoise-clair/10 shadow-sm"
              />
              <button
                onClick={reinitialiser}
                className="absolute top-2 right-2 bg-terre text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-terre/80 transition-colors"
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3 justify-center">
              <Bouton variante="primaire" chargement={chargement} onClick={handleScan}>
                Lancer le scan OCR
              </Bouton>
              <Bouton variante="secondaire" onClick={demarrerCamera}>
                Reprendre une photo
              </Bouton>
              <Bouton variante="ghost" onClick={() => fileInputRef.current?.click()}>
                Changer le fichier
              </Bouton>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFile}
              className="hidden"
            />
          </div>
        )}
      </Carte>

      {/* Résultat OCR */}
      {donnees && (
        <Carte titre="📋 Donnees extraites">
          <div className="space-y-3">
            <ChampExtrait label="Nom" valeur={donnees.nom_famille} />
            <ChampExtrait label="Prenom(s)" valeur={donnees.prenoms} />
            <ChampExtrait label="Sexe" valeur={donnees.sexe === "M" ? "Masculin" : donnees.sexe === "F" ? "Feminin" : donnees.sexe} />
            <ChampExtrait label="Date de naissance" valeur={donnees.date_naissance} />
            <ChampExtrait label="Lieu de naissance" valeur={donnees.lieu_naissance} />
            <ChampExtrait label="Numero CNI" valeur={donnees.numero_cni} />
            <ChampExtrait label="Date de delivrance" valeur={donnees.date_delivrance} />
            <ChampExtrait label="Date d expiration" valeur={donnees.date_expiration} />
            <ChampExtrait label="Autorite" valeur={donnees.autorite_delivrance} />
            <ChampExtrait label="Taille" valeur={donnees.taille ? `${donnees.taille} cm` : null} />
            {donnees.mrz_ligne_1 && (
              <div className="pt-3 border-t border-ardoise-clair/10">
                <p className="text-xs uppercase text-ardoise-clair font-semibold mb-1">Zone MRZ</p>
                <pre className="font-mono text-xs bg-sable p-3 rounded overflow-x-auto">
                  {donnees.mrz_ligne_1}
                  {donnees.mrz_ligne_2 && `\n${donnees.mrz_ligne_2}`}
                  {donnees.mrz_ligne_3 && `\n${donnees.mrz_ligne_3}`}
                </pre>
              </div>
            )}
            {resultat?.resultat_ocr?.champs_extraits !== undefined && (
              <div className="flex items-center gap-2 pt-3 border-t border-ardoise-clair/10">
                <Badge variante={resultat.statut === "approuve" ? "succes" : resultat.statut === "rejete" ? "terre" : "ocre"}>
                  {resultat.statut === "approuve" ? "Valide" : resultat.statut === "rejete" ? "Rejete" : "En attente"}
                </Badge>
                <span className="text-xs text-ardoise-clair">
                  {resultat.resultat_ocr.champs_extraits} champs extraits
                  {donnees.taux_confiance_moyen && ` — Confiance ${donnees.taux_confiance_moyen.toFixed(0)}%`}
                </span>
              </div>
            )}
          </div>
        </Carte>
      )}

      {/* Erreurs OCR */}
      {resultat?.resultat_ocr?.erreurs && resultat.resultat_ocr.erreurs.length > 0 && (
        <div className="bg-ocre/10 border border-ocre/30 p-4 rounded">
          <p className="text-sm font-semibold text-ocre">Avertissements OCR</p>
          <ul className="list-disc list-inside text-xs text-ardoise-clair mt-1 space-y-0.5">
            {resultat.resultat_ocr.erreurs.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          Le module OCR extraira automatiquement : nom, prenom, date naissance, numero CNI.
          Les donnees sont chiffrees et stockees de maniere securisee.
        </p>
      </div>

      <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>

      {/* Canvas cache pour capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function ChampExtrait({ label, valeur }: { label: string; valeur: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-ardoise-clair/5 last:border-b-0">
      <span className="text-sm text-ardoise-clair">{label}</span>
      <span className={`text-sm font-semibold ${valeur ? "text-ardoise" : "text-ardoise-clair/50 italic"}`}>
        {valeur || "Non detecte"}
      </span>
    </div>
  );
}
