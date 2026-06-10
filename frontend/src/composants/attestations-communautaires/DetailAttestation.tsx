/**
 * DetailAttestation — Carte de détail d'une attestation.
 * 
 * Affiche :
 *   - Les informations complètes de l'attestation
 *   - Les boutons d'action (approuver/refuser si en attente)
 *   - Le badge de statut
 *   - Les métadonnées (dates, poids, visibilité)
 *   - Les boutons de modification/suppression pour l'attestant
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { ModalConfirmation } from "@/composants/commun/ModalConfirmation";
import { StatutAttestation } from "./StatutAttestation";
import { useNotifications } from "@/contextes/notifications";
import {
  type AttestationDetail,
  type StatutAttestation as TypeStatut,
  ETIQUETTES_TYPES,
  ETIQUETTES_STATUTS,
  ETIQUETTES_LIENS,
  approuverAttestation,
  refuserAttestation,
  supprimerAttestation,
} from "@/services/attestations_communautaires";
import { ErreurAPI } from "@/services/client_api";
import clsx from "clsx";

// ============================================================================
// Propriétés
// ============================================================================

interface ProprietesDetailAttestation {
  /** Données complètes de l'attestation */
  attestation: AttestationDetail;
  /** ID de l'utilisateur connecté (pour déterminer les droits) */
  utilisateurId: string;
  /** Callback après mise à jour */
  onRafraichir?: () => void;
}

// ============================================================================
// Composant principal
// ============================================================================

