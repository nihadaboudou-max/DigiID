"use client";

import { useState, useEffect } from "react";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";

interface Mission {
  id: string;
  titre: string;
  description?: string;
  zone_intervention?: string;
  statut: "planifiee" | "en_cours" | "terminee" | "annulee";
  date_debut: string;
  date_fin?: string;
  date_creation: string;
  agents_assignes?: number;
}

interface GestionMissionsChefProps {
  titre: string;
  sousTitre: string;
  typeOrganisation: "police" | "medical" | "ong" | "enrolement";
}

export default function GestionMissionsChef({
  titre,
  sousTitre,
  typeOrganisation,
}: GestionMissionsChefProps) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");

  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    zone_intervention: "",
    date_debut: "",
    date_fin: "",
  });

  useEffect(() => {
    chargerMissions();
    const interval = setInterval(chargerMissions, 60000);
    return () => clearInterval(interval);
  }, []);

  async function chargerMissions() {
    setChargement(true);
    try {
      // TODO: Remplacer par un appel API réel
      setTimeout(() => {
        setMissions([
          {
            id: "1",
            titre: "Distribution de kits sanitaires",
            description: "Distribution de kits dans les quartiers défavorisés",
            zone_intervention: "Dakar, Parcelles Assainies",
            statut: "en_cours",
            date_debut: "2026-07-01",
            date_fin: "2026-07-15",
            date_creation: "2026-06-25",
            agents_assignes: 5,
          },
        ]);
        setChargement(false);
      }, 500);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement.");
      setChargement(false);
    }
  }

  async function handleCreer() {
    if (!formData.titre || !formData.date_debut) return;
    setSauvegarde(true);
    try {
      setTimeout(() => {
        setSauvegarde(false);
        setAfficherFormulaire(false);
        setFormData({
          titre: "",
          description: "",
          zone_intervention: "",
          date_debut: "",
          date_fin: "",
        });
        chargerMissions();
      }, 1000);
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la création.");
      setSauvegarde(false);
    }
  }

  const getBadgeStatut = (statut: string) => {
    const config: any = {
      planifiee: { couleur: "ocre", label: "Planifiée" },
      en_cours: { couleur: "lagune", label: "En cours" },
      terminee: { couleur: "succes", label: "Terminée" },
      annulee: { couleur: "terre", label: "Annulée" },
    };
    const cfg = config[statut] || { couleur: "neutre", label: statut };
    return <Badge variante={cfg.couleur} taille="petit">{cfg.label}</Badge>;
  };

  const missionsFiltrees =
    filtreStatut === "tous"
      ? missions
      : missions.filter((m) => m.statut === filtreStatut);

  return (
    <div className="min-h-screen space-y-6 apparition pb-20">
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          📋 Missions
        </p>
        <h1>{titre}</h1>
        <p className="text-ardoise-clair mt-2">{sousTitre}</p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Filtres et actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          className="px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
        >
          <option value="tous">Tous les statuts</option>
          <option value="planifiee">Planifiées</option>
          <option value="en_cours">En cours</option>
          <option value="terminee">Terminées</option>
          <option value="annulee">Annulées</option>
        </select>
        <div className="flex-1"></div>
        <Bouton variante="primaire" onClick={() => setAfficherFormulaire(true)}>
          + Nouvelle mission
        </Bouton>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-ocre">
            {missions.filter((m) => m.statut === "planifiee").length}
          </p>
          <p className="text-xs text-ardoise-clair">Planifiées</p>
        </Carte>
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-lagune">
            {missions.filter((m) => m.statut === "en_cours").length}
          </p>
          <p className="text-xs text-ardoise-clair">En cours</p>
        </Carte>
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-succes">
            {missions.filter((m) => m.statut === "terminee").length}
          </p>
          <p className="text-xs text-ardoise-clair">Terminées</p>
        </Carte>
        <Carte className="text-center p-4">
          <p className="text-2xl font-bold text-terre">
            {missions.filter((m) => m.statut === "annulee").length}
          </p>
          <p className="text-xs text-ardoise-clair">Annulées</p>
        </Carte>
      </div>

      {/* Liste des missions */}
      <Carte titre={`${missionsFiltrees.length} mission(s)`}>
        {chargement ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-ardoise-clair italic">Chargement...</p>
          </div>
        ) : missionsFiltrees.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-ardoise-clair italic">
              Aucune mission planifiée.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {missionsFiltrees.map((mission) => (
              <div
                key={mission.id}
                className="p-4 bg-sable rounded-lg hover:bg-sable/80 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-bold text-ardoise">{mission.titre}</h3>
                      {getBadgeStatut(mission.statut)}
                    </div>
                    {mission.description && (
                      <p className="text-sm text-ardoise-clair mt-1">
                        {mission.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-ardoise-clair">
                      {mission.zone_intervention && (
                        <span>📍 {mission.zone_intervention}</span>
                      )}
                      {mission.agents_assignes && (
                        <span>👥 {mission.agents_assignes} agent(s)</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-ardoise-clair pt-3 border-t border-ardoise-clair/10">
                  <span>
                    📅 Début:{" "}
                    {new Date(mission.date_debut).toLocaleDateString("fr-FR")}
                  </span>
                  {mission.date_fin && (
                    <span>
                      📅 Fin:{" "}
                      {new Date(mission.date_fin).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {/* Modal de création - CORRIGÉ : Plein écran */}
      {afficherFormulaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header sticky */}
            <div className="sticky top-0 bg-white border-b border-ardoise-clair/10 p-6 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-ardoise">
                  📋 Nouvelle mission
                </h2>
                <button
                  onClick={() => setAfficherFormulaire(false)}
                  className="text-ardoise-clair hover:text-ardoise transition-colors text-2xl leading-none"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Contenu */}
            <div className="p-6 space-y-4">
              <ChampSaisie
                libelle="Titre de la mission"
                value={formData.titre}
                onChange={(e) =>
                  setFormData({ ...formData, titre: e.target.value })
                }
                placeholder="Ex: Distribution de kits sanitaires"
                required
              />
              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                  rows={4}
                  placeholder="Décrivez la mission..."
                />
              </div>
              <ChampSaisie
                libelle="Zone d'intervention"
                value={formData.zone_intervention}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    zone_intervention: e.target.value,
                  })
                }
                placeholder="Ex: Dakar, Thiès..."
              />
              <div className="grid grid-cols-2 gap-3">
                <ChampSaisie
                  libelle="Date de début"
                  type="date"
                  value={formData.date_debut}
                  onChange={(e) =>
                    setFormData({ ...formData, date_debut: e.target.value })
                  }
                  required
                />
                <ChampSaisie
                  libelle="Date de fin (optionnelle)"
                  type="date"
                  value={formData.date_fin}
                  onChange={(e) =>
                    setFormData({ ...formData, date_fin: e.target.value })
                  }
                />
              </div>

              {/* Footer avec boutons */}
              <div className="flex gap-3 pt-4 border-t border-ardoise-clair/10">
                <Bouton
                  variante="primaire"
                  chargement={sauvegarde}
                  onClick={handleCreer}
                  className="flex-1"
                >
                  Créer la mission
                </Bouton>
                <Bouton
                  variante="ghost"
                  onClick={() => setAfficherFormulaire(false)}
                >
                  Annuler
                </Bouton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}