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
  rafraichirJetons,
  seConnecter as seConnecterAPI,
  seDeconnecter as seDeconnecterAPI,
} from "@/services/authentification";
import {
  obtenirTokenAcces,
  obtenirTokenRafraichissement,
  effacerJetons,
  EVENEMENT_AUTH_EXPIRE,
} from "@/services/client_api";

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
      let token = obtenirTokenAcces();

      // Si pas de token mais refresh token présent → tenter rafraîchissement
      if (!token) {
        const refresh = obtenirTokenRafraichissement();
        if (refresh) {
          try {
            const jetons = await rafraichirJetons();
            token = jetons.token_acces;
          } catch {
            // Refresh token invalide ou expiré
            setUtilisateur(null);
            setChargement(false);
            return;
          }
        } else {
          // Pas de token ni de refresh → utilisateur non connecté
          setUtilisateur(null);
          setChargement(false);
          return;
        }
      }

      // On a un token (soit existant, soit rafraîchi) → récupérer le profil
      try {
        const profil = await obtenirMonProfil();
        setUtilisateur(profil);
      } catch {
        // Échec : token invalide ou autre erreur
        setUtilisateur(null);
        effacerJetons();
      } finally {
        setChargement(false);
      }
    }

    initialiser();

    // 🔑 Écouter l'événement d'expiration d'authentification
    // Déclenché par client_api.ts quand le token n'est plus valide
    // (ex: rôle modifié par un super admin → déconnexion forcée)
    function gererExpirationAuth() {
      setUtilisateur(null);
      effacerJetons();
    }
    window.addEventListener(EVENEMENT_AUTH_EXPIRE, gererExpirationAuth);

    // 🔄 Vérification périodique du profil (toutes les 30 secondes)
    // Détecte les changements de rôle même sans action utilisateur
    // Ex: super admin change le rôle dans un autre onglet
    const INTERVALLE_VERIFICATION_MS = 30_000;
    const idIntervalle = setInterval(async () => {
      const token = obtenirTokenAcces();
      if (!token) return; // Pas connecté, rien à vérifier

      try {
        // Appelle GET /api/v1/auth/moi → déclenche la vérification
        // du rôle côté backend (JWT.role vs DB.role)
        // Si le rôle a changé → 401 AUTH_001 → declencherEvenementAuthExpire()
        await obtenirMonProfil();
      } catch {
        // Si erreur (rôle modifié, token expiré...),
        // le client_api.ts aura déjà appelé declencherEvenementAuthExpire()
        // et l'événement digiid:auth-expired aura déjà été traité
      }
    }, INTERVALLE_VERIFICATION_MS);

    // 🔄 Vérification au retour sur l'onglet (visibility change)
    // Quand l'utilisateur revient sur l'onglet après être allé
    // voir la page super admin qui a changé son rôle
    function gererVisibilite() {
      if (document.visibilityState === "visible") {
        const token = obtenirTokenAcces();
        if (!token) return;

        obtenirMonProfil().catch(() => {
          // L'erreur est déjà gérée par client_api.ts → declencherEvenementAuthExpire()
        });
      }
    }
    document.addEventListener("visibilitychange", gererVisibilite);

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
    return () => {
      clearInterval(idIntervalle);
      document.removeEventListener("visibilitychange", gererVisibilite);
      window.removeEventListener("pageshow", gererPageshow);
      window.removeEventListener(EVENEMENT_AUTH_EXPIRE, gererExpirationAuth);
    };
  }, []);

  async function seConnecter(donnees: DonneesConnexion) {
    setChargement(true);
    try {
      // 🔒 Nettoyage préalable pour éviter les fuites de données entre sessions
      // Efface tous les jetons et données utilisateur avant la nouvelle connexion
      effacerJetons();
      setUtilisateur(null);
      
      // Nettoyer le sessionStorage pour éviter les données résiduelles
      if (typeof window !== "undefined") {
        sessionStorage.clear();
      }
      
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
      // 🔒 Nettoyage complet pour éviter les fuites de données
      setUtilisateur(null);
      effacerJetons();
      
      // Nettoyer toutes les données de session
      if (typeof window !== "undefined") {
        sessionStorage.clear();
        localStorage.removeItem("digiid_utilisateur");
      }
      
      setChargement(false);
      
      // 🔄 Forcer le rechargement de la page pour vider tous les caches
      // et garantir que le prochain utilisateur ne verra pas les données précédentes
      if (typeof window !== "undefined") {
        window.location.href = "/connexion";
      }
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