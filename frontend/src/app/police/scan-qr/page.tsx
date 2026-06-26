"use client";

/**
 * Page carte géographique des vérifications police.
 * Affiche sur une carte les points de vérification récents.
 * Utilise une carte Leaflet-like simplifiée (OpenStreetMap via iframe).
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { obtenirPointsCarte } from "@/services/police";
import type { PointCarte } from "@/services/police";

export default function PageCarte() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [points, setPoints] = useState<PointCarte[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [centreLat, setCentreLat] = useState<number | null>(14.7167); // Dakar par défaut
  const [centreLng, setCentreLng] = useState<number | null>(-17.4677);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const data = await obtenirPointsCarte({ limite: 100 });
      setPoints(data.points || []);
      if (data.centre_lat && data.centre_lng) {
        setCentreLat(data.centre_lat);
        setCentreLng(data.centre_lng);
      }
    } catch {
      setErreur("Impossible de charger les données géographiques.");
    } finally {
      setChargement(false);
    }
  }

  function genererUrlCarte(): string {
    const lat = centreLat ?? 14.7167;
    const lng = centreLng ?? -17.4677;
    const zoom = 12;

    // Marqueurs sur la carte via query params OpenStreetMap
    let url = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.1},${lat - 0.1},${lng + 0.1},${lat + 0.1}&layer=mapnik&marker=${lat},${lng}`;

    // Ajouter les marqueurs additionnels
    if (points.length > 0) {
      const marqueurs = points
        .slice(0, 10)
        .map(p => `&marker=${p.lat},${p.lng}`)
        .join("");
      url += marqueurs;
    }

    return url;
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Carte géographique</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>
          <h1 className="mt-1">Carte des vérifications</h1>
          <p className="text-ardoise-clair mt-1">Visualise les vérifications d'identité par zone géographique.</p>
        </div>
        <Bouton variante="ghost" taille="petit" onClick={charger} chargement={chargement}>
          🔄 Actualiser
        </Bouton>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">{chargement ? "..." : points.length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Points sur la carte</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-ocre">{points.filter(p => p.type === "verification").length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Vérifications</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">{points.filter(p => p.type === "signalement").length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Signalements</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">{points.filter(p => p.type === "controle").length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Contrôles</p>
        </div>
      </div>

      {/* Carte */}
      <Carte>
        {chargement ? (
          <div className="h-96 flex items-center justify-center">
            <p className="text-ardoise-clair italic">Chargement de la carte...</p>
          </div>
        ) : erreur ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl mb-3">🗺️</p>
              <p className="text-terre text-sm mb-3">{erreur}</p>
              <Bouton variante="ghost" taille="petit" onClick={charger}>Réessayer</Bouton>
            </div>
          </div>
        ) : (
          <div className="w-full h-[500px] rounded-lg overflow-hidden border border-ardoise-clair/20">
            <iframe
              title="Carte des vérifications"
              src={genererUrlCarte()}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
            />
          </div>
        )}
        <p className="text-xs text-ardoise-clair mt-2">
          Carte OpenStreetMap · {points.length} point(s) affiché(s)
          {points.length > 10 && " (10 premiers marqueurs affichés)"}
        </p>
      </Carte>

      {/* Liste des points */}
      {points.length > 0 && (
        <Carte titre="Points récents">
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {points.map((point, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-sable rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {point.type === "verification" ? "🔍" : point.type === "signalement" ? "🚨" : "📍"}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ardoise">{point.titre}</p>
                    <p className="text-xs text-ardoise-clair">{point.adresse || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variante={point.type === "verification" ? "lagune" : point.type === "signalement" ? "terre" : "ocre"} taille="petit">
                    {point.type}
                  </Badge>
                  <Link
                    href={`/police/verification?id=${point.verification_id}`}
                    className="text-xs text-ocre hover:underline"
                  >
                    Voir →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Carte>
      )}

      <Link href="/police/dashboard">
        <Bouton variante="ghost">← Retour au dashboard</Bouton>
      </Link>
    </div>
  );
}
