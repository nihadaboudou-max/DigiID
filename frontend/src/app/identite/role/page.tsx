"use client";

/**
 * Page Identité → Rôle & Permissions (RBAC).
 * Permet de voir et gérer son rôle dans le système.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { useAuthentification } from "@/contextes/authentification";
import { clientAPI, ErreurAPI } from "@/services/client_api";

const DESCRIPTION_ROLES: Record<string, { titre: string; desc: string; icone: string }> = {
  citoyen: {
    titre: "Citoyen",
    desc: "Accès de base à DigiID. Tu peux gérer ton profil, ton score, et utiliser le chatbot.",
    icone: "👤",
  },
  agent: {
    titre: "Agent",
    desc: "Accès aux fonctionnalités avancées de vérification et de traitement des demandes.",
    icone: "🛠️",
  },
  medecin: {
    titre: "Médecin",
    desc: "Accès aux données de santé partagées avec ton consentement. Peut vérifier les certificats médicaux.",
    icone: "⚕️",
  },
  police: {
    titre: "Police",
    desc: "Accès aux vérifications d'identité renforcées. Utilisé dans le cadre des enquêtes autorisées.",
    icone: "🛡️",
  },
  ong: {
    titre: "ONG / Association",
    desc: "Accès aux fonctionnalités d'aide sociale et de vérification des bénéficiaires.",
    icone: "🤝",
  },
};

export default function PageIdentiteRole() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur"
      ]}
    >
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter();
  const { utilisateur } = useAuthentification();
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!utilisateur) return null;

  const roleActuel = DESCRIPTION_ROLES[utilisateur.role] || {
    titre: utilisateur.role,
    desc: "Rôle personnalisé",
    icone: "🔑",
  };

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70 mb-2">
        <a href="/identite" className="hover:text-ocre transition-colors">Identité</a>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Rôle & permissions</span>
      </nav>

      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Étape 2 — Identité
        </p>
        <h1 className="mt-1">Rôle &amp; permissions</h1>
        <p className="text-ardoise-clair mt-2">
          Ton rôle détermine ce que tu peux faire sur DigiID.
        </p>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Rôle actuel */}
      <Carte variante="accent">
        <div className="flex items-start gap-4">
          <span className="text-5xl">{roleActuel.icone}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="!mb-0">{roleActuel.titre}</h3>
              <Badge variante="lagune">{utilisateur.role.replace(/_/g, " ")}</Badge>
            </div>
            <p className="text-sm text-ardoise-clair">{roleActuel.desc}</p>
          </div>
        </div>
      </Carte>

      {/* Liste des rôles disponibles */}
      <Carte titre="Rôles disponibles">
        <div className="space-y-4">
          {Object.entries(DESCRIPTION_ROLES).map(([cle, role]) => {
            const estActif = utilisateur.role === cle;
            return (
              <div
                key={cle}
                className={`p-4 rounded-xl border-2 transition-all ${
                  estActif
                    ? "border-lagune bg-lagune/5"
                    : "border-ardoise-clair/10 hover:border-ardoise-clair/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{role.icone}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="!text-base !mb-0">{role.titre}</h4>
                      {estActif && (
                        <Badge variante="succes">Rôle actuel</Badge>
                      )}
                    </div>
                    <p className="text-sm text-ardoise-clair mt-1">
                      {role.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Carte>

      {/* Informations */}
      <Carte variante="pointilles" titre="Comment changer de rôle ?">
        <p className="text-sm text-ardoise mb-3">
          Pour obtenir un rôle institutionnel (agent, médecin, police, ONG),
          tu dois faire une demande qui sera vérifiée par un administrateur.
        </p>
        <ol className="space-y-2 text-sm text-ardoise list-decimal list-inside">
          <li>Assure-toi d&apos;avoir une vérification CNI complète.</li>
          <li>Fais ta demande auprès d&apos;un administrateur DigiID.</li>
          <li>Fournis les justificatifs nécessaires (carte professionnelle, etc.).</li>
          <li>L&apos;admin active ton rôle après vérification.</li>
        </ol>
      </Carte>
    </div>
  );
}
