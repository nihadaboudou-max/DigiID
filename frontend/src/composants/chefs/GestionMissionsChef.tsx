"use client";

import { useState, useEffect } from "react";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI } from "@/services/client_api";

interface Mission {
  id: string;
  titre: string;
  objectifs?: string;
  zone?: string;
  statut: string;
  date_depart: string;
  date_retour?: string;
  programme_id?: string;
  programme_nom?: string;
}

interface Programme {
  id: string;
  nom: string;
}

interface AgentResponse {
  id: string;
  digiid_public: string;
  email: string;
  prenom: string;
  nom: string;
  role: string;
  domaine_id: string | null;
  departement_id: string | null;
  est_actif: boolean;
  ville: string | null;
  telephone: string | null;
  date_creation: string;
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
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [modeEdition, setModeEdition] = useState(false);
  const [missionEnCours, setMissionEnCours] = useState<string | null>(null);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState<string>("tous");
  
  // États pour l'assignation
  const [afficherAssignation, setAfficherAssignation] = useState(false);
  const [missionAssignation, setMissionAssignation] = useState<string | null>(null);
  const [agentsDisponibles, setAgentsDisponibles] = useState<AgentResponse[]>([]);
  const [agentsSelectionnes, setAgentsSelectionnes] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [agentsMission, setAgentsMission] = useState<any[]>([]);
  const [rechercheAgent, setRechercheAgent] = useState("");

  const [formData, setFormData] = useState({
    titre: "",
    objectifs: "",
    zone: "",
    date_depart: "",
    date_retour: "",
    programme_id: "",
    statut: "planifiee",
  });

  useEffect(() => {
    chargerMissions();
    chargerProgrammes();
  }, [typeOrganisation]);

