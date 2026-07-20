"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { listerDossiers } from "@/services/medical";
import type { DossierMedical } from "@/services/medical";

export default function MedecinDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical", "chef_medical"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [dossiers, setDossiers] = useState<DossierMedical[]>([]);
  const [chargementDossiers, setChargementDossiers] = useState(true);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    chargerDossiers();
  }, []);

  async function chargerDossiers() {
    setChargementDossiers(true);
    try {
      const data = await listerDossiers();
      setDossiers(data);
    } catch (error) {
      console.error("Erreur chargement dossiers:", error);
    } finally {
      setChargementDossiers(false);
    }
  }

  const ouverts = dossiers.filter((d) => d.statut === "ouvert").length;
  const aujourdui = dossiers.filter(
    (d) => new Date(d.date_creation).toDateString() === new Date().toDateString(),
  ).length;
  const incomplets = dossiers.filter((d) => !d.diagnostic).length;

  return (
    <div className="space-y-8 apparition">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace médical</p>
          <h1 className="mt-1">Tableau de bord médecin</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">Gérez vos patients, créez et suivez les dossiers médicaux.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link href="/medecin/nouveau-dossier">
            <Bouton variante="primaire">+ Nouveau dossier</Bouton>
          </Link>
          <Link href="/medecin/dossiers">
            <Bouton variante="ghost">Voir tous les dossiers</Bouton>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="carte text-center p-4">
          <p className="text-3xl md:text-4xl font-bold mb-2 text-lagune">{chargementDossiers ? "..." : aujourdui}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Patients aujourd'hui</p>
        </div>
        <div className="carte text-center p-4">
          <p className="text-3xl md:text-4xl font-bold mb-2 text-ocre">{chargementDossiers ? "..." : ouverts}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Dossiers ouverts</p>
        </div>
        <div className="carte text-center p-4">
          <p className="text-3xl md:text-4xl font-bold mb-2 text-succes">{chargementDossiers ? "..." : dossiers.length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Total dossiers</p>
        </div>
        <div className="carte text-center p-4">
          <p className="text-3xl md:text-4xl font-bold mb-2 text-terre">{chargementDossiers ? "..." : incomplets}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Sans diagnostic</p>
        </div>
      </div>

      <Carte titre="Recherche patient">
        <p className="text-sm text-ardoise-clair mb-3">Recherche par DigiID ou nom</p>
        <div className="flex gap-2">
          <ChampRecherche placeholder="DigiID ou nom du patient..." value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <Bouton variante="primaire" taille="petit" onClick={async () => {
            setChargementDossiers(true);
            try { 
              const data = await listerDossiers(undefined, recherche || undefined); 
              setDossiers(data); 
            } finally { 
              setChargementDossiers(false); 
            }
          }}>🔍</Bouton>
        </div>
      </Carte>

      <Carte titre="Dossiers récents">
        {chargementDossiers ? (
          <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
        ) : dossiers.length === 0 ? (
          <p className="text-ardoise-clair italic text-center py-8">Aucun dossier. Créez votre premier dossier !</p>
        ) : (
          <div className="space-y-2">
            {dossiers.slice(0, 5).map((dossier) => (
              <div key={dossier.id} className="flex items-center justify-between p-3 bg-sable rounded-lg hover:bg-sable/80 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ocre/10 flex items-center justify-center text-ocre font-bold">
                    {(dossier.patient_prenom?.[0] || "") + (dossier.patient_nom[0] || "")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ardoise">{dossier.patient_prenom} {dossier.patient_nom}</p>
                    <p className="text-xs text-ardoise-clair">{dossier.motif} · {new Date(dossier.date_creation).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variante={dossier.statut === "ouvert" ? "succes" : "lagune"} taille="petit">
                    {dossier.statut === "ouvert" ? "Ouvert" : "Archivé"}
                  </Badge>
                  <Link href={`/medecin/dossiers/${dossier.id}`} className="text-xs text-ocre hover:underline">Voir →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Carte>

      {incomplets > 0 && (
        <div className="bg-ocre/10 border-l-4 border-ocre p-4 rounded">
          <p className="text-sm font-semibold text-ocre">⚠ {incomplets} dossier(s) sans diagnostic</p>
          <p className="text-xs text-ardoise-clair mt-1">Complétez les diagnostics manquants.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CarteAction titre="Créer un dossier" description="Nouveau dossier médical" href="/medecin/nouveau-dossier" icone="📋" />
        <CarteAction titre="Suivi des dossiers" description="Consulte et mets à jour" href="/medecin/dossiers" icone="📂" />
        <CarteAction titre="Ordonnances" description="Gérer les prescriptions" href="/medecin/ordonnances" icone="💊" />
        <CarteAction titre="Attestations" description="Certificats médicaux" href="/medecin/attestations" icone="📄" />
        <CarteAction titre="Calendrier" description="Planifier des rendez-vous" href="/medecin/calendrier" icone="📅" />
        <CarteAction titre="Historique" description="Timeline des consultations" href="/medecin/historique" icone="🕐" />
      </div>
    </div>
  );
}

function CarteAction({ titre, description, href, icone }: { titre: string; description: string; href: string; icone: string }) {
  return (
    <Link href={href} className="block group">
      <div className="carte cursor-pointer hover:shadow-lg transition-all duration-200 h-full p-4">
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