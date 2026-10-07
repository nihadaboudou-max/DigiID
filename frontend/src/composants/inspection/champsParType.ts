// Rendu « par type » des données extraites (étape S8).
//
// Chaque document possède SON schéma : on affiche donc les champs dans un ordre
// métier explicite (avec libellés français) plutôt qu'un JSON brut générique.
// Les champs non répertoriés sont ajoutés à la fin avec un libellé automatique.

import { TypeDocument } from "@/types/inspection";

export interface ChampDocument {
  key: string;
  libelle: string;
}

/** Champs affichés (dans l'ordre) pour chaque type de document supporté. */
export const CHAMPS_PAR_TYPE: Record<string, ChampDocument[]> = {
  [TypeDocument.CNI_BIOMETRIQUE]: [
    { key: "numero_document", libelle: "N° de carte" },
    { key: "nom_famille", libelle: "Nom" },
    { key: "prenoms", libelle: "Prénoms" },
    { key: "date_naissance", libelle: "Date de naissance" },
    { key: "lieu_naissance", libelle: "Lieu de naissance" },
    { key: "sexe", libelle: "Sexe" },
    { key: "taille", libelle: "Taille (cm)" },
    { key: "date_delivrance", libelle: "Date de délivrance" },
    { key: "date_expiration", libelle: "Date d'expiration" },
    { key: "autorite_delivrance", libelle: "Autorité de délivrance" },
  ],
  [TypeDocument.CNI_PAPIER]: [
    { key: "numero_document", libelle: "N° de carte" },
    { key: "nom_famille", libelle: "Nom" },
    { key: "prenoms", libelle: "Prénoms" },
    { key: "date_naissance", libelle: "Date de naissance" },
    { key: "lieu_naissance", libelle: "Lieu de naissance" },
    { key: "sexe", libelle: "Sexe" },
    { key: "date_delivrance", libelle: "Date de délivrance" },
    { key: "date_expiration", libelle: "Date d'expiration" },
    { key: "autorite_delivrance", libelle: "Autorité de délivrance" },
  ],
  [TypeDocument.PASSEPORT]: [
    { key: "numero_passeport", libelle: "N° de passeport" },
    { key: "type_passeport", libelle: "Type de passeport" },
    { key: "nom_famille", libelle: "Nom" },
    { key: "prenoms", libelle: "Prénoms" },
    { key: "date_naissance", libelle: "Date de naissance" },
    { key: "lieu_naissance", libelle: "Lieu de naissance" },
    { key: "sexe", libelle: "Sexe" },
    { key: "nationalite", libelle: "Nationalité" },
    { key: "pays_emetteur", libelle: "Pays émetteur" },
    { key: "autorite_delivrance", libelle: "Autorité de délivrance" },
    { key: "date_delivrance", libelle: "Date de délivrance" },
    { key: "date_expiration", libelle: "Date d'expiration" },
    { key: "mrz_valide", libelle: "MRZ valide" },
  ],
  [TypeDocument.PERMIS_CONDUIRE]: [
    { key: "numero_document", libelle: "N° de permis" },
    { key: "nom_famille", libelle: "Nom" },
    { key: "prenoms", libelle: "Prénoms" },
    { key: "date_naissance", libelle: "Date de naissance" },
    { key: "lieu_naissance", libelle: "Lieu de naissance" },
    { key: "categories", libelle: "Catégories" },
    { key: "date_delivrance", libelle: "Date de délivrance" },
    { key: "date_expiration", libelle: "Date d'expiration" },
  ],
  [TypeDocument.CARTE_ASSURANCE]: [
    { key: "numero_document", libelle: "N° de contrat" },
    { key: "compagnie_assurance", libelle: "Compagnie d'assurance" },
    { key: "nom_famille", libelle: "Nom de l'assuré" },
    { key: "prenoms", libelle: "Prénoms de l'assuré" },
    { key: "immatriculation", libelle: "Immatriculation" },
    { key: "marque_vehicule", libelle: "Marque du véhicule" },
    { key: "modele_vehicule", libelle: "Modèle du véhicule" },
    { key: "date_effet", libelle: "Date d'effet" },
    { key: "date_expiration", libelle: "Date d'expiration" },
  ],
  [TypeDocument.CARTE_GRISE]: [
    { key: "numero_immatriculation", libelle: "Immatriculation" },
    { key: "immatriculation", libelle: "Immatriculation" },
    { key: "numero_chassis", libelle: "N° de châssis (VIN)" },
    { key: "numero_moteur", libelle: "N° de moteur" },
    { key: "marque", libelle: "Marque" },
    { key: "modele", libelle: "Modèle" },
    { key: "genre", libelle: "Genre" },
    { key: "energie", libelle: "Énergie" },
    { key: "puissance_fiscale_cv", libelle: "Puissance fiscale (CV)" },
    { key: "nombre_places", libelle: "Nombre de places" },
    { key: "poids_total_kg", libelle: "Poids total (kg)" },
    { key: "date_premiere_mise_circulation", libelle: "1re mise en circulation" },
    { key: "annee_vehicule", libelle: "Année du véhicule" },
    { key: "titulaire_nom", libelle: "Titulaire (nom)" },
    { key: "titulaire_prenoms", libelle: "Titulaire (prénoms)" },
    { key: "titulaire_adresse", libelle: "Titulaire (adresse)" },
    { key: "numero_formule", libelle: "Numéro de formule" },
    { key: "date_expiration", libelle: "Date d'expiration" },
  ],
  [TypeDocument.CARTE_SEJOUR]: [
    { key: "numero_titre", libelle: "N° du titre" },
    { key: "numero_document", libelle: "N° du titre" },
    { key: "type_titre", libelle: "Type de titre" },
    { key: "categorie", libelle: "Catégorie" },
    { key: "nom_famille", libelle: "Nom" },
    { key: "prenoms", libelle: "Prénoms" },
    { key: "sexe", libelle: "Sexe" },
    { key: "date_naissance", libelle: "Date de naissance" },
    { key: "lieu_naissance", libelle: "Lieu de naissance" },
    { key: "nationalite", libelle: "Nationalité" },
    { key: "adresse", libelle: "Adresse" },
    { key: "autorite_delivrance", libelle: "Autorité de délivrance" },
    { key: "date_delivrance", libelle: "Date de délivrance" },
    { key: "date_expiration", libelle: "Date d'expiration" },
  ],
  [TypeDocument.CARTE_CONSULAIRE]: [
    { key: "numero_immatriculation_consulaire", libelle: "N° d'immatriculation" },
    { key: "numero_document", libelle: "N° d'immatriculation" },
    { key: "numero_passeport", libelle: "N° de passeport" },
    { key: "nom_famille", libelle: "Nom" },
    { key: "prenoms", libelle: "Prénoms" },
    { key: "date_naissance", libelle: "Date de naissance" },
    { key: "lieu_naissance", libelle: "Lieu de naissance" },
    { key: "nationalite", libelle: "Nationalité" },
    { key: "profession", libelle: "Profession" },
    { key: "situation_matrimoniale", libelle: "Situation matrimoniale" },
    { key: "adresse", libelle: "Adresse" },
    { key: "poste_consulaire", libelle: "Poste consulaire" },
    { key: "pays_emetteur", libelle: "Pays émetteur" },
    { key: "personnes_a_charge", libelle: "Personnes à charge" },
    { key: "date_delivrance", libelle: "Date de délivrance" },
    { key: "date_expiration", libelle: "Date d'expiration" },
  ],
};

