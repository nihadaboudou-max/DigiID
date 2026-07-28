"use client";

/**
 * Page Paramètres — sécurité, langue, confidentialité et identité.
 * Permet de modifier son nom/prénom, gérer le 2FA, et exporter ses données.
 */
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { Gestion2FA } from "@/composants/commun/Gestion2FA";
import {
  IconeCle, IconeBouclier, IconeLangue, IconeJournal, IconeEnvoyer, IconeUtilisateur
} from "@/composants/commun/Icones";
import { useAuthentification } from "@/contextes/authentification";
import { useNotifications } from "@/contextes/notifications";
import { clientAPI } from "@/services/client_api";
import { modifierMonProfil } from "@/services/profil";

export default function PageParametres() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={[      
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur"
    ]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter();
  const { notifier } = useNotifications();
  const { utilisateur } = useAuthentification();
  
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sauvegardeIdentite, setSauvegardeIdentite] = useState(false);
  const [exportChargement, setExportChargement] = useState(false);

  // Initialiser les champs avec les données de l'utilisateur
  useEffect(() => {
    if (utilisateur) {
      setNom(utilisateur.nom || "");
      setPrenom(utilisateur.prenom || "");
    }
  }, [utilisateur]);

  if (!utilisateur) return null;
  const idUtilisateur = utilisateur.id;

  async function gererSauvegardeIdentite() {
    const nomTrim = nom.trim();
    const prenomTrim = prenom.trim();

    if (!nomTrim || !prenomTrim) {
      notifier("Le nom et le prénom sont obligatoires.", "erreur");
      return;
    }

    setSauvegardeIdentite(true);
    try {
      await modifierMonProfil({ nom: nomTrim, prenom: prenomTrim });
      notifier("Identité mise à jour avec succès.", "succes");
    } catch (e) {
      notifier("Erreur lors de la mise à jour. Vérifiez les données.", "erreur");
    } finally {
      setSauvegardeIdentite(false);
    }
  }

  async function gererExportDonnees() {
    setExportChargement(true);
    try {
      const donnees = await clientAPI.get("/api/v1/utilisateur/profil/export", {
        authentifie: true,
      });
      const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `digiid-export-${idUtilisateur}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notifier("Export téléchargé avec succès.", "succes");
    } catch (e) {
      notifier("Erreur lors de l'export des données.", "erreur");
    } finally {
      setExportChargement(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 apparition pb-20">
      {/* En-tête compact */}
      <div>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Paramètres</p>
        <h1 className="text-2xl font-bold text-ardoise mt-1">Sécurité et préférences</h1>
        <p className="text-sm text-ardoise-clair mt-1">
          Gère ton identité, ton mot de passe et tes préférences de compte.
        </p>
      </div>

      {/* ✅ NOUVEAU : Modification de l'identité (Nom / Prénom) */}
      <Carte>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 bg-lagune/10 text-lagune rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeUtilisateur />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ardoise">Identité personnelle</h3>
            <p className="text-xs text-ardoise-clair mt-0.5">
              Assure-toi que ces informations correspondent exactement à ta pièce d'identité (CNI).
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium text-ardoise mb-1">Nom de famille</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-lagune/50 focus:border-lagune outline-none"
              placeholder="NOM"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ardoise mb-1">Prénom</label>
            <input
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-lagune/50 focus:border-lagune outline-none"
              placeholder="Prénom"
            />
          </div>
        </div>
        <Bouton
          variante="primaire"
          taille="petit"
          chargement={sauvegardeIdentite}
          onClick={gererSauvegardeIdentite}
        >
          💾 Sauvegarder les modifications
        </Bouton>
      </Carte>

      {/* Mot de passe */}
      <Carte>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 bg-lagune/10 text-lagune rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeCle />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ardoise">Mot de passe</h3>
            <p className="text-xs text-ardoise-clair mt-0.5">
              Choisis un mot de passe fort que tu n'utilises sur aucun autre service.
            </p>
          </div>
        </div>
        <Bouton variante="ghost" taille="petit" onClick={() => router.push("/mot-de-passe-oublie")}>
          Réinitialiser mon mot de passe →
        </Bouton>
      </Carte>

      {/* 2FA */}
      <Carte>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 bg-ocre/15 text-ocre rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeBouclier />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ardoise flex items-center gap-2">
              Authentification à deux facteurs
              {utilisateur.deux_fa_active ? (
                <Badge variante="succes" taille="petit">Active</Badge>
              ) : (
                <Badge variante="neutre" taille="petit">Désactivée</Badge>
              )}
            </h3>
            <p className="text-xs text-ardoise-clair mt-0.5">
              Un code à 6 chiffres généré par une application (Google Authenticator) en plus de ton mot de passe.
            </p>
          </div>
        </div>
        <Gestion2FA />
      </Carte>

      {/* Langue */}
      <Carte>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 bg-lagune/10 text-lagune rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeLangue />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ardoise">Langue d'affichage</h3>
            <p className="text-xs text-ardoise-clair mt-0.5">
              Choisis la langue dans laquelle DigiID s'affiche pour toi.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { code: "fr", libelle: "Français", actif: true },
            { code: "wo", libelle: "Wolof", actif: false },
            { code: "fo", libelle: "Fon", actif: false },
          ].map((langue) => (
            <button
              key={langue.code}
              type="button"
              disabled={!langue.actif}
              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                langue.actif
                  ? "bg-lagune text-white border-lagune"
                  : "bg-sable text-ardoise-clair border-ardoise-clair/20 cursor-not-allowed"
              }`}
            >
              {langue.libelle}
              {!langue.actif && <span className="block text-[10px] italic mt-0.5 opacity-70">Bientôt</span>}
            </button>
          ))}
        </div>
      </Carte>

      {/* Historique de connexion */}
      <Carte>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 bg-lagune/10 text-lagune rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeJournal />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ardoise">Activité récente</h3>
            <p className="text-xs text-ardoise-clair mt-0.5">
              Consulte tes dernières connexions et actions sur ton compte.
            </p>
          </div>
        </div>
        <Bouton variante="ghost" taille="petit" onClick={() => router.push("/historique")}>
          Voir mon activité →
        </Bouton>
      </Carte>

      {/* Export des données */}
      <Carte>
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 bg-lagune/10 text-lagune rounded-lg flex items-center justify-center flex-shrink-0">
            <IconeEnvoyer />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ardoise">Export de mes données</h3>
            <p className="text-xs text-ardoise-clair mt-0.5">
              Télécharge toutes tes données personnelles au format JSON (conformité RGPD / loi 2008-12).
            </p>
          </div>
        </div>
        <Bouton
          variante="ghost"
          taille="petit"
          chargement={exportChargement}
          onClick={gererExportDonnees}
        >
          📥 Exporter mes données
        </Bouton>
      </Carte>

      {/* Zone dangereuse */}
      <Alerte variante="erreur" titre="Zone sensible">
        <p className="text-xs mb-3">
          Supprimer ton compte effacera toutes tes données sous 30 jours. Cette action est irréversible.
        </p>
        <Bouton variante="danger" taille="petit" onClick={() => router.push("/profil/suppression")}>
          Supprimer mon compte
        </Bouton>
      </Alerte>
    </div>
  );
}