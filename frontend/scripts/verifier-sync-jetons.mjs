/**
 * Vérification des règles de session utilisées par la synchronisation hors-ligne.
 * Exécution : node scripts/verifier-sync-jetons.mjs
 *
 * ⚠️ Ce script importe **le vrai module** `src/services/jetons.ts` (Node ≥ 22
 * sait exécuter du TypeScript sans build) : on ne teste pas une copie de la
 * logique, mais celle qui part en production.
 *
 * Cas couvert — le bug `401 AUTH_001` de la synchro :
 *   le cookie d'accès vit 15 min ; après une coupure plus longue, la requête
 *   partait sans `Authorization` et l'agent était déconnecté au lieu de voir
 *   son jeton renouvelé.
 */
import {
  effacerJetonsApresRafraichissement,
  peutRafraichirApres401,
  renouvelerAvantEnvoi,
} from "../src/services/jetons.ts";

const VERROU = { acces: "jeton-acces", rafraichissement: "jeton-refresh" };
const EXPIRE = { acces: undefined, rafraichissement: "jeton-refresh" };
const VIDE = { acces: undefined, rafraichissement: undefined };

const cas = [];

function verifier(nom, obtenu, attendu) {
  cas.push({ nom, obtenu, attendu, ok: obtenu === attendu });
}

// 1. Renouveler AVANT d'envoyer
verifier(
  "accès expiré + refresh → renouvelle avant envoi",
  renouvelerAvantEnvoi(EXPIRE, true, false),
  true,
);
verifier("accès valide → pas de renouvellement", renouvelerAvantEnvoi(VERROU, true, false), false);
verifier("aucune session → 401 assumé, pas de refresh", renouvelerAvantEnvoi(VIDE, true, false), false);
verifier("appel public → jamais de refresh", renouvelerAvantEnvoi(EXPIRE, false, false), false);
verifier("déjà réessayé → pas de boucle", renouvelerAvantEnvoi(EXPIRE, true, true), false);

// 2. 401 : rafraîchir plutôt que déconnecter
verifier("AUTH_001 (aucun token fourni) → refresh", peutRafraichirApres401("AUTH_001", false, true), true);
verifier("AUTH_006 (token expiré) → refresh", peutRafraichirApres401("AUTH_006", false, true), true);
verifier("AUTH_001 sans refresh → déconnexion", peutRafraichirApres401("AUTH_001", false, false), false);
verifier("AUTH_004 (2FA) → pas de refresh", peutRafraichirApres401("AUTH_004", false, true), false);
verifier("AUTH_008 (droit refusé) → pas de refresh", peutRafraichirApres401("AUTH_008", false, true), false);
verifier("retry déjà tenté → pas de boucle", peutRafraichirApres401("AUTH_001", true, true), false);

// 3. Ne pas détruire la session sur une panne réseau / serveur
verifier("refresh refusé 401 → efface", effacerJetonsApresRafraichissement(401), true);
verifier("refresh refusé 403 → efface", effacerJetonsApresRafraichissement(403), true);
verifier("backend en 500 → garde les jetons", effacerJetonsApresRafraichissement(500), false);
verifier("passerelle 502 → garde les jetons", effacerJetonsApresRafraichissement(502), false);
verifier("panne réseau (0) → garde les jetons", effacerJetonsApresRafraichissement(0), false);

let echecs = 0;
for (const { nom, obtenu, attendu, ok } of cas) {
  if (!ok) echecs += 1;
  console.log(`${ok ? "OK   " : "ECHEC"} ${nom.padEnd(48)} -> ${obtenu} (attendu ${attendu})`);
}
console.log(echecs === 0 ? "\nTous les cas passent." : `\n${echecs} cas en échec.`);
process.exit(echecs === 0 ? 0 : 1);
