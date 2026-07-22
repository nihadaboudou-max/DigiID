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
    <EnvelopperEspaceProtege rolesAutorises={["agent_terrain"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can, chargement: chargementPerms, avertissement } = useRoleUI();
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
        // Meilleure qualite possible : utiliser la camera arriere avec
        // contrainte exacte pour eviter les resolutions interpolees
        const contraintes: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { min: 1280, ideal: 2560 },
            height: { min: 720, ideal: 1440 },
            aspectRatio: { ideal: 1.7777777778 },
          },
        };

        stream = await navigator.mediaDevices.getUserMedia(contraintes);

        // Appliquer la meilleure resolution disponible
        const piste = stream.getVideoTracks()[0];
        if (piste && piste.applyConstraints) {
          try {
            const capacites: any = piste.getCapabilities?.();
            if (capacites?.focusMode?.includes?.("continuous")) {
              await piste.applyConstraints({ advanced: [{ focusMode: "continuous" }] } as any);
            }
          } catch {
            // Optimisation non supportee — pas grave
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraActive(true);
      } catch (err: any) {
        const msg = err?.name === "NotAllowedError"
          ? "Permission camera refusee. Autorise l acces dans les parametres du navigateur."
          : err?.name === "NotFoundError"
          ? "Aucune camera trouvee sur cet appareil."
          : "Impossible d acceder a la camera. Verifie les permissions.";
        setErreur(msg);
        setMode("choix");
      }
    })();

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

  // Capture photo depuis la camera avec meilleure qualite
  const capturerPhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Utiliser la resolution native de la video (max 4K)
    const maxW = Math.min(video.videoWidth, 3840);
    const maxH = Math.min(video.videoHeight, 2160);
    canvas.width = maxW;
    canvas.height = maxH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Desactiver lissage pour maximiser la nettete du texte OCR
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(video, 0, 0, maxW, maxH);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.98);
    setPreview(dataUrl);

    // Convertir en File (qualite max pour OCR)
    setResultat(null);  // <-- reset du resultat precedent
    setSucces("");      // <-- reset du message succes
    setErreur("");      // <-- reset du message erreur
    canvas.toBlob((blob) => {
      if (blob) {
        setFichier(new File([blob], "capture_cni.jpg", { type: "image/jpeg" }));
      }
    }, "image/jpeg", 0.95);

    arreterCamera();
    setMode("apercu");
  }, [arreterCamera, setPreview, setFichier, setResultat, setSucces, setErreur, setMode]);

  // Upload fichier depuis le disque
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Reset de la valeur pour permettre de re-sélectionner le même fichier
    e.target.value = "";
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
      console.log(`📤 Upload CNI : ${fichier.name} (${(fichier.size / 1024).toFixed(0)} Ko)`);
      const r = await uploaderCNI(fichier, "recto");
      console.log(`📥 Reponse : ${r.statut} — ${r.message}`);
      setResultat(r);

      if (r.statut === "approuve") {
        setSucces("✅ CNI analysee avec succes !");
      } else if (r.resultat_ocr?.succes) {
        setSucces("✅ OCR reussi — verification en cours");
      } else {
        const nbChamps = r.resultat_ocr?.champs_extraits ?? 0;
        const erreurs = r.resultat_ocr?.erreurs ?? [];
        const detail = erreurs.length > 0
          ? ` ${erreurs.slice(0, 2).join(", ")}`
          : ` Seulement ${nbChamps} champ(s) extrait(s).`;
        setErreur(`L OCR n a pas pu extraire les donnees.${detail} Essaie une photo mieux cadree et mieux eclairee.`);
      }
    } catch (e: any) {
      console.error("❌ Erreur upload:", e);
      if (e?.name === "ErreurAPI" && e?.code_http === 413) {
        setErreur("La photo est trop volumineuse. Redimensionne-la ou utilise une resolution plus basse.");
      } else if (e?.code_erreur === "RESEAU") {
        setErreur("Le serveur backend est inaccessible. Verifie qu il est bien lance.");
      } else {
        setErreur(e?.message || "Erreur inconnue lors de l upload");
      }
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

  if (chargementPerms) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-ardoise-clair animate-pulse">Chargement des permissions...</p>
      </div>
    );
  }

  if (!can.scanCNI) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1>Scan CNI</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module scan désactivé.</p>
        </div>
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  const donnees = resultat?.resultat_ocr?.donnees;

  return (
    <div className="space-y-8 apparition">
      {avertissement && (
        <div className="bg-ocre/10 border-l-4 border-ocre p-4 rounded">
          <p className="text-sm text-ocre">{avertissement}</p>
        </div>
      )}
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/agent/dashboard" className="hover:text-ocre">Tableau de bord</Link>
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

      {/* Input file UNIQUE et TOUJOURS present (hors flux conditionnel) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        key="input-fichier-cni"
      />

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
              {/* Surbrillance sombre avec cadre lumineux */}
              <div className="absolute inset-0 bg-black/10 pointer-events-none" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-40 border-2 border-ocre/70 rounded-lg shadow-[0_0_0_999px_rgba(0,0,0,0.3)]" />
              </div>
              <div className="absolute top-3 left-3 right-3 flex justify-between pointer-events-none">
                <span className="text-[10px] bg-black/50 text-white px-2 py-1 rounded">🧹 Bien a plat</span>
                <span className="text-[10px] bg-black/50 text-white px-2 py-1 rounded">☀️ Bon eclairage</span>
                <span className="text-[10px] bg-black/50 text-white px-2 py-1 rounded">📐 Cadree</span>
              </div>
              <p className="absolute bottom-3 left-0 right-0 text-center text-sm text-white font-semibold drop-shadow-lg">
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
            <div className="bg-ocre/5 border border-ocre/20 p-3 rounded-lg">
              <p className="text-xs text-ardoise-clair text-center">
                💡 <strong>Conseils :</strong> pose la CNI sur un fond sombre et uni,
                evite les reflets, assure-toi que le texte est bien lisible.
              </p>
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
