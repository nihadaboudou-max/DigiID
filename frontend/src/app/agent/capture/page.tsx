"use client";

/**
 * Capture biométrique — agent terrain.
 *
 * Ce qui existe déjà :
 *  - flag `capture_biometrique` sur la table `enrolements` + PATCH API
 *  - module facial `verification_visuelle` (pour le compte connecté, pas le citoyen)
 *
 * Ce qui n'existe PAS :
 *  - table / routes / matériel lecteur d'empreinte digitale
 *
 * Cette page : caméra + import photo, liaison à un enrôlement, marquage du flag.
 */
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { useRoleUI } from "@/crochets/useRoleUI";
import { listerEnrolements, modifierEnrolement } from "@/services/enrolement";
import type { Enrolement } from "@/services/enrolement";

export default function CapturePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_terrain"]}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-ardoise-clair animate-pulse">Chargement...</p>
          </div>
        }
      >
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can, chargement: chargementPerms, avertissement } = useRoleUI();
  const searchParams = useSearchParams();
  const enrolementIdUrl = searchParams.get("enrolement_id");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fluxRef = useRef<MediaStream | null>(null);

  const [enrolements, setEnrolements] = useState<Enrolement[]>([]);
  const [enrolementId, setEnrolementId] = useState(enrolementIdUrl || "");
  const [modeCamera, setModeCamera] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [chargementListe, setChargementListe] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  useEffect(() => {
    (async () => {
      setChargementListe(true);
      try {
        const liste = await listerEnrolements();
        setEnrolements(liste);
        if (enrolementIdUrl) setEnrolementId(enrolementIdUrl);
      } catch {
        setErreur("Impossible de charger les enrôlements.");
      } finally {
        setChargementListe(false);
      }
    })();
  }, [enrolementIdUrl]);

  useEffect(() => {
    if (modeCamera && fluxRef.current && videoRef.current) {
      videoRef.current.srcObject = fluxRef.current;
    }
  }, [modeCamera]);

  useEffect(() => {
    return () => {
      fluxRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const arreterCamera = useCallback(() => {
    fluxRef.current?.getTracks().forEach((t) => t.stop());
    fluxRef.current = null;
    setModeCamera(false);
  }, []);

  async function demarrerCamera() {
    setErreur("");
    setSucces("");
    try {
      const flux = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      fluxRef.current = flux;
      setModeCamera(true);
      setPreview(null);
      setFichier(null);
    } catch {
      setErreur("Impossible d'accéder à la caméra. Vérifie les permissions du navigateur.");
    }
  }

  function capturerPhoto() {
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
    canvas.toBlob((blob) => {
      if (blob) {
        setFichier(new File([blob], "photo_identite.jpg", { type: "image/jpeg" }));
      }
    }, "image/jpeg", 0.92);
    arreterCamera();
  }

  function handleFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErreur("");
    setSucces("");
    setFichier(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
    arreterCamera();
  }

  function reinitialiserPhoto() {
    setPreview(null);
    setFichier(null);
    setSucces("");
    setErreur("");
  }

  async function enregistrerCapture() {
    if (!fichier || !enrolementId) {
      setErreur("Choisis un enrôlement et capture ou importe une photo.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    setSucces("");
    try {
      const maj = await modifierEnrolement(enrolementId, {
        capture_biometrique: true,
      });
      // Enrichir notes côté client si besoin — on refetch liste
      setEnrolements((prev) => prev.map((e) => (e.id === maj.id ? maj : e)));
      setSucces(
        `Photo enregistrée pour ${maj.citoyen_prenom} ${maj.citoyen_nom} — capture biométrique marquée.`,
      );
    } catch (e: unknown) {
      const err = e as { message_utilisateur?: string; message?: string };
      setErreur(err?.message_utilisateur || err?.message || "Erreur lors de l'enregistrement");
    } finally {
      setEnvoi(false);
    }
  }

  if (chargementPerms) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-ardoise-clair animate-pulse">Chargement des permissions...</p>
      </div>
    );
  }

  if (!can.captureBiometrics) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1>Capture biométrique</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module de capture biométrique désactivé.</p>
        </div>
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  const enrolementSelectionne = enrolements.find((e) => e.id === enrolementId);
  const aCapturer = enrolements.filter((e) => !e.capture_biometrique && e.statut === "en_attente");

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
        <span className="text-ardoise font-semibold">Capture biométrique</span>
      </nav>

      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Agent terrain</p>
        <h1 className="mt-1">Capture biométrique</h1>
        <p className="text-ardoise-clair mt-2">
          Photo d&apos;identité du citoyen liée à un enrôlement. L&apos;empreinte digitale n&apos;est pas encore disponible.
        </p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}
      {succes && <Alerte variante="succes">{succes}</Alerte>}

      <Carte titre="Enrôlement cible">
        {chargementListe ? (
          <p className="text-sm text-ardoise-clair animate-pulse">Chargement des enrôlements...</p>
        ) : enrolements.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-ardoise-clair">Aucun enrôlement. Crée-en un d&apos;abord.</p>
            <Link href="/agent/enrolement">
              <Bouton variante="primaire">Nouvel enrôlement</Bouton>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs uppercase text-ardoise-clair font-semibold">
              Citoyen à capturer
            </label>
            <select
              value={enrolementId}
              onChange={(e) => {
                setEnrolementId(e.target.value);
                setSucces("");
              }}
              className="w-full max-w-md px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white"
            >
              <option value="">— Sélectionner —</option>
              {enrolements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.citoyen_prenom} {e.citoyen_nom}
                  {e.capture_biometrique ? " ✓ biométrie" : ""}
                  {e.statut !== "en_attente" ? ` (${e.statut})` : ""}
                </option>
              ))}
            </select>
            {enrolementSelectionne && (
              <div className="flex flex-wrap gap-2 items-center text-sm">
                <Badge variante={enrolementSelectionne.capture_biometrique ? "succes" : "ocre"}>
                  {enrolementSelectionne.capture_biometrique ? "Biométrie faite" : "Biométrie à faire"}
                </Badge>
                <Link href={`/agent/enrolement/${enrolementSelectionne.id}`} className="text-lagune text-xs hover:underline">
                  Voir le détail
                </Link>
              </div>
            )}
            {aCapturer.length > 0 && !enrolementId && (
              <p className="text-xs text-ardoise-clair">
                {aCapturer.length} enrôlement(s) en attente sans capture biométrique.
              </p>
            )}
          </div>
        )}
      </Carte>

      <div className="grid md:grid-cols-2 gap-6">
        <Carte titre="Photo d'identité">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFichier}
          />
          <canvas ref={canvasRef} className="hidden" />

          {modeCamera && (
            <div className="space-y-3 mb-4">
              <div className="relative rounded-xl overflow-hidden bg-black border border-ardoise-clair/10">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-48 border-2 border-ocre/60 rounded-full" />
                </div>
              </div>
              <div className="flex gap-2">
                <Bouton variante="primaire" onClick={capturerPhoto}>
                  Capturer
                </Bouton>
                <Bouton variante="ghost" onClick={arreterCamera}>
                  Annuler
                </Bouton>
              </div>
            </div>
          )}

          {!modeCamera && preview && (
            <div className="space-y-3 mb-4">
              <img
                src={preview}
                alt="Aperçu photo"
                className="max-h-64 mx-auto rounded-xl border border-ardoise-clair/10"
              />
              <p className="text-xs text-center text-ardoise-clair">
                {fichier?.name} {fichier ? `(${(fichier.size / 1024).toFixed(0)} Ko)` : ""}
              </p>
            </div>
          )}

          {!modeCamera && !preview && (
            <div className="border-2 border-dashed border-ardoise-clair/30 rounded-xl p-10 text-center bg-sable/50 mb-4">
              <p className="text-4xl mb-2">📷</p>
              <p className="text-sm text-ardoise-clair">Caméra ou import de fichier</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!modeCamera && !preview && (
              <>
                <Bouton variante="primaire" onClick={demarrerCamera}>
                  Prendre la photo
                </Bouton>
                <Bouton variante="secondaire" onClick={() => inputRef.current?.click()}>
                  Importer
                </Bouton>
              </>
            )}
            {preview && (
              <>
                <Bouton
                  variante="primaire"
                  disabled={!enrolementId || envoi}
                  chargement={envoi}
                  onClick={enregistrerCapture}
                >
                  {envoi ? "Enregistrement..." : "Enregistrer sur l'enrôlement"}
                </Bouton>
                <Bouton variante="ghost" onClick={reinitialiserPhoto}>
                  Reprendre
                </Bouton>
                <Bouton variante="ghost" onClick={() => inputRef.current?.click()}>
                  Autre fichier
                </Bouton>
              </>
            )}
          </div>
        </Carte>

        <Carte titre="Empreinte digitale">
          <div className="border-2 border-dashed border-ardoise-clair/20 rounded-xl p-10 text-center bg-sable/30 opacity-80">
            <p className="text-4xl mb-2">👆</p>
            <p className="text-sm font-semibold text-ardoise mb-1">Non disponible</p>
            <p className="text-xs text-ardoise-clair">
              Aucune table, route API ni intégration lecteur d&apos;empreinte n&apos;existe encore dans DigiID.
              Seule la photo d&apos;identité est opérationnelle pour l&apos;instant.
            </p>
          </div>
          <div className="mt-4">
            <Bouton variante="primaire" disabled>
              Lancer le scan
            </Bouton>
          </div>
        </Carte>
      </div>

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          La capture marque le champ <code className="text-[11px]">capture_biometrique</code> de
          l&apos;enrôlement. Le module facial citoyen (`/verification-visuelle`) reste réservé
          au compte de l&apos;utilisateur connecté — il n&apos;est pas utilisé ici pour éviter
          d&apos;écraser l&apos;empreinte faciale de l&apos;agent.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
        {enrolementId && (
          <Link href={`/agent/enrolement/${enrolementId}`}>
            <Bouton variante="secondaire">Voir l&apos;enrôlement</Bouton>
          </Link>
        )}
      </div>
    </div>
  );
}
