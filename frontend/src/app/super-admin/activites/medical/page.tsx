"use client";

import { useEffect, useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { NavigationActivites } from "@/app/admin/activites/navigation";

export default function SuperAdminMedicalPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
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
    setChargement(true);
    setErreur("");
    try {
      const data = await clientAPI.get<any[]>("/api/v1/admin/medical/dossiers", { authentifie: true });
      setDossiers(data || []);
    } catch (e: any) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* En-tête compact */}
      <div>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl">Activités médicales</h1>
        <p className="text-ardoise-clair mt-1 text-sm">Dossiers médicaux, consultations et ordonnances.</p>
      </div>

      <NavigationActivites active="medical" prefixe="/super-admin/activites" />

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte titre="Dossiers médicaux">
        {chargement ? (
          <p className="text-ardoise-clair italic py-6 text-center">Chargement...</p>
        ) : dossiers.length === 0 ? (
          <p className="text-ardoise-clair italic py-6 text-center">Aucun dossier médical.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ardoise-clair text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-3">Patient</th>
                  <th className="pb-2 pr-3">Médecin</th>
                  <th className="pb-2 pr-3">Motif</th>
                  <th className="pb-2 pr-3">Statut</th>
                  <th className="pb-2 pr-3">Consult.</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {dossiers.map((d: any) => (
                  <tr key={d.id} className="border-t border-ardoise-clair/10 hover:bg-sable/40">
                    <td className="py-2 pr-3 font-semibold text-ardoise text-sm">{d.patient_nom}</td>
                    <td className="py-2 pr-3 text-ardoise-clair text-xs">{d.medecin_nom || "—"}</td>
                    <td className="py-2 pr-3 text-ardoise text-xs">{d.motif || "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge variante={d.statut === "ferme" ? "neutre" : d.statut === "en_cours" ? "ocre" : "succes"}>
                        {d.statut || "ouvert"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-center text-xs">{d.consultations_count || 0}</td>
                    <td className="py-2 text-xs text-ardoise-clair">
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