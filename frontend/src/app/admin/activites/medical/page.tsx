"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { NavigationActivites } from "../navigation";

export default function AdminMedicalPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true); setErreur("");
    try {
      const data = await clientAPI.get<any[]>("/api/v1/admin/medical/dossiers", { authentifie: true });
      setDossiers(data || []);
    } catch (e: any) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur");
    } finally { setChargement(false); }
  }

  return (
    <div className="space-y-8 apparition">
      <div>
        <p className="text-terre font-semibold text-sm uppercase tracking-wider">Administration</p>
        <h1 className="mt-1">Activites medicales</h1>
        <p className="text-ardoise-clair mt-2">Dossiers medicaux, consultations et ordonnances.</p>
      </div>

      <NavigationActivites active="medical" />

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte titre="Dossiers medicaux">
        {chargement ? (
          <p className="text-ardoise-clair italic py-8 text-center">Chargement...</p>
        ) : dossiers.length === 0 ? (
          <p className="text-ardoise-clair italic py-8 text-center">Aucun dossier medical.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ardoise-clair text-xs uppercase tracking-wider">
                  <th className="pb-3 pr-4">Patient</th>
                  <th className="pb-3 pr-4">Medecin</th>
                  <th className="pb-3 pr-4">Motif</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3 pr-4">Consult.</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {dossiers.map((d: any) => (
                  <tr key={d.id} className="border-t border-ardoise-clair/10 hover:bg-sable/40">
                    <td className="py-3 pr-4 font-semibold text-ardoise">{d.patient_nom}</td>
                    <td className="py-3 pr-4 text-ardoise-clair">{d.medecin_nom || "—"}</td>
                    <td className="py-3 pr-4 text-ardoise">{d.motif || "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge variante={d.statut === "ferme" ? "neutre" : d.statut === "en_cours" ? "ocre" : "succes"}>
                        {d.statut || "ouvert"}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-center">{d.consultations_count || 0}</td>
                    <td className="py-3 text-xs text-ardoise-clair">
                      {new Date(d.date_creation).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
    </div>
  );
}
