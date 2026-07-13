"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";

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

export default function ProgrammePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong", "ong", "chef_ong", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const reponse = await fetch("/api/v1/ong/programmes", { credentials: "include" });
      if (!reponse.ok) throw new Error("Erreur de chargement");
      const data = await reponse.json();
      setProgrammes(data);
    } catch (error) {
      setErreur("Erreur de chargement des programmes");
      console.error(error);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="space-y-6 apparition">
      <nav className="text-sm text-ardoise-clair">
        <Link href="/ong" className="hover:text-ocre">Tableau de bord</Link>
        <span className="mx-2">/</span>
        <span className="text-ardoise font-semibold">Programmes</span>
      </nav>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div>
        <p className="text-ocre text-xs uppercase font-semibold tracking-wider">Agent ONG</p>
        <h1 className="mt-1 text-2xl">Programmes</h1>
        <p className="text-ardoise-clair mt-1 text-sm">{programmes.length} programme(s)</p>
      </div>

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
            <p className="text-xs text-ardoise-clair mt-2">Les programmes sont créés par votre chef ONG.</p>
          </div>
        </Carte>
      ) : (
        <div className="space-y-2">
          {programmes.map((p) => (
            <div key={p.id} className="carte p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1">
                  <h3 className="font-bold text-ardoise">{p.nom}</h3>
                  {p.description && (
                    <p className="text-xs text-ardoise-clair mt-1">{p.description}</p>
                  )}
                  <p className="text-xs text-ardoise-clair mt-1">
                    {p.zone || "Zone non spécifiée"} · 
                    Budget: {p.budget ? p.budget.toLocaleString() + " FCFA" : "Non défini"} · 
                    Début: {new Date(p.date_debut).toLocaleDateString("fr-FR")}
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

      <Link href="/ong">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}