  async function chargerMissions() {
    setChargement(true);
    setErreur("");
    try {
      const data: any = await clientAPI.get(`/api/v1/chefs/${typeOrganisation}/missions`, {
        authentifie: true,
      });
      setMissions(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des missions.");
    } finally {
      setChargement(false);
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

  async function chargerAgentsDisponibles() {
    try {
      const data: any = await clientAPI.get(`/api/v1/chefs/${typeOrganisation}/agents?par_page=1000`, {
        authentifie: true,
      });
      setAgentsDisponibles(data.agents || []);
    } catch (error) {
      console.error("Erreur chargement agents:", error);
    }
  }

  async function chargerAgentsMission(missionId: string) {
    try {
      const data: any = await clientAPI.get(`/api/v1/chefs/${typeOrganisation}/missions/${missionId}/agents`, {
        authentifie: true,
      });
      setAgentsMission(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erreur chargement agents mission:", error);
    }
  }

  async function handleCreer() {
    if (!formData.titre || !formData.date_depart) {
      setErreur("Le titre et la date de début sont obligatoires.");
      return;
    }
    
    setSauvegarde(true);
    setErreur("");
    
    try {
      await clientAPI.post(`/api/v1/chefs/${typeOrganisation}/missions`, {
        titre: formData.titre,
        objectifs: formData.objectifs || undefined,
        zone: formData.zone || undefined,
        date_depart: formData.date_depart,
        date_retour: formData.date_retour || undefined,
        programme_id: formData.programme_id || undefined,
      }, { authentifie: true });
      
      setAfficherFormulaire(false);
      reinitialiserFormulaire();
      await chargerMissions();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la création de la mission.");
    } finally {
      setSauvegarde(false);
    }
  }

  async function handleModifier() {
    if (!missionEnCours || !formData.titre || !formData.date_depart) {
      setErreur("Le titre et la date de début sont obligatoires.");
      return;
    }
    
    setSauvegarde(true);
    setErreur("");
    
    try {
      await clientAPI.patch(`/api/v1/chefs/${typeOrganisation}/missions/${missionEnCours}`, {
        titre: formData.titre,
        objectifs: formData.objectifs || undefined,
        zone: formData.zone || undefined,
        date_depart: formData.date_depart,
        date_retour: formData.date_retour || undefined,
        programme_id: formData.programme_id || undefined,
        statut: formData.statut,
      }, { authentifie: true });
      
      setAfficherFormulaire(false);
      reinitialiserFormulaire();
      await chargerMissions();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la modification de la mission.");
    } finally {
      setSauvegarde(false);
    }
  }

  async function handleSupprimer(missionId: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette mission ?")) return;
    
    try {
      await clientAPI.delete(`/api/v1/chefs/${typeOrganisation}/missions/${missionId}`, {
        authentifie: true,
      });
      await chargerMissions();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la suppression.");
    }
  }

  async function handleChangerStatut(missionId: string, nouveauStatut: string) {
    try {
      await clientAPI.patch(`/api/v1/chefs/${typeOrganisation}/missions/${missionId}`, {
        statut: nouveauStatut,
      }, { authentifie: true });
      await chargerMissions();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors du changement de statut.");
    }
  }

  function ouvrirAssignation(mission: Mission) {
    setMissionAssignation(mission.id);
    setAgentsSelectionnes([]);
    setInstructions("");
    setRechercheAgent("");
    setAfficherAssignation(true);
    chargerAgentsDisponibles();
    chargerAgentsMission(mission.id);
  }

  async function handleAssignerAgents() {
    if (!missionAssignation || agentsSelectionnes.length === 0) {
      setErreur("Veuillez sélectionner au moins un agent.");
      return;
    }
    
    try {
      await clientAPI.post(`/api/v1/chefs/${typeOrganisation}/missions/${missionAssignation}/assigner-agents`, {
        agent_ids: agentsSelectionnes,
        instructions: instructions || null,
      }, { authentifie: true });
      
      setAfficherAssignation(false);
      await chargerMissions();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de l'assignation.");
    }
  }

  function ouvrirFormulaireEdition(mission: Mission) {
    setMissionEnCours(mission.id);
    setFormData({
      titre: mission.titre,
      objectifs: mission.objectifs || "",
      zone: mission.zone || "",
      date_depart: mission.date_depart.split('T')[0],
      date_retour: mission.date_retour ? mission.date_retour.split('T')[0] : "",
      programme_id: mission.programme_id || "",
      statut: mission.statut || "planifiee",
    });
    setModeEdition(true);
    setAfficherFormulaire(true);
  }

  function reinitialiserFormulaire() {
    setMissionEnCours(null);
    setFormData({
      titre: "",
      objectifs: "",
      zone: "",
      date_depart: "",
      date_retour: "",
      programme_id: "",
      statut: "planifiee",
    });
    setModeEdition(false);
  }

  // Filtrage des agents selon la recherche
  const agentsFiltres = agentsDisponibles.filter((agent) => {
    const search = rechercheAgent.toLowerCase();
    return (
      agent.prenom?.toLowerCase().includes(search) ||
      agent.nom?.toLowerCase().includes(search) ||
      agent.email?.toLowerCase().includes(search) ||
      agent.digiid_public?.toLowerCase().includes(search)
    );
  });

  // Vérifier si tous les agents filtrés sont sélectionnés
  const tousSelectionnes = agentsFiltres.length > 0 && 
    agentsFiltres.every((agent) => agentsSelectionnes.includes(agent.id));

  // Fonction pour sélectionner/désélectionner tous
  function toggleSelectionTous() {
    const idsDejaAssignes = agentsMission.map((a) => a.id);
    if (tousSelectionnes) {
      // Désélectionner tous les agents filtrés
      const idsAFiltrer = agentsFiltres.map(a => a.id);
      setAgentsSelectionnes(agentsSelectionnes.filter(id => !idsAFiltrer.includes(id)));
    } else {
      // Sélectionner tous les agents filtrés (sauf ceux déjà assignés)
      const nouveauxAgents = agentsFiltres
        .filter(a => !idsDejaAssignes.includes(a.id))
        .map(a => a.id);
      setAgentsSelectionnes([...new Set([...agentsSelectionnes, ...nouveauxAgents])]);
    }
  }

  function getBadgeStatut(statut: string) {
    const config: Record<string, { couleur: any; label: string }> = {
      planifiee: { couleur: "ocre", label: "Planifiée" },
      en_cours: { couleur: "lagune", label: "En cours" },
      terminee: { couleur: "succes", label: "Terminée" },
      annulee: { couleur: "terre", label: "Annulée" },
      archivee: { couleur: "ardoise", label: "Archivée" },
    };
    const cfg = config[statut] || { couleur: "lagune", label: statut };
    return <Badge variante={cfg.couleur} taille="petit">{cfg.label}</Badge>;
  }

  const missionsFiltrees =
    filtreStatut === "tous"
      ? missions
      : missions.filter((m) => m.statut === filtreStatut);

  return (
    <div className="min-h-screen space-y-6 apparition pb-20">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">📋 Missions</p>
        <h1 className="text-3xl font-bold text-ardoise mt-1">{titre}</h1>
        <p className="text-ardoise-clair mt-2">{sousTitre}</p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

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
          <option value="archivee">Archivées</option>
        </select>
        <div className="flex-1"></div>
        <Bouton variante="primaire" onClick={() => { setModeEdition(false); setAfficherFormulaire(true); }}>
          + Nouvelle mission
        </Bouton>
      </div>

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

      <Carte titre={`${missionsFiltrees.length} mission(s)`}>
        {chargement ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-ardoise-clair italic">Chargement...</p>
          </div>
        ) : missionsFiltrees.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-ardoise-clair italic">Aucune mission planifiée.</p>
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
                      {mission.programme_nom && (
                        <Badge variante="lagune" taille="petit">📁 {mission.programme_nom}</Badge>
                      )}
                    </div>
                    {mission.objectifs && (
                      <p className="text-sm text-ardoise-clair mt-1">{mission.objectifs}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-ardoise-clair">
                      {mission.zone && <span> {mission.zone}</span>}
                      <span>📅 Début: {new Date(mission.date_depart).toLocaleDateString("fr-FR")}</span>
                      {mission.date_retour && (
                        <span>📅 Fin: {new Date(mission.date_retour).toLocaleDateString("fr-FR")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:ml-4">
                    <button
                      onClick={() => ouvrirAssignation(mission)}
                      className="px-3 py-1 text-xs bg-lagune text-white rounded hover:bg-lagune/90"
                    >
                      👥 Assigner
                    </button>
                    {mission.statut === "planifiee" && (
                      <button
                        onClick={() => handleChangerStatut(mission.id, "en_cours")}
                        className="px-3 py-1 text-xs bg-lagune text-white rounded hover:bg-lagune/90"
                      >
                        ▶️ Démarrer
                      </button>
                    )}
                    {mission.statut === "en_cours" && (
                      <button
                        onClick={() => handleChangerStatut(mission.id, "terminee")}
                        className="px-3 py-1 text-xs bg-succes text-white rounded hover:bg-succes/90"
                      >
                        ✅ Terminer
                      </button>
                    )}
                    {mission.statut !== "archivee" && (
                      <>
                        <button
                          onClick={() => ouvrirFormulaireEdition(mission)}
                          className="px-3 py-1 text-xs bg-ocre text-white rounded hover:bg-ocre/90"
                        >
                          ✏️ Modifier
                        </button>
                        <button
                          onClick={() => handleChangerStatut(mission.id, "archivee")}
                          className="px-3 py-1 text-xs bg-ardoise text-white rounded hover:bg-ardoise/90"
                        >
                          📦 Archiver
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleSupprimer(mission.id)}
                      className="px-3 py-1 text-xs bg-terre text-white rounded hover:bg-terre/90"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {/* Modal Création/Édition */}
      {afficherFormulaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-ardoise-clair/10 p-6 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-ardoise">
                  {modeEdition ? "✏️ Modifier la mission" : "+ Nouvelle mission"}
                </h2>
                <button
                  onClick={() => { setAfficherFormulaire(false); reinitialiserFormulaire(); }}
                  className="text-ardoise-clair hover:text-ardoise transition-colors text-2xl leading-none"
                >
                  
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <ChampSaisie
                libelle="Titre de la mission *"
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="Ex: Distribution de kits sanitaires"
                required
              />
              
              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-2">
                  Programme (optionnel)
                </label>
                <select
                  value={formData.programme_id}
                  onChange={(e) => setFormData({ ...formData, programme_id: e.target.value })}
                  className="w-full px-4 py-3 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                >
                  <option value="">Aucun programme</option>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-2">
                  Objectifs / Description
                </label>
                <textarea
                  value={formData.objectifs}
                  onChange={(e) => setFormData({ ...formData, objectifs: e.target.value })}
                  className="w-full px-4 py-3 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                  rows={4}
                  placeholder="Décrivez la mission..."
                />
              </div>

              <ChampSaisie
                libelle="Zone d'intervention"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                placeholder="Ex: Dakar, Thiès..."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChampSaisie
                  libelle="Date de début *"
                  type="date"
                  value={formData.date_depart}
                  onChange={(e) => setFormData({ ...formData, date_depart: e.target.value })}
                  required
                />
                <ChampSaisie
                  libelle="Date de fin (optionnelle)"
                  type="date"
                  value={formData.date_retour}
                  onChange={(e) => setFormData({ ...formData, date_retour: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-ardoise-clair/10">
                <Bouton
                  variante="primaire"
                  chargement={sauvegarde}
                  onClick={modeEdition ? handleModifier : handleCreer}
                  className="flex-1"
                  disabled={!formData.titre || !formData.date_depart}
                >
                  {sauvegarde ? "Enregistrement..." : (modeEdition ? "Modifier" : "Créer")}
                </Bouton>
                <Bouton
                  variante="ghost"
                  onClick={() => { setAfficherFormulaire(false); reinitialiserFormulaire(); }}
                >
                  Annuler
                </Bouton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'Assignation - VERSION ERGONOMIQUE */}
      {afficherAssignation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-ardoise-clair/10">
              <div>
                <h2 className="text-xl font-bold text-ardoise">👥 Assigner des agents</h2>
                <p className="text-sm text-ardoise-clair mt-1">
                  Sélectionnez les agents à assigner à cette mission
                </p>
              </div>
              <button
                onClick={() => setAfficherAssignation(false)}
                className="text-ardoise-clair hover:text-ardoise transition-colors text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Agents déjà assignés */}
              {agentsMission.length > 0 && (
                <div className="bg-lagune/5 border border-lagune/20 rounded-lg p-4">
                  <p className="text-sm font-semibold text-ardoise mb-2">
                    ✅ Agents déjà assignés ({agentsMission.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {agentsMission.map((agent: any) => (
                      <div
                        key={agent.id}
                        className="flex items-center gap-2 px-3 py-1 bg-lagune/10 rounded-full text-sm"
                      >
                        <span className="font-medium">{agent.prenom} {agent.nom}</span>
                        {agent.instructions && (
                          <span className="text-xs text-ardoise-clair">📝</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Barre de recherche */}
              <div className="sticky top-0 bg-white z-10">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Rechercher un agent (nom, email, matricule)..."
                    value={rechercheAgent}
                    onChange={(e) => setRechercheAgent(e.target.value)}
                    className="w-full px-4 py-3 pl-11 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                  />
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ardoise-clair">
                    
                  </span>
                  {rechercheAgent && (
                    <button
                      onClick={() => setRechercheAgent("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-ardoise-clair hover:text-ardoise"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-ardoise-clair">
                  <span>{agentsFiltres.length} agent(s) trouvé(s)</span>
                  <button
                    onClick={toggleSelectionTous}
                    className="text-lagune hover:underline"
                  >
                    {tousSelectionnes ? "Désélectionner tout" : "Sélectionner tout"}
                  </button>
                </div>
              </div>

              {/* Liste des agents */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {agentsFiltres.length === 0 ? (
                  <div className="text-center py-8 text-ardoise-clair">
                    <p className="text-4xl mb-2">😕</p>
                    <p>Aucun agent trouvé</p>
                  </div>
                ) : (
                  agentsFiltres.map((agent) => {
                    const estDejaAssigne = agentsMission.some((a) => a.id === agent.id);
                    const estSelectionne = agentsSelectionnes.includes(agent.id);

                    return (
                      <label
                        key={agent.id}
                        className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          estDejaAssigne
                            ? "bg-lagune/5 border-lagune/20 opacity-60"
                            : estSelectionne
                            ? "bg-lagune/10 border-lagune"
                            : "bg-sable border-transparent hover:bg-sable/80"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={estSelectionne}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAgentsSelectionnes([...agentsSelectionnes, agent.id]);
                            } else {
                              setAgentsSelectionnes(agentsSelectionnes.filter(id => id !== agent.id));
                            }
                          }}
                          disabled={estDejaAssigne}
                          className="w-5 h-5 rounded text-lagune focus:ring-lagune disabled:opacity-50"
                        />
                        <div className="w-12 h-12 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold flex-shrink-0">
                          {(agent.prenom?.[0] || "") + (agent.nom?.[0] || "")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-ardoise truncate">
                            {agent.prenom} {agent.nom}
                          </p>
                          <p className="text-sm text-ardoise-clair truncate">{agent.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {agent.ville && (
                              <span className="text-xs text-ardoise-clair">📍 {agent.ville}</span>
                            )}
                            {agent.telephone && (
                              <span className="text-xs text-ardoise-clair"> {agent.telephone}</span>
                            )}
                          </div>
                        </div>
                        {estDejaAssigne && (
                          <Badge variante="succes" taille="petit">Déjà assigné</Badge>
                        )}
                      </label>
                    );
                  })
                )}
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-2">
                  Instructions pour cette mission (optionnel)
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-4 py-3 border border-ardoise-clair/20 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lagune/30"
                  rows={3}
                  placeholder="Ex: Se présenter au point de rendez-vous à 8h00. Apporter le matériel nécessaire..."
                />
              </div>
            </div>

            {/* Footer fixe */}
            <div className="border-t border-ardoise-clair/10 p-6 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-ardoise-clair">
                  <span className="font-semibold text-lagune">{agentsSelectionnes.length}</span> agent(s) sélectionné(s)
                </div>
                <div className="flex gap-3">
                  <Bouton variante="ghost" onClick={() => setAfficherAssignation(false)}>
                    Annuler
                  </Bouton>
                  <Bouton
                    variante="primaire"
                    onClick={handleAssignerAgents}
                    disabled={agentsSelectionnes.length === 0}
                  >
                    Assigner {agentsSelectionnes.length} agent(s)
                  </Bouton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}