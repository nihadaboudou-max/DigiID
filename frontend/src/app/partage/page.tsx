"use client";
import { useState, useRef, useCallback } from "react";
import Link from "next/link";

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
  const [qrCharge, setQrCharge] = useState(true);
  const [qrErreur, setQrErreur] = useState(false);
  const refImageQR = useRef<HTMLImageElement>(null);
  const refCanvas = useRef<HTMLCanvasElement>(null);

  if (!utilisateur || !utilisateur.digiid_public) return null;
  const digiId = utilisateur.digiid_public;

  // QR code via API gratuite (aucune dépendance npm)
  const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
    JSON.stringify({ digiid: digiId })
  )}&bgcolor=ffffff&color=1e293b&margin=10`;

  const urlProfil = typeof window !== "undefined" 
    ? `${window.location.origin}/profil/${digiId}`
    : `https://digiid.africa/profil/${digiId}`;

  async function copier() {
    try {
      await navigator.clipboard.writeText(digiId);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = digiId;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  async function copierLien() {
    try {
      await navigator.clipboard.writeText(urlProfil);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = urlProfil;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  const telechargerQR = useCallback(() => {
    const img = refImageQR.current;
    const canvas = refCanvas.current;
    if (!img || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 430;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 400, 430);
    ctx.drawImage(img, 0, 0, 400, 400);
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(digiId, 200, 420);

    const lien = document.createElement("a");
    lien.download = `digiid-${digiId}-qr.png`;
    lien.href = canvas.toDataURL("image/png");
    lien.click();
  }, [digiId]);

  async function partager() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mon identité numérique DigiID",
          text: `Voici mon identifiant DigiID : ${digiId}`,
          url: urlProfil,
        });
      } catch { /* Annulé */ }
    } else {
      copierLien();
    }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/profil" className="hover:text-ocre">Mon profil</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Partager mon DigiID</span>
      </nav>

      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Partage</p>
        <h1 className="mt-1">Mon identifiant DigiID</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Carte className="flex flex-col items-center text-center">
          <p className="text-xs uppercase text-ocre font-bold mb-4 tracking-wider">
            Code QR à scanner
          </p>
          <div className="relative bg-white p-4 border-2 border-ardoise/10 rounded-2xl shadow-sm">
            {qrCharge && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-2xl">
                <p className="text-ardoise-clair text-sm">Génération du QR...</p>
              </div>
            )}
            {qrErreur ? (
              <div className="w-[240px] h-[240px] flex items-center justify-center bg-sable rounded-lg">
                <div className="text-center">
                  <p className="text-4xl mb-2">📱</p>
                  <p className="text-xs text-ardoise-clair">QR non disponible</p>
                  <p className="text-xs text-ardoise-clair/60 mt-1">DigiID: {digiId}</p>
                </div>
              </div>
            ) : (
              <img
                ref={refImageQR}
                src={urlQR}
                alt={`QR Code ${digiId}`}
                width={240}
                height={240}
                className="mx-auto"
                onLoad={() => setQrCharge(false)}
                onError={() => { setQrCharge(false); setQrErreur(true); }}
              />
            )}
            <canvas ref={refCanvas} className="hidden" />
            <p className="text-center text-xs text-ardoise-clair/60 mt-3 font-mono">{digiId}</p>
          </div>
          <div className="flex gap-2 mt-4">
            <Bouton variante="secondaire" taille="petit" onClick={telechargerQR}>
              📥 Télécharger le QR
            </Bouton>
            <Bouton variante="ghost" taille="petit" onClick={() => window.print()}>
              🖨️ Imprimer
            </Bouton>
          </div>

        </Carte>

        <Carte>
          <p className="text-xs uppercase text-ocre font-bold mb-3 tracking-wider">
            Mon identifiant
          </p>
          <p className="text-3xl font-mono font-bold text-lagune break-all mb-6 tracking-wider">
            {digiId}
          </p>
          <div className="space-y-3">
            <Bouton variante="secondaire" onClick={copier} className="w-full">
              {copie ? (
                <><IconeCheck className="w-4 h-4" /> Copié !</>
              ) : (
                <><IconeCopier className="w-4 h-4" /> Copier mon DigiID</>
              )}
            </Bouton>
            {typeof navigator?.share === 'function' ? (
              <Bouton variante="primaire" onClick={partager} className="w-full">
                📤 Partager
              </Bouton>
            ) : (
              <Bouton variante="primaire" onClick={copierLien} className="w-full">
                🔗 Copier le lien
              </Bouton>
            )}
            <Link href="/profil/telecharger" className="block">
              <Bouton variante="ghost" className="w-full">
                📋 Télécharger mon profil numérique
              </Bouton>
            </Link>
          </div>
          <div className="mt-6 pt-4 border-t border-ardoise-clair/10">
            <p className="text-xs text-ardoise-clair font-semibold mb-2">Statut du profil</p>
            <div className="flex flex-wrap gap-2">
              <Badge variante={utilisateur.est_email_verifie ? "succes" : "terre"} taille="petit">
                ✉️ {utilisateur.est_email_verifie ? "Vérifié" : "Non vérifié"}
              </Badge>
              <Badge variante={utilisateur.est_visage_verifie ? "succes" : "terre"} taille="petit">
                👤 Visage {utilisateur.est_visage_verifie ? "✓" : "✗"}
              </Badge>
              <Badge variante={utilisateur.est_cni_verifiee ? "succes" : "terre"} taille="petit">
                🆔 CNI {utilisateur.est_cni_verifiee ? "✓" : "✗"}
              </Badge>
            </div>
          </div>
        </Carte>
      </div>

      <Carte titre="Partages récents">
        <div className="flex items-center gap-3 p-3 bg-sable rounded-lg">
          <span className="text-2xl">🔒</span>
          <p className="text-sm text-ardoise-clair flex-1">Chaque consultation est tracée.</p>
          <Link href="/autorisations"><Bouton variante="ghost" taille="petit">Voir →</Bouton></Link>
        </div>
      </Carte>

      <Alerte variante="avertissement" titre="🔐 Sécurité">
        <p className="text-sm">Ne partage ton DigiID qu'avec des institutions de confiance. Chaque consultation est tracée.</p>
      </Alerte>

      <Carte titre="Qui peut interroger mon DigiID ?">
        <div className="grid sm:grid-cols-3 gap-4">
          <BlocUsage titre="Banques" detail="Vérification d'identité avant ouverture de compte." statut="actif" />
          <BlocUsage titre="Hôpitaux" detail="Accès au dossier médical, ordonnances." statut="actif" />
          <BlocUsage titre="Administration" detail="Aides sociales, certificats." statut="phase-4" />
        </div>
      </Carte>

      <div className="flex gap-2">
        <Link href="/profil"><Bouton variante="primaire">← Profil</Bouton></Link>
        <Link href="/autorisations"><Bouton variante="secondaire">Autorisations</Bouton></Link>
        <Link href="/profil/telecharger"><Bouton variante="ghost">📥 Export</Bouton></Link>
      </div>
    </div>
  );
}

function BlocUsage({ titre, detail, statut }: {
  titre: string; detail: string; statut: "actif" | "phase-4";
}) {
  return (
    <div className="bg-sable-clair rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-lagune">{titre}</h4>
        {statut === "actif" ? (
          <Badge variante="succes">Actif</Badge>
        ) : (
          <Badge variante="ocre">À venir</Badge>
        )}
      </div>
      <p className="text-xs text-ardoise-clair">{detail}</p>
    </div>
  );
}
