"use client";

import { useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { Badge } from "@/composants/commun/Badge";
import { rechercherPersonne } from "@/services/police";
import type { PersonneRecherchee } from "@/services/police";

export default function RecherchePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [query, setQuery] = useState("");
  const [resultats, setResultats] = useState<PersonneRecherchee[]>([]);
  const [recherche, setRecherche] = useState(false);

  async function handleSearch() {
    if (!query) return;
    setRecherche(true);
    try {
      // Le backend renvoie maintenant directement un tableau
      const personnes = await rechercherPersonne(query);
      setResultats(personnes || []);
    } catch {
      setResultats([]);
    } finally {
      setRecherche(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Recherche avancee</span>
      </nav>
      <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Forces de l ordre</p>
      <h1>Recherche avancee</h1>

      <Carte titre="Rechercher">
        <div className="flex gap-2">
          <ChampRecherche placeholder="DigiID, nom, email..." value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }} />
          <Bouton variante="primaire" disabled={recherche || !query} onClick={handleSearch}>
            {recherche ? "..." : "🔍"}
          </Bouton>
        </div>
      </Carte>

      {resultats.length > 0 ? (
        resultats.map((p, i) => (
          <div key={i} className="carte flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold">
              {/* Correction : gère les noms vides ou nuls */}
              {(p.nom || "?").split(" ").map((n) => n[0] || "").join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-ardoise">{p.nom}</p>
              <p className="text-sm text-ardoise-clair">{p.digiid}</p>
              <div className="flex gap-2 mt-1">
                <Badge variante={p.est_actif ? "succes" : "terre"}>{p.est_actif ? "Actif" : "Inactif"}</Badge>
                <span className="text-xs text-ardoise-clair">Score: {p.score}</span>
              </div>
            </div>
          </div>
        ))
      ) : (
        <Carte><p className="text-ardoise-clair italic text-center py-8">Utilisez le champ ci-dessus pour rechercher.</p></Carte>
      )}
      <Link href="/police/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
