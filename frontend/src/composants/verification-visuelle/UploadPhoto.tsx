"use client";

/**
 * UploadPhoto — prise de photo / upload pour vérification faciale.
 * Utilise l'API MediaDevices pour la caméra, avec fallback upload fichier.
 */
import { useEffect, useRef, useState } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { uploaderPhoto } from "@/services/verification_visuelle";
import clsx from "clsx";
import { ErreurAPI } from "@/services/client_api";

type Props = {
  /** Appelée après un upload réussi */
  onSucces: () => void;
};

export default function UploadPhoto({ onSucces }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Ref pour le flux caméra (pas de state pour éviter le délai React) */
  const fluxRef = useRef<MediaStream | null>(null);

  const [modeCamera, setModeCamera] = useState(false);
  const [capture, setCapture] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [progression, setProgression] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);

  /**
   * Branche le flux APRÈS que React a rendu la balise <video>.
   * Sans ça, videoRef.current est null car le DOM n'est pas encore mis à jour.
   */
  useEffect(() => {
    if (modeCamera && fluxRef.current && videoRef.current) {
      videoRef.current.srcObject = fluxRef.current;
    }
  }, [modeCamera]);

  /** Démarrer la caméra */
  async function demarrerCamera() {
    setErreur(null);
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      fluxRef.current = flux;   // stocke dans une ref (dispo immediatement)
      setModeCamera(true);       // React rend <video> → useEffect branche le flux
      setCapture(null);
    } catch {
      setErreur("Impossible d'accéder à la caméra. Vérifie les permissions.");
    }
  }

  /** Arrêter la caméra */
  function arreterCamera() {
    if (fluxRef.current) {
      fluxRef.current.getTracks().forEach((piste) => piste.stop());
      fluxRef.current = null;
    }
    setModeCamera(false);
    setCapture(null);
  }

  /** Capturer une frame depuis la vidéo */
  function capturerPhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setCapture(canvas.toDataURL("image/jpeg", 0.9));
  }

  /** Uploader la photo capturée (convertir dataURL → Blob) */
  async function envoyerCapture() {
    if (!capture) return;
    setErreur(null);
    setChargement(true);
    setProgression(0);
    try {
      const blob = await (await fetch(capture)).blob();
      const fichier = new File([blob], "capture_visage.jpg", { type: "image/jpeg" });
      await uploaderPhoto(fichier, setProgression);
      arreterCamera();
      onSucces();
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de l'envoi.");
    } finally {
      setChargement(false);
    }
  }

  /** Uploader un fichier depuis le disque */
  async function envoyerFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setErreur(null);
    setChargement(true);
    setProgression(0);
    try {
      await uploaderPhoto(fichier, setProgression);
      onSucces();
    } catch (err) {
      setErreur(err instanceof ErreurAPI ? err.message_utilisateur : "Erreur lors de l'envoi.");
    } finally {
      setChargement(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  /** Tout réinitialiser pour une nouvelle photo */
  function reinitialiser() {
    setCapture(null);
    setErreur(null);
  }

  return (
    <div className="space-y-4">
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Zone caméra */}
      {modeCamera && (
        <div className="space-y-3">
          <div className="relative bg-gray-900 rounded-xl overflow-hidden min-h-[240px] flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full max-h-80 object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            {capture && (
              <img
                src={capture}
                alt="Aperçu"
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
          </div>

          {!capture ? (
            <Bouton variante="primaire" className="w-full" onClick={capturerPhoto}>
              📸 Prendre la photo
            </Bouton>
          ) : (
            <div className="flex gap-2">
              <Bouton variante="secondaire" className="flex-1" onClick={reinitialiser}>
                Reprendre
              </Bouton>
              <Bouton
                variante="primaire"
                className="flex-1"
                chargement={chargement}
                onClick={envoyerCapture}
              >
                Envoyer
              </Bouton>
            </div>
          )}

          <Bouton variante="ghost" onClick={arreterCamera}>
            ✕ Fermer la caméra
          </Bouton>
        </div>
      )}

      {/* Boutons de sélection du mode */}
      {!modeCamera && (
        <div className="flex flex-col gap-3">
          <Bouton variante="primaire" className="w-full" onClick={demarrerCamera}>
            📷 Prendre une photo (caméra)
          </Bouton>

          <div className="relative">
            <div className="border-t border-ardoise-clair/20 my-2" />
            <p className="text-center text-xs text-ardoise-clair -mt-3 bg-white px-2 mx-auto w-fit">
              ou
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={envoyerFichier}
          />
          <Bouton
            variante="secondaire"
            className="w-full"
            chargement={chargement}
            onClick={() => inputRef.current?.click()}
          >
            📁 Choisir une photo
          </Bouton>
        </div>
      )}

      {/* Barre de progression */}
      {chargement && progression > 0 && (
        <div className="w-full bg-sable-clair rounded-full h-2">
          <div
            className="bg-lagune h-2 rounded-full transition-all duration-300"
            style={{ width: `${progression}%` }}
          />
        </div>
      )}
    </div>
  );
}
