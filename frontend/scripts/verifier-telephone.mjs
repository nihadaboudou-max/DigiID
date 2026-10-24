/**
 * Vérification manuelle (hors navigateur) des règles de validation téléphone.
 * Exécution : node scripts/verifier-telephone.mjs
 *
 * Ce script reproduit la logique de `src/services/telephone.ts` pour prouver
 * que les cas réels du guichet sont bien acceptés et que les saisies
 * fantaisistes (« 1234 », « abc ») sont refusées — c'est exactement ce qui
 * laissait passer « n'importe quel numéro » auparavant.
 */
const INDICATIF_BENIN = "+229";

function nettoyer(valeur) {
  return (valeur ?? "").replace(/[\s.\-()/]/g, "").trim();
}

function normaliserTelephone(valeur) {
  if (!valeur) return null;
  let brut = nettoyer(valeur);
  if (!brut) return null;
  if (brut.startsWith("00")) brut = `+${brut.slice(2)}`;
  const avecIndicatif = brut.startsWith("+");
  const chiffres = brut.replace(/^\+/, "");
  const indicatifBenin = chiffres.startsWith("229");
  const sansIndicatif = indicatifBenin ? chiffres.slice(3) : chiffres;
  const local =
    !avecIndicatif && sansIndicatif.length === 8 ? `01${sansIndicatif}` : sansIndicatif;
  if (/^0[1-9]\d{8}$/.test(local)) return `${INDICATIF_BENIN}${local}`;
  if (avecIndicatif && !indicatifBenin && /^[1-9]\d{7,14}$/.test(chiffres)) {
    return `+${chiffres}`;
  }
  return null;
}

const cas = [
  ["97 12 34 56", "+2290197123456"],
  ["+229 01 97 12 34 56", "+2290197123456"],
  ["002290197123456", "+2290197123456"],
  ["0197123456", "+2290197123456"],
  ["+226 70 12 34 56", "+22670123456"],
  ["abc", null],
  ["1234", null],
  ["00000000", null],
  ["+229 01 97 12 34", null],
  ["", null],
];

let echecs = 0;
for (const [entree, attendu] of cas) {
  const obtenu = normaliserTelephone(entree);
  const ok = obtenu === attendu;
  if (!ok) echecs += 1;
  console.log(`${ok ? "OK  " : "ECHEC"} ${JSON.stringify(entree).padEnd(24)} -> ${obtenu} (attendu ${attendu})`);
}
console.log(echecs === 0 ? "\nTous les cas passent." : `\n${echecs} cas en échec.`);
process.exit(echecs === 0 ? 0 : 1);
