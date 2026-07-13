"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";

interface Beneficiaire {
  id: string;
  nom: string;
  digiid: string | null;
  programme: string;
  zone: string | null;
  date_inscription: string;
  statut: string;
  notes: string | null;
}

export default function BeneficiairesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong", "chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [nom, setNom] = useState("");
  const [digiid, setDigiid] = useState("");
  const [programme, setProgramme] = useState("");
  const [zone, setZone] = useState("");
  const [notes, setNotes] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await fetch("/api/v1/ong/beneficiaires", {
        credentials: "include",
      });
      if (!reponse.ok) throw new Error("Erreur de chargement");
      const data = await reponse.json();
      setBeneficiaires(data);
    } catch (error) {
      setErreur("Erreur de chargement des bénéficiaires");
      console.error(error);
    } finally {
      setChargement(false);
    }
  }

  async function handleCreer() {
    if (!nom || !programme) return;
    setEnvoi(true);
    try {
      const reponse = await fetch("/api/v1/ong/beneficiaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nom,
          digiid: digiid || undefined,
          programme,
          zone: zone || undefined,
          notes: notes || undefined,
        }),
      });
      if (!reponse.ok) throw new Error("Erreur de création");
      await charger();
      setNom(""); setDigiid(""); setProgramme(""); setZone(""); setNotes("");
      setAfficherFormulaire(false);
    } catch (error) {
      setErreur("Erreur lors de la création du bénéficiaire");
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
          <p className="text-ocre text-xs uppercase font-semibold tracking-wider">ONG</p>
          <h1 className="mt-1 text-2xl">Bénéficiaires</h1>
          <p className="text-ardoise-clair mt-1 text-sm">{beneficiaires.length} bénéficiaire(s) inscrit(s)</p>
        </div>
        <Bouton variante="primaire" onClick={() => setAfficherFormulaire(!afficherFormulaire)}>
          {afficherFormulaire ? "✕ Annuler" : "+ Nouveau bénéficiaire"}
        </Bouton>
      </div>

      {afficherFormulaire && (
        <Carte titre="Ajouter un bénéficiaire">
          <div className="max-w-md space-y-3">
            <ChampSaisie 
              libelle="Nom complet" 
              value={nom} 
              onChange={(e) => setNom(e.target.value)} 
              placeholder="Ex: Fatou Diallo"
              required
            />
            <ChampSaisie 
              libelle="DigiID (optionnel)" 
              value={digiid} 
              onChange={(e) => setDigiid(e.target.value)} 
              placeholder="Ex: A1B2C3D4E5F6G7H8"
            />
            <ChampSaisie 
              libelle="Programme" 
              value={programme} 
              onChange={(e) => setProgramme(e.target.value)} 
              placeholder="Ex: Aide alimentaire"
              required
            />
            <ChampSaisie 
              libelle="Zone (optionnel)" 
              value={zone} 
              onChange={(e) => setZone(e.target.value)} 
              placeholder="Ex: Dakar"
            />
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Notes (optionnel)
              </label>
              <textarea 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                rows={3}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                placeholder="Informations complémentaires..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Bouton 
                variante="primaire" 
                disabled={!nom || !programme || envoi} 
                onClick={handleCreer}
                chargement={envoi}
              >
                {envoi ? "Ajout..." : "Ajouter le bénéficiaire"}
              </Bouton>
              <Bouton variante="ghost" onClick={() => setAfficherFormulaire(false)}>
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
                  <div className="w-10 h-10 rounded-full bg-ocre/10 flex items-center justify-center text-ocre font-bold">
                    {b.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-ardoise">{b.nom}</p>
                    <p className="text-xs text-ardoise-clair">
                      {b.programme} · {b.zone || "Zone non spécifiée"}
                      {b.digiid && ` · DigiID: ${b.digiid}`}
                    </p>
                  </div>
                </div>
                <Badge variante={b.statut === "actif" ? "succes" : "lagune"}>
                  {b.statut === "actif" ? "Actif" : "Inactif"}
                </Badge>
              </div>
              {b.notes && (
                <p className="text-xs text-ardoise-clair mt-2 italic">{b.notes}</p>
              )}
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