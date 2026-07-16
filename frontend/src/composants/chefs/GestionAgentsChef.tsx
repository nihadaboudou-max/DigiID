"use client";

import { useState, useEffect } from "react";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import {
  listerAgentsONG, listerAgentsPolice, listerMedecins, listerAgentsEnrolement,
  creerAgentONG, creerAgentPolice, creerMedecin, creerAgentEnrolement,
  inviterAgent, listerInvitations, annulerInvitation, renvoyerInvitation,
  type AgentResponse, type InvitationResponse,
} from "@/services/chefs";

interface GestionAgentsChefProps {
  titre: string;
  sousTitre: string;
  typeAgent: "police" | "medical" | "ong" | "enrolement";
}

export default function GestionAgentsChef({ titre, sousTitre, typeAgent }: GestionAgentsChefProps) {
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [modeCreation, setModeCreation] = useState<"direct" | "invitation">("invitation");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<"tous" | "actif" | "inactif">("tous");

  const [formData, setFormData] = useState({
    email: "",
    prenom: "",
    nom: "",
    telephone: "",
    ville: "",
    pays: "Sénégal",
    mission: "", // Spécifique à ONG
    specialite: "", // Spécifique à Médical
    message: "", // Pour l'invitation
  });

  useEffect(() => {
    charger();
  }, [typeAgent]);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const listerFonction = {
        police: listerAgentsPolice,
        medical: listerMedecins,
        ong: listerAgentsONG,
        enrolement: listerAgentsEnrolement,
      }[typeAgent];

      const [agentsData, invitationsData] = await Promise.all([
        listerFonction({ par_page: 100 }),
        listerInvitations({ par_page: 50 }),
      ]);
      
      setAgents(agentsData.agents || []);
      setInvitations(invitationsData.invitations || []);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des données.");
    } finally {
      setChargement(false);
    }
  }

  function getCreerFonction() {
    switch (typeAgent) {
      case "police": return creerAgentPolice;
      case "medical": return creerMedecin;
      case "ong": return creerAgentONG;
      case "enrolement": return creerAgentEnrolement;
      default: return creerAgentONG;
    }
  }

  function ouvrirFormulaire(mode: "direct" | "invitation") {
    setModeCreation(mode);
    setFormData({ 
      email: "", 
      prenom: "", 
      nom: "", 
      telephone: "", 
      ville: "", 
      pays: "Sénégal", 
      mission: "", 
      specialite: "", 
      message: "" 
    });
    setAfficherFormulaire(true);
    setErreur("");
  }

  async function handleCreer() {
    if (!formData.email || !formData.prenom || !formData.nom) {
      setErreur("L'email, le prénom et le nom sont obligatoires.");
      return;
    }
    
    setSauvegarde(true);
    setErreur("");
    
    try {
      if (modeCreation === "invitation") {
        await inviterAgent(typeAgent, { email: formData.email, message: formData.message });
      } else {
        const creerFonction = getCreerFonction();
        const payload: any = {
          email: formData.email,
          prenom: formData.prenom,
          nom: formData.nom,
          telephone: formData.telephone || undefined,
          ville: formData.ville || undefined,
          pays: formData.pays || "Sénégal",
        };
        
        // ✅ Champs spécifiques selon le type d'agent
        if (typeAgent === "ong") {
          payload.mission = formData.mission || undefined;
        }
        if (typeAgent === "medical") {
          payload.specialite = formData.specialite || undefined;
        }
        
        await creerFonction(payload);
      }
      
      setAfficherFormulaire(false);
      await charger();
    } catch (error: any) {
      setErreur(error?.message || "Une erreur est survenue lors de l'opération.");
    } finally {
      setSauvegarde(false);
    }
  }

  async function handleAnnulerInvitation(invitationId: string) {
    if (!confirm("Annuler cette invitation ?")) return;
    try {
      await annulerInvitation(invitationId);
      await charger();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de l'annulation.");
    }
  }

  async function handleRenvoyerInvitation(invitationId: string) {
    try {
      await renvoyerInvitation(invitationId);
      await charger();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors du renvoi.");
    }
  }

  const agentsFiltres = agents.filter((agent) => {
    const matchRecherche =
      agent.email.toLowerCase().includes(recherche.toLowerCase()) ||
      `${agent.prenom} ${agent.nom}`.toLowerCase().includes(recherche.toLowerCase()) ||
      agent.digiid_public.toLowerCase().includes(recherche.toLowerCase());
      
    const matchStatut =
      filtreStatut === "tous" ||
      (filtreStatut === "actif" && agent.est_actif) ||
      (filtreStatut === "inactif" && !agent.est_actif);
      
    return matchRecherche && matchStatut;
  });

  const invitationsEnAttente = invitations.filter((inv) => inv.statut === "en_attente");

  const getLibelleType = () => {
    switch (typeAgent) {
      case "police": return "Agent Police";
      case "medical": return "Médecin";
      case "ong": return "Agent ONG";
      case "enrolement": return "Agent d'Enrôlement";
      default: return "Agent";
    }
  };

  return (
    <div className="min-h-screen space-y-6 apparition pb-20">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Gestion d'équipe</p>
        <h1 className="text-3xl font-bold text-ardoise mt-1">{titre}</h1>
        <p className="text-ardoise-clair mt-2">{sousTitre}</p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder={`Rechercher un ${getLibelleType().toLowerCase()}...`}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          className="flex-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
        />
        <select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value as any)}
          className="px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
        >
          <option value="tous">Tous les statuts</option>
          <option value="actif">Actifs</option>
          <option value="inactif">Inactifs</option>
        </select>
        <div className="flex gap-2">
          <Bouton variante={modeCreation === "invitation" ? "primaire" : "ghost"} onClick={() => ouvrirFormulaire("invitation")}>
            ✉️ Inviter
          </Bouton>
          <Bouton variante={modeCreation === "direct" ? "primaire" : "ghost"} onClick={() => ouvrirFormulaire("direct")}>
            + Créer
          </Bouton>
        </div>
      </div>

      {invitationsEnAttente.length > 0 && (
        <Carte titre={`Invitations en attente (${invitationsEnAttente.length})`}>
          <div className="space-y-2">
            {invitationsEnAttente.map((invitation) => (
              <div key={invitation.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-ocre/5 rounded-lg gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✉️</span>
                  <div>
                    <p className="font-semibold text-ardoise">{invitation.email}</p>
                    <p className="text-xs text-ardoise-clair">
                      Envoyée le {new Date(invitation.date_creation).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRenvoyerInvitation(invitation.id)} className="px-3 py-1 text-xs bg-lagune text-white rounded hover:bg-lagune/90 transition-colors">
                    Renvoyer
                  </button>
                  <button onClick={() => handleAnnulerInvitation(invitation.id)} className="px-3 py-1 text-xs bg-terre text-white rounded hover:bg-terre/90 transition-colors">
                    Annuler
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Carte>
      )}

      <Carte titre={`${agentsFiltres.length} ${getLibelleType().toLowerCase()}(s)`}>
        {chargement ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-ardoise-clair italic">Chargement...</p>
          </div>
        ) : agentsFiltres.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-ardoise-clair italic">Aucun agent trouvé.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agentsFiltres.map((agent) => (
              <div key={agent.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-sable rounded-lg hover:bg-sable/80 transition-colors gap-3">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold flex-shrink-0">
                    {(agent.prenom[0] || "") + (agent.nom[0] || "")}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-ardoise truncate">{agent.prenom} {agent.nom}</p>
                    <p className="text-sm text-ardoise-clair truncate">{agent.email}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variante={agent.est_actif ? "succes" : "terre"} taille="petit">
                        {agent.est_actif ? "Actif" : "Inactif"}
                      </Badge>
                      <span className="text-xs text-ardoise-clair font-mono">{agent.digiid_public}</span>
                      {agent.ville && <span className="text-xs text-ardoise-clair">📍 {agent.ville}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-ardoise-clair flex-shrink-0 sm:text-right">
                  <p>Créé le</p>
                  <p className="font-medium">{new Date(agent.date_creation).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {afficherFormulaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-ardoise-clair/10 p-6 rounded-t-xl z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-ardoise">
                  {modeCreation === "invitation" ? "✉️ Inviter un nouvel agent" : `+ Créer un nouveau ${getLibelleType().toLowerCase()}`}
                </h2>
                <button onClick={() => setAfficherFormulaire(false)} className="text-ardoise-clair hover:text-ardoise transition-colors text-2xl leading-none" aria-label="Fermer">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {modeCreation === "invitation" && (
                <Alerte variante="info">L'agent recevra un email avec un lien sécurisé pour créer son compte lui-même.</Alerte>
              )}

              <ChampSaisie libelle="Email *" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="agent@exemple.com" required />
              
              <div className="grid grid-cols-2 gap-3">
                <ChampSaisie libelle="Prénom *" value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} placeholder="Prénom" required />
                <ChampSaisie libelle="Nom *" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} placeholder="Nom" required />
              </div>
              
              <ChampSaisie libelle="Téléphone" value={formData.telephone} onChange={(e) => setFormData({ ...formData, telephone: e.target.value })} placeholder="+221 77 123 45 67" />
              <ChampSaisie libelle="Ville" value={formData.ville} onChange={(e) => setFormData({ ...formData, ville: e.target.value })} placeholder="Dakar" />
              
              {/* ✅ Champ spécifique ONG */}
              {typeAgent === "ong" && modeCreation === "direct" && (
                <ChampSaisie libelle="Mission (optionnel)" value={formData.mission} onChange={(e) => setFormData({ ...formData, mission: e.target.value })} placeholder="Ex: Distribution alimentaire" />
              )}

              {/* ✅ Champ spécifique Médical */}
              {typeAgent === "medical" && modeCreation === "direct" && (
                <ChampSaisie libelle="Spécialité (optionnel)" value={formData.specialite} onChange={(e) => setFormData({ ...formData, specialite: e.target.value })} placeholder="Ex: Médecine générale" />
              )}
              
              {modeCreation === "invitation" && (
                <div>
                  <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Message personnalisé (optionnel)</label>
                  <textarea 
                    value={formData.message} 
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })} 
                    className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30" 
                    rows={3} 
                    placeholder="Ajoutez un message personnalisé à l'invitation..." 
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-ardoise-clair/10">
                <Bouton variante="primaire" chargement={sauvegarde} onClick={handleCreer} className="flex-1">
                  {modeCreation === "invitation" ? "Envoyer l'invitation" : `Créer le ${getLibelleType().toLowerCase()}`}
                </Bouton>
                <Bouton variante="ghost" onClick={() => setAfficherFormulaire(false)}>Annuler</Bouton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}