"use client";

import { useEffect, useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { NavigationActivites } from "@/app/admin/activites/navigation";

export default function SuperAdminONGPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [beneficiaires, setBeneficiaires] = useState<any[]>([]);
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true); setErreur("");
    try {
      const [b, p, m] = await Promise.all([
        clientAPI.get<any[]>("/api/v1/admin/ong/beneficiaires", { authentifie: true }),
        clientAPI.get<any[]>("/api/v1/admin/ong/programmes", { authentifie: true }),
        clientAPI.get<any[]>("/api/v1/admin/ong/missions", { authentifie: true }),
      ]);
      setBeneficiaires(b || []); setProgrammes(p || []); setMissions(m || []);
    } catch (e: any) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur");
    } finally { setChargement(false); }
  }

  return (
    <div className="space-y-8 apparition">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1">Activites ONG</h1>
        <p className="text-ardoise-clair mt-2">Beneficiaires, programmes et missions terrain.</p>
      </div>

      <NavigationActivites active="ong" prefixe="/super-admin/activites" />

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte titre="Beneficiaires">
        {chargement ? (
          <p className="text-ardoise-clair italic py-8 text-center">Chargement...</p>
        ) : beneficiaires.length === 0 ? (
          <p className="text-ardoise-clair italic py-8 text-center">Aucun beneficiaire.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ardoise-clair text-xs uppercase tracking-wider">
                  <th className="pb-3 pr-4">Nom</th>
                  <th className="pb-3 pr-4">ONG</th>
                  <th className="pb-3 pr-4">Programme</th>
                  <th className="pb-3 pr-4">Zone</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3">Inscription</th>
                </tr>
              </thead>
              <tbody>
                {beneficiaires.map((b: any) => (
                  <tr key={b.id} className="border-t border-ardoise-clair/10 hover:bg-sable/40">
                    <td className="py-3 pr-4 font-semibold text-ardoise">{b.nom}</td>
                    <td className="py-3 pr-4 text-ardoise-clair">{b.ong_nom || "—"}</td>
                    <td className="py-3 pr-4 text-ardoise">{b.programme || "—"}</td>
                    <td className="py-3 pr-4 text-ardoise-clair">{b.zone || "—"}</td>
                    <td className="py-3 pr-4">
                      <Badge variante={b.statut === "actif" ? "succes" : "neutre"}>{b.statut || "actif"}</Badge>
                    </td>
                    <td className="py-3 text-xs text-ardoise-clair">
                      {new Date(b.date_inscription).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>

      <div className="grid md:grid-cols-2 gap-6">
        <Carte titre="Programmes">
          {chargement ? (
            <p className="text-ardoise-clair italic py-4 text-center">...</p>
          ) : programmes.length === 0 ? (
            <p className="text-ardoise-clair italic py-4 text-center">Aucun programme.</p>
          ) : (
            <div className="space-y-2">
              {programmes.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2 bg-sable rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-ardoise">{p.nom}</p>
                    <p className="text-xs text-ardoise-clair">{p.zone || "—"} · {p.ong_nom || "—"}</p>
                  </div>
                  <Badge variante={p.statut === "actif" ? "succes" : "neutre"}>{p.statut}</Badge>
                </div>
              ))}
            </div>
          )}
        </Carte>

        <Carte titre="Missions terrain">
          {chargement ? (
            <p className="text-ardoise-clair italic py-4 text-center">...</p>
          ) : missions.length === 0 ? (
            <p className="text-ardoise-clair italic py-4 text-center">Aucune mission.</p>
          ) : (
            <div className="space-y-2">
              {missions.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-2 bg-sable rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-ardoise">{m.titre}</p>
                    <p className="text-xs text-ardoise-clair">{m.zone || "—"}</p>
                  </div>
                  <Badge variante={m.statut === "termine" ? "succes" : m.statut === "en_cours" ? "ocre" : "neutre"}>
                    {m.statut}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Carte>
      </div>
    </div>
  );
}
