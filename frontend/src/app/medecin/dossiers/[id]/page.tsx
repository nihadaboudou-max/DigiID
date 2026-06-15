"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { obtenirDossier, listerConsultations, listerOrdonnances } from "@/services/medical";
import type { DossierMedical, Consultation, Ordonnance } from "@/services/medical";

export default function DossierDetailPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const params = useParams();
  const dossierId = params.id as string;
  const [dossier, setDossier] = useState<DossierMedical | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => { if (dossierId) charger(); }, [dossierId]);

  async function charger() {
    setChargement(true);
    try {
      const [d, c, o] = await Promise.all([
        obtenirDossier(dossierId), listerConsultations(dossierId), listerOrdonnances(dossierId)
      ]);
      setDossier(d); setConsultations(c); setOrdonnances(o);
    } catch {}
    finally { setChargement(false); }
  }

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ardoise-clair italic py-12 text-center">Chargement du dossier...</p>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="space-y-8 apparition">
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Dossier introuvable.</p>
        </div>
        <Link href="/medecin/dossiers"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <Link href="/medecin/dossiers" className="hover:text-ocre">Dossiers</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">{dossier.patient_nom}</span>
      </nav>

      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-ardoise">{dossier.patient_nom}</h1>
            <Badge variante={dossier.statut === "ouvert" ? "succes" : "lagune"}>
              {dossier.statut === "ouvert" ? "Ouvert" : "Archive"}
            </Badge>
          </div>
          <p className="text-ardoise-clair mt-1">{dossier.patient_digiid}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Carte titre="Informations">
          <div className="space-y-2 text-sm">
            <p><strong>Motif :</strong> {dossier.motif}</p>
            <p><strong>Diagnostic :</strong> {dossier.diagnostic || "Non renseigne"}</p>
            <p><strong>Cree le :</strong> {new Date(dossier.date_creation).toLocaleDateString("fr-FR")}</p>
            <p><strong>Modifie le :</strong> {new Date(dossier.date_modification).toLocaleDateString("fr-FR")}</p>
          </div>
        </Carte>

        <Carte titre={"Consultations (" + consultations.length + ")"}>
          {consultations.length === 0 ? (
            <p className="text-sm text-ardoise-clair italic">Aucune consultation</p>
          ) : (
            <div className="space-y-3">
              {consultations.map((c) => (
                <div key={c.id} className="p-2 bg-sable rounded text-sm">
                  <p className="font-semibold">{c.motif}</p>
                  {c.diagnostic && <p className="text-xs text-ardoise-clair">{c.diagnostic}</p>}
                  <p className="text-xs text-ardoise-clair">{new Date(c.date_consultation).toLocaleDateString("fr-FR")}</p>
                </div>
              ))}
            </div>
          )}
        </Carte>

        <Carte titre={"Ordonnances (" + ordonnances.length + ")"}>
          {ordonnances.length === 0 ? (
            <p className="text-sm text-ardoise-clair italic">Aucune ordonnance</p>
          ) : (
            <div className="space-y-3">
              {ordonnances.map((o) => (
                <div key={o.id} className="p-2 bg-sable rounded text-sm">
                  <p className="font-semibold">{o.medicaments}</p>
                  {o.instructions && <p className="text-xs text-ardoise-clair">{o.instructions}</p>}
                </div>
              ))}
            </div>
          )}
        </Carte>
      </div>

      <Link href="/medecin/dossiers"><Bouton variante="ghost">Retour aux dossiers</Bouton></Link>
    </div>
  );
}
