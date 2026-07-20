"use client";

/**
 * Page de configuration de la Double Authentification (2FA).
 * Accessible depuis le tableau de bord des vérifications.
 */
import React, { useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Gestion2FA } from "@/composants/commun/Gestion2FA";
import { useAuthentification } from "@/contextes/authentification";

export default function PageParametres2FA() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur",
      ]}
    >
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();

  if (!utilisateur) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider">
          Sécurité
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          Double authentification (2FA)
        </h1>
        <p className="text-gray-500 mt-2">
          Ajoute une couche de sécurité à ton compte avec un code à 6 chiffres
          généré par une application d&apos;authentification.
        </p>
      </div>

      <Carte
        titre={
          utilisateur.deux_fa_active
            ? "🔐 2FA Activée"
            : "🔓 2FA Désactivée"
        }
      >
        <p className="text-sm text-gray-600 mb-4">
          {utilisateur.deux_fa_active
            ? "Ton compte est protégé par la double authentification. Tu peux la désactiver si nécessaire."
            : "Active la 2FA pour sécuriser ton compte. Tu auras besoin d'une application comme Google Authenticator ou Authy."}
        </p>

        <Gestion2FA varianteBouton="primaire" />
      </Carte>

      {/* Information */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <span className="text-blue-600 text-lg">🔒</span>
          <div>
            <h4 className="text-sm font-semibold text-blue-800">
              Pourquoi activer la 2FA ?
            </h4>
            <ul className="text-xs text-blue-600 mt-2 space-y-1">
              <li>• Protège ton compte même si ton mot de passe est volé</li>
              <li>• Requis pour les rôles administrateur</li>
              <li>• +15 points de bonus sur ton score DigiID</li>
              <li>• Obligatoire pour accéder aux données sensibles</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
