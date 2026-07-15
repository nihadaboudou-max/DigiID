"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI } from "@/services/client_api";

interface Beneficiaire {
  id: string;
  nom: string;
  digiid: string | null;
  programme: string;
  mission_id: string | null;
  mission_titre: string | null;
  zone: string | null;
  date_inscription: string;
  statut: string;
  notes: string | null;
}

interface Programme {
  id: string;
  nom: string;
}

interface Mission {
  id: string;
  titre: string;
  statut: string;
}

export default function BeneficiairesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong", "ong", "chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  
  const [nom, setNom] = useState("");
  const [digiid, setDigiid] = useState("");
  const [programme, setProgramme] = useState("");
  const [missionId, setMissionId] = useState("");
  const [zone, setZone] = useState("");
  const [notes, setNotes] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { 
    charger(); 
    chargerProgrammes();
    chargerMissions();
  }, []);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const response: any = await clientAPI.get("/api/v1/ong/beneficiaires", { authentifie: true });
      const dataArray = Array.isArray(response) ? response : (response.beneficiaires || response.data || []);
      setBeneficiaires(dataArray);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des bénéficiaires");
      console.error(error);
    } finally {
      setChargement(false);
    }
  }

  async function chargerProgrammes() {
    try {
      const response: any = await clientAPI.get("/api/v1/ong/programmes", { authentifie: true });
      const dataArray = Array.isArray(response) ? response : (response.programmes || response.data || []);
      setProgrammes(dataArray);
    } catch (error) {
      console.error("Erreur chargement programmes:", error);
    }
  }

  async function chargerMissions() {
    try {
      const response: any = await clientAPI.get("/api/v1/ong/missions", { authentifie: true });
      const dataArray = Array.isArray(response) ? response : (response.missions || response.data || []);
      
      // On garde toutes les missions pour le Chef, mais on peut filtrer si besoin
      // Le backend filtre déjà automatiquement : le Chef voit tout, l'Agent voit seulement ses missions assignées.
      setMissions(dataArray);
    } catch (error) {
      console.error("Erreur chargement missions:", error);
    }
  }

  async function handleCreer() {
    if (!nom || !programme) {
      setErreur("Le nom et le programme sont obligatoires.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await clientAPI.post("/api/v1/ong/beneficiaires", {
        nom,
        digiid: digiid || null,
        programme,
        mission_id: missionId || null,
        zone: zone || null,
        notes: notes || null,
      }, { authentifie: true });
      
      await charger();
      // Réinitialisation du formulaire
      setNom(""); setDigiid(""); setProgramme(""); setMissionId(""); setZone(""); setNotes("");
      setAfficherFormulaire(false);
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la création du bénéficiaire");
      console.error(error);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="space-y-6 apparition">
      <nav className="text-sm text-ardoise-clair">
        <Link href="/ong" className="hover:text-ocre">Tableau de bord</Link>
        <span className="mx-2">/</span>
        <span className="text-ardoise font-semibold">Bénéficiaires</span>
      </nav>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-ocre text-xs uppercase font-semibold tracking-wider">Gestion ONG</p>
          <h1 className="mt-1 text-2xl">Bénéficiaires</h1>
          <p className="text-ardoise-clair mt-1 text-sm">{beneficiaires.length} bénéficiaire(s) inscrit(s)</p>
        </div>
        <Bouton variante="primaire" onClick={() => setAfficherFormulaire(!afficherFormulaire)}>
          {afficherFormulaire ? "✕ Annuler" : "+ Nouveau bénéficiaire"}
        </Bouton>
      </div>

      {afficherFormulaire && (
        <Carte titre="Ajouter un bénéficiaire">
          <div className="max-w-md space-y-4">
            <ChampSaisie libelle="Nom complet *" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Fatou Diallo" required />
            <ChampSaisie libelle="DigiID (optionnel)" value={digiid} onChange={(e) => setDigiid(e.target.value)} placeholder="Ex: A1B2C3D4E5F6G7H8" />
            
            {/* Sélection du programme */}
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Programme *</label>
              <select
                value={programme}
                onChange={(e) => setProgramme(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30 bg-white"
                required
              >
                <option value="">Sélectionner un programme</option>
                {programmes.map((p) => (
                  <option key={p.id} value={p.nom}>{p.nom}</option>
                ))}
                <option value="activite_quotidienne">📋 Activité quotidienne</option>
              </select>
            </div>

            {/* Sélection de la mission */}
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Mission (optionnel)</label>
              <select
                value={missionId}
                onChange={(e) => setMissionId(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30 bg-white"
              >
                <option value="">Aucune mission</option>
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.titre} {m.statut === 'en_cours' ? '(En cours)' : '(Planifiée)'}
                  </option>
                ))}
              </select>
              {missions.length === 0 && (
                <p className="text-xs text-ardoise-clair mt-1 italic">
                  ℹ️ Aucune mission disponible. (En tant qu'agent, vous ne voyez que vos missions assignées).
                </p>
              )}
            </div>

            <ChampSaisie libelle="Zone (optionnel)" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex: Dakar" />
            
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Notes (optionnel)</label>
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                rows={3} 
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lagune/30" 
                placeholder="Informations complémentaires..." 
              />
            </div>
            
            <div className="flex gap-2 pt-2">
              <Bouton variante="primaire" disabled={!nom || !programme || envoi} onClick={handleCreer} chargement={envoi} className="flex-1">
                {envoi ? "Ajout en cours..." : "Ajouter le bénéficiaire"}
              </Bouton>
              <Bouton variante="ghost" onClick={() => setAfficherFormulaire(false)}>Annuler</Bouton>
            </div>
          </div>
        </Carte>
      )}

      {chargement ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-ocre border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-ardoise-clair italic">Chargement...</p>
        </div>
      ) : beneficiaires.length === 0 ? (
        <Carte>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-ardoise-clair italic">Aucun bénéficiaire enregistré.</p>
            <p className="text-xs text-ardoise-clair mt-2">Commencez par ajouter votre premier bénéficiaire !</p>
          </div>
        </Carte>
      ) : (
        <div className="space-y-2">
          {beneficiaires.map((b) => (
            <div key={b.id} className="carte p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ocre/10 flex items-center justify-center text-ocre font-bold flex-shrink-0">
                    {(b.nom || "U").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-ardoise">{b.nom}</p>
                    <p className="text-xs text-ardoise-clair">
                      {b.programme} 
                      {b.mission_titre && <span className="text-lagune font-medium"> · 📋 {b.mission_titre}</span>}
                      {b.zone && <span> · 📍 {b.zone}</span>}
                    </p>
                  </div>
                </div>
                <Badge variante={b.statut === "actif" ? "succes" : "lagune"}>
                  {b.statut === "actif" ? "Actif" : "Inactif"}
                </Badge>
              </div>
              {b.notes && <p className="text-xs text-ardoise-clair mt-3 italic bg-sable p-2 rounded">📝 {b.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <Link href="/ong">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}