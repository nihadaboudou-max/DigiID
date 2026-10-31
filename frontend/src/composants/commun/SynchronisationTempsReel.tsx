"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { obtenirTokenAcces } from "@/services/client_api";

const INTERVALLE_SECOURS_MS = 30_000;

export function SynchronisationTempsReel() {
  const router = useRouter();
  const derniereVersion = useRef<string | null>(null);
  const rechargementProgramme = useRef(false);

  useEffect(() => {
    const token = obtenirTokenAcces();
    if (!token) return;

    let websocket: WebSocket | null = null;
    let intervalle: ReturnType<typeof setInterval> | null = null;

    const recharger = () => {
      if (rechargementProgramme.current) return;
      rechargementProgramme.current = true;
      // L'événement est envoyé avant la fin de certaines transactions.
      // Un court délai évite de relire une donnée encore en écriture.
      window.setTimeout(() => {
        router.refresh();
        window.location.reload();
      }, 800);
    };

    const connecter = () => {
      const protocole = window.location.protocol === "https:" ? "wss:" : "ws:";
      const baseBackend = process.env.NEXT_PUBLIC_URL_BACKEND;
      const origine = baseBackend
        ? baseBackend.replace(/^http/, protocole).replace(/\/$/, "")
        : `${protocole}//${window.location.host}`;
      websocket = new WebSocket(
        `${origine}/api/v1/temps-reel/ws?token=${encodeURIComponent(token)}`,
      );
      websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as { type?: string };
          if (message.type === "donnees_modifiees") recharger();
        } catch {
          // Les messages inconnus ne doivent pas interrompre la connexion.
        }
      };
      websocket.onclose = () => {
        websocket = null;
      };
    };

    const verifierVersion = async () => {
      try {
        const reponse = await fetch("/api/v1/temps-reel/version", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!reponse.ok) return;
        const donnees = (await reponse.json()) as { version?: string };
        if (derniereVersion.current === null) {
          derniereVersion.current = donnees.version ?? null;
        } else if (donnees.version && donnees.version !== derniereVersion.current) {
          derniereVersion.current = donnees.version;
          recharger();
        }
      } catch {
        // Le prochain contrôle réessaiera sans perturber la page.
      }
    };

    connecter();
    intervalle = setInterval(verifierVersion, INTERVALLE_SECOURS_MS);
    void verifierVersion();

    return () => {
      if (intervalle) clearInterval(intervalle);
      websocket?.close();
    };
  }, [router]);

  return null;
}
