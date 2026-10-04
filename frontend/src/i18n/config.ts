/**
 * DigiID — Configuration de l'accessibilité vocale (S5).
 *
 * Un seul endroit à modifier pour activer/désactiver des comportements
 * « qui attendent les vrais fichiers audio ».
 */

/**
 * ⚙️ INTERRUPTEUR — Préchargement des audios
 *
 * `false` = on ne précharge PAS les .mp3.
 * `true`  = on précharge les .mp3 de la langue courante.
 *
 * Pourquoi `false` aujourd'hui ?
 *   Les fichiers `.mp3` ne sont PAS encore dans `public/audios/`.
 *   Les précharger maintenant afficherait des erreurs 404 dans la console
 *   du navigateur (le son, lui, passe quand même grâce au repli TTS).
 *
 * 👉 👉 👉  À FAIRE LE JOUR OÙ LES .mp3 SONT ENREGISTRÉS :
 *   passer cette valeur à `true`, puis tester une page avec du son
 *   (accueil → choisir une langue, ou assistant colis).
 */
export const ACTIVER_PREACHARGEMENT_AUDIO = false;