export function DetailAttestation({
  attestation,
  utilisateurId,
  onRafraichir,
}: ProprietesDetailAttestation) {
  const router = useRouter();
  const { notifier } = useNotifications();

  // --- État local ---
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [motifRefus, setMotifRefus] = useState("");
  const [afficherFormulaireRefus, setAfficherFormulaireRefus] = useState(false);
  const [modalSuppression, setModalSuppression] = useState(false);

  // --- Déterminer les droits ---
  const estAttestant = attestation.attestant_id === utilisateurId;
  const estAtteste = attestation.atteste_id === utilisateurId;
  const estEnAttente = attestation.statut === "EN_ATTENTE";
  const estModifiable = estAttestant && estEnAttente;

  // --- Actions ---
  async function gererApprobation() {
    setActionEnCours("approuver");
    setErreur(null);
    try {
      const resultat = await approuverAttestation(attestation.id);
      notifier(
        `✅ Attestation approuvée ! ${resultat.message}`,
        "succes",
      );
      if (onRafraichir) onRafraichir();
      else router.refresh();
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Erreur lors de l'approbation.",
      );
    } finally {
      setActionEnCours(null);
    }
  }

  async function gererRefus() {
    if (!motifRefus.trim()) return;
    setActionEnCours("refuser");
    setErreur(null);
    try {
      const resultat = await refuserAttestation(
        attestation.id,
        motifRefus.trim(),
      );
      notifier(resultat.message, "info");
      if (onRafraichir) onRafraichir();
      else router.refresh();
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Erreur lors du refus.",
      );
    } finally {
      setActionEnCours(null);
    }
  }

  async function gererSuppression() {
    setActionEnCours("supprimer");
    setErreur(null);
    try {
      await supprimerAttestation(attestation.id);
      notifier("🗑️ Attestation supprimée avec succès.", "succes");
      router.push("/attestations-communautaires");
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Erreur lors de la suppression.",
      );
    } finally {
      setActionEnCours(null);
      setModalSuppression(false);
    }
  }

  // --- Formatage des dates ---
  function formaterDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70">
        <Link href="/attestations-communautaires" className="hover:text-ocre transition-colors">
          Attestations
        </Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold truncate max-w-[200px]">
          {attestation.titre}
        </span>
      </nav>

      {/* Erreur */}
      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      {/* En-tête avec statut */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1>{attestation.titre}</h1>
            <StatutAttestation
              statut={attestation.statut as TypeStatut}
              taille="moyen"
            />
          </div>
          <p className="text-ardoise-clair">
            {ETIQUETTES_TYPES[attestation.type_attestation]} · +
            {attestation.poids_score} point{attestation.poids_score > 1 ? "s" : ""}{" "}
            de confiance
          </p>
        </div>

        <Link
          href="/attestations-communautaires"
          className="px-4 py-2 text-sm text-lagune border border-lagune rounded-lg
                     hover:bg-lagune hover:text-white transition-colors"
        >
          ← Retour
        </Link>
      </div>

      {/* Informations sur les personnes */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Attestant */}
        <Carte variante="pointilles" titre="✍️ Attestant">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-ardoise">
              {attestation.attestant_prenom} {attestation.attestant_nom}
            </p>
            <p className="text-sm text-ardoise-clair font-mono">
              {attestation.attestant_digiid}
            </p>
            {estAttestant && (
              <Badge variante="info" taille="petit">C&apos;est moi</Badge>
            )}
          </div>
        </Carte>

        {/* Attesté */}
        <Carte variante="pointilles" titre="🎯 Personne attestée">
          <div className="space-y-2">
            <p className="text-lg font-semibold text-ardoise">
              {attestation.atteste_prenom} {attestation.atteste_nom}
            </p>
            <p className="text-sm text-ardoise-clair font-mono">
              {attestation.atteste_digiid}
            </p>
            {estAtteste && (
              <Badge variante="info" taille="petit">C&apos;est moi</Badge>
            )}
          </div>
        </Carte>
      </div>

      {/* Description */}
      <Carte titre="📝 Description">
        {attestation.description ? (
          <p className="text-ardoise whitespace-pre-wrap">{attestation.description}</p>
        ) : (
          <p className="text-ardoise-clair italic">Aucune description fournie.</p>
        )}
      </Carte>

      {/* Forces et qualités */}
      {attestation.forces && (
        <Carte titre="⭐ Forces et qualités">
          <p className="text-ardoise whitespace-pre-wrap">{attestation.forces}</p>
        </Carte>
      )}

      {/* Métadonnées */}
      <Carte titre="ℹ️ Détails et métadonnées">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <MetaDonnee
            libelle="Type"
            valeur={ETIQUETTES_TYPES[attestation.type_attestation]}
          />
          <MetaDonnee
            libelle="Nature du lien"
            valeur={
              attestation.lien_nature
                ? (ETIQUETTES_LIENS[attestation.lien_nature as keyof typeof ETIQUETTES_LIENS]
                  || attestation.lien_nature)
                : "—"
            }
          />
          <MetaDonnee
            libelle="Connu depuis"
            valeur={attestation.lien_connu_depuis || "—"}
          />
          <MetaDonnee
            libelle="Statut"
            valeur={ETIQUETTES_STATUTS[attestation.statut]}
          />
          <MetaDonnee
            libelle="Poids (score)"
            valeur={`+${attestation.poids_score} pts`}
          />
          <MetaDonnee
            libelle="Visibilité publique"
            valeur={attestation.est_visible_public ? "Oui" : "Non"}
          />
          <MetaDonnee
            libelle="Soumis le"
            valeur={formaterDate(attestation.date_soumission)}
          />
          <MetaDonnee
            libelle="Décision le"
            valeur={formaterDate(attestation.date_decision)}
          />
          <MetaDonnee
            libelle="Expire le"
            valeur={formaterDate(attestation.date_expiration)}
          />
        </div>

        {/* Motif de refus */}
        {attestation.motif_refus && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">
              Motif de refus
            </p>
            <p className="text-sm text-red-600">{attestation.motif_refus}</p>
          </div>
        )}
      </Carte>

      {/* Actions possibles */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Pour l'attesté : approuver/refuser si en attente */}
        {estAtteste && estEnAttente && (
          <>
            <Bouton
              variante="succes"
              onClick={gererApprobation}
              chargement={actionEnCours === "approuver"}
            >
              ✅ Approuver l'attestation
            </Bouton>
            <Bouton
              variante="danger"
              onClick={() => setAfficherFormulaireRefus(!afficherFormulaireRefus)}
            >
              ❌ Refuser
            </Bouton>
          </>
        )}

        {/* Pour l'attestant : modifier/supprimer */}
        {estModifiable && (
          <>
            <Link href={`/attestations-communautaires/attestation/${attestation.id}`}>
              <Bouton variante="secondaire">✏️ Modifier</Bouton>
            </Link>
            <Bouton
              variante="danger"
              onClick={() => setModalSuppression(true)}
            >
              🗑️ Supprimer
            </Bouton>
          </>
        )}
      </div>

      {/* Formulaire de refus */}
      {afficherFormulaireRefus && (
        <Carte variante="danger" titre="Motif de refus">
          <div className="space-y-3">
            <p className="text-sm text-ardoise-clair">
              Explique pourquoi tu refuses cette attestation. Ce motif sera
              visible par l&apos;attestant.
            </p>
            <textarea
              value={motifRefus}
              onChange={(e) => setMotifRefus(e.target.value)}
              placeholder="Je ne connais pas suffisamment cette personne..."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 border border-red-200 rounded-lg text-sm
                         focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none
                         bg-white transition-colors resize-y"
            />
            <div className="flex gap-2">
              <Bouton
                variante="danger"
                onClick={gererRefus}
                disabled={!motifRefus.trim()}
                chargement={actionEnCours === "refuser"}
              >
                Confirmer le refus
              </Bouton>
              <Bouton
                variante="secondaire"
                onClick={() => {
                  setAfficherFormulaireRefus(false);
                  setMotifRefus("");
                }}
              >
                Annuler
              </Bouton>
            </div>
          </div>
        </Carte>
      )}

      {/* Modal de confirmation de suppression */}
      {modalSuppression && (
        <ModalConfirmation
          ouvert
          titre="Supprimer l'attestation ?"
          messageAlerte="Cette action est irréversible. L'attestation sera définitivement supprimée."
          surConfirmation={gererSuppression}
          surAnnulation={() => setModalSuppression(false)}
          chargement={actionEnCours === "supprimer"}
          varianteAlerte="erreur"
        />
      )}
    </div>
  );
}

// ============================================================================
// Sous-composants
// ============================================================================

/** Métadonnée simple (libellé + valeur) */
function MetaDonnee({
  libelle,
  valeur,
}: {
  libelle: string;
  valeur: string;
}) {
  return (
    <div>
      <p className="text-xs text-ardoise-clair/60 uppercase tracking-wide mb-0.5">
        {libelle}
      </p>
      <p className="text-ardoise font-medium">{valeur}</p>
    </div>
  );
}
