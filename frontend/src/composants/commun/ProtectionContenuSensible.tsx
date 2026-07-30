"use client";

import React, { useEffect, useState, useRef } from "react";

interface ProtectionContenuSensibleProps {
  children: React.ReactNode;
  /** Identifiant à afficher dans le filigrane (ex: DigiID ou Email) */
  identifiantFiligrane?: string;
  /** Niveau de protection : 'normal' (filigrane) | 'strict' (masquage au focus) */
  niveau?: "normal" | "strict";
}

export default function ProtectionContenuSensible({
  children,
  identifiantFiligrane = "CONFIDENTIEL",
  niveau = "strict",
}: ProtectionContenuSensibleProps) {
  const [estVisible, setEstVisible] = useState(true);
  const conteneurRef = useRef<HTMLDivElement>(null);

  // 1. Masquer le contenu si l'utilisateur quitte la fenêtre (outil de capture)
  useEffect(() => {
    if (niveau !== "strict") return;

    const gererChangementVisibilite = () => {
      if (document.hidden) {
        setEstVisible(false);
      } else {
        const timeout = setTimeout(() => setEstVisible(true), 800);
        return () => clearTimeout(timeout);
      }
    };

    document.addEventListener("visibilitychange", gererChangementVisibilite);
    window.addEventListener("blur", () => setEstVisible(false));
    window.addEventListener("focus", () => {
      setTimeout(() => setEstVisible(true), 800);
    });

    return () => {
      document.removeEventListener("visibilitychange", gererChangementVisibilite);
      window.removeEventListener("blur", () => setEstVisible(false));
      window.removeEventListener("focus", () => setEstVisible(true));
    };
  }, [niveau]);

  // 2. Empêcher le clic droit et le menu contextuel
  useEffect(() => {
    const element = conteneurRef.current;
    if (!element) return;

    const preventContextMenu = (e: Event) => {
      e.preventDefault();
      return false;
    };

    element.addEventListener("contextmenu", preventContextMenu);
    
    // Empêcher le drag sur les images
    const images = element.querySelectorAll("img");
    images.forEach((img) => {
      img.addEventListener("dragstart", (e) => e.preventDefault());
      img.setAttribute("draggable", "false");
    });

    return () => {
      element.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);

  return (
    <div
      ref={conteneurRef}
      className="relative overflow-hidden select-none"
      onDragStart={(e) => e.preventDefault()}
      // ✅ CORRECTION : Style simplifié sans WebkitUserDrag
      style={{ userSelect: "none" }}
    >
      {/* Contenu protégé */}
      <div
        className={`transition-all duration-300 ${
          estVisible ? "opacity-100 blur-0" : "opacity-0 blur-xl scale-95"
        }`}
      >
        {children}
      </div>

      {/* Couche de masquage si perte de focus */}
      {!estVisible && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-sable/80 backdrop-blur-md">
          <div className="text-center p-6">
            <p className="text-4xl mb-2"></p>
            <p className="text-ardoise font-semibold">Contenu masqué</p>
            <p className="text-xs text-ardoise-clair mt-1">
              Revenez sur cette fenêtre pour afficher vos informations.
            </p>
          </div>
        </div>
      )}

      {/* Filigrane dynamique (Watermark) */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden opacity-[0.07]">
        {/* Motif en arrière-plan */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 100px, #000 100px, #000 101px), repeating-linear-gradient(-45deg, transparent, transparent 100px, #000 100px, #000 101px)`,
            backgroundSize: '200px 200px'
          }}
        />
        {/* Texte centralisé et répété */}
        <div className="absolute inset-0 flex flex-wrap content-center justify-center gap-12 rotate-[-15deg] scale-150">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="text-2xl font-bold text-ardoise whitespace-nowrap">
              {identifiantFiligrane} • {new Date().toLocaleDateString()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}