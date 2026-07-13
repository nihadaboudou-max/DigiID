"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";

interface Mission {
  id: string;
  programme_id: string | null;
  titre: string;
  zone: string | null;
  date_depart: string;
  date_retour: string | null;
  objectifs: string | null;
  statut: string;
}

interface Programme {
  id: string;
  nom: string;
}

export default function MissionsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong", "chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [titre, setTitre] = useState("");
  const [zone, setZone] = useState("");
  const [date_depart, setDateDepart] = useState("");
  const [date_retour, setDateRetour] = useState("");
  const [objectifs, setObjectifs] = useState("");
  const [programme_id, setProgrammeId] = useState("");
  const [afficherForm, setAfficherForm] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const [missionsRes, programmesRes] = await Promise.all([
        fetch("/api/v1/ong/missions", { credentials: "include" }),
        fetch("/api/v1/ong/programmes", { credentials: "include" }),
      ]);

      if (!missionsRes.ok || !programmesRes.ok) {
        throw new Error("Erreur de chargement");
      }

      const [missionsData, programmesData] = await Promise.all([
        missionsRes.json(),
        programmesRes.json(),
      ]);

      setMissions(missionsData);
      setProgrammes(programmesData);
    } catch (error) {
      setErreur("Erreur de chargement des missions");
      console.error(error);
    } finally {
      setChargement(false);
    }
  }

  async function handleCreer() {
    if (!titre || !date_depart) return;
    setEnvoi(true);
    try {
      const reponse = await fetch("/api/v1/ong/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          titre,
          zone: zone || undefined,
          date_depart,
          date_retour: date_retour || undefined,
          objectifs: objectifs || undefined,
          programme_id: programme_id || undefined,
        }),
      });

      if (!reponse.ok) throw new Error("Erreur de création");

      setTitre(""); 
      setZone(""); 
      setDateDepart(""); 
      setDateRetour(""); 
      setObjectifs(""); 
      setProgrammeId("");
      setAfficherForm(false);
      await charger();
    } catch (error) {
      setErreur("Erreur lors de la création de la mission");
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
        <span className="text-ardoise font-semibold">Missions terrain</span>
      </nav>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-ocre text-xs uppercase font-semibold tracking-wider">ONG</p>
          <h1 className="mt-1 text-2xl">Missions terrain</h1>
          <p className="text-ardoise-clair mt-1 text-sm">{missions.length} mission(s)</p>
        </div>
        <Bouton variante="primaire" onClick={() => setAfficherForm(!afficherForm)}>
          {afficherForm ? "✕ Annuler" : "+ Nouvelle mission"}
        </Bouton>
      </div>

      {afficherForm && (
        <Carte titre="Planifier une mission">
          <div className="max-w-md space-y-3">
            <ChampSaisie 
              libelle="Titre" 
              value={titre} 
              onChange={(e) => setTitre(e.target.value)} 
              placeholder="Ex: Mission Dakar Nord"
              required
            />
            <ChampSaisie 
              libelle="Zone" 
              value={zone} 
              onChange={(e) => setZone(e.target.value)} 
              placeholder="Ex: Dakar"
            />
            
            {programmes.length > 0 && (
              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                  Programme lié (optionnel)
                </label>
                <select 
                  value={programme_id} 
                  onChange={(e) => setProgrammeId(e.target.value)}
                  className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white"
                >
                  <option value="">-- Aucun programme --</option>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <ChampSaisie 
                libelle="Date départ" 
                value={date_depart} 
                onChange={(e) => setDateDepart(e.target.value)} 
                type="date"
                required
              />
              <ChampSaisie 
                libelle="Date retour" 
                value={date_retour} 
                onChange={(e) => setDateRetour(e.target.value)} 
                type="date"
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Objectifs
              </label>
              <textarea 
                value={objectifs} 
                onChange={(e) => setObjectifs(e.target.value)} 
                rows={3}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                placeholder="Décrivez les objectifs de cette mission..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Bouton 
                variante="primaire" 
                disabled={!titre || !date_depart || envoi} 
                onClick={handleCreer}
                chargement={envoi}
              >
                {envoi ? "Création..." : "Planifier la mission"}
              </Bouton>
              <Bouton variante="ghost" onClick={() => setAfficherForm(false)}>
                Annuler
              </Bouton>
            </div>
          </div>
        </Carte>
      )}

      {chargement ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-ocre border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-ardoise-clair italic">Chargement...</p>
        </div>
      ) : missions.length === 0 ? (
        <Carte>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-ardoise-clair italic">Aucune mission planifiée.</p>
            <p className="text-xs text-ardoise-clair mt-2">Créez votre première mission pour commencer !</p>
          </div>
        </Carte>
      ) : (
        <div className="space-y-2">
          {missions.map((m) => (
            <div key={m.id} className="carte p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-bold text-ardoise">{m.titre}</h3>
                  <p className="text-xs text-ardoise-clair mt-1">
                    {m.zone || "Zone non spécifiée"}
                  </p>
                  <p className="text-xs text-ardoise-clair">
                    Du {new Date(m.date_depart).toLocaleDateString("fr-FR")}
                    {m.date_retour ? ` au ${new Date(m.date_retour).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                  {m.objectifs && (
                    <p className="text-xs text-ardoise-clair mt-2 italic">
                      {m.objectifs}
                    </p>
                  )}
                </div>
                <Badge 
                  variante={
                    m.statut === "en_cours" ? "succes" : 
                    m.statut === "planifiee" ? "ocre" : "lagune"
                  }
                >
                  {m.statut === "en_cours" ? "En cours" : 
                   m.statut === "planifiee" ? "Planifiée" : "Terminée"}
                </Badge>
              </div>
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