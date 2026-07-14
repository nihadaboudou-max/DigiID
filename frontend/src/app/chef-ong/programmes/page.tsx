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

interface Programme {
  id: string;
  nom: string;
  description: string | null;
  zone: string | null;
  budget: number | null;
  date_debut: string;
  date_fin: string | null;
  statut: string;
}

export default function ChefOngProgrammesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [afficherForm, setAfficherForm] = useState(false);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [zone, setZone] = useState("");
  const [budget, setBudget] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      // ✅ Utilise clientAPI pour l'authentification automatique
      const data = await clientAPI.get("/api/v1/chefs/ong/programmes", {
        authentifie: true,
      });
      setProgrammes(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement des programmes");
    } finally {
      setChargement(false);
    }
  }

  async function handleCreer() {
    if (!nom || !dateDebut) {
      setErreur("Le nom et la date de début sont obligatoires.");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await clientAPI.post("/api/v1/chefs/ong/programmes", {
        nom,
        description: description || null,
        zone: zone || null,
        budget: budget ? parseFloat(budget) : null,
        date_debut: dateDebut,
        date_fin: dateFin || null,
      }, { authentifie: true });
      
      await charger();
      setNom(""); setDescription(""); setZone(""); setBudget(""); setDateDebut(""); setDateFin("");
      setAfficherForm(false);
    } catch (error: any) {
      setErreur(error?.message || "Erreur lors de la création");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="space-y-6 apparition">
      <nav className="text-sm text-ardoise-clair">
        <Link href="/chef-ong" className="hover:text-ocre">Tableau de bord</Link>
        <span className="mx-2">/</span>
        <span className="text-ardoise font-semibold">Programmes</span>
      </nav>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-ocre text-xs uppercase font-semibold tracking-wider">Chef ONG</p>
          <h1 className="mt-1 text-2xl font-bold text-ardoise">Programmes</h1>
          <p className="text-ardoise-clair mt-1 text-sm">{programmes.length} programme(s)</p>
        </div>
        <Bouton variante="primaire" onClick={() => setAfficherForm(!afficherForm)}>
          {afficherForm ? "✕ Annuler" : "+ Nouveau programme"}
        </Bouton>
      </div>

      {afficherForm && (
        <Carte titre="Créer un programme">
          <div className="max-w-md space-y-3">
            <ChampSaisie libelle="Nom *" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Aide alimentaire 2026" required />
            <ChampSaisie libelle="Zone" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex: Dakar" />
            <ChampSaisie libelle="Budget (FCFA)" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Ex: 5000000" type="number" />
            <div className="grid grid-cols-2 gap-3">
              <ChampSaisie libelle="Date de début *" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} type="date" required />
              <ChampSaisie libelle="Date de fin" value={dateFin} onChange={(e) => setDateFin(e.target.value)} type="date" />
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none" placeholder="Décrivez le programme..." />
            </div>
            <div className="flex gap-2 pt-2">
              <Bouton variante="primaire" disabled={!nom || !dateDebut || envoi} onClick={handleCreer} chargement={envoi}>
                {envoi ? "Création..." : "Créer le programme"}
              </Bouton>
              <Bouton variante="ghost" onClick={() => setAfficherForm(false)}>Annuler</Bouton>
            </div>
          </div>
        </Carte>
      )}

      {chargement ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-ocre border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-ardoise-clair italic">Chargement...</p>
        </div>
      ) : programmes.length === 0 ? (
        <Carte>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-ardoise-clair italic">Aucun programme enregistré.</p>
            <p className="text-xs text-ardoise-clair mt-2">Créez votre premier programme pour commencer !</p>
          </div>
        </Carte>
      ) : (
        <div className="space-y-2">
          {programmes.map((p) => (
            <div key={p.id} className="carte p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-bold text-ardoise">{p.nom}</h3>
                  {p.description && <p className="text-xs text-ardoise-clair mt-1">{p.description}</p>}
                  <p className="text-xs text-ardoise-clair mt-1">
                    {p.zone || "Zone non spécifiée"} · Budget: {p.budget ? p.budget.toLocaleString() + " FCFA" : "Non défini"} · Début: {new Date(p.date_debut).toLocaleDateString("fr-FR")}
                    {p.date_fin && ` · Fin: ${new Date(p.date_fin).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
                <Badge variante={p.statut === "actif" ? "succes" : "lagune"}>
                  {p.statut === "actif" ? "Actif" : "Terminé"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link href="/chef-ong">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}