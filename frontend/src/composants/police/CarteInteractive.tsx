"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PointCarte } from "@/services/police";

// Correction des icônes Leaflet avec Next.js
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x.src,
  iconUrl: markerIcon.src,
  shadowUrl: markerShadow.src,
});

interface CarteInteractiveProps {
  points: PointCarte[];
  centreLat?: number;
  centreLng?: number;
  zoom?: number;
  filtreType?: string | null;
}

// Couleurs par type de point
const COULEURS_PAR_TYPE: Record<string, string> = {
  verification: "#0e7490", // lagune
  signalement: "#b91c1c", // terre
  controle: "#b45309", // ocre
  arrestation: "#7c2d12",
  default: "#64748b",
};

// Icônes par type
const ICONES_PAR_TYPE: Record<string, string> = {
  verification: "🔍",
  signalement: "🚨",
  controle: "📍",
  arrestation: "🚔",
  default: "📌",
};

export default function CarteInteractive({
  points,
  centreLat = 14.7167,
  centreLng = -17.4677,
  zoom = 12,
  filtreType = null,
}: CarteInteractiveProps) {
  const carteRef = useRef<HTMLDivElement>(null);
  const carteInstanceRef = useRef<L.Map | null>(null);
  const marqueursRef = useRef<L.LayerGroup | null>(null);
  const [positionAgent, setPositionAgent] = useState<[number, number] | null>(null);

  // Géolocalisation de l'agent
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPositionAgent([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          // Silencieux si refusé
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Initialisation de la carte
  useEffect(() => {
    if (!carteRef.current || carteInstanceRef.current) return;

    const carte = L.map(carteRef.current).setView([centreLat, centreLng], zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(carte);

    // Position de l'agent (cercle bleu)
    if (positionAgent) {
      L.circleMarker(positionAgent, {
        radius: 10,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.5,
        weight: 2,
      })
        .bindPopup("<strong>👮 Votre position</strong>")
        .addTo(carte);

      // Cercle de rayon 500m autour de l'agent
      L.circle(positionAgent, {
        radius: 500,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.1,
        weight: 1,
        dashArray: "5, 5",
      }).addTo(carte);
    }

    // Layer group pour les marqueurs
    marqueursRef.current = L.layerGroup().addTo(carte);
    carteInstanceRef.current = carte;

    return () => {
      carte.remove();
      carteInstanceRef.current = null;
    };
  }, [centreLat, centreLng, zoom, positionAgent]);

  // Mise à jour des marqueurs quand les points changent
  useEffect(() => {
    if (!marqueursRef.current) return;
    marqueursRef.current.clearLayers();

    const pointsFiltres = filtreType
      ? points.filter((p) => p.type === filtreType)
      : points;

    pointsFiltres.forEach((point) => {
      const couleur = COULEURS_PAR_TYPE[point.type] || COULEURS_PAR_TYPE.default;
      const icone = ICONES_PAR_TYPE[point.type] || ICONES_PAR_TYPE.default;

      // Marqueur personnalisé avec icône colorée
      const marqueurIcon = L.divIcon({
        html: `<div style="background:${couleur};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
          <span style="transform:rotate(45deg);font-size:14px;">${icone}</span>
        </div>`,
        className: "marqueur-personnalise",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const popup = `
        <div style="min-width:200px;">
          <div style="font-weight:bold;color:${couleur};margin-bottom:5px;">
            ${icone} ${point.titre}
          </div>
          <div style="font-size:12px;color:#64748b;margin-bottom:8px;">
            ${point.adresse || "Adresse non précisée"}
          </div>
          <div style="font-size:11px;color:#94a3b8;">
            📅 ${new Date(point.date || Date.now()).toLocaleString("fr-FR")}
          </div>
          ${point.description ? `<div style="margin-top:8px;font-size:12px;">${point.description}</div>` : ""}
          ${point.verification_id ? `
            <a href="/police/verification?id=${point.verification_id}" 
               style="display:inline-block;margin-top:10px;padding:5px 10px;background:${couleur};color:white;text-decoration:none;border-radius:4px;font-size:12px;">
              Voir détails →
            </a>
          ` : ""}
        </div>
      `;

      L.marker([point.lat, point.lng], { icon: marqueurIcon })
        .bindPopup(popup)
        .addTo(marqueursRef.current!);
    });

    // Ajuster la vue pour voir tous les marqueurs
    if (pointsFiltres.length > 0 && carteInstanceRef.current) {
      const bounds = L.latLngBounds(pointsFiltres.map((p) => [p.lat, p.lng]));
      carteInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [points, filtreType]);

  return (
    <div
      ref={carteRef}
      className="w-full h-[500px] rounded-lg overflow-hidden border border-ardoise-clair/20"
      style={{ zIndex: 0 }}
    />
  );
}