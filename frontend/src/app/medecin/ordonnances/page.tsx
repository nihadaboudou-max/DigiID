"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { useRoleUI } from "@/crochets/useRoleUI";
import { listerDossiers, listerToutesOrdonnances, creerOrdonnance } from "@/services/medical";
import type { Ordonnance, DossierMedical } from "@/services/medical";

export default function OrdonnancesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [dossiers, setDossiers] = useState<DossierMedical[]>([]);
  const [chargement, setChargement] = useState(true);
  const [dossierId, setDossierId] = useState("");
  const [medicaments, setMedicaments] = useState("");
  const [instructions, setInstructions] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    try {
      const [dossiersData, ordonnancesData] = await Promise.all([
        listerDossiers(),
        listerToutesOrdonnances(),
      ]);
      setDossiers(dossiersData);
      setOrdonnances(ordonnancesData);
    } catch {}
    finally { setChargement(false); }
  }

  async function handleCreer() {
    if (!dossierId || !medicaments) return;
    setEnvoi(true);
    try {
      await creerOrdonnance({ dossier_id: dossierId, medicaments, instructions: instructions || undefined });
      setMedicaments(""); setInstructions(""); setDossierId("");
      // Recharger les deux listes après création
      const [dossiersData, ordonnancesData] = await Promise.all([
        listerDossiers(),
        listerToutesOrdonnances(),
      ]);
      setDossiers(dossiersData);
      setOrdonnances(ordonnancesData);
    } catch {}
    finally { setEnvoi(false); }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Ordonnances</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace medical</p>
        <h1 className="mt-1">Gestion des ordonnances</h1>
        <p className="text-ardoise-clair mt-2">Creez et consultez les prescriptions.</p>
      </div>

      {can.managePrescriptions && (
        <Carte titre="Nouvelle ordonnance">
          <div className="max-w-md space-y-3">
            <select value={dossierId} onChange={(e) => setDossierId(e.target.value)}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white">
              <option value="">-- Selectionnez un dossier --</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>{d.patient_nom} ({d.patient_digiid})</option>
              ))}
            </select>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Medicaments</label>
              <textarea value={medicaments} onChange={(e) => setMedicaments(e.target.value)}
                rows={3} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                placeholder="Ex: Amoxicilline 500mg - 2x/jour pendant 7 jours" />
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Instructions</label>
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
                rows={2} className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                placeholder="Precautions, posologie..." />
            </div>
            <Bouton variante="primaire" disabled={!dossierId || !medicaments || envoi} onClick={handleCreer}>
              {envoi ? "Creation..." : "Prescrire"}
            </Bouton>
          </div>
        </Carte>
      )}

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
      ) : ordonnances.length === 0 ? (
        <Carte><p className="text-ardoise-clair italic text-center py-8">Aucune ordonnance pour le moment.</p></Carte>
      ) : (
        <Carte titre={"Ordonnances (" + ordonnances.length + ")"}>
          <div className="space-y-3">
            {ordonnances.map((o) => (
              <div key={o.id} className="p-3 bg-sable rounded-lg">
                <p className="font-semibold text-ardoise">{o.medicaments}</p>
                {o.instructions && <p className="text-xs text-ardoise-clair mt-1">{o.instructions}</p>}
                <p className="text-xs text-ardoise-clair mt-1">
                  Prescrit le {new Date(o.date_prescription).toLocaleDateString("fr-FR")}
                  {o.date_expiration && " · Expire le " + new Date(o.date_expiration).toLocaleDateString("fr-FR")}
                </p>
              </div>
            ))}
          </div>
        </Carte>
      )}
      <Link href="/medecin/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
