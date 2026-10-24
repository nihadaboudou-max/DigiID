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
  estErreurReseau,
  EVENEMENT_AUTH_EXPIRE,
} from "@/services/client_api";

import type { DonneesConnexion, Utilisateur } from "@/types/api";
import {
  connecterHorsLigne,
  effacerSessionHorsLigne,
  memoriserCompte,
  ouvrirSessionHorsLigne,
  restaurerSessionHorsLigne,
  synchroniserSessionLocale,
} from "@/services/offline/session_locale";

interface ContexteAuth {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  estConnecte: boolean;
  /** Vrai quand la session a été ouverte **sans réseau** (données en cache). */
  estHorsLigne: boolean;
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
  const [estHorsLigne, setEstHorsLigne] = useState(false);

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
          } catch (erreurRafraichissement) {
            // Réseau coupé : on ne déconnecte pas, on retombe sur la session
            // locale mémorisée sur ce poste (guichet sans connexion).
            const local = await restaurerSessionHorsLigne().catch(() => null);
            if (local && estErreurReseau(erreurRafraichissement)) {
              setUtilisateur(local);
              setEstHorsLigne(true);
              setChargement(false);
              return;
            }
            setUtilisateur(null);
            setChargement(false);
            return;
          }
        } else {
          // Pas de token ni de refresh : session locale éventuelle.
          const local = await restaurerSessionHorsLigne().catch(() => null);
          setUtilisateur(local);
          setEstHorsLigne(local !== null);
          setChargement(false);
          return;
        }
      }

      // On a un token (soit existant, soit rafraîchi) → récupérer le profil
      try {
        const profil = await obtenirMonProfil();
        setUtilisateur(profil);
        setEstHorsLigne(false);
        // Session locale tenue à jour : c'est elle qui permet de recharger la
        // page sans réseau sans être renvoyé à l'écran de connexion.
        await synchroniserSessionLocale(profil).catch(() => undefined);
      } catch (erreur) {
        // ⚠️ Coupure réseau ≠ session invalide : auparavant toute erreur
        // effaçait les jetons, donc un rechargement de page hors-ligne
        // déconnectait l'agent du guichet. On restaure la session locale.
        if (estErreurReseau(erreur)) {
          const local = await restaurerSessionHorsLigne().catch(() => null);
          if (local) {
            setUtilisateur(local);
            setEstHorsLigne(true);
            return;
          }
        }
        // Token invalide/expiré (ou aucune session locale) : déconnexion.
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
      
      try {
        const reponse = await seConnecterAPI(donnees);
        setUtilisateur(reponse.utilisateur);
        setEstHorsLigne(false);
        // Le compte est memorise pour la prochaine session locale : seul le
        // SHA-256 du mot de passe est conserve, jamais le mot de passe.
        await memoriserCompte(reponse.utilisateur, donnees.mot_de_passe).catch(
          () => undefined,
        );
        // ⚠️ Ouvrir la session locale **dès la connexion en ligne** : sinon un
        // agent connecté le matin était déconnecté au premier rechargement
        // après une coupure réseau (aucune session hors-ligne à restaurer).
        await ouvrirSessionHorsLigne(reponse.utilisateur).catch(
          () => undefined,
        );
      } catch (erreur) {
        // Hors-ligne : session locale si l'identifiant correspond à un compte
        // déjà connecté sur ce poste (mode offline global, S3). On ne tente
        // la bascule QUE si l'échec vient du réseau : un mauvais mot de passe
        // doit rester un refus, pas une ouverture de session locale.
        if (estErreurReseau(erreur)) {
          const local = await connecterHorsLigne(
            donnees.email ?? "",
            donnees.mot_de_passe,
          ).catch(() => null);
          if (local) {
            setUtilisateur(local);
            setEstHorsLigne(true);
            await ouvrirSessionHorsLigne(local).catch(() => undefined);
            return;
          }
        }
        throw erreur;
      }
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
      
      // Fermer la session locale hors-ligne (le compte reste mémorisé pour une
      // prochaine connexion sans réseau, mais la session est close).
      await effacerSessionHorsLigne().catch(() => undefined);
      setEstHorsLigne(false);      
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
      setEstHorsLigne(false);
      await synchroniserSessionLocale(profil).catch(() => undefined);
    } catch (erreur) {
      // Réseau coupé : on garde la session locale au lieu de déconnecter.
      if (estErreurReseau(erreur)) {
        const local = await restaurerSessionHorsLigne().catch(() => null);
        if (local) {
          setUtilisateur(local);
          setEstHorsLigne(true);
          return;
        }
      }
      setUtilisateur(null);
    }
  }

  return (
    <Contexte.Provider
      value={{
        utilisateur,
        chargement,
        estConnecte: utilisateur !== null,
        estHorsLigne,
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