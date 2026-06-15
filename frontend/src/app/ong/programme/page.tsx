"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { useRoleUI } from "@/crochets/useRoleUI";
import { listerProgrammes, creerProgramme } from "@/services/ong";
import type { ProgrammeONG } from "@/services/ong";

export default function ProgrammePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["ong"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [programmes, setProgrammes] = useState<ProgrammeONG[]>([]);
  const [chargement, setChargement] = useState(true);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [zone, setZone] = useState("");
  const [budget, setBudget] = useState("");
  const [date_debut, setDateDebut] = useState("");
  const [afficherForm, setAfficherForm] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { charger(); }, []);
  async function charger() {
    setChargement(true);
    try { setProgrammes(await listerProgrammes()); }
    catch {}
    finally { setChargement(false); }
  }

  async function handleCreer() {
    if (!nom || !date_debut) return;
    setEnvoi(true);
    try {
      await creerProgramme({ nom, description: description || undefined, zone: zone || undefined, budget: budget ? parseFloat(budget) : undefined, date_debut });
      setNom(""); setDescription(""); setZone(""); setBudget(""); setDateDebut("");
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
        <span className="text-ardoise font-semibold">Programmes</span>
      </nav>
      <div className="flex justify-between items-center">
        <div>
          <p className="text-ocre text-sm uppercase font-semibold tracking-wider">ONG</p>
          <h1 className="mt-1">Programmes</h1>
          <p className="text-ardoise-clair mt-2">{programmes.length} programme(s)</p>
        </div>
        <Bouton variante="primaire" onClick={() => setAfficherForm(!afficherForm)}>
          {afficherForm ? "Annuler" : "+ Nouveau programme"}
        </Bouton>
      </div>

      {afficherForm && (
        <Carte titre="Creer un programme">
          <div className="max-w-md space-y-3">
            <ChampSaisie libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Aide alimentaire 2026" />
            <ChampSaisie libelle="Zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex: Dakar" />
            <ChampSaisie libelle="Budget (FCFA)" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Ex: 5000000" type="number" />
            <ChampSaisie libelle="Date de debut" value={date_debut} onChange={(e) => setDateDebut(e.target.value)} type="date" />
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none" />
            </div>
            <Bouton variante="primaire" disabled={!nom || !date_debut || envoi} onClick={handleCreer}>
              {envoi ? "Creation..." : "Creer le programme"}
            </Bouton>
          </div>
        </Carte>
      )}

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
      ) : programmes.length === 0 ? (
        <Carte><p className="text-ardoise-clair italic text-center py-8">Aucun programme.</p></Carte>
      ) : (
        <div className="space-y-2">
          {programmes.map((p) => (
            <div key={p.id} className="carte">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-ardoise">{p.nom}</h3>
                <Badge variante={p.statut === "actif" ? "succes" : "lagune"}>{p.statut === "actif" ? "Actif" : "Termine"}</Badge>
              </div>
              <p className="text-xs text-ardoise-clair mt-1">{p.description || "Aucune description"}</p>
              <p className="text-xs text-ardoise-clair">{p.zone || "N/A"} · Budget: {p.budget ? p.budget.toLocaleString() + " FCFA" : "Non defini"} · {new Date(p.date_debut).toLocaleDateString("fr-FR")}</p>
            </div>
          ))}
        </div>
      )}
      <Link href="/ong/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
