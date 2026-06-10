/**
 * FormulaireAttestation — Formulaire de création d'une attestation.
 * 
 * Permet de :
 *   1. Saisir le DigiID de la personne à attester
 *   2. Choisir le type d'attestation
 *   3. Rédiger le titre et la description
 *   4. Indiquer la nature et la durée du lien
 *   5. Définir le poids (score) de l'attestation
 *   6. Choisir la visibilité publique
 *   7. Soumettre l'attestation
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { useNotifications } from "@/contextes/notifications";
import {
  creerAttestation,
  ETIQUETTES_TYPES,
  ETIQUETTES_LIENS,
  type TypeAttestation,
  type LienNature,
} from "@/services/attestations_communautaires";
import { ErreurAPI } from "@/services/client_api";

/** Types d'attestation disponibles pour le sélecteur */
const TYPES_ATTESTATION = Object.keys(ETIQUETTES_TYPES) as TypeAttestation[];

/** Natures de lien disponibles pour le sélecteur */
const NATURES_LIEN = Object.keys(ETIQUETTES_LIENS) as LienNature[];

/** Valeur par défaut du poids de score */
const POIDS_SCORE_DEFAUT = 5;

/** Poids minimum et maximum */
const POIDS_MIN = 1;
const POIDS_MAX = 20;

/**
 * Propriétés du composant.
 */
interface ProprietesFormulaire {
  /** Callback appelée après une création réussie (optionnel) */
  onSucces?: () => void;
}

/**
 * Formulaire de création d'attestation communautaire.
 */
