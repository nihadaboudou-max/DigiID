"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { listerDossiers } from "@/services/medical";
import clsx from "clsx";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const CRENEAUX = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
];

interface RendezVous {
  id: string;
  patient: string;
  digiid: string;
  motif: string;
  creneau: string;
  jour: number;
  statut: "planifie" | "confirme" | "termine";
}

export default function CalendrierMedecin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical", "chef_medical"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [dossiersCount, setDossiersCount] = useState(0);

  useEffect(() => {
    listerDossiers().then((d) => setDossiersCount(d.length)).catch(() => {});
  }, []);

  // RDV fictifs pour la semaine en cours (à remplacer par l'API plus tard)
  const rdvs: RendezVous[] = [];

  const debutSemaine = new Date();
  debutSemaine.setDate(debutSemaine.getDate() - debutSemaine.getDay() + 1);

  const joursSemaine = JOURS.map((nom, i) => {
    const d = new Date(debutSemaine);
    d.setDate(d.getDate() + i);
    return { nom, date: d, numero: d.getDate(), aujourdhui: d.toDateString() === new Date().toDateString() };
  });

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Calendrier</span>
      </nav>

      <div>
        <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Espace médical</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mt-1">Calendrier</h1>
            <p className="text-ardoise-clair mt-2">
              Planifiez et gérez vos rendez-vous médicaux.
            </p>
          </div>
          <p className="text-xs text-ardoise-clair/60">{dossiersCount} patients actifs</p>
        </div>
      </div>

      {/* Navigation semaine */}
      <div className="flex items-center justify-between">
        <Bouton variante="ghost" onClick={() => {}}>
          &larr; Semaine précédente
        </Bouton>
        <p className="text-sm font-semibold text-ardoise">
          {joursSemaine[0]?.date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
        </p>
        <Bouton variante="ghost" onClick={() => {}}>
          Semaine suivante &rarr;
        </Bouton>
      </div>

      {/* Grille hebdomadaire */}
      <div className="overflow-x-auto">
        <div className="min-w-[768px]">
          {/* En-tête des jours */}
          <div className="flex border-b border-ardoise-clair/10 pb-2 mb-2">
            <div className="w-16 flex-shrink-0" />
            {joursSemaine.map((j) => (
              <div key={j.nom} className={clsx(
                "flex-1 text-center py-2 rounded-lg mx-0.5",
                j.aujourdhui ? "bg-lagune/10" : "",
              )}>
                <p className="text-xs uppercase text-ardoise-clair/60 font-semibold">{j.nom}</p>
                <p className={clsx(
                  "text-lg font-bold",
                  j.aujourdhui ? "text-lagune" : "text-ardoise",
                )}>
                  {j.numero}
                </p>
              </div>
            ))}
          </div>

          {/* Créneaux */}
          <div className="space-y-0.5">
            {CRENEAUX.map((heure) => (
              <div key={heure} className="flex items-stretch">
                <div className="w-16 flex-shrink-0 py-2 text-[10px] text-ardoise-clair/50 text-right pr-2">
                  {heure}
                </div>
                {joursSemaine.map((j) => {
                  const rdv = rdvs.find(
                    (r) => r.creneau === heure && r.jour === j.date.getDay()
                  );
                  return (
                    <div
                      key={`${j.nom}-${heure}`}
                      className={clsx(
                        "flex-1 min-h-[36px] mx-0.5 rounded-lg border border-dashed border-ardoise-clair/5",
                        "hover:border-lagune/30 hover:bg-sable/30 transition-colors cursor-pointer",
                        j.aujourdhui ? "bg-sable/20" : "",
                      )}
                    >
                      {rdv && (
                        <div className="p-1.5 bg-lagune/10 rounded-lg border border-lagune/20 h-full">
                          <p className="text-[10px] font-semibold text-lagune truncate">{rdv.patient}</p>
                          <p className="text-[9px] text-ardoise-clair/60 truncate">{rdv.motif}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nouveau RDV */}
      <Carte titre="Ajouter un rendez-vous">
        <div className="max-w-md space-y-3">
          <p className="text-sm text-ardoise-clair">
            La planification automatique des rendez-vous arrive bientôt.
            Vous pouvez pour l&apos;instant utiliser vos dossiers patients
            pour organiser vos consultations.
          </p>
          <Link href="/medecin/dossiers">
            <Bouton variante="primaire">Voir les dossiers patients</Bouton>
          </Link>
        </div>
      </Carte>

      <Link href="/medecin/dashboard">
        <Bouton variante="ghost">Retour</Bouton>
      </Link>
    </div>
  );
}