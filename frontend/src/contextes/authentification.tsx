"use client";

/**
 * Contexte global d'authentification.
 * Tous les composants peuvent appeler `useAuthentification()` pour savoir
 * qui est connecté et déclencher connexion/déconnexion.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  obtenirMonProfil,
  seConnecter as seConnecterAPI,
  seDeconnecter as seDeconnecterAPI,
} from "@/services/authentification";
import { obtenirTokenAcces, effacerJetons } from "@/services/client_api";

import type { DonneesConnexion, Utilisateur } from "@/types/api";

interface ContexteAuth {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  estConnecte: boolean;
  seConnecter: (donnees: DonneesConnexion) => Promise<void>;
  seDeconnecter: () => Promise<void>;
  rafraichirProfil: () => Promise<void>;
}

const Contexte = createContext<ContexteAuth | undefined>(undefined);

export function FournisseurAuthentification({
  children,
}: {
  children: ReactNode;
}) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  // Au montage : si on a un token, on tente de récupérer le profil
  // ET on écoute le retour arrière (BFCache) pour forcer la revérification
  useEffect(() => {
    async function initialiser() {
      const token = obtenirTokenAcces();
      if (!token) {
        setUtilisateur(null);
        setChargement(false);
        return;
      }
      try {
        const profil = await obtenirMonProfil();
        setUtilisateur(profil);
      } catch {
        // Token invalide ou expiré — l'utilisateur devra se reconnecter
        setUtilisateur(null);
        effacerJetons();
      } finally {
        setChargement(false);
      }
    }

    initialiser();

    // Détecte le retour arrière du navigateur (BFCache)
    // Quand l'utilisateur revient en arrière après déconnexion, le token
    // est déjà effacé mais la page est restaurée sans re-exécuter le JS.
    function gererPageshow(event: PageTransitionEvent) {
      if (event.persisted) {
        // Page restaurée depuis le cache — forcer la revérification
        const token = obtenirTokenAcces();
        if (!token) {
          setUtilisateur(null);
        }
      }
    }
    window.addEventListener("pageshow", gererPageshow);
    return () => window.removeEventListener("pageshow", gererPageshow);
  }, []);

  async function seConnecter(donnees: DonneesConnexion) {
    setChargement(true);
    try {
      const reponse = await seConnecterAPI(donnees);
      setUtilisateur(reponse.utilisateur);
    } finally {
      setChargement(false);
    }
  }

  async function seDeconnecter() {
    setChargement(true);
    try {
      await seDeconnecterAPI();
    } catch {
      // Même si la requête échoue, on efface tout localement
    } finally {
      setUtilisateur(null);
      setChargement(false);
    }
  }

  async function rafraichirProfil() {
    try {
      const profil = await obtenirMonProfil();
      setUtilisateur(profil);
    } catch {
      setUtilisateur(null);
    }
  }

  return (
    <Contexte.Provider
      value={{
        utilisateur,
        chargement,
        estConnecte: utilisateur !== null,
        seConnecter,
        seDeconnecter,
        rafraichirProfil,
      }}
    >
      {children}
    </Contexte.Provider>
  );
}

export function useAuthentification(): ContexteAuth {
  const contexte = useContext(Contexte);
  if (contexte === undefined) {
    throw new Error(
      "useAuthentification() doit être utilisé à l'intérieur de FournisseurAuthentification",
    );
  }
  return contexte;
}
