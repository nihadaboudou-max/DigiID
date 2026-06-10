"use client";

/**
 * Page Historique — journal d'activité personnel de l'utilisateur.
 */
import { useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";

interface Activite {
  id: string;
  type: "connexion" | "modification" | "consentement" | "partage" | "score";
  description: string;
  date: string;
  ip?: string;
  appareil?: string;
}

const ACTIVITES_DEMO: Activite[] = [
  { id: "a-001", type: "connexion",   description: "Connexion réussie", date: "2026-05-29 14:23", ip: "41.82.183.45", appareil: "Chrome / Windows" },
  { id: "a-002", type: "consentement", description: "Consentement accordé : Accès aux données mobile money", date: "2026-05-28 10:15" },
  { id: "a-003", type: "partage",     description: "DigiID partagé via QR code", date: "2026-05-27 09:42" },
  { id: "a-004", type: "score",       description: "Score recalculé : 71 → 76", date: "2026-05-26 03:00" },
  { id: "a-005", type: "connexion",   description: "Connexion réussie", date: "2026-05-25 18:11", ip: "196.207.149.10", appareil: "App mobile" },
  { id: "a-006", type: "modification", description: "Profil modifié : ville changée", date: "2026-05-22 11:30" },
  { id: "a-007", type: "connexion",   description: "Connexion réussie", date: "2026-05-20 08:45", ip: "41.82.183.45", appareil: "Chrome / Windows" },
];

const STYLES_TYPE = {
  connexion: { libelle: "Connexion", variante: "lagune" as const },
  modification: { libelle: "Modification", variante: "ocre" as const },
  consentement: { libelle: "Consentement", variante: "lagune" as const },
  partage: { libelle: "Partage", variante: "lagune" as const },
  score: { libelle: "Score", variante: "ocre" as const },
};

export default function PageHistorique() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<"toutes" | Activite["type"]>("toutes");

  const activitesFiltrees = ACTIVITES_DEMO.filter((a) => {
    const matchFiltre = filtre === "toutes" || a.type === filtre;
    const matchRecherche =
      !recherche ||
      a.description.toLowerCase().includes(recherche.toLowerCase()) ||
      a.ip?.toLowerCase().includes(recherche.toLowerCase()) ||
      a.appareil?.toLowerCase().includes(recherche.toLowerCase());
    return matchFiltre && matchRecherche;
  });

  return (
    <div className="space-y-6 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Mon activité
        </p>
        <h1 className="mt-1">Historique</h1>
        <p className="text-ardoise-clair mt-2 max-w-2xl">
          Toutes les actions effectuées sur ton compte. Si quelque chose te paraît bizarre,
          déconnecte-toi et change ton mot de passe.
        </p>
      </header>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        {(["toutes", "connexion", "modification", "consentement", "partage", "score"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltre(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${
              filtre === f
                ? "bg-lagune text-white"
                : "bg-white border border-ardoise-clair/20 text-ardoise hover:bg-sable"
            }`}
          >
            {f === "toutes" ? "Tout" : f}
          </button>
        ))}
      </div>

      {/* Recherche */}
      <ChampRecherche
        placeholder="Rechercher dans l'historique..."
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
      />

      {/* Timeline */}
      {activitesFiltrees.length === 0 ? (
        <Carte>
          <p className="text-center text-ardoise-clair italic py-8">
            Aucune activité ne correspond à ces critères.
          </p>
        </Carte>
      ) : (
        <div className="space-y-3">
          {activitesFiltrees.map((a) => {
            const style = STYLES_TYPE[a.type];
            return (
              <Carte key={a.id} className="!py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variante={style.variante}>{style.libelle}</Badge>
                      <span className="text-xs text-ardoise-clair">{a.date}</span>
                    </div>
                    <p className="text-sm text-ardoise">{a.description}</p>
                    {(a.ip || a.appareil) && (
                      <div className="flex gap-4 mt-2 text-xs text-ardoise-clair">
                        {a.ip && <span><strong>IP :</strong> <code className="font-mono">{a.ip}</code></span>}
                        {a.appareil && <span><strong>Appareil :</strong> {a.appareil}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </Carte>
            );
          })}
        </div>
      )}

      <p className="text-xs text-ardoise-clair italic text-center pt-4">
        En Phase 2, cet historique sera tiré en temps réel du journal d'audit backend
        (table <code>journal_audit</code>).
      </p>
    </div>
  );
}
