"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Modal } from "@/composants/commun/Modal";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import {
  listerEquipe,
  obtenirStatistiquesChef,
  type AgentResponse,
  type StatistiquesChefResponse,
} from "@/services/chefs";

interface DashboardChefProps {
  titre: string;
  sousTitre: string;
  typeAgent: string; // "police", "medical", "ong", "enrolement"
  iconeDashboard: string;
  creerAgent: (data: any) => Promise<AgentResponse>;
  champsSupplementaires?: Array<{
    nom: string;
    label: string;
    type: string;
    required?: boolean;
  }>;
}

export default function DashboardChef({
  titre,
  sousTitre,
  typeAgent,
  iconeDashboard,
  creerAgent,
  champsSupplementaires = [],
}: DashboardChefProps) {
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [stats, setStats] = useState<StatistiquesChefResponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);

  // Formulaire
  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("");
  const [champsAdditionnels, setChampsAdditionnels] = useState<Record<string, string>>({});

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const [equipeData, statsData] = await Promise.all([
        listerEquipe({ par_page: 50 }),
        obtenirStatistiquesChef(),
      ]);
      setAgents(equipeData.agents || []);
      setStats(statsData);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement.");
    } finally {
      setChargement(false);
    }
  }

  function ouvrirFormulaire() {
    setEmail("");
    setPrenom("");
    setNom("");
    setTelephone("");
    setVille("");
    setChampsAdditionnels({});
    setAfficherFormulaire(true);
  }

  async function handleCreer() {
    if (!email || !prenom || !nom) return;
    setSauvegarde(true);
    try {
      const data: any = { email, prenom, nom, telephone, ville };
      // Ajouter les champs supplémentaires
      Object.entries(champsAdditionnels).forEach(([key, value]) => {
        if (value) data[key] = value;
      });
      await creerAgent(data);
      setAfficherFormulaire(false);
      charger();
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la création.");
    } finally {
      setSauvegarde(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            {iconeDashboard} {titre}
          </p>
          <h1 className="mt-1">{sousTitre}</h1>
          <p className="text-ardoise-clair mt-2">
            Gérez votre équipe et créez de nouveaux agents.
          </p>
        </div>
        <Bouton variante="primaire" onClick={ouvrirFormulaire}>
          + Nouvel agent
        </Bouton>
      </div>

      {/* Erreur */}
      {erreur && (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">{erreur}</p>
        </div>
      )}

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="carte text-center p-4">
            <p className="text-3xl font-bold text-lagune">{stats.total_agents}</p>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Total agents</p>
          </div>
          <div className="carte text-center p-4">
            <p className="text-3xl font-bold text-succes">{stats.agents_actifs}</p>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Actifs</p>
          </div>
          <div className="carte text-center p-4">
            <p className="text-3xl font-bold text-terre">{stats.agents_inactifs}</p>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Inactifs</p>
          </div>
          <div className="carte text-center p-4">
            <p className="text-3xl font-bold text-ocre">{stats.agents_crees_aujourdhui}</p>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Créés aujourd'hui</p>
          </div>
          <div className="carte text-center p-4">
            <p className="text-3xl font-bold text-jaune">{stats.agents_crees_ce_mois}</p>
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Ce mois</p>
          </div>
        </div>
      )}

      {/* Liste des agents */}
      <Carte titre={`${agents.length} agent(s) dans votre équipe`}>
        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
        ) : agents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-ardoise-clair italic mb-4">Aucun agent dans votre équipe.</p>
            <Bouton variante="primaire" taille="petit" onClick={ouvrirFormulaire}>
              + Créer votre premier agent
            </Bouton>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-4 bg-sable rounded-lg hover:bg-sable-fonce transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold flex-shrink-0">
                    {(agent.prenom[0] || "") + (agent.nom[0] || "")}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-ardoise truncate">
                      {agent.prenom} {agent.nom}
                    </p>
                    <p className="text-sm text-ardoise-clair truncate">{agent.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variante={agent.est_actif ? "succes" : "terre"}
                        taille="petit"
                      >
                        {agent.est_actif ? "Actif" : "Inactif"}
                      </Badge>
                      <span className="text-xs text-ardoise-clair font-mono">
                        {agent.digiid_public}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-ardoise-clair flex-shrink-0 ml-4">
                  <p>Créé le</p>
                  <p className="font-medium">
                    {new Date(agent.date_creation).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {/* Modal de création */}
      {afficherFormulaire && (
        <Modal
          ouvert={true}
          titre={`Créer un nouvel agent ${typeAgent}`}
          surFermeture={() => setAfficherFormulaire(false)}
        >
          <div className="space-y-4">
            <ChampSaisie
              libelle="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@exemple.com"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <ChampSaisie
                libelle="Prénom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Prénom"
                required
              />
              <ChampSaisie
                libelle="Nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom"
                required
              />
            </div>
            <ChampSaisie
              libelle="Téléphone"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+221 77 123 45 67"
            />
            <ChampSaisie
              libelle="Ville"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              placeholder="Dakar"
            />
            {/* Champs supplémentaires */}
            {champsSupplementaires.map((champ) => (
              <ChampSaisie
                key={champ.nom}
                libelle={champ.label}
                type={champ.type}
                value={champsAdditionnels[champ.nom] || ""}
                onChange={(e) =>
                  setChampsAdditionnels({
                    ...champsAdditionnels,
                    [champ.nom]: e.target.value,
                  })
                }
                placeholder={champ.label}
                required={champ.required}
              />
            ))}
            <div className="flex gap-3 pt-2">
              <Bouton
                variante="primaire"
                chargement={sauvegarde}
                onClick={handleCreer}
              >
                Créer l'agent
              </Bouton>
              <Bouton
                variante="ghost"
                onClick={() => setAfficherFormulaire(false)}
              >
                Annuler
              </Bouton>
            </div>
          </div>
        </Modal>
      )}

      <Link href="/police/dashboard">
        <Bouton variante="ghost">← Retour au dashboard</Bouton>
      </Link>
    </div>
  );
}