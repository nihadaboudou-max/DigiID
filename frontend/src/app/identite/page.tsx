"use client";

/**
 * Page Identité — Tableau de bord des vérifications d'identité.
 * Point d'entrée du menu Identité avec vue d'ensemble.
 */
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { TableauBordVerifications } from "@/composants/verifications";

export default function PageIdentite() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur"
      ]}
    >
      <div className="space-y-8 apparition">
        {/* En-tête */}
        <header>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
            Menu Identité
          </p>
          <h1 className="mt-1">Vérifications d&apos;identité</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Centralise et gère toutes les vérifications liées à ton identité numérique.
            Chaque étape validée renforce ton score DigiID.
          </p>
        </header>

        {/* Tableau de bord complet des vérifications */}
        <TableauBordVerifications />
      </div>
    </EnvelopperEspaceProtege>
  );
}
