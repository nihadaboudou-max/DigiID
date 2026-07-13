"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { obtenirPointsCarte } from "@/services/police";
import type { PointCarte } from "@/services/police";

// Import dynamique pour éviter les erreurs SSR avec Leaflet
const CarteInteractive = dynamic(
  () => import("@/composants/police/CarteInteractive"),
  { ssr: false, loading: () => <div className="h-96 flex items-center justify-center bg-sable rounded-lg">Chargement de la carte...</div> }
);

export default function PageCarte() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [points, setPoints] = useState<PointCarte[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [filtreType, setFiltreType] = useState<string | null>(null);
  const [rayon, setRayon] = useState<number>(5000); // 5km par défaut
  const [positionAgent, setPositionAgent] = useState<[number, number] | null>(null);

  useEffect(() => {
    charger();
    // Géolocalisation de l'agent
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setPositionAgent([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const params: any = { limite: 200 };
      if (filtreType) params.type = filtreType;
      if (positionAgent) {
        params.lat = positionAgent[0];
        params.lng = positionAgent[1];
        params.rayon_km = rayon / 1000;
      }
      const data = await obtenirPointsCarte(params);
      setPoints(data.points || []);
    } catch {
      setErreur("Impossible de charger les données géographiques.");
    } finally {
      setChargement(false);
    }
  }

  const stats = {
    total: points.length,
    verification: points.filter((p) => p.type === "verification").length,
    signalement: points.filter((p) => p.type === "signalement").length,
    controle: points.filter((p) => p.type === "controle").length,
  };

  return (
    <div className="space-y-6 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2 flex-wrap">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Carte géographique</span>
      </nav>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-ocre text-sm font-semibold uppercase tracking-wider">Forces de l'ordre</p>
          <h1 className="mt-1">Carte des vérifications</h1>
          <p className="text-ardoise-clair mt-1">Visualisation en temps réel des contrôles par zone.</p>
        </div>
        <div className="flex gap-2">
          <Bouton variante="ghost" taille="petit" onClick={charger} chargement={chargement}>
            🔄 Actualiser
          </Bouton>
        </div>
      </div>

      {/* Filtres */}
      <Carte>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-semibold text-ardoise">Filtrer :</span>
          {[
            { type: null, label: "Tous", icone: "🗺️" },
            { type: "verification", label: "Vérifications", icone: "🔍" },
            { type: "signalement", label: "Signalements", icone: "🚨" },
            { type: "controle", label: "Contrôles", icone: "📍" },
          ].map((f) => (
            <button
              key={f.type || "tous"}
              onClick={() => setFiltreType(f.type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filtreType === f.type
                  ? "bg-lagune text-white shadow"
                  : "bg-sable text-ardoise hover:bg-sable-fonce"
              }`}
            >
              {f.icone} {f.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-ardoise-clair">Rayon :</label>
            <select
              value={rayon}
              onChange={(e) => setRayon(Number(e.target.value))}
              className="px-2 py-1 text-sm border border-ardoise-clair/20 rounded"
            >
              <option value={1000}>1 km</option>
              <option value={5000}>5 km</option>
              <option value={10000}>10 km</option>
              <option value={25000}>25 km</option>
              <option value={50000}>50 km</option>
            </select>
          </div>
        </div>
      </Carte>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">{chargement ? "..." : stats.total}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Total</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">{stats.verification}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">🔍 Vérifications</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">{stats.signalement}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">🚨 Signalements</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-ocre">{stats.controle}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">📍 Contrôles</p>
        </div>
      </div>

      {/* Carte interactive */}
      <Carte>
        {erreur ? (
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl mb-3">🗺️</p>
              <p className="text-terre text-sm mb-3">{erreur}</p>
              <Bouton variante="ghost" taille="petit" onClick={charger}>Réessayer</Bouton>
            </div>
          </div>
        ) : (
          <CarteInteractive
            points={points}
            filtreType={filtreType}
            centreLat={positionAgent?.[0] || 14.7167}
            centreLng={positionAgent?.[1] || -17.4677}
          />
        )}
        <div className="flex justify-between items-center mt-3 text-xs text-ardoise-clair">
          <span>
            {points.length} point(s) affiché(s)
            {filtreType && ` · filtre: ${filtreType}`}
          </span>
          <span>
            {positionAgent ? `📍 Centré sur votre position` : "📍 Position non disponible"}
          </span>
        </div>
      </Carte>

      {/* Liste des points */}
      {points.length > 0 && (
        <Carte titre="Points récents">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {points.slice(0, 50).map((point, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-sable rounded-lg hover:bg-sable-fonce transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-lg flex-shrink-0">
                    {point.type === "verification" ? "🔍" : point.type === "signalement" ? "🚨" : "📍"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ardoise truncate">{point.titre}</p>
                    <p className="text-xs text-ardoise-clair truncate">
                      {point.adresse || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}
                    </p>
                    <p className="text-[10px] text-ardoise-clair/70 mt-0.5">
                      {new Date(point.date || Date.now()).toLocaleString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <Badge
                    variante={point.type === "verification" ? "lagune" : point.type === "signalement" ? "terre" : "ocre"}
                    taille="petit"
                  >
                    {point.type}
                  </Badge>
                  {point.verification_id && (
                    <Link
                      href={`/police/verification?id=${point.verification_id}`}
                      className="text-xs text-ocre hover:underline font-semibold"
                    >
                      Voir →
                    </Link>
                  )}
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