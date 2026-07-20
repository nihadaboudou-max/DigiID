/**
 * Page Attestations Communautaires — Tableau de bord principal.
 * 
 * Affiche la vue d'ensemble des attestations :
 *   - Statistiques globales
 *   - Alertes pour les actions en attente
 *   - Liens rapides vers les sous-pages
 */
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { TableauBordAttestations } from "@/composants/attestations-communautaires";

/**
 * Page principale du module Attestations Communautaires.
 * Accessible à tous les utilisateurs sauf les non-connectés.
 */
export default function PageAttestationsCommunautaires() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur"
      ]}
    >
      <div className="space-y-8 apparition">
        {/* Fil d'Ariane */}
        <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70">
          <a href="/tableau-de-bord" className="hover:text-ocre transition-colors">
            Accueil
          </a>
          <span className="text-ardoise-clair/30">/</span>
          <span className="text-ardoise font-semibold">Attestations communautaires</span>
        </nav>

        {/* Tableau de bord des attestations */}
        <TableauBordAttestations />

        {/* Note d'information */}
        <div className="text-xs text-ardoise-clair/50 border-t border-ardoise-clair/10 pt-4 space-y-1">
          <p>
            🔒 Les attestations communautaires sont un élément clé du réseau de confiance DigiID.
            Chaque attestation approuvée renforce le score de la personne attestée.
          </p>
          <p>
            🤝 Atteste uniquement des personnes que tu connais réellement.
            La sincérité des attestations est essentielle à la fiabilité du système.
          </p>
          <p>
            ⏳ Les attestations approuvées expirent automatiquement après 1 an.
          </p>
        </div>
      </div>
    </EnvelopperEspaceProtege>
  );
}