/** Libellé automatique de secours : « numero_immatriculation » → « Numero Immatriculation ». */
export function libelleAutomatique(cle: string): string {
  return cle
    .split("_")
    .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
    .join(" ");
}

/** Formate une valeur quelconque en chaîne affichable. */
export function formaterValeurChamp(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return "";
  if (Array.isArray(valeur)) return valeur.join(", ");
  if (typeof valeur === "object") return JSON.stringify(valeur);
  return String(valeur);
}

export interface ChampAffiche {
  cle: string;
  libelle: string;
  valeur: string;
}

/**
 * Renvoie les champs d'un document ordonnés selon SON type (libellés métier),
 * complétés par les éventuels champs non répertoriés (libellé automatique).
 */
export function champsDocument(
  type: string | undefined,
  donnees: Record<string, unknown>
): ChampAffiche[] {
  const ordre = (type && CHAMPS_PAR_TYPE[type]) || [];
  const connus = new Set(ordre.map((champ) => champ.key));

  const resultat: ChampAffiche[] = ordre
    .filter((champ) => champ.key in donnees)
    .map((champ) => ({
      cle: champ.key,
      libelle: champ.libelle,
      valeur: formaterValeurChamp(donnees[champ.key]),
    }));

  for (const [cle, valeur] of Object.entries(donnees)) {
    if (!connus.has(cle)) {
      resultat.push({
        cle,
        libelle: libelleAutomatique(cle),
        valeur: formaterValeurChamp(valeur),
      });
    }
  }

  return resultat;
}
