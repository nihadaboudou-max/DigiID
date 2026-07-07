"use client";

import { useState, useEffect } from "react";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Modal } from "@/composants/commun/Modal";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";

interface Rapport {
  id: string;
  titre: string;
  type: string;
  date_creation: string;
  statut: "brouillon" | "valide" | "archive";
}

interface RapportsChefProps {
  titre: string;
  sousTitre: string;
  typeOrganisation: string;
}

export default function RapportsChef({
  titre,
  sousTitre,
  typeOrganisation,
}: RapportsChefProps) {
  const [rapports, setRapports] = useState<Rapport[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);

  const [formData, setFormData] = useState({
    titre: "",
    type: "activite",
    description: "",
  });

  useEffect(() => {
    chargerRapports();
  }, []);

  async function chargerRapports() {
    setChargement(true);
    // Simulation
    setTimeout(() => {
      setRapports([
        {
          id: "1",
          titre: "Rapport d'activité - Juin 2026",
          type: "activite",
          date_creation: "2026-06-30",
          statut: "valide",
        },
      ]);
      setChargement(false);
    }, 500);
  }

  async function handleCreer() {
    if (!formData.titre) return;
    setSauvegarde(true);
    setTimeout(() => {
      setSauvegarde(false);
      setAfficherFormulaire(false);
      setFormData({ titre: "", type: "activite", description: "" });
      chargerRapports();
    }, 1000);
  }

  const getBadgeStatut = (statut: string) => {
    const config: any = {
      brouillon: { couleur: "neutre", label: "Brouillon" },
      valide: { couleur: "succes", label: "Validé" },
      archive: { couleur: "ocre", label: "Archivé" },
    };
    const cfg = config[statut] || { couleur: "neutre", label: statut };
    return <Badge variante={cfg.couleur} taille="petit">{cfg.label}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const types: any = {
      activite: "Activité",
      mission: "Mission",
      financier: "Financier",
      beneficiaires: "Bénéficiaires",
    };
    return types[type] || type;
  };

  return (
    <div className="space-y-6 apparition">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Rapports</p>
        <h1>{titre}</h1>
        <p className="text-ardoise-clair mt-2">{sousTitre}</p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="flex justify-end">
        <Bouton variante="primaire" onClick={() => setAfficherFormulaire(true)}>
          + Nouveau rapport
        </Bouton>
      </div>

      <Carte titre={`${rapports.length} rapport(s)`}>
        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
        ) : rapports.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📄</p>
            <p className="text-ardoise-clair italic">Aucun rapport disponible.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rapports.map((rapport) => (
              <div
                key={rapport.id}
                className="flex items-center justify-between p-4 bg-sable rounded-lg hover:bg-sable/80 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-lagune/10 flex items-center justify-center text-lagune flex-shrink-0">
                    📄
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ardoise truncate">{rapport.titre}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-ardoise-clair">{getTypeLabel(rapport.type)}</span>
                      <span className="text-ardoise-clair">•</span>
                      <span className="text-xs text-ardoise-clair">
                        {new Date(rapport.date_creation).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ml-4">{getBadgeStatut(rapport.statut)}</div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {afficherFormulaire && (
        <Modal
          ouvert={true}
          titre="Nouveau rapport"
          surFermeture={() => setAfficherFormulaire(false)}
        >
          <div className="space-y-4">
            <ChampSaisie
              libelle="Titre du rapport"
              value={formData.titre}
              onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
              placeholder="Ex: Rapport mensuel d'activité"
              required
            />
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Type de rapport
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              >
                <option value="activite">Activité</option>
                <option value="mission">Mission</option>
                <option value="financier">Financier</option>
                <option value="beneficiaires">Bénéficiaires</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
                rows={4}
                placeholder="Décrivez le contenu du rapport..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Bouton variante="primaire" chargement={sauvegarde} onClick={handleCreer}>
                Créer le rapport
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