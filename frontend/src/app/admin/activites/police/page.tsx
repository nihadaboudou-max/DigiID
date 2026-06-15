"use client";

import { useEffect, useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { NavigationActivites } from "../navigation";

export default function AdminPolicePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [signalements, setSignalements] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true); setErreur("");
    try {
      const [v, s] = await Promise.all([
        clientAPI.get<any[]>("/api/v1/admin/police/verifications", { authentifie: true }),
        clientAPI.get<any[]>("/api/v1/admin/police/signalements", { authentifie: true }),
      ]);
      setVerifications(v || []); setSignalements(s || []);
    } catch (e: any) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur");
    } finally { setChargement(false); }
  }

  const badgeResultat = (r: string) => {
    if (r === "conforme") return <Badge variante="succes">Conforme</Badge>;
    if (r === "non_conforme") return <Badge variante="terre">Non conforme</Badge>;
    return <Badge variante="ocre">{r}</Badge>;
  };

  return (
    <div className="space-y-8 apparition">
      <div>
        <p className="text-terre font-semibold text-sm uppercase tracking-wider">Administration</p>
        <h1 className="mt-1">Activites Police</h1>
        <p className="text-ardoise-clair mt-2">Verifications d identite et signalements de fraude.</p>
      </div>

      <NavigationActivites active="police" />

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte titre="Verifications recentes">
        {chargement ? (
          <p className="text-ardoise-clair italic py-8 text-center">Chargement...</p>
        ) : verifications.length === 0 ? (
          <p className="text-ardoise-clair italic py-8 text-center">Aucune verification.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ardoise-clair text-xs uppercase tracking-wider">
                  <th className="pb-3 pr-4">Officier</th>
                  <th className="pb-3 pr-4">Personne</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Resultat</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {verifications.map((v: any) => (
                  <tr key={v.id} className="border-t border-ardoise-clair/10 hover:bg-sable/40">
                    <td className="py-3 pr-4 text-ardoise-clair">{v.officier_nom || "—"}</td>
                    <td className="py-3 pr-4 font-semibold text-ardoise">{v.personne_nom || v.personne_digiid || "—"}</td>
                    <td className="py-3 pr-4 text-ardoise">{v.type_verification}</td>
                    <td className="py-3 pr-4">{badgeResultat(v.resultat)}</td>
                    <td className="py-3 text-xs text-ardoise-clair">
                      {new Date(v.date_verification).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>

      <Carte titre="Signalements de fraude">
        {chargement ? (
          <p className="text-ardoise-clair italic py-8 text-center">Chargement...</p>
        ) : signalements.length === 0 ? (
          <p className="text-ardoise-clair italic py-8 text-center">Aucun signalement.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ardoise-clair text-xs uppercase tracking-wider">
                  <th className="pb-3 pr-4">Officier</th>
                  <th className="pb-3 pr-4">Motif</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {signalements.map((s: any) => (
                  <tr key={s.id} className="border-t border-ardoise-clair/10 hover:bg-sable/40">
                    <td className="py-3 pr-4 text-ardoise-clair">{s.officier_nom || "—"}</td>
                    <td className="py-3 pr-4 text-ardoise">{s.motif}</td>
                    <td className="py-3 pr-4">
                      <Badge variante={s.statut === "traite" ? "succes" : s.statut === "rejete" ? "terre" : "ocre"}>
                        {s.statut || "en_attente"}
                      </Badge>
                    </td>
                    <td className="py-3 text-xs text-ardoise-clair">
                      {new Date(s.date_signalement).toLocaleDateString("fr-FR")}
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
