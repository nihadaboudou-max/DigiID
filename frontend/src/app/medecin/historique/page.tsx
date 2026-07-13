"use client";

/**
 * Historique — Timeline des consultations médicales.
 */
import Link from "next/link";
import { useState, useEffect } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { listerDossiers, listerConsultations } from "@/services/medical";
import type { DossierMedical, Consultation } from "@/services/medical";

interface Activite {
  id: string;
  type: "consultation" | "dossier_ouvert" | "dossier_archive";
  patient_nom: string;
  patient_digiid: string;
  motif: string;
  detail?: string;
  date: string;
}

export default function HistoriqueMedecin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [activites, setActivites] = useState<Activite[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    charger();
  }, []);

  async function charger() {
    setChargement(true);
    try {
      const dossiers = await listerDossiers();
      const toutes: Activite[] = [];

      for (const d of dossiers) {
        toutes.push({
          id: `dossier-${d.id}`,
          type: d.statut === "archive" ? "dossier_archive" : "dossier_ouvert",
          patient_nom: d.patient_nom,
          patient_digiid: d.patient_digiid,
          motif: d.motif,
          detail: d.diagnostic || undefined,
          date: d.date_creation,
        });

        try {
          const consultations = await listerConsultations(d.id);
          for (const c of consultations) {
            toutes.push({
              id: `consultation-${c.id}`,
              type: "consultation",
              patient_nom: d.patient_nom,
              patient_digiid: d.patient_digiid,
              motif: c.motif,
              detail: c.observations || c.diagnostic || undefined,
              date: c.date_consultation,
            });
          }
        } catch {}
      }

      toutes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setActivites(toutes);
    } catch {}
    finally { setChargement(false); }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Historique</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Espace medical</p>
          <h1 className="mt-1">Historique</h1>
          <p className="text-ardoise-clair mt-2">
            Timeline complete des consultations et interventions.
          </p>
        </div>
        <Bouton variante="ghost" onClick={charger}>
          Actualiser
        </Bouton>
      </div>

      {chargement ? (
        <div className="text-center py-12 text-ardoise-clair italic">Chargement de l historique...</div>
      ) : activites.length === 0 ? (
        <Carte titre="Aucune activite">
          <p className="text-ardoise-clair italic text-center py-8">
            Aucune consultation ou dossier pour le moment.
          </p>
        </Carte>
      ) : (
        <div className="relative">
          {/* Ligne verticale */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-ocre/20" />

          <div className="space-y-4">
            {activites.map((a) => (
              <div key={a.id} className="relative pl-12">
                {/* Point sur la timeline */}
                <div className={[
                  "absolute left-2.5 top-2 w-3 h-3 rounded-full border-2 border-white shadow",
                  a.type === "consultation"
                    ? "bg-lagune"
                    : a.type === "dossier_ouvert"
                    ? "bg-ocre"
                    : "bg-ardoise-clair",
                ].join(" ")} />

                <Carte>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ardoise text-sm">{a.patient_nom}</span>
                        <Badge variante={a.type === "consultation" ? "succes" : a.type === "dossier_ouvert" ? "lagune" : "neutre"}>
                          {a.type === "consultation" ? "Consultation" : a.type === "dossier_ouvert" ? "Nouveau dossier" : "Archive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-ardoise-clair mt-1">{a.motif}</p>
                      {a.detail && (
                        <p className="text-xs text-ardoise-clair/60 mt-1 italic">{a.detail}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-ardoise-clair whitespace-nowrap">
                        {new Date(a.date).toLocaleDateString("fr-FR", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                      <p className="text-[10px] text-ardoise-clair/50">{a.patient_digiid}</p>
                    </div>
                  </div>
                </Carte>
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href="/medecin/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
