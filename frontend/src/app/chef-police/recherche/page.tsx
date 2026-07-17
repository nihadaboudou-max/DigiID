"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // ✅ Importer useRouter
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { listerAgentsPolice } from "@/services/chefs";
import type { AgentResponse } from "@/services/chefs";
import { Alerte } from "@/composants/commun/Alerte";

export default function ChefPoliceRecherchePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_police", "super_administrateur", "admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter(); // ✅ Initialiser le router
  const [recherche, setRecherche] = useState("");
  const [filtreVille, setFiltreVille] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<"tous" | "actif" | "inactif">("tous");
  const [resultats, setResultats] = useState<AgentResponse[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [tousLesAgents, setTousLesAgents] = useState<AgentResponse[]>([]);
  const [villesDisponibles, setVillesDisponibles] = useState<string[]>([]);

  useEffect(() => {
    chargerTousLesAgents();
  }, []);

  async function chargerTousLesAgents() {
    try {
      const data = await listerAgentsPolice({ par_page: 1000 });
      setTousLesAgents(data.agents || []);
      const villes = [...new Set(data.agents.map((a) => a.ville).filter(Boolean))] as string[];
      setVillesDisponibles(villes.sort());
    } catch (error: any) {
      setErreur("Erreur de chargement des données");
    }
  }

  useEffect(() => {
    effectuerRecherche();
  }, [recherche, filtreVille, filtreStatut]);

  function effectuerRecherche() {
    setChargement(true);
    setErreur("");
    setTimeout(() => {
      try {
        let resultatsFiltres = [...tousLesAgents];
        if (recherche.trim()) {
          const termeRecherche = recherche.toLowerCase().trim();
          resultatsFiltres = resultatsFiltres.filter((agent) => {
            const nomComplet = `${agent.prenom} ${agent.nom}`.toLowerCase();
            const email = agent.email.toLowerCase();
            const digiid = agent.digiid_public.toLowerCase();
            const ville = (agent.ville || "").toLowerCase();
            return (
              nomComplet.includes(termeRecherche) ||
              email.includes(termeRecherche) ||
              digiid.includes(termeRecherche) ||
              ville.includes(termeRecherche)
            );
          });
        }
        if (filtreVille) {
          resultatsFiltres = resultatsFiltres.filter((agent) => agent.ville === filtreVille);
        }
        if (filtreStatut !== "tous") {
          const estActif = filtreStatut === "actif";
          resultatsFiltres = resultatsFiltres.filter((agent) => agent.est_actif === estActif);
        }
        setResultats(resultatsFiltres);
      } catch (error: any) {
        setErreur("Erreur lors de la recherche");
      } finally {
        setChargement(false);
      }
    }, 300);
  }

  function reinitialiserFiltres() {
    setRecherche("");
    setFiltreVille("");
    setFiltreStatut("tous");
    setResultats(tousLesAgents);
  }

  // ✅ Fonction pour voir le profil
  function voirProfil(agentId: string) {
    router.push(`/chefs/police/agents/${agentId}`);
  }

  const stats = {
    total: resultats.length,
    actifs: resultats.filter((r) => r.est_actif).length,
    inactifs: resultats.filter((r) => !r.est_actif).length,
  };

  return (
    <div className="min-h-screen space-y-6 apparition pb-20">
      <div>
        <p className="text-terre font-semibold text-sm uppercase tracking-wider">🔍 Recherche</p>
        <h1>Recherche d'agents de police</h1>
        <p className="text-ardoise-clair mt-2">Recherchez des agents par nom, email, DigiID, matricule ou ville</p>
      </div>
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}
      <Carte>
        <div className="space-y-4">
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-2">Terme de recherche</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher par nom, prénom, email, DigiID, matricule ou ville..."
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terre/30"
                autoFocus
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ardoise-clair">🔍</span>
              {recherche && (
                <button onClick={() => setRecherche("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ardoise-clair hover:text-ardoise">✕</button>
              )}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Ville</label>
              <select value={filtreVille} onChange={(e) => setFiltreVille(e.target.value)} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terre/30">
                <option value="">Toutes les villes</option>
                {villesDisponibles.map((ville) => (<option key={ville} value={ville}>{ville}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Statut</label>
              <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value as any)} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terre/30">
                <option value="tous">Tous les statuts</option>
                <option value="actif">Actifs</option>
                <option value="inactif">Inactifs</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Bouton variante="ghost" onClick={reinitialiserFiltres}>🔄 Réinitialiser</Bouton>
            <div className="flex-1"></div>
            <span className="text-sm text-ardoise-clair self-center">{resultats.length} résultat{resultats.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      </Carte>
      {resultats.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Carte className="text-center p-4"><p className="text-2xl font-bold text-lagune">{stats.total}</p><p className="text-xs text-ardoise-clair">Résultats</p></Carte>
          <Carte className="text-center p-4"><p className="text-2xl font-bold text-succes">{stats.actifs}</p><p className="text-xs text-ardoise-clair">Actifs</p></Carte>
          <Carte className="text-center p-4"><p className="text-2xl font-bold text-terre">{stats.inactifs}</p><p className="text-xs text-ardoise-clair">Inactifs</p></Carte>
        </div>
      )}
      <Carte titre="Résultats de la recherche">
        {chargement ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-terre border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-ardoise-clair">Recherche en cours...</p>
          </div>
        ) : resultats.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-ardoise-clair italic">{recherche ? "Aucun résultat trouvé." : "Commencez une recherche."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resultats.map((agent) => (
              <div key={agent.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-sable rounded-lg hover:bg-sable/80 transition-colors gap-3">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-full bg-terre/10 flex items-center justify-center text-terre font-bold flex-shrink-0">{(agent.prenom[0] || "") + (agent.nom[0] || "")}</div>
                  <div className="min-w-0">
                    <p className="font-bold text-ardoise truncate">{agent.prenom} {agent.nom}</p>
                    <p className="text-sm text-ardoise-clair truncate">{agent.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variante={agent.est_actif ? "succes" : "terre"} taille="petit">{agent.est_actif ? "Actif" : "Inactif"}</Badge>
                      <span className="text-xs text-ardoise-clair font-mono">{agent.digiid_public}</span>
                      {agent.ville && (<><span className="text-ardoise-clair">•</span><span className="text-xs text-ardoise-clair">📍 {agent.ville}</span></>)}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <button 
                    onClick={() => voirProfil(agent.id)} // ✅ Ajouter onClick
                    className="px-3 py-1 text-xs bg-terre text-white rounded hover:bg-terre/90 transition-colors"
                  >
                    Voir profil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>
      <Carte titre="💡 Astuces de recherche">
        <div className="grid md:grid-cols-2 gap-4 text-sm text-ardoise-clair">
          <div>
            <p className="font-semibold text-ardoise mb-1">Recherche textuelle :</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Nom complet : "Amadou Diallo"</li>
              <li>Matricule : "POL-2026-001"</li>
              <li>Email : "amadou@police.sn"</li>
              <li>DigiID : "A3F7K9M2X4B8P1Q6"</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-ardoise mb-1">Filtres disponibles :</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ville : filtre par localisation</li>
              <li>Statut : actifs/inactifs</li>
              <li>Combinez plusieurs critères</li>
            </ul>
          </div>
        </div>
      </Carte>
    </div>
  );
}