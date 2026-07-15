"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI } from "@/services/client_api";

interface Mission {
  id: string;
  titre: string;
  zone: string | null;
  date_depart: string;
  date_retour: string | null;
  objectifs: string | null;
  statut: string;
}

export default function MissionsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong", "ong", "chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [missionEnCours, setMissionEnCours] = useState<string | null>(null);
  const [rapport, setRapport] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);

  useEffect(() => { chargerMissions(); }, []);

  async function chargerMissions() {
    setChargement(true);
    setErreur(null);
    try {
      const response: any = await clientAPI.get("/api/v1/ong/missions", { authentifie: true });
      const dataArray = Array.isArray(response) ? response : (response.missions || response.data || []);
      setMissions(dataArray);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des missions");
      console.error(error);
    } finally {
      setChargement(false);
    }
  }

  async function changerStatut(missionId: string, nouveauStatut: string) {
    try {
      await clientAPI.patch(`/api/v1/ong/missions/${missionId}/statut`, 
        { statut: nouveauStatut }, 
        { authentifie: true }
      );
      await chargerMissions();
      setMissionEnCours(null);
      setAfficherFormulaire(false);
      setRapport("");
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la mise à jour");
      console.error(error);
    }
  }

  async function demarrerMission(missionId: string) {
    if (!confirm("Confirmez-vous le démarrage de cette mission ?")) return;
    await changerStatut(missionId, "en_cours");
  }

  async function terminerMission(missionId: string) {
    setMissionEnCours(missionId);
    setAfficherFormulaire(true);
  }

  async function soumettreRapport(missionId: string) {
    if (!rapport.trim()) {
      alert("Veuillez ajouter un rapport d'exécution");
      return;
    }
    
    try {
      await clientAPI.post(`/api/v1/ong/missions/${missionId}/rapport`, 
        { 
          rapport: rapport,
          resultats: "Mission exécutée avec succès"
        }, 
        { authentifie: true }
      );
      await changerStatut(missionId, "terminee");
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de l'envoi du rapport");
      console.error(error);
    }
  }

  function getBadgeStatut(statut: string) {
    const config: Record<string, { couleur: "lagune" | "succes" | "ocre" | "terre"; label: string }> = {
      "planifiee": { couleur: "ocre", label: "Planifiée" },
      "en_cours": { couleur: "lagune", label: "En cours" },
      "terminee": { couleur: "succes", label: "Terminée" },
      "annulee": { couleur: "terre", label: "Annulée" },
    };
    const cfg = config[statut] || { couleur: "lagune", label: statut };
    return <Badge variante={cfg.couleur} taille="petit">{cfg.label}</Badge>;
  }

  return (
    <div className="space-y-6 apparition">
      <nav className="text-sm text-ardoise-clair">
        <Link href="/ong" className="hover:text-ocre">Tableau de bord</Link>
        <span className="mx-2">/</span>
        <span className="text-ardoise font-semibold">Missions</span>
      </nav>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div>
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">Agent ONG</p>
        <h1 className="mt-1 text-2xl">Missions</h1>
        <p className="text-ardoise-clair mt-1 text-sm">{missions.length} mission(s)</p>
      </div>

      {chargement ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-ocre border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-ardoise-clair italic">Chargement...</p>
        </div>
      ) : missions.length === 0 ? (
        <Carte>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-ardoise-clair italic">Aucune mission.</p>
            <p className="text-xs text-ardoise-clair mt-2">Les missions vous seront assignées par votre chef ONG.</p>
          </div>
        </Carte>
      ) : (
        <div className="space-y-3">
          {missions.map((m) => (
            <div key={m.id} className="carte p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-ardoise text-lg">{m.titre}</h3>
                    {getBadgeStatut(m.statut)}
                  </div>
                  <p className="text-sm text-ardoise-clair">{m.zone || "Zone non spécifiée"}</p>
                  <p className="text-xs text-ardoise-clair mt-1">
                    Du {new Date(m.date_depart).toLocaleDateString("fr-FR")}
                    {m.date_retour && ` au ${new Date(m.date_retour).toLocaleDateString("fr-FR")}`}
                  </p>
                  {m.objectifs && (
                    <p className="text-sm text-ardoise mt-2 bg-sable p-3 rounded">
                      <strong>Objectifs :</strong> {m.objectifs}
                    </p>
                  )}
                </div>
                
                {/* Actions selon le statut */}
                <div className="flex flex-col gap-2">
                  {m.statut === "planifiee" && (
                    <Bouton 
                      variante="primaire" 
                      onClick={() => demarrerMission(m.id)}
                      className="w-full sm:w-auto"
                    >
                      ▶️ Démarrer
                    </Bouton>
                  )}
                  
                  {m.statut === "en_cours" && (
                    <Bouton 
                      variante="succes" 
                      onClick={() => terminerMission(m.id)}
                      className="w-full sm:w-auto"
                    >
                      ✅ Terminer
                    </Bouton>
                  )}
                  
                  {m.statut === "terminee" && (
                    <p className="text-xs text-succes font-semibold text-center">
                      ✓ Mission terminée
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal pour ajouter un rapport */}
      {afficherFormulaire && missionEnCours && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-ardoise mb-4">📝 Rapport de mission</h2>
            <p className="text-sm text-ardoise-clair mb-4">
              Décrivez le déroulement de la mission avant de la terminer.
            </p>
            
            <textarea
              value={rapport}
              onChange={(e) => setRapport(e.target.value)}
              className="w-full px-4 py-3 border border-ardoise-clair/20 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lagune/30 mb-4"
              rows={6}
              placeholder="Décrivez les activités réalisées, les résultats obtenus, les difficultés rencontrées..."
            />
            
            <div className="flex gap-3">
              <Bouton 
                variante="primaire" 
                onClick={() => soumettreRapport(missionEnCours)}
                className="flex-1"
              >
                ✅ Terminer et envoyer
              </Bouton>
              <Bouton 
                variante="ghost" 
                onClick={() => {
                  setAfficherFormulaire(false);
                  setMissionEnCours(null);
                  setRapport("");
                }}
              >
                Annuler
              </Bouton>
            </div>
          </div>
        </div>
      )}

      <Link href="/ong">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}