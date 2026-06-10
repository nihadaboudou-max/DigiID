"use client";

/**
 * Page Identité → Mot de passe.
 * Permet de changer son mot de passe depuis le menu Identité.
 */
import { useState } from "react";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { useNotifications } from "@/contextes/notifications";

export default function PageIdentiteMotDePasse() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
        "citoyen", "agent", "medecin", "police", "ong",
        "administrateur", "super_administrateur",
      ]}
    >
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [ancienMotDePasse, setAncienMotDePasse] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function gererChangement() {
    setErreur(null);

    if (!ancienMotDePasse || !nouveauMotDePasse || !confirmation) {
      setErreur("Tous les champs sont requis.");
      return;
    }

    if (nouveauMotDePasse !== confirmation) {
      setErreur("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    if (nouveauMotDePasse.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setChargement(true);
    try {
      await clientAPI.patch(
        "/api/v1/utilisateur/profil/mot-de-passe",
        { ancien_mot_de_passe: ancienMotDePasse, nouveau_mot_de_passe: nouveauMotDePasse },
        { authentifie: true },
      );
      notifier("Mot de passe modifié avec succès !", "succes");
      setAncienMotDePasse("");
      setNouveauMotDePasse("");
      setConfirmation("");
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Erreur lors du changement de mot de passe.",
      );
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70 mb-2">
        <a href="/identite" className="hover:text-ocre transition-colors">Identité</a>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Mot de passe</span>
      </nav>

      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Sécurité du compte
        </p>
        <h1 className="mt-1">Changer de mot de passe</h1>
        <p className="text-ardoise-clair mt-2">
          Choisis un mot de passe fort que tu n&apos;utilises sur aucun autre service.
        </p>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <Carte>
        <div className="space-y-4 max-w-md">
          <ChampSaisie
            libelle="Mot de passe actuel"
            type="password"
            value={ancienMotDePasse}
            onChange={(e) => setAncienMotDePasse(e.target.value)}
            placeholder="Ton mot de passe actuel"
            required
            autoComplete="current-password"
          />
          <ChampSaisie
            libelle="Nouveau mot de passe"
            type="password"
            value={nouveauMotDePasse}
            onChange={(e) => setNouveauMotDePasse(e.target.value)}
            placeholder="Au moins 8 caractères"
            required
            autoComplete="new-password"
            aide="Minimum 8 caractères, lettres et chiffres recommandés."
          />
          <ChampSaisie
            libelle="Confirmer le nouveau mot de passe"
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Répète le nouveau mot de passe"
            required
            autoComplete="new-password"
          />
          <div className="pt-2">
            <Bouton
              variante="primaire"
              onClick={gererChangement}
              chargement={chargement}
            >
              Changer mon mot de passe
            </Bouton>
          </div>
        </div>
      </Carte>

      {/* Conseils de sécurité */}
      <Carte variante="pointilles" titre="Conseils de sécurité">
        <ul className="space-y-2 text-sm text-ardoise">
          <li>🔐 Utilise un mot de passe unique pour DigiID.</li>
          <li>🔐 Active la double authentification (2FA) pour plus de sécurité.</li>
          <li>🔐 Ne partage jamais ton mot de passe.</li>
          <li>🔐 Change ton mot de passe régulièrement.</li>
        </ul>
      </Carte>
    </div>
  );
}
