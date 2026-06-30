"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { NavigationActivites } from "@/app/admin/activites/navigation";

export default function SuperAdminEnrolementsPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [enrolements, setEnrolements] = useState<any[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [recherche, setRecherche] = useState("");

  useEffect(() => { charger(); }, [filtreStatut]);

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const params = filtreStatut !== "tous" ? `?statut=${filtreStatut}` : "";
      const data = await clientAPI.get<any[]>(`/api/v1/admin/enrolements${params}`, { authentifie: true });
      setEnrolements(data || []);
    } catch (e: any) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  }

  const filtres = ["tous", "en_attente", "valide", "rejete"];
  const enrolementsFiltres = enrolements.filter((e) => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return (
      e.citoyen_nom?.toLowerCase().includes(q) ||
      e.citoyen_prenom?.toLowerCase().includes(q) ||
      (e.citoyen_digiid && e.citoyen_digiid.toLowerCase().includes(q)) ||
      (e.agent_nom?.toLowerCase().includes(q)) ||
      (e.citoyen_telephone && e.citoyen_telephone.includes(q))
    );
  });

  function exporterCSV() {
    const entetes = ["Prenom,Nom,Telephone,Email,DigiID,Agent,Statut,Date"];
    const lignes = enrolementsFiltres.map(
      (e) =>
        `${e.citoyen_prenom},${e.citoyen_nom},${e.citoyen_telephone || ""},${e.citoyen_email || ""},${e.citoyen_digiid || ""},${e.agent_nom},${e.statut},${new Date(e.date_enrolement).toLocaleDateString("fr-FR")}`
    );
    const csv = [...entetes, ...lignes].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enrolements_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = {
    total: enrolements.length,
    en_attente: enrolements.filter((e) => e.statut === "en_attente").length,
    valide: enrolements.filter((e) => e.statut === "valide").length,
    rejete: enrolements.filter((e) => e.statut === "rejete").length,
  };

  return (
    <div className="space-y-4">
      {/* En-tête compact */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
          <h1 className="mt-1 text-2xl">Enrôlements citoyens</h1>
          <p className="text-ardoise-clair mt-1 text-sm">Tous les enrôlements, avec export CSV.</p>
        </div>
        <Bouton variante="secondaire" taille="petit" onClick={exporterCSV} disabled={enrolements.length === 0}>
          Exporter CSV
        </Bouton>
      </div>

      <NavigationActivites active="enrolements" prefixe="/super-admin/activites" />

      {/* Statistiques compactes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="carte border-l-4 border-lagune/30 p-3">
          <p className="text-2xl font-bold text-lagune">{stats.total}</p>
          <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Total</p>
        </div>
        <div className="carte border-l-4 border-ocre/30 p-3">
          <p className="text-2xl font-bold text-ocre">{stats.en_attente}</p>
          <p className="text-[10px] uppercase text-ardoise-clair font-semibold">En attente</p>
        </div>
        <div className="carte border-l-4 border-green-400/30 p-3">
          <p className="text-2xl font-bold text-green-600">{stats.valide}</p>
          <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Validés</p>
        </div>
        <div className="carte border-l-4 border-terre/30 p-3">
          <p className="text-2xl font-bold text-terre">{stats.rejete}</p>
          <p className="text-[10px] uppercase text-ardoise-clair font-semibold">Rejetés</p>
        </div>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte titre="Liste des enrôlements">
        <div className="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-ardoise-clair/10">
          <div className="flex gap-1">
            {filtres.map((f) => (
              <button
                key={f}
                onClick={() => setFiltreStatut(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filtreStatut === f ? "bg-ocre text-white" : "bg-sable text-ardoise-clair hover:bg-sable/80"
                }`}
              >
                {f === "tous" ? "Tous" : f === "en_attente" ? "En attente" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher..."
            className="ml-auto px-2.5 py-1 border border-ardoise-clair/20 rounded-lg text-xs max-w-xs"
          />
        </div>

        {chargement ? (
          <p className="text-ardoise-clair italic text-center py-6">Chargement...</p>
        ) : enrolementsFiltres.length === 0 ? (
          <p className="text-ardoise-clair italic text-center py-6">Aucun enrôlement trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ardoise-clair text-xs uppercase tracking-wider">
                  <th className="pb-2 pr-3">Citoyen</th>
                  <th className="pb-2 pr-3">Agent</th>
                  <th className="pb-2 pr-3">Statut</th>
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrolementsFiltres.map((e: any) => (
                  <tr key={e.id} className="border-t border-ardoise-clair/10 hover:bg-sable/40">
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-ardoise text-sm">{e.citoyen_prenom} {e.citoyen_nom}</p>
                      {e.citoyen_digiid && <p className="text-xs font-mono text-ardoise-clair/60">{e.citoyen_digiid}</p>}
                    </td>
                    <td className="py-2 pr-3 text-ardoise-clair text-xs">{e.agent_nom || "—"}</td>
                    <td className="py-2 pr-3">
                      <Badge variante={e.statut === "valide" ? "succes" : e.statut === "rejete" ? "terre" : "ocre"}>
                        {e.statut === "valide" ? "Validé" : e.statut === "rejete" ? "Rejeté" : "En attente"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-ardoise-clair text-xs">
                      {new Date(e.date_enrolement).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-2">
                      <Link href={`/agent/enrolement/${e.id}`}>
                        <Bouton variante="ghost" taille="petit">Voir</Bouton>
                      </Link>
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