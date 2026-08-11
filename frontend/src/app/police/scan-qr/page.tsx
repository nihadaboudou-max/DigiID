"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { verifierQRCode, type CitoyenVerifie } from "@/services/qr_dynamique";
import BadgeExpiration, { labelDocument, formaterDateExpiration } from "@/composants/police/BadgeExpiration";
import PhotoProtegee from "@/composants/police/PhotoProtegee";
import { Html5Qrcode } from "html5-qrcode";

export default function ScanQRPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_police", "chef_police","admin", "super_admin"]}>
      {/* Suspense requis par useSearchParams pour éviter une erreur de build Next.js */}
      <Suspense fallback={<div className="text-center py-8 text-ardoise-clair">Chargement...</div>}>
        <Contenu />
      </Suspense>
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [token, setToken] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [citoyen, setCitoyen] = useState<CitoyenVerifie | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  // États pour le scan QR code
  const [scanActif, setScanActif] = useState(false);
  const [permissionCamera, setPermissionCamera] = useState<boolean | null>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // --- Vérification automatique depuis l'URL (scan caméra native) ---
  // Le QR code encode maintenant : https://<frontend>/police/scan-qr?token=TOKEN
  // La caméra native du téléphone ouvre cette URL → on vérifie automatiquement.
  const searchParams = useSearchParams();
  const router = useRouter();
  const aAutoVerifie = useRef(false);

  useEffect(() => {
    const tokenURL = searchParams.get("token");
    if (tokenURL && !aAutoVerifie.current) {
      aAutoVerifie.current = true;
      setToken(tokenURL);
      // Nettoie l'URL pour éviter de re-vérifier un token déjà consommé au refresh
      router.replace("/police/scan-qr", { scroll: false });
      verifierAutomatiquement(tokenURL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Initialiser le scanner QR code
  useEffect(() => {
    if (scanActif && scannerRef.current) {
      initialiserScanner();
    }
    
    return () => {
      if (html5QrCodeRef.current) {
        arreterScanner();
      }
    };
  }, [scanActif]);

  async function initialiserScanner() {
    // Évite une double initialisation (ex: re-render en mode dev StrictMode)
    if (html5QrCodeRef.current) return;
    try {
      // Vérifier la permission de la caméra
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach(track => track.stop());
      setPermissionCamera(true);

      // Créer l'instance du scanner
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      // Configurer le scanner
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false,
      };

      // Démarrer le scan
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanFailure
      );
    } catch (err) {
      console.error("Erreur caméra:", err);
      // Libère l'instance pour permettre une nouvelle tentative sans recharger la page
      if (html5QrCodeRef.current) {
        try { html5QrCodeRef.current.stop().catch(() => {}); } catch { /* ignoré */ }
        html5QrCodeRef.current = null;
      }
      setPermissionCamera(false);
      setErreur("Impossible d'accéder à la caméra. Vérifiez les permissions.");
    }
  }

  function onScanSuccess(decodedText: string) {
    // Extraire le token de l'URL QR code
    // Formats possibles :
    //   - https://digiid.africa/police/scan-qr?token=TOKEN (format actuel)
    //   - https://api.digiid.africa/v1/police/qr/verifier/TOKEN (ancien format API)
    //   - https://.../v1/verify/TOKEN (ancien format)
    //   - TOKEN brut (si le QR contient directement le token)
    let tokenExtrait = "";
    try {
      const url = new URL(decodedText);
      const tokenQuery = url.searchParams.get("token");
      if (tokenQuery) tokenExtrait = tokenQuery;
    } catch {
      // Pas une URL valide → on continue avec les formats ci-dessous
    }
    if (!tokenExtrait) {
      const match =
        decodedText.match(/\/qr\/verifier\/([A-Za-z0-9_-]+)$/) ||
        decodedText.match(/\/verify\/([A-Za-z0-9_-]+)$/);
      tokenExtrait = match ? match[1] : decodedText;
    }
    
    setToken(tokenExtrait);
    arreterScanner();
    setScanActif(false);
    
    // Vérifier automatiquement
    setTimeout(() => {
      verifierAutomatiquement(tokenExtrait);
    }, 500);
  }

  function onScanFailure(error: any) {
    // Les erreurs de scan sont normales (pas de QR code détecté)
    // console.warn(`Code scan error = ${error}`);
  }

  async function arreterScanner() {
    const scanner = html5QrCodeRef.current;
    if (!scanner) return;
    // Libère la référence immédiatement (idempotent) pour permettre une
    // réactivation ultérieure et éviter un double stop.
    html5QrCodeRef.current = null;
    try {
      await scanner.stop();
    } catch (err) {
      console.error("Erreur arrêt scanner:", err);
    }
  }

  async function handleVerifier(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    await verifierAutomatiquement(token.trim());
  }

  async function verifierAutomatiquement(tokenValue: string) {
    setChargement(true);
    setErreur(null);
    setCitoyen(null);
    setMessage(null);

    try {
      const resultat = await verifierQRCode(tokenValue);
      if (resultat.succes && resultat.citoyen) {
        setCitoyen(resultat.citoyen);
        setMessage("✅ Identité vérifiée avec succès !");
      } else {
        setErreur(resultat.message || "QR Code invalide.");
      }
    } catch (err: any) {
      // On ne redirige vers la connexion QUE si la session a réellement expiré
      // (code AUTH_TOKEN_EXPIRE). Un QR invalide/expiré renvoie 400 (et non 401) :
      // il ne doit donc jamais déconnecter l'agent ni l'envoyer à la page de connexion.
      if (err?.code_erreur === "AUTH_TOKEN_EXPIRE") {
        const retour = tokenValue
          ? `/police/scan-qr?token=${encodeURIComponent(tokenValue)}`
          : "/police/scan-qr";
        router.push(`/connexion?retour=${encodeURIComponent(retour)}`);
        return;
      }
      setErreur(err.message || "Erreur lors de la vérification.");
    } finally {
      setChargement(false);
    }
  }

  function reinitialiser() {
    setToken("");
    setCitoyen(null);
    setErreur(null);
    setMessage(null);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/police/dashboard" className="hover:text-ocre">
          Espace Police
        </Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Scanner un QR Code</span>
      </nav>

      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Contrôle d'identité
        </p>
        <h1 className="mt-1">Vérifier un QR Code DigiID</h1>
        <p className="text-ardoise-clair mt-2">
          Scannez le QR code du citoyen ou saisissez manuellement le token.
        </p>
      </div>

      {/* Message d'erreur */}
      {erreur && (
        <div className="p-4 bg-terre/10 border border-terre/30 rounded-lg">
          <div className="flex items-start justify-between">
            <p className="text-terre font-semibold">❌ {erreur}</p>
            <button onClick={() => setErreur(null)} className="text-terre hover:text-terre-fonce">✕</button>
          </div>
        </div>
      )}

      {/* Message de succès */}
      {message && !citoyen && (
        <div className="p-4 bg-vert/10 border border-vert/30 rounded-lg">
          <p className="text-vert font-semibold">{message}</p>
        </div>
      )}

      {/* Résultat : fiche d'identité du citoyen */}
      {citoyen && (
        <Carte>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <h3 className="text-lg font-bold text-ardoise">
                Identité vérifiée
              </h3>
            </div>
            <Bouton variante="ghost" taille="petit" onClick={reinitialiser}>
              Nouvelle vérification
            </Bouton>
          </div>

          {/* Photo de profil (servie par un endpoint protégé JWT) */}
          {citoyen.photo_profil_url && (
            <div className="mb-4 flex justify-center">
              <PhotoProtegee
                src={citoyen.photo_profil_url}
                alt="Photo du citoyen"
                className="w-32 h-32 rounded-full object-cover border-4 border-lagune/30"
                fallback={
                  <div className="w-32 h-32 rounded-full bg-lagune/10 flex items-center justify-center text-lagune text-3xl font-bold border-4 border-lagune/30">
                    {`${citoyen.prenom || ""} ${citoyen.nom || ""}`.trim().split(" ").map((n) => n[0] || "").join("").slice(0, 2).toUpperCase() || "?"}
                  </div>
                }
              />
            </div>
          )}

          {/* Informations */}
          <div className="space-y-3">
            <InfoLigne
              label="Nom complet"
              valeur={`${citoyen.prenom || ""} ${citoyen.nom || ""}`.trim() || "—"}
            />
            <InfoLigne label="Email" valeur={citoyen.email || "—"} />

            {/* Badges de vérification */}
            <div className="pt-3 border-t border-ardoise-clair/20">
              <p className="text-xs uppercase text-ardoise-clair font-semibold mb-2">
                Statut des vérifications
              </p>
              <div className="flex flex-wrap gap-2">
                <BadgeVerification
                  label="CNI"
                  valide={citoyen.est_cni_verifiee}
                />
                <BadgeVerification
                  label="Visage"
                  valide={citoyen.est_visage_verifie}
                />
                <BadgeVerification
                  label="Email"
                  valide={citoyen.est_email_verifie}
                />
              </div>
            </div>

            {/* Pièces d'identité et état d'expiration */}
            {Array.isArray(citoyen.documents) && citoyen.documents.length > 0 && (
              <div className="pt-3 border-t border-ardoise-clair/20">
                <p className="text-xs uppercase text-ardoise-clair font-semibold mb-2">
                  Pièces d'identité
                </p>
                <ul className="space-y-2">
                  {citoyen.documents.map((d, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 text-xs p-2 bg-sable rounded"
                    >
                      <div className="min-w-0">
                        <p className="text-ardoise font-semibold">
                          {labelDocument(d.type_document)}
                        </p>
                        <p className="text-[10px] text-ardoise-clair">
                          {formaterDateExpiration(d.date_expiration)}
                        </p>
                      </div>
                      <BadgeExpiration
                        est_expire={d.est_expire}
                        expire_bientot={d.expire_bientot}
                        est_valide={d.est_valide}
                        jours_restants={d.jours_restants}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Carte>
      )}

      {/* Zone de scan QR code */}
      {!citoyen && (
        <>
          {/* Bouton pour activer/désactiver la caméra */}
          <Carte>
            <div className="text-center space-y-4">
              {!scanActif ? (
                <>
                  <div className="w-20 h-20 bg-lagune/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-lagune" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-ardoise">Scanner un QR Code</h3>
                  <p className="text-sm text-ardoise-clair">
                    Activez la caméra pour scanner directement le QR code du citoyen
                  </p>
                  <Bouton
                    variante="primaire"
                    taille="grand"
                    onClick={() => setScanActif(true)}
                  >
                    📷 Activer la caméra
                  </Bouton>
                </>
              ) : (
                <div className="space-y-4">
                  <div ref={scannerRef} id="qr-reader" className="rounded-lg overflow-hidden" />
                  <Bouton
                    variante="ghost"
                    taille="petit"
                    onClick={() => {
                      setScanActif(false);
                      arreterScanner();
                    }}
                  >
                    ✕ Arrêter le scan
                  </Bouton>
                </div>
              )}
            </div>
          </Carte>

          {/* Séparateur */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-ardoise-clair/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-ardoise-clair">ou</span>
            </div>
          </div>

          {/* Formulaire de saisie manuelle */}
          <Carte>
            <form onSubmit={handleVerifier} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ardoise mb-2">
                  Saisie manuelle du token
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Collez le token ici..."
                  className="w-full px-4 py-3 border border-ardoise-clair/30 rounded-lg font-mono text-sm focus:ring-2 focus:ring-lagune focus:border-transparent"
                  disabled={chargement || scanActif}
                />
                <p className="text-xs text-ardoise-clair mt-1">
                  Le token se trouve sous le QR Code affiché sur le téléphone du citoyen.
                </p>
              </div>

              <Bouton
                variante="primaire"
                taille="grand"
                disabled={!token.trim() || chargement || scanActif}
                type="submit"
              >
                {chargement ? "Vérification..." : "🔍 Vérifier l'identité"}
              </Bouton>
            </form>
          </Carte>
        </>
      )}

      {/* Instructions */}
      <div className="bg-sable-clair rounded-lg p-4">
        <h4 className="text-sm font-semibold text-ardoise mb-2">
          📋 Procédure de contrôle
        </h4>
        <ol className="text-xs text-ardoise-clair space-y-1.5 list-decimal list-inside">
          <li>Demandez au citoyen d'ouvrir son QR Code DigiID</li>
          <li>Scannez le QR code avec la caméra OU copiez le token manuellement</li>
          <li>Comparez la photo affichée avec la personne devant vous</li>
          <li>Le QR Code sera automatiquement invalidé après cette vérification</li>
        </ol>
      </div>

      <Link href="/police/dashboard">
        <Bouton variante="ghost">← Retour à l'espace Police</Bouton>
      </Link>
    </div>
  );
}

// Composants utilitaires
function InfoLigne({
  label,
  valeur,
  monospace = false,
}: {
  label: string;
  valeur: string;
  monospace?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-ardoise-clair/10 last:border-0">
      <span className="text-sm text-ardoise-clair">{label}</span>
      <span
        className={`text-sm font-medium text-ardoise ${
          monospace ? "font-mono text-xs" : ""
        }`}
      >
        {valeur}
      </span>
    </div>
  );
}

function BadgeVerification({
  label,
  valide,
}: {
  label: string;
  valide: boolean;
}) {
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full font-medium ${
        valide
          ? "bg-vert/20 text-vert"
          : "bg-ardoise-clair/20 text-ardoise-clair"
      }`}
    >
      {valide ? "✓" : "✗"} {label}
    </span>
  );
}
