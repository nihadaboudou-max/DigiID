/**
 * Service API pour le module QR Code Dynamique.
 * Gère la génération et la vérification des QR codes temporaires.
 */
import { clientAPI, obtenirTokenAcces, ErreurAPI } from "./client_api";

export interface QRCodeGenere {
  token: string;
  qr_code_url: string;
  expire_a: string;
  duree_vie_secondes: number;
  message: string;
}

export interface CitoyenVerifie {
  digiid: string;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  photo_profil_url: string | null;
  est_cni_verifiee: boolean;
  est_visage_verifie: boolean;
  est_email_verifie: boolean;
}

export interface QRCodeVerification {
  succes: boolean;
  citoyen: CitoyenVerifie | null;
  message: string;
}

const URL_BASE = "/api/backend";

/**
 * Génère un nouveau QR Code temporaire pour le citoyen connecté.
 * L'ancien QR est automatiquement invalidé.
 */
export async function genererQRCode(): Promise<QRCodeGenere> {
  const token = obtenirTokenAcces();

  try {
    const reponse = await fetch(`${URL_BASE}/api/v1/utilisateur/qr/generer`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : { "Content-Type": "application/json" },
    });

    if (!reponse.ok) {
      let erreur: any = {};
      try { erreur = await reponse.json(); } catch {}
      throw new ErreurAPI(
        erreur.detail || "GENERATION_QR",
        erreur.detail || "Impossible de générer le QR Code.",
        reponse.status,
      );
    }

    return reponse.json();
  } catch (erreur: unknown) {
    if (erreur instanceof ErreurAPI) throw erreur;
    throw new ErreurAPI("RESEAU", "Erreur réseau lors de la génération du QR Code.", 0);
  }
}

/**
 * Vérifie un QR Code scanné par un agent de police.
 */
export async function verifierQRCode(token: string): Promise<QRCodeVerification> {
  const tokenAuth = obtenirTokenAcces();

  try {
    const reponse = await fetch(`${URL_BASE}/api/v1/police/qr/verifier/${token}`, {
      method: "POST",
      headers: tokenAuth ? { Authorization: `Bearer ${tokenAuth}` } : { "Content-Type": "application/json" },
    });

    if (!reponse.ok) {
      let erreur: any = {};
      try { erreur = await reponse.json(); } catch {}
      throw new ErreurAPI(
        erreur.detail || "VERIFICATION_QR",
        erreur.detail || "QR Code invalide ou expiré.",
        reponse.status,
      );
    }

    return reponse.json();
  } catch (erreur: unknown) {
    if (erreur instanceof ErreurAPI) throw erreur;
    throw new ErreurAPI("RESEAU", "Erreur réseau lors de la vérification.", 0);
  }
}