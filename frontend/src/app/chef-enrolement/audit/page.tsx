"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Bouton } from "@/composants/commun/Bouton";
import { listerAuditChef } from "@/services/chefs";
import {
  AuditTableEnrichi,
  useAuditEnrichi,
} from "@/composants/audit/AuditTableEnrichi";

export default function ChefAgentAuditPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["chef_agent", "super_administrateur", "admin_domaine"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [typeAction, setTypeAction] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [recherche, setRecherche] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  const {
    logs, total, chargement, erreur, page, totalPages, setPage, chargerAudit,
  } = useAuditEnrichi();

  const fetchAudit = useCallback(() => {
    chargerAudit(listerAuditChef, {
      type_action: typeAction || undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
      agent_id: agentFilter || undefined,
      recherche: recherche || undefined,
    });
  }, [typeAction, dateDebut, dateFin, agentFilter, recherche]);

  useEffect(() => {
    fetchAudit();
  }, [page, typeAction, dateDebut, dateFin, agentFilter, recherche]);

  const resetFiltres = () => {
    setTypeAction("");
    setDateDebut("");
    setDateFin("");
    setRecherche("");
    setAgentFilter("");
    setPage(1);
  };

  const filtres = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Action</label>
          <select
            value={typeAction}
            onChange={(e) => { setTypeAction(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terre/30"
          >
            <option value="">Toutes</option>
            <option value="enrolement_creation">Création enrôlement</option>
            <option value="enrolement_scan_cni">Scan CNI</option>
            <option value="enrolement_capture_biometrique">Capture biométrique</option>
            <option value="connexion_reussie">Connexion réussie</option>
            <option value="connexion_echouee">Échec connexion</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Agent</label>
          <input
            type="text"
            placeholder="Nom de l'agent..."
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terre/30"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Du</label>
          <input
            type="date"
            value={dateDebut}
            onChange={(e) => { setDateDebut(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terre/30"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Au</label>
          <input
            type="date"
            value={dateFin}
            onChange={(e) => { setDateFin(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terre/30"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Recherche</label>
          <input
            type="text"
            placeholder="Texte dans la description..."
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-terre/30"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <AuditTableEnrichi
        logs={logs}
        total={total}
        chargement={chargement}
        erreur={erreur}
        accentCouleur="text-terre"
        titre="Journal d'Audit — Enrôlement"
        sousTitre="Qui a enrôlé qui, à quelle heure, depuis quel appareil — traçabilité complète des enrôlements."
        filtres={filtres}
        onResetFiltres={resetFiltres}
        page={page}
        totalPages={totalPages}
        surPageSuivante={() => setPage(p => p + 1)}
        surPagePrecedente={() => setPage(p => p - 1)}
      />
      <div className="mt-4">
        <Link href="/chef-enrolement">
          <Bouton variante="ghost" taille="petit">← Retour au tableau de bord</Bouton>
        </Link>
      </div>
    </div>
  );
}