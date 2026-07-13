"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { useRoleUI } from "@/crochets/useRoleUI";
import { listerMissions, creerMission, listerProgrammes } from "@/services/ong";
import type { MissionTerrain, ProgrammeONG } from "@/services/ong";

export default function MissionsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent-ong"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [missions, setMissions] = useState<MissionTerrain[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeONG[]>([]);
  const [chargement, setChargement] = useState(true);
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
    try { const [m, p] = await Promise.all([listerMissions(), listerProgrammes()]); setMissions(m); setProgrammes(p); }
    catch {}
    finally { setChargement(false); }
  }

  async function handleCreer() {
    if (!titre || !date_depart) return;
    setEnvoi(true);
    try {
      await creerMission({ titre, zone: zone || undefined, date_depart, date_retour: date_retour || undefined, objectifs: objectifs || undefined, programme_id: programme_id || undefined });
      setTitre(""); setZone(""); setDateDepart(""); setDateRetour(""); setObjectifs(""); setProgrammeId("");
      setAfficherForm(false);
      await charger();
    } catch {}
    finally { setEnvoi(false); }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/ong/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Missions terrain</span>
      </nav>

      <div className="flex justify-between items-center">
        <div>
          <p className="text-ocre text-sm uppercase font-semibold tracking-wider">ONG</p>
          <h1 className="mt-1">Missions terrain</h1>
          <p className="text-ardoise-clair mt-2">{missions.length} mission(s)</p>
        </div>
        <Bouton variante="primaire" onClick={() => setAfficherForm(!afficherForm)}>
          {afficherForm ? "Annuler" : "+ Nouvelle mission"}
        </Bouton>
      </div>

      {afficherForm && (
        <Carte titre="Planifier une mission">
          <div className="max-w-md space-y-3">
            <ChampSaisie libelle="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex: Mission Dakar Nord" />
            <ChampSaisie libelle="Zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex: Dakar" />
            <select value={programme_id} onChange={(e) => setProgrammeId(e.target.value)}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white">
              <option value="">-- Programme lie (optionnel) --</option>
              {programmes.map((p) => (<option key={p.id} value={p.id}>{p.nom}</option>))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <ChampSaisie libelle="Date depart" value={date_depart} onChange={(e) => setDateDepart(e.target.value)} type="date" />
              <ChampSaisie libelle="Date retour" value={date_retour} onChange={(e) => setDateRetour(e.target.value)} type="date" />
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Objectifs</label>
              <textarea value={objectifs} onChange={(e) => setObjectifs(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none" />
            </div>
            <Bouton variante="primaire" disabled={!titre || !date_depart || envoi} onClick={handleCreer}>
              {envoi ? "Creation..." : "Planifier la mission"}
            </Bouton>
          </div>
        </Carte>
      )}

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
      ) : missions.length === 0 ? (
        <Carte><p className="text-ardoise-clair italic text-center py-8">Aucune mission.</p></Carte>
      ) : (
        <div className="space-y-2">
          {missions.map((m) => (
            <div key={m.id} className="carte">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-ardoise">{m.titre}</h3>
                <Badge variante={m.statut === "en_cours" ? "succes" : m.statut === "planifiee" ? "ocre" : "lagune"}>
                  {m.statut === "en_cours" ? "En cours" : m.statut === "planifiee" ? "Planifiee" : "Terminee"}
                </Badge>
              </div>
              <p className="text-xs text-ardoise-clair mt-1">{m.zone || "N/A"}</p>
              <p className="text-xs text-ardoise-clair">du {new Date(m.date_depart).toLocaleDateString("fr-FR")}{m.date_retour ? " au " + new Date(m.date_retour).toLocaleDateString("fr-FR") : ""}</p>
            </div>
          ))}
        </div>
      )}
      <Link href="/ong/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