export function FormulaireAttestation({ onSucces }: ProprietesFormulaire) {
  const router = useRouter();
  const { notifier } = useNotifications();

  // --- État du formulaire ---
  const [attesteDigiID, setAttesteDigiID] = useState("");
  const [typeAttestation, setTypeAttestation] = useState<TypeAttestation>("identite");
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [forces, setForces] = useState("");
  const [lienConnuDepuis, setLienConnuDepuis] = useState("");
  const [lienNature, setLienNature] = useState<LienNature | "">("");
  const [poidsScore, setPoidsScore] = useState(POIDS_SCORE_DEFAUT);
  const [estVisiblePublic, setEstVisiblePublic] = useState(false);

  // --- État du formulaire ---
  const [soumission, setSoumission] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // --- Validation ---
  const estValide =
    attesteDigiID.trim().length >= 8 &&
    titre.trim().length >= 3;

  /**
   * Soumet le formulaire de création d'attestation.
   */
  async function gererSoumission(e: React.FormEvent) {
    e.preventDefault();
    setSoumission(true);
    setErreur(null);

    try {
      // Appel API
      const resultat = await creerAttestation({
        atteste_digiid: attesteDigiID.trim().toUpperCase(),
        type_attestation: typeAttestation,
        titre: titre.trim(),
        description: description.trim() || undefined,
        forces: forces.trim() || undefined,
        lien_connu_depuis: lienConnuDepuis.trim() || undefined,
        lien_nature: (lienNature as LienNature) || undefined,
        poids_score: poidsScore,
        est_visible_public: estVisiblePublic,
      });

      // Succès
      notifier(
        `✅ Attestation créée ! ${resultat.attestation.titre}`,
        "succes",
      );

      // Redirection vers le détail de l'attestation créée
      if (onSucces) {
        onSucces();
      } else {
        router.push(`/attestations-communautaires/attestation/${resultat.attestation.id}`);
      }
    } catch (e) {
      // Gestion des erreurs
      if (e instanceof ErreurAPI) {
        setErreur(e.message_utilisateur);
      } else if (e instanceof Error) {
        setErreur(e.message);
      } else {
        setErreur("Une erreur inattendue est survenue.");
      }
    } finally {
      setSoumission(false);
    }
  }

  return (
    <form onSubmit={gererSoumission} className="space-y-6 apparition">
      {/* En-tête */}
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Nouvelle attestation
        </p>
        <h1 className="mt-1">Attester un membre de la communauté</h1>
        <p className="text-ardoise-clair mt-2">
          En attestant quelqu&apos;un, tu confirmes publiquement ta confiance en
          cette personne. Ton attestation contribue à son score de confiance
          DigiID.
        </p>
      </header>

      {/* Message d'erreur */}
      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      {/* Section 1 : Personne à attester */}
      <Carte titre="👤 Personne à attester">
        <div className="space-y-4">
          <ChampSaisie
            id="atteste_digiid"
            libelle="DigiID public de la personne"
            aide="Saisis le DigiID public (ex: DIGIID-A1B2C3D4). Tu le trouves sur son profil."
            placeholder="DIGIID-XXXXXXXX"
            value={attesteDigiID}
            onChange={(e) => setAttesteDigiID(e.target.value.toUpperCase())}
            required
          />
        </div>
      </Carte>

      {/* Section 2 : Type et titre */}
      <Carte titre="🏷️ Type et titre">
        <div className="space-y-4">
          {/* Type d'attestation */}
          <div>
            <label
              htmlFor="type_attestation"
              className="block text-sm font-medium text-ardoise mb-1.5"
            >
              Type d&apos;attestation <span className="text-ocre">*</span>
            </label>
            <select
              id="type_attestation"
              value={typeAttestation}
              onChange={(e) => setTypeAttestation(e.target.value as TypeAttestation)}
              className="w-full px-3 py-2.5 border border-ardoise-clair/20 rounded-lg text-sm
                         focus:ring-2 focus:ring-lagune/20 focus:border-lagune outline-none
                         bg-white transition-colors"
            >
              {TYPES_ATTESTATION.map((type) => (
                <option key={type} value={type}>
                  {ETIQUETTES_TYPES[type]}
                </option>
              ))}
            </select>
            <p className="text-xs text-ardoise-clair/60 mt-1">
              {typeAttestation === "identite" && "Je confirme connaître cette personne dans la vie réelle"}
              {typeAttestation === "competence" && "Je certifie les compétences professionnelles"}
              {typeAttestation === "moralite" && "Je certifie la bonne moralité"}
              {typeAttestation === "residence" && "Je confirme l'adresse de résidence"}
              {typeAttestation === "activite" && "Je confirme l'activité ou l'emploi"}
              {typeAttestation === "personnalise" && "Autre type d'attestation personnalisée"}
            </p>
          </div>

          {/* Titre */}
          <ChampSaisie
            id="titre"
            libelle="Titre de l'attestation"
            aide="Un titre clair qui décrit l'attestation"
            placeholder="Ex: Attestation de connaissance - Jean Dupont"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            required
            maxLength={200}
          />
        </div>
      </Carte>

      {/* Section 3 : Description détaillée */}
      <Carte titre="📝 Description détaillée">
        <div className="space-y-4">
          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-ardoise mb-1.5"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explique dans quel contexte tu connais cette personne, pourquoi tu attestes d'elle..."
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2.5 border border-ardoise-clair/20 rounded-lg text-sm
                         focus:ring-2 focus:ring-lagune/20 focus:border-lagune outline-none
                         bg-white transition-colors resize-y"
            />
            <p className="text-xs text-ardoise-clair/40 text-right mt-1">
              {description.length}/2000
            </p>
          </div>

          {/* Forces/qualités */}
          <div>
            <label
              htmlFor="forces"
              className="block text-sm font-medium text-ardoise mb-1.5"
            >
              Forces et qualités observées
            </label>
            <textarea
              id="forces"
              value={forces}
              onChange={(e) => setForces(e.target.value)}
              placeholder="Personne intègre, fiable, ponctuelle..."
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2.5 border border-ardoise-clair/20 rounded-lg text-sm
                         focus:ring-2 focus:ring-lagune/20 focus:border-lagune outline-none
                         bg-white transition-colors resize-y"
            />
          </div>
        </div>
      </Carte>

      {/* Section 4 : Relation */}
      <Carte titre="🔗 Nature de la relation">
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Nature du lien */}
          <div>
            <label
              htmlFor="lien_nature"
              className="block text-sm font-medium text-ardoise mb-1.5"
            >
              Nature du lien
            </label>
            <select
              id="lien_nature"
              value={lienNature}
              onChange={(e) => setLienNature(e.target.value as LienNature | "")}
              className="w-full px-3 py-2.5 border border-ardoise-clair/20 rounded-lg text-sm
                         focus:ring-2 focus:ring-lagune/20 focus:border-lagune outline-none
                         bg-white transition-colors"
            >
              <option value="">— Sélectionne une option —</option>
              {NATURES_LIEN.map((nature) => (
                <option key={nature} value={nature}>
                  {ETIQUETTES_LIENS[nature]}
                </option>
              ))}
            </select>
          </div>

          {/* Depuis quand */}
          <ChampSaisie
            id="lien_connu_depuis"
            libelle="Connu(e) depuis"
            aide="Ex: '5 ans', 'enfance', 'depuis 2019'"
            placeholder="Depuis quand ?"
            value={lienConnuDepuis}
            onChange={(e) => setLienConnuDepuis(e.target.value)}
            maxLength={100}
          />
        </div>
      </Carte>

      {/* Section 5 : Score et visibilité */}
      <Carte titre="⚙️ Configuration">
        <div className="space-y-4">
          {/* Poids du score */}
          <div>
            <label
              htmlFor="poids_score"
              className="block text-sm font-medium text-ardoise mb-1.5"
            >
              Poids de l&apos;attestation (score) : <strong>{poidsScore}</strong> points
            </label>
            <input
              id="poids_score"
              type="range"
              min={POIDS_MIN}
              max={POIDS_MAX}
              value={poidsScore}
              onChange={(e) => setPoidsScore(Number(e.target.value))}
              className="w-full h-2 bg-sable-clair rounded-full appearance-none cursor-pointer
                         accent-ocre"
            />
            <div className="flex justify-between text-xs text-ardoise-clair/60 mt-1">
              <span>Min : {POIDS_MIN} pt</span>
              <span>Max : {POIDS_MAX} pts</span>
            </div>
            <p className="text-xs text-ardoise-clair/60 mt-1">
              Plus le poids est élevé, plus l&apos;attestation contribue au score
              de la personne attestée.
            </p>
          </div>

          {/* Visibilité publique */}
          <div className="flex items-start gap-3">
            <input
              id="est_visible_public"
              type="checkbox"
              checked={estVisiblePublic}
              onChange={(e) => setEstVisiblePublic(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-ardoise-clair/20 text-lagune
                         focus:ring-lagune/20 focus:ring-2"
            />
            <label htmlFor="est_visible_public" className="text-sm text-ardoise">
              <span className="font-medium">Rendre visible sur le profil public</span>
              <p className="text-xs text-ardoise-clair/60 mt-0.5">
                Si activé, cette attestation sera visible par les autres utilisateurs
                sur le profil de la personne attestée.
              </p>
            </label>
          </div>
        </div>
      </Carte>

      {/* Bouton de soumission */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <div className="text-xs text-ardoise-clair/50">
          En attestant, tu confirmes que les informations fournies sont sincères.
        </div>
        <div className="flex gap-3">
          <Bouton
            variante="secondaire"
            onClick={() => router.back()}
            type="button"
          >
            Annuler
          </Bouton>
          <Bouton
            variante="primaire"
            chargement={soumission}
            disabled={!estValide || soumission}
            type="submit"
          >
            {soumission ? "Création en cours..." : "Créer l'attestation"}
          </Bouton>
        </div>
      </div>
    </form>
  );
}
