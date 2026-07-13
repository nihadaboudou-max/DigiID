"use client";

import { useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { Badge } from "@/composants/commun/Badge";
import { rechercherPersonnes } from "@/services/police";
import type { PersonneRecherchee } from "@/services/police";

export default function RecherchePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_police"]}>
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
      const resultats = await rechercherPersonnes({ query });
      setResultats(resultats.resultats || []);
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
          <Link key={i} href={`/police/profil/${p.digiid}`} className="block group">
            <div className="carte flex items-center gap-4 group-hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold">
                {(p.nom || "?").split(" ").map((n) => n[0] || "").join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ardoise group-hover:text-ocre transition-colors">{p.nom}</p>
                <p className="text-sm text-ardoise-clair font-mono">{p.digiid}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <Badge variante={p.est_actif ? "succes" : "terre"} taille="petit">{p.est_actif ? "Actif" : "Inactif"}</Badge>
                  <span className="text-xs text-ardoise-clair">Score: {p.score}</span>
                  {p.numero_cni && <span className="text-xs text-ardoise-clair">CNI: {p.numero_cni}</span>}
                </div>
              </div>
              <span className="text-xs text-ocre group-hover:translate-x-1 transition-all">→</span>
            </div>
          </Link>
        ))
      ) : (
        <Carte><p className="text-ardoise-clair italic text-center py-8">Utilisez le champ ci-dessus pour rechercher.</p></Carte>
      )}
      <Link href="/police/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
