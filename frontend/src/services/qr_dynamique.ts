/**
 * Service API pour le module QR Code Dynamique.
 * Gère la génération et la vérification des QR codes temporaires.
 */
import { clientAPI } from "./client_api";

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

/**
 * Génère un nouveau QR Code temporaire pour le citoyen connecté.
 * L'ancien QR est automatiquement invalidé.
 */
export async function genererQRCode(): Promise<QRCodeGenere> {
  return clientAPI.post<QRCodeGenere>(
    "/api/v1/utilisateur/qr/generer",
    undefined,
    { authentifie: true }
  );
}

/**
 * Vérifie un QR Code scanné par un agent de police.
 * Utilise clientAPI pour bénéficier du rafraîchissement automatique
 * du JWT et de la gestion d'erreurs uniforme.
 */
export async function verifierQRCode(token: string): Promise<QRCodeVerification> {
  return clientAPI.post<QRCodeVerification>(
    `/api/v1/police/qr/verifier/${encodeURIComponent(token)}`,
    undefined,
    { authentifie: true }
  );
}