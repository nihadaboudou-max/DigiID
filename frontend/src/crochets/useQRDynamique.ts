/**
 * Hook personnalisé pour gérer le QR Code dynamique.
 * Règles de sécurité :
 * - Auto-réinitialisation toutes les 30 secondes
 * - Invalidation à chaque changement de visibilité
 * - Invalidation à chaque navigation
 */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { genererQRCode, type QRCodeGenere } from "@/services/qr_dynamique";

const DUREE_VIE = 30; // secondes

export function useQRDynamique() {
  const [qrCode, setQrCode] = useState<QRCodeGenere | null>(null);
  const [tempsRestant, setTempsRestant] = useState(DUREE_VIE);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Génère un nouveau QR Code
  const genererNouveauQR = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const resultat = await genererQRCode();
      setQrCode(resultat);
      setTempsRestant(DUREE_VIE);
    } catch (err: any) {
      setErreur(err.message || "Erreur lors de la génération du QR Code.");
    } finally {
      setChargement(false);
    }
  }, []);

  // Timer de compte à rebours
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setTempsRestant((prev) => {
        if (prev <= 1) {
          // Auto-réinitialisation
          genererNouveauQR();
          return DUREE_VIE;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [genererNouveauQR]);

  // Rafraîchir quand la page redevient visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        genererNouveauQR();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [genererNouveauQR]);

  // Rafraîchir à chaque navigation (montage du composant)
  useEffect(() => {
    genererNouveauQR();
  }, [genererNouveauQR]);

  return {
    qrCode,
    tempsRestant,
    chargement,
    erreur,
    rafraichir: genererNouveauQR,
  };
}