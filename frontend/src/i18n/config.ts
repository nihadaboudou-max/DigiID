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

/**
 * ⚙️ INTERRUPTEUR — Fichiers audio enregistrés par des voix humaines
 *
 * `false` = les `.mp3` ne sont pas encore déposés dans `public/audios/`.
 *           Conséquence : en **français**, on va directement à la synthèse
 *           vocale (aucune tentative de fichier, donc aucun 404 et une voix
 *           plus rapide à démarrer).
 *
 * Pour les langues locales (fon, dendi, bariba), le fichier reste tenté en
 * premier : la synthèse vocale ne sait pas encore les prononcer.
 *
 * 👉 Le jour où les enregistrements existent : passer cette valeur à `true`.
 */
export const AUDIOS_ENREGISTRES = false;
