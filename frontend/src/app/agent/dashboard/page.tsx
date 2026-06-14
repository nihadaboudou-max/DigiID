"use client";

/**
 * Tableau de bord Agent Terrain — Enrôlement des citoyens.
 * 
 * Modules accessibles :
 *   - enrolement_citoyen    → /agent/enrolement
 *   - scan_ocr_cni          → /agent/scan
 *   - capture_biometrique   → /agent/capture
 *   - liste_enrollements    → (liste intégrée)
 *   - recherche_citoyen     → /agent/recherche
 *   - stats_enrolement      → (statistiques intégrées)
 */
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { useRoleUI } from "@/crochets/useRoleUI";

export default function AgentDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

const ENROLEMENTS_RECENTS = [
  { id: "ENR-001", nom: "Mamadou Dia", date: "2026-06-10", statut: "valide" as const },
  { id: "ENR-002", nom: "Aminata Sow", date: "2026-06-10", statut: "en_attente" as const },
  { id: "ENR-003", nom: "Cheikh Niang", date: "2026-06-09", statut: "valide" as const },
  { id: "ENR-004", nom: "Ndèye Fall", date: "2026-06-09", statut: "en_attente" as const },
  { id: "ENR-005", nom: "Pape Diop", date: "2026-06-08", statut: "valide" as const },
];

function Contenu() {
  const { can, chargement } = useRoleUI();

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <header>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Agent terrain</p>
          <h1 className="mt-1">Tableau de bord</h1>
        </header>
        <p className="text-ardoise-clair italic text-center py-12">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Agent terrain</p>
          <h1 className="mt-1">Enrôlement des citoyens</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Inscris les nouveaux citoyens au système DigiID. Capture biométrique et scan de documents.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {can.enroll && (
            <Link href="/agent/enrolement">
              <Bouton variante="primaire">+ Nouvel enrôlement</Bouton>
            </Link>
          )}
          {can.scanCNI && (
            <Link href="/agent/scan">
              <Bouton variante="secondaire">Scanner une CNI</Bouton>
            </Link>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">12</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Enrôlés aujourd'hui</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-ocre">20</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Objectif du jour</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">85%</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Taux de validation</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">4</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">En attente</p>
        </div>
      </div>

      {/* Barre de progression objectif */}
      <Carte titre="Progression du jour">
        <BarreProgression valeur={60} label="12/20 enrôlements" couleur="ocre" />
      </Carte>

      {/* Liste des enrôlements récents */}
      {can.viewEnrollments && (
        <Carte titre="Enrôlements récents">
          <div className="space-y-2">
            {ENROLEMENTS_RECENTS.map((enr) => (
              <div
                key={enr.id}
                className="flex items-center justify-between p-3 bg-sable rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold">
                    {enr.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ardoise">{enr.nom}</p>
                    <p className="text-xs text-ardoise-clair">{enr.id} · {new Date(enr.date).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
                <Badge variante={enr.statut === "valide" ? "succes" : "ocre"}>
                  {enr.statut === "valide" ? "Validé" : "En attente"}
                </Badge>
              </div>
            ))}
          </div>
        </Carte>
      )}

      {/* Accès rapide */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {can.enroll && (
          <CarteAction titre="Nouvel enrôlement" description="Inscrire un nouveau citoyen" href="/agent/enrolement" icone="👤" />
        )}
        {can.scanCNI && (
          <CarteAction titre="Scanner CNI" description="OCR de la carte d'identité" href="/agent/scan" icone="🪪" />
        )}
        {can.captureBiometrics && (
          <CarteAction titre="Capture biométrique" description="Photo et empreinte" href="/agent/capture" icone="🔐" />
        )}
      </div>
    </div>
  );
}

function CarteAction({ titre, description, href, icone }: { titre: string; description: string; href: string; icone: string }) {
  return (
    <Link href={href} className="block group">
      <div className="carte cursor-pointer hover:shadow-lg transition-all h-full">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{icone}</span>
          <div>
            <h3 className="font-bold text-ardoise group-hover:text-ocre transition-colors">{titre}</h3>
            <p className="text-sm text-ardoise-clair mt-1">{description}</p>
          </div>
        </div>
        <p className="text-xs text-ocre font-semibold mt-3 group-hover:translate-x-1 transition-transform">Accéder →</p>
      </div>
    </Link>
  );
}
