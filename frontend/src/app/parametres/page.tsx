"use client";

/**
 * Page Paramètres — sécurité, langue, confidentialité.
 * Phase 5b : UI prête, actions désactivées.
 * Phase 2 : changement de mot de passe.
 * Phase 4 : activation 2FA réelle.
 */
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { Gestion2FA } from "@/composants/commun/Gestion2FA";
import {
  IconeCle, IconeBouclier, IconeLangue, IconeJournal, IconeEnvoyer,
} from "@/composants/commun/Icones";
import { useAuthentification } from "@/contextes/authentification";
import { clientAPI } from "@/services/client_api";
import { useState } from "react";

export default function PageParametres() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter();
  const { utilisateur } = useAuthentification();
  const [exportChargement, setExportChargement] = useState(false);
  if (!utilisateur) return null;

  // Extraire l'ID avant les closures asynchrones pour éviter les soucis TypeScript
  const idUtilisateur = utilisateur.id;

  async function gererExportDonnees() {
    setExportChargement(true);
    try {
      const donnees = await clientAPI.get("/api/v1/utilisateur/profil/export", {
        authentifie: true,
      });
      // Télécharger le JSON
      const blob = new Blob([JSON.stringify(donnees, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `digiid-export-${idUtilisateur}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Erreur lors de l'export des données:", e);
    } finally {
      setExportChargement(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Mes paramètres
        </p>
        <h1 className="mt-1">Sécurité et préférences</h1>
        <p className="text-ardoise-clair mt-2">
          Gère ton mot de passe, ton authentification à deux facteurs et tes préférences.
        </p>
      </header>

      {/* Mot de passe */}
      <Carte>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-lagune/10 text-lagune rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeCle />
          </div>
          <div>
            <h3>Mot de passe</h3>
            <p className="text-sm text-ardoise-clair">
              Choisis un mot de passe fort que tu n'utilises sur aucun autre service.
            </p>
          </div>
        </div>
        <Bouton
          variante="ghost"
          onClick={() => router.push("/mot-de-passe-oublie")}
        >
          Réinitialiser mon mot de passe
        </Bouton>
        <p className="text-xs text-ardoise-clair italic mt-2">
          La modification directe du mot de passe sera disponible en Phase 2.
          Tu peux déjà le réinitialiser via l'email.
        </p>
      </Carte>

      {/* 2FA */}
      <Carte>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-ocre/15 text-ocre-fonce rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeBouclier />
          </div>
          <div>
            <h3 className="flex items-center gap-2">
              Authentification à deux facteurs
              {utilisateur.deux_fa_active ? (
                <Badge variante="succes">Active</Badge>
              ) : (
                <Badge variante="neutre">Désactivée</Badge>
              )}
            </h3>
            <p className="text-sm text-ardoise-clair">
              Une couche de sécurité supplémentaire : un code à 6 chiffres généré par
              Google Authenticator ou équivalent en plus de ton mot de passe.
            </p>
          </div>
        </div>
        <Gestion2FA />
      </Carte>

      {/* Langue */}
      <Carte>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-lagune/10 text-lagune rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeLangue />
          </div>
          <div>
            <h3>Langue d'affichage</h3>
            <p className="text-sm text-ardoise-clair">
              Choisis la langue dans laquelle DigiID s'affiche pour toi.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { code: "fr", libelle: "Français", actif: true },
            { code: "wo", libelle: "Wolof",    actif: false },
            { code: "fo", libelle: "Fon",      actif: false },
          ].map((langue) => (
            <button
              key={langue.code}
              type="button"
              disabled={!langue.actif}
              className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                langue.actif
                  ? "bg-lagune text-white border-lagune"
                  : "bg-white text-ardoise-clair border-ardoise-clair/20 cursor-not-allowed"
              }`}
            >
              {langue.libelle}
              {!langue.actif && <span className="block text-xs italic mt-0.5">Phase 5</span>}
            </button>
          ))}
        </div>
      </Carte>

      {/* Historique de connexion */}
      <Carte>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-lagune/10 text-lagune rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeJournal />
          </div>
          <div>
            <h3>Activité récente</h3>
            <p className="text-sm text-ardoise-clair">
              Consulte tes dernières connexions et actions sur ton compte.
            </p>
          </div>
        </div>
        <Bouton
          variante="ghost"
          onClick={() => router.push("/historique")}
        >
          Voir mon activité
        </Bouton>
      </Carte>

      {/* Export des données */}
      <Carte>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-lagune/10 text-lagune rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeEnvoyer />
          </div>
          <div>
            <h3>Export de mes données</h3>
            <p className="text-sm text-ardoise-clair">
              Télécharge toutes tes données personnelles au format JSON
              (conformité RGPD / loi 2008-12).
            </p>
          </div>
        </div>
        <Bouton
          variante="ghost"
          chargement={exportChargement}
          onClick={gererExportDonnees}
        >
          Exporter mes données
        </Bouton>
      </Carte>

      {/* Zone dangereuse */}
      <Alerte variante="erreur" titre="Zone sensible — suppression définitive">
        <p className="mb-3">
          Supprimer ton compte effacera toutes tes données sous 30 jours, conformément à
          la loi 2008-12 sur la protection des données personnelles. Cette action est
          irréversible.
        </p>
        <Bouton
          variante="secondaire"
          onClick={() => router.push("/profil")}
        >
          Voir les options dans mon profil
        </Bouton>
      </Alerte>
    </div>
  );
}
