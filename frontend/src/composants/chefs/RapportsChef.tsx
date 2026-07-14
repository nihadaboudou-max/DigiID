"use client";

import { useState, useEffect } from "react";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import {
  listerRapports,
  creerRapport,
  supprimerRapport,
  validerRapport,
  archiverRapport,
  type Rapport,
} from "@/services/rapports";

interface RapportsChefProps {
  titre: string;
  sousTitre: string;
  typeOrganisation: "police" | "medical" | "ong" | "enrolement";
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
  const [filtreType, setFiltreType] = useState<string>("tous");
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [recherche, setRecherche] = useState("");

  const [formData, setFormData] = useState({
    titre: "",
    type: "activite" as "activite" | "mission" | "financier" | "beneficiaires",
    description: "",
  });

  useEffect(() => {
    chargerRapports();
  }, [typeOrganisation]);

  async function chargerRapports() {
    setChargement(true);
    setErreur("");
    try {
      const params: any = { par_page: 100 };
      if (filtreType !== "tous") params.type = filtreType;
      if (filtreStatut !== "tous") params.statut = filtreStatut;

      const data = await listerRapports(typeOrganisation, params);
      setRapports(data.rapports || []);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des rapports.");
    } finally {
      setChargement(false);
    }
  }

  async function handleCreer() {
    if (!formData.titre) {
      setErreur("Le titre est obligatoire.");
      return;
    }
    setSauvegarde(true);
    setErreur("");
    try {
      await creerRapport(typeOrganisation, formData);
      setAfficherFormulaire(false);
      setFormData({ titre: "", type: "activite", description: "" });
      await chargerRapports();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la création du rapport.");
    } finally {
      setSauvegarde(false);
    }
  }

  async function handleSupprimer(rapportId: string) {
    if (!confirm("Supprimer ce rapport ?")) return;
    try {
      await supprimerRapport(typeOrganisation, rapportId);
      await chargerRapports();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la suppression.");
    }
  }

  async function handleValider(rapportId: string) {
    try {
      await validerRapport(typeOrganisation, rapportId);
      await chargerRapports();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la validation.");
    }
  }

  async function handleArchiver(rapportId: string) {
    try {
      await archiverRapport(typeOrganisation, rapportId);
      await chargerRapports();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de l'archivage.");
    }
  }

