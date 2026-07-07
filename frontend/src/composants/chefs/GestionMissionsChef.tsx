"use client";

import { useState, useEffect } from "react";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Modal } from "@/composants/commun/Modal";
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
}

interface GestionMissionsChefProps {
  titre: string;
  sousTitre: string;
  typeOrganisation: string;
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

  const [formData, setFormData] = useState({
    titre: "",
    description: "",
    zone_intervention: "",
    date_debut: "",
    date_fin: "",
  });

  useEffect(() => {
    chargerMissions();
  }, []);

  async function chargerMissions() {
    setChargement(true);
    // Simulation - à remplacer par un appel API réel
    setTimeout(() => {
      setMissions([]);
      setChargement(false);
    }, 500);
  }

  async function handleCreer() {
    if (!formData.titre || !formData.date_debut) return;
    setSauvegarde(true);
    // Simulation création
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

  return (
    <div className="space-y-6 apparition">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Missions</p>
        <h1>{titre}</h1>
        <p className="text-ardoise-clair mt-2">{sousTitre}</p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="flex justify-end">
        <Bouton variante="primaire" onClick={() => setAfficherFormulaire(true)}>
          + Nouvelle mission
        </Bouton>
      </div>

      <Carte titre={`${missions.length} mission(s)`}>
        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
        ) : missions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-ardoise-clair italic">Aucune mission planifiée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((mission) => (
              <div
                key={mission.id}
                className="p-4 bg-sable rounded-lg hover:bg-sable/80 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-ardoise">{mission.titre}</h3>
                    {mission.description && (
                      <p className="text-sm text-ardoise-clair mt-1">{mission.description}</p>
                    )}
                    {mission.zone_intervention && (
                      <p className="text-xs text-ardoise-clair mt-1">
                        📍 {mission.zone_intervention}
                      </p>
                    )}
                  </div>
                  <div className="ml-4">{getBadgeStatut(mission.statut)}</div>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-ardoise-clair">
                  <span>📅 Début: {new Date(mission.date_debut).toLocaleDateString("fr-FR")}</span>
                  {mission.date_fin && (
                    <span>📅 Fin: {new Date(mission.date_fin).toLocaleDateString("fr-FR")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {afficherFormulaire && (
        <Modal
          ouvert={true}
          titre="Nouvelle mission"
          surFermeture={() => setAfficherFormulaire(false)}
        >
          <div className="space-y-4">
            <ChampSaisie
              libelle="Titre de la mission"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Ex: Distribution de kits sanitaires"
              required
            />
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
                rows={3}
                placeholder="Décrivez la mission..."
              />
            </div>
            <ChampSaisie
              libelle="Zone d'intervention"
              value={formData.zone_intervention}
              onChange={(e) => setFormData({ ...formData, zone_intervention: e.target.value })}
              placeholder="Ex: Dakar, Thiès..."
            />
            <div className="grid grid-cols-2 gap-3">
              <ChampSaisie
                libelle="Date de début"
                type="date"
                value={formData.date_debut}
                onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                required
              />
              <ChampSaisie
                libelle="Date de fin (optionnelle)"
                type="date"
                value={formData.date_fin}
                onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Bouton variante="primaire" chargement={sauvegarde} onClick={handleCreer}>
                Créer la mission
              </Bouton>
              <Bouton variante="ghost" onClick={() => setAfficherFormulaire(false)}>
                Annuler
              </Bouton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}