"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { listerAuditChef, type AuditLog } from "@/services/chefs";
import { Alerte } from "@/composants/commun/Alerte";

export default function ChefOngAuditPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_ong", "super_administrateur", "admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
    // ✅ Suppression des caractères parasites à la fin
  );
}

function Contenu() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  
  // Filtres
  const [typeAction, setTypeAction] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    chargerAudit();
  }, [page, typeAction, dateDebut, dateFin]);

  async function chargerAudit() {
    setChargement(true);
    setErreur(null);
    try {
      const data = await listerAuditChef({
        type_action: typeAction || undefined,
        date_debut: dateDebut || undefined,
        date_fin: dateFin || undefined,
        page,
        par_page: 50,
      });
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error: any) {
      setErreur(error?.message || "Erreur de chargement de l'audit");
    } finally {
      setChargement(false);
    }
  }

  function resetFiltres() {
    setTypeAction("");
    setDateDebut("");
    setDateFin("");
    setPage(1);
  }

  // Helper pour formater la date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  // ✅ Helper adapté pour les actions ONG (et non Police)
  const getBadgeVariante = (type: string) => {
    if (type.includes("creation") || type.includes("ajout")) return "succes";
    if (type.includes("suppression") || type.includes("erreur")) return "terre";
    if (type.includes("connexion")) return "lagune";
    return "ocre";
  };

  return (
    <div className="space-y-6 apparition pb-20">
      <div>
        <p className="text-lagune font-semibold text-sm uppercase tracking-wider">🛡️ Supervision ONG</p>
        <h1>Journal d'Audit de l'Équipe</h1>
        <p className="text-ardoise-clair mt-2">
          Historique complet de toutes les actions effectuées par vos agents ONG.
        </p>
      </div>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Filtres */}
      <Carte titre="Filtrer les activités">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Type d'action</label>
            {/* ✅ Options adaptées au contexte ONG */}
            <select 
              value={typeAction} 
              onChange={(e) => { setTypeAction(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
            >
              <option value="">Toutes les actions</option>
              <option value="ong_beneficiaire_creation">Création bénéficiaire</option>
              <option value="ong_programme_creation">Création programme</option>
              <option value="ong_mission_creation">Création mission</option>
              <option value="connexion_reussie">Connexion réussie</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Date début</label>
            <input 
              type="date" 
              value={dateDebut} 
              onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Date fin</label>
            <input 
              type="date" 
              value={dateFin} 
              onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
            />
          </div>
          <div className="flex items-end">
            <Bouton variante="ghost" onClick={resetFiltres} className="w-full">🔄 Réinitialiser</Bouton>
          </div>
        </div>
      </Carte>

      {/* Tableau des résultats */}
      <Carte titre={`Activités récentes (${total} au total)`}>
        {chargement ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-ardoise-clair">Chargement des journaux...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-ardoise-clair italic">Aucune activité trouvée pour ces critères.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-sable text-ardoise-clair">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Date & Heure</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Détails</th>
                  <th className="px-4 py-3 rounded-tr-lg">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-ardoise-clair/10 hover:bg-sable/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-ardoise-clair">
                      {formatDate(log.date_evenement)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-ardoise">{log.agent_nom}</div>
                      <div className="text-xs text-ardoise-clair capitalize">{log.agent_role.replace('_', ' ')}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variante={getBadgeVariante(log.type_evenement)} taille="petit">
                        {log.type_evenement.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-ardoise-clair" title={log.description}>
                      {log.description}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ardoise-clair">
                      {log.adresse_ip || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination simple */}
        {!chargement && logs.length > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-ardoise-clair/10">
            <p className="text-xs text-ardoise-clair">
              Page {page} sur {Math.ceil(total / 50) || 1}
            </p>
            <div className="flex gap-2">
              <Bouton 
                variante="ghost" 
                taille="petit" 
                disabled={page === 1} 
                onClick={() => setPage(p => p - 1)}
              >
                ← Précédent
              </Bouton>
              <Bouton 
                variante="ghost" 
                taille="petit" 
                disabled={page * 50 >= total} 
                onClick={() => setPage(p => p + 1)}
              >
                Suivant →
              </Bouton>
            </div>
          </div>
        )}
      </Carte>

      {/* ✅ Correction du lien de retour pour pointer vers le dashboard ONG */}
      <Link href="/chef-ong">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}