  const getBadgeStatut = (statut: string) => {
    const config: Record<string, { couleur: any; label: string }> = {
      brouillon: { couleur: "lagune", label: "Brouillon" },
      valide: { couleur: "succes", label: "Validé" },
      archive: { couleur: "ocre", label: "Archivé" },
    };
    const cfg = config[statut] || { couleur: "lagune", label: statut };
    return <Badge variante={cfg.couleur} taille="petit">{cfg.label}</Badge>;
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      activite: "📋 Activité",
      mission: "🎯 Mission",
      financier: "💰 Financier",
      beneficiaires: " Bénéficiaires",
    };
    return types[type] || type;
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      activite: "📋",
      mission: "🎯",
      financier: "💰",
      beneficiaires: "👥",
    };
    return icons[type] || "📄";
  };

  const rapportsFiltres = rapports.filter((rapport) => {
    const matchType = filtreType === "tous" || rapport.type === filtreType;
    const matchStatut =
      filtreStatut === "tous" || rapport.statut === filtreStatut;
    const matchRecherche =
      recherche.trim() === "" ||
      rapport.titre.toLowerCase().includes(recherche.toLowerCase()) ||
      (rapport.description || "")
        .toLowerCase()
        .includes(recherche.toLowerCase()) ||
      rapport.auteur.toLowerCase().includes(recherche.toLowerCase());
    return matchType && matchStatut && matchRecherche;
  });

  const statsRapports = {
    total: rapports.length,
    brouillons: rapports.filter((r) => r.statut === "brouillon").length,
    valides: rapports.filter((r) => r.statut === "valide").length,
    archives: rapports.filter((r) => r.statut === "archive").length,
  };

  return (
    <div className="min-h-screen space-y-6 apparition pb-20">
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          📄 Rapports
        </p>
        <h1 className="text-3xl font-bold text-ardoise mt-1">{titre}</h1>
        <p className="text-ardoise-clair mt-2">{sousTitre}</p>
      </div>

      {/* Erreur */}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Carte className="text-center p-4 hover:shadow-lg transition-shadow">
          <p className="text-2xl font-bold text-lagune">{statsRapports.total}</p>
          <p className="text-xs text-ardoise-clair">Total</p>
        </Carte>
        <Carte className="text-center p-4 hover:shadow-lg transition-shadow">
          <p className="text-2xl font-bold text-ocre">
            {statsRapports.brouillons}
          </p>
          <p className="text-xs text-ardoise-clair">Brouillons</p>
        </Carte>
        <Carte className="text-center p-4 hover:shadow-lg transition-shadow">
          <p className="text-2xl font-bold text-succes">
            {statsRapports.valides}
          </p>
          <p className="text-xs text-ardoise-clair">Validés</p>
        </Carte>
        <Carte className="text-center p-4 hover:shadow-lg transition-shadow">
          <p className="text-2xl font-bold text-terre">
            {statsRapports.archives}
          </p>
          <p className="text-xs text-ardoise-clair">Archivés</p>
        </Carte>
      </div>

      {/* Filtres et actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Rechercher un rapport..."
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="flex-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
        />
        <select
          value={filtreType}
          onChange={(e) => setFiltreType(e.target.value)}
          className="px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
        >
          <option value="tous">Tous les types</option>
          <option value="activite">📋 Activité</option>
          <option value="mission"> Mission</option>
          <option value="financier">💰 Financier</option>
          <option value="beneficiaires">👥 Bénéficiaires</option>
        </select>
        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value)}
          className="px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
        >
          <option value="tous">Tous les statuts</option>
          <option value="brouillon">Brouillons</option>
          <option value="valide">Validés</option>
          <option value="archive">Archivés</option>
        </select>
        <Bouton variante="primaire" onClick={() => setAfficherFormulaire(true)}>
          + Nouveau rapport
        </Bouton>
      </div>

      {/* Liste des rapports */}
      <Carte titre={`${rapportsFiltres.length} rapport(s)`}>
        {chargement ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-ardoise-clair italic">Chargement...</p>
          </div>
        ) : rapportsFiltres.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3"></p>
            <p className="text-ardoise-clair italic">
              {recherche
                ? "Aucun rapport ne correspond à votre recherche."
                : "Aucun rapport disponible."}
            </p>
            {!recherche && (
              <Bouton
                variante="primaire"
                className="mt-4"
                onClick={() => setAfficherFormulaire(true)}
              >
                + Créer votre premier rapport
              </Bouton>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {rapportsFiltres.map((rapport) => (
              <div
                key={rapport.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-sable rounded-lg hover:bg-sable/80 transition-colors gap-3"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-lagune/10 flex items-center justify-center text-2xl flex-shrink-0">
                    {getTypeIcon(rapport.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ardoise truncate">
                      {rapport.titre}
                    </p>
                    {rapport.description && (
                      <p className="text-sm text-ardoise-clair truncate mt-1">
                        {rapport.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-ardoise-clair">
                        {getTypeLabel(rapport.type)}
                      </span>
                      <span className="text-ardoise-clair">•</span>
                      <span className="text-xs text-ardoise-clair">
                        {new Date(rapport.date_creation).toLocaleDateString(
                          "fr-FR"
                        )}
                      </span>
                      <span className="text-ardoise-clair">•</span>
                      <span className="text-xs text-ardoise-clair">
                        Par {rapport.auteur}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:ml-4 flex-shrink-0">
                  {getBadgeStatut(rapport.statut)}
                  {rapport.statut === "brouillon" && (
                    <button
                      onClick={() => handleValider(rapport.id)}
                      className="p-2 text-succes hover:bg-succes/10 rounded-lg transition-colors"
                      title="Valider"
                    >
                      ✅
                    </button>
                  )}
                  {rapport.statut === "valide" && (
                    <button
                      onClick={() => handleArchiver(rapport.id)}
                      className="p-2 text-ocre hover:bg-ocre/10 rounded-lg transition-colors"
                      title="Archiver"
                    >
                      📦
                    </button>
                  )}
                  <button
                    onClick={() => handleSupprimer(rapport.id)}
                    className="p-2 text-terre hover:bg-terre/10 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {/* Modal de création */}
      {afficherFormulaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-ardoise-clair/10 p-6 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-ardoise">
                  📄 Nouveau rapport
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

            <div className="p-6 space-y-4">
              <ChampSaisie
                libelle="Titre du rapport *"
                value={formData.titre}
                onChange={(e) =>
                  setFormData({ ...formData, titre: e.target.value })
                }
                placeholder="Ex: Rapport mensuel d'activité"
                required
              />
              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                  Type de rapport
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                >
                  <option value="activite">📋 Activité</option>
                  <option value="mission">🎯 Mission</option>
                  <option value="financier"> Financier</option>
                  <option value="beneficiaires">👥 Bénéficiaires</option>
                </select>
              </div>
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
                  rows={5}
                  placeholder="Décrivez le contenu du rapport..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-ardoise-clair/10">
                <Bouton
                  variante="primaire"
                  chargement={sauvegarde}
                  onClick={handleCreer}
                  className="flex-1"
                  disabled={!formData.titre}
                >
                  Créer le rapport
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