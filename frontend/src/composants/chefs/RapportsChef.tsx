"use client";

import { useState, useEffect } from "react";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI } from "@/services/client_api";

interface Rapport {
  id: string;
  titre: string;
  type: "activite" | "mission" | "programme" | "hebdomadaire" | "mensuel" | "trimestriel";
  description?: string;
  date_creation: string;
  statut: "brouillon" | "valide" | "archive";
  auteur: string;
  mission_id?: string;
  mission_titre?: string;
  programme_id?: string;
  programme_nom?: string;
  periode_debut?: string;
  periode_fin?: string;
}

interface Mission {
  id: string;
  titre: string;
}

interface Programme {
  id: string;
  nom: string;
}

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
  const [missions, setMissions] = useState<Mission[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [filtreType, setFiltreType] = useState<string>("tous");
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  const [recherche, setRecherche] = useState("");

  const [formData, setFormData] = useState({
    titre: "",
    type: "activite" as "activite" | "mission" | "programme" | "hebdomadaire" | "mensuel" | "trimestriel",
    description: "",
    mission_id: "",
    programme_id: "",
    periode_debut: "",
    periode_fin: "",
  });

  useEffect(() => {
    chargerRapports();
    chargerMissions();
    chargerProgrammes();
  }, [typeOrganisation]);

  async function chargerRapports() {
    setChargement(true);
    setErreur("");
    try {
      const params: any = { par_page: 100 };
      if (filtreType !== "tous") params.type = filtreType;
      if (filtreStatut !== "tous") params.statut = filtreStatut;

      const data: any = await clientAPI.get(`/api/v1/chefs/${typeOrganisation}/rapports`, {
        authentifie: true,
      });
      setRapports(data.rapports || []);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des rapports.");
    } finally {
      setChargement(false);
    }
  }

  async function chargerMissions() {
    try {
      const data: any = await clientAPI.get(`/api/v1/chefs/${typeOrganisation}/missions`, {
        authentifie: true,
      });
      setMissions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement missions:", error);
    }
  }

  async function chargerProgrammes() {
    try {
      const data: any = await clientAPI.get(`/api/v1/chefs/${typeOrganisation}/programmes`, {
        authentifie: true,
      });
      setProgrammes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement programmes:", error);
    }
  }

  async function handleCreer() {
    if (!formData.titre) {
      setErreur("Le titre est obligatoire.");
      return;
    }

    // Validation selon le type
    if (formData.type === "mission" && !formData.mission_id) {
      setErreur("Veuillez sélectionner une mission.");
      return;
    }
    if (formData.type === "programme" && !formData.programme_id) {
      setErreur("Veuillez sélectionner un programme.");
      return;
    }
    if (["hebdomadaire", "mensuel", "trimestriel"].includes(formData.type)) {
      if (!formData.periode_debut || !formData.periode_fin) {
        setErreur("Veuillez définir la période du rapport.");
        return;
      }
    }

    setSauvegarde(true);
    setErreur("");
    try {
      await clientAPI.post(`/api/v1/chefs/${typeOrganisation}/rapports`, {
        titre: formData.titre,
        type: formData.type,
        description: formData.description || null,
        mission_id: formData.mission_id || null,
        programme_id: formData.programme_id || null,
        periode_debut: formData.periode_debut || null,
        periode_fin: formData.periode_fin || null,
      }, { authentifie: true });
      
      setAfficherFormulaire(false);
      setFormData({ 
        titre: "", 
        type: "activite", 
        description: "",
        mission_id: "",
        programme_id: "",
        periode_debut: "",
        periode_fin: "",
      });
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
      await clientAPI.delete(`/api/v1/chefs/${typeOrganisation}/rapports/${rapportId}`, {
        authentifie: true,
      });
      await chargerRapports();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la suppression.");
    }
  }

  async function handleValider(rapportId: string) {
    try {
      await clientAPI.patch(`/api/v1/chefs/${typeOrganisation}/rapports/${rapportId}/valider`, {}, {
        authentifie: true,
      });
      await chargerRapports();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la validation.");
    }
  }

  async function handleArchiver(rapportId: string) {
    try {
      await clientAPI.patch(`/api/v1/chefs/${typeOrganisation}/rapports/${rapportId}/archiver`, {}, {
        authentifie: true,
      });
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
      programme: "📁 Programme",
      hebdomadaire: "📅 Hebdomadaire",
      mensuel: "📆 Mensuel",
      trimestriel: "📊 Trimestriel",
    };
    return types[type] || type;
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      activite: "",
      mission: "🎯",
      programme: "📁",
      hebdomadaire: "📅",
      mensuel: "📆",
      trimestriel: "📊",
    };
    return icons[type] || "📄";
  };

  const rapportsFiltres = rapports.filter((rapport) => {
    const matchType = filtreType === "tous" || rapport.type === filtreType;
    const matchStatut = filtreStatut === "tous" || rapport.statut === filtreStatut;
    const matchRecherche =
      recherche.trim() === "" ||
      rapport.titre.toLowerCase().includes(recherche.toLowerCase()) ||
      (rapport.description || "").toLowerCase().includes(recherche.toLowerCase()) ||
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
          <option value="mission">🎯 Mission</option>
          <option value="programme">📁 Programme</option>
          <option value="hebdomadaire">📅 Hebdomadaire</option>
          <option value="mensuel">📆 Mensuel</option>
          <option value="trimestriel">📊 Trimestriel</option>
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
            <p className="text-4xl mb-3">📄</p>
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
                      {rapport.mission_titre && (
                        <>
                          <span className="text-ardoise-clair">•</span>
                          <span className="text-xs text-lagune">🎯 {rapport.mission_titre}</span>
                        </>
                      )}
                      {rapport.programme_nom && (
                        <>
                          <span className="text-ardoise-clair">•</span>
                          <span className="text-xs text-ocre"> {rapport.programme_nom}</span>
                        </>
                      )}
                      {rapport.periode_debut && rapport.periode_fin && (
                        <>
                          <span className="text-ardoise-clair">•</span>
                          <span className="text-xs text-ardoise-clair">
                             Du {new Date(rapport.periode_debut).toLocaleDateString("fr-FR")} au {new Date(rapport.periode_fin).toLocaleDateString("fr-FR")}
                          </span>
                        </>
                      )}
                      <span className="text-ardoise-clair">•</span>
                      <span className="text-xs text-ardoise-clair">
                        {new Date(rapport.date_creation).toLocaleDateString("fr-FR")}
                      </span>
                      <span className="text-ardoise-clair">•</span>
                      <span className="text-xs text-ardoise-clair">
                        Par {rapport.auteur}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:ml-4 flex-shrink-0 flex-wrap">
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-ardoise-clair/10 p-6 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-ardoise">
                   Nouveau rapport
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
                placeholder="Ex: Rapport d'activité - Juin 2026"
                required
              />
              
              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-2">
                  Type de rapport *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => {
                    const newType = e.target.value as any;
                    setFormData({ 
                      ...formData, 
                      type: newType,
                      // Réinitialiser les champs spécifiques si type change
                      mission_id: newType === "mission" ? formData.mission_id : "",
                      programme_id: newType === "programme" ? formData.programme_id : "",
                    });
                  }}
                  className="w-full px-4 py-3 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                >
                  <option value="activite">📋 Rapport d'activité (général)</option>
                  <option value="mission">🎯 Rapport de mission</option>
                  <option value="programme">📁 Rapport de programme</option>
                  <option value="hebdomadaire">📅 Rapport hebdomadaire</option>
                  <option value="mensuel">📆 Rapport mensuel</option>
                  <option value="trimestriel">📊 Rapport trimestriel</option>
                </select>
              </div>

              {/* Sélection de mission */}
              {formData.type === "mission" && (
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-2">
                    Mission concernée *
                  </label>
                  <select
                    value={formData.mission_id}
                    onChange={(e) => setFormData({ ...formData, mission_id: e.target.value })}
                    className="w-full px-4 py-3 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                  >
                    <option value="">Sélectionner une mission</option>
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>{m.titre}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sélection de programme */}
              {formData.type === "programme" && (
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-2">
                    Programme concerné *
                  </label>
                  <select
                    value={formData.programme_id}
                    onChange={(e) => setFormData({ ...formData, programme_id: e.target.value })}
                    className="w-full px-4 py-3 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                  >
                    <option value="">Sélectionner un programme</option>
                    {programmes.map((p) => (
                      <option key={p.id} value={p.id}>{p.nom}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Période pour rapports temporels */}
              {["hebdomadaire", "mensuel", "trimestriel"].includes(formData.type) && (
                <div className="grid grid-cols-2 gap-4">
                  <ChampSaisie
                    libelle="Date de début de période *"
                    type="date"
                    value={formData.periode_debut}
                    onChange={(e) => setFormData({ ...formData, periode_debut: e.target.value })}
                    required
                  />
                  <ChampSaisie
                    libelle="Date de fin de période *"
                    type="date"
                    value={formData.periode_fin}
                    onChange={(e) => setFormData({ ...formData, periode_fin: e.target.value })}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-2">
                  Description / Contenu
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                  rows={5}
                  placeholder="Décrivez le contenu du rapport, les résultats, les observations..."
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