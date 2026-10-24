/**
 * Session locale hors-ligne (S3).
 *
 * **Règle** : si le numéro saisi correspond à un compte déjà connecté sur ce
 * poste, l'authentification s'exécute **sans réseau**. Le mot de passe n'est
 * jamais stocké : on conserve seulement son empreinte SHA-256, comparée à la
 * saisie. Un compte n'est mémorisé qu'après une connexion **en ligne réussie**,
 * et la session locale expire au bout de 7 jours.
 *
 * Sécurité assumée : le poste guichet est un appareil de confiance, partagé par
 * des agents identifiés. La session locale ne donne accès qu'aux écrans du rôle
 * mémorisé, et toute action sensible (paiement, identité) exige le réseau.
 */
import type { Utilisateur } from "@/types/api";

import { ecrire, lire, supprimer } from "./base_locale";

const DUREE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

/** Compte mémorisé sur ce poste. */
export interface CompteLocal {
  cle: string;            // "+2290197123456"
  empreinte_mdp: string;  // SHA-256 hexadécimal
  utilisateur: Utilisateur;
  memorise_le: number;
}

/** Empreinte SHA-256 (WebCrypto) d'un mot de passe. */
async function empreinte(texte: string): Promise<string> {
  const donnees = new TextEncoder().encode(texte);
  const digest = await crypto.subtle.digest("SHA-256", donnees);
  return Array.from(new Uint8Array(digest))
    .map((octet) => octet.toString(16).padStart(2, "0"))
    .join("");
}

/** Normalise un numéro pour servir de clé locale. */
export function cleTelephone(numero: string): string {
  const chiffres = numero.replace(/[^\d]/g, "");
  const sansIndicatif = chiffres.startsWith("229")
    ? chiffres.slice(3)
    : chiffres;
  const local = sansIndicatif.length === 8 ? `01${sansIndicatif}` : sansIndicatif;
  return `+229${local}`;
}

/** Mémorise un compte après une connexion en ligne réussie. */
export async function memoriserCompte(
  utilisateur: Utilisateur,
  motDePasse: string,
): Promise<void> {
  if (!utilisateur.telephone) return;
  const compte: CompteLocal = {
    cle: cleTelephone(utilisateur.telephone),
    empreinte_mdp: await empreinte(motDePasse),
    utilisateur,
    memorise_le: Date.now(),
  };
  await ecrire("comptes", compte);
}

/**
 * Authentifie localement un compte déjà mémorisé.
 *
 * `identifiant` accepte un **numéro** (session locale par téléphone, cas du
 * guichet : le citoyen donne son numéro sans réseau) ou un **email**.
 */
export async function connecterHorsLigne(
  identifiant: string,
  motDePasse: string,
): Promise<Utilisateur | null> {
  const empreinteSaisie = await empreinte(motDePasse);

  // 1. Par numéro de téléphone (clé directe).
  const parTelephone = await lire<CompteLocal>(
    "comptes",
    cleTelephone(identifiant),
  );
  if (parTelephone) {
    if (Date.now() - parTelephone.memorise_le > DUREE_SESSION_MS) {
      await supprimer("comptes", parTelephone.cle);
    } else if (parTelephone.empreinte_mdp === empreinteSaisie) {
      return parTelephone.utilisateur;
    }
  }

  // 2. Par email (formulaire de connexion classique).
  const { lister } = await import("./base_locale");
  const cible = identifiant.trim().toLowerCase();
  const comptes = await lister<CompteLocal>("comptes");
  const parEmail = comptes.find(
    (compte) =>
      compte.utilisateur.email?.toLowerCase() === cible &&
      compte.empreinte_mdp === empreinteSaisie,
  );
  return parEmail?.utilisateur ?? null;
}

/** Ouvre une session locale persistante (survit à un rechargement de page). */
export async function ouvrirSessionHorsLigne(
  utilisateur: Utilisateur,
): Promise<void> {
  await ecrire("meta", {
    cle: "session_hors_ligne",
    utilisateur,
    expire_le: Date.now() + DUREE_SESSION_MS,
  });
}

/** Restaure la session locale (appelée quand l'API est injoignable). */
export async function restaurerSessionHorsLigne(): Promise<Utilisateur | null> {
  const session = await lire<{ expire_le: number; utilisateur: Utilisateur }>(
    "meta",
    "session_hors_ligne",
  );
  if (!session || Date.now() > session.expire_le) return null;
  return session.utilisateur;
}

/** Ferme la session locale (déconnexion). */
export async function effacerSessionHorsLigne(): Promise<void> {
  await supprimer("meta", "session_hors_ligne");
}

/** Nombre de comptes mémorisés (indicateur d'interface). */
export async function compterComptesLocaux(): Promise<number> {
  const { lister } = await import("./base_locale");
  return (await lister<CompteLocal>("comptes")).length;
}
