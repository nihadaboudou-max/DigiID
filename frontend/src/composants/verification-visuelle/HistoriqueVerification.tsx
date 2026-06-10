"use client";

/**
 * HistoriqueVerification — liste les vérifications précédentes
 * avec possibilité de supprimer (corbeille) ou restaurer.
 */
import { useState } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { ModalConfirmation } from "@/composants/commun/ModalConfirmation";
import {
  type VerificationDetail,
  supprimerPhoto,
  restaurerPhoto,
} from "@/services/verification_visuelle";
import { ErreurAPI } from "@/services/client_api";

type Props = {
  historique: VerificationDetail[];
  total: number;
  chargement: boolean;
  /** Rappel pour rafraîchir la liste après action */
  onRafraichir: () => void;
};

const COULEURS_STATUT: Record<string, string> = {
  en_attente: "text-ocre",
  approuve: "text-green-700",
  rejete: "text-rouge",
};

const LABELS_STATUT: Record<string, string> = {
  en_attente: "En attente",
  approuve: "Approuvée",
  rejete: "Rejetée",
};

export default function HistoriqueVerification({
  historique,
  total,
  chargement,
  onRafraichir,
}: Props) {
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  if (chargement) {
    return (
      <p className="text-sm text-ardoise-clair italic">
        Chargement de l&apos;historique...
      </p>
    );
  }

  /** Supprimer une vérification → corbeille */
  async function confirmerSuppression() {
    if (!suppressionId) return;
    setActionEnCours(suppressionId);
    setErreur(null);
    try {
      await supprimerPhoto(suppressionId);
      setSuppressionId(null);
      onRafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la suppression.");
    } finally {
      setActionEnCours(null);
    }
  }

  /** Restaurer une vérification depuis la corbeille */
  async function gererRestauration(id: string) {
    setActionEnCours(id);
    setErreur(null);
    try {
      await restaurerPhoto(id);
      onRafraichir();
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la restauration.");
    } finally {
      setActionEnCours(null);
    }
  }

  const filtrerActif = historique.filter((v) => !v.est_supprime);
  const filtrerCorbeille = historique.filter((v) => v.est_supprime);

  if (historique.length === 0) {
    return (
      <p className="text-sm text-ardoise-clair italic text-center py-4">
        Aucune vérification pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Ligne active */}
      {filtrerActif.map((v) => (
        <LigneVerification
          key={v.id}
          verification={v}
          enCours={actionEnCours === v.id}
          onSupprimer={() => setSuppressionId(v.id)}
        />
      ))}

      {/* Section corbeille */}
      {filtrerCorbeille.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-ardoise-clair hover:text-ardoise font-medium">
            🗑️ Corbeille ({filtrerCorbeille.length})
          </summary>
          <div className="mt-3 space-y-3">
            {filtrerCorbeille.map((v) => (
              <div
                key={v.id}
                className="border border-dashed border-ardoise-clair/20 rounded-xl p-4 opacity-70 hover:opacity-100 transition-opacity"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <StatutBadge statut={v.statut} />
                    <span className="text-ardoise-clair">
                      {new Date(v.date_upload).toLocaleDateString("fr-FR")}
                    </span>
                    {v.date_suppression && (
                      <span className="text-xs text-ardoise-clair/50">
                        (suppr. {new Date(v.date_suppression).toLocaleDateString("fr-FR")})
                      </span>
                    )}
                  </div>
                  <Bouton
                    variante="ghost"
                    taille="petit"
                    chargement={actionEnCours === v.id}
                    onClick={() => gererRestauration(v.id)}
                  >
                    ↺ Restaurer
                  </Bouton>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Total */}
      <p className="text-xs text-ardoise-clair/60 text-right">
        {total} vérification{total > 1 ? "s" : ""} au total
      </p>

      {/* Modal de confirmation suppression */}
      <ModalConfirmation
        ouvert={!!suppressionId}
        titre="Supprimer cette vérification ?"
        description="Elle sera déplacée dans la corbeille. Tu pourras la restaurer plus tard."
        texteBoutonConfirmer="Supprimer"
        couleurBoutonConfirmer="terre"
        chargement={!!actionEnCours}
        surConfirmation={confirmerSuppression}
        surAnnulation={() => setSuppressionId(null)}
      />
    </div>
  );
}

// --- Sous-composant : une ligne de l'historique ---

function LigneVerification({
  verification,
  enCours,
  onSupprimer,
}: {
  verification: VerificationDetail;
  enCours: boolean;
  onSupprimer: () => void;
}) {
  return (
    <div className="border border-ardoise-clair/10 rounded-xl p-4 hover:border-ardoise-clair/30 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <StatutBadge statut={verification.statut} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ardoise truncate">
              {LABELS_STATUT[verification.statut] || verification.statut}
            </p>
            <p className="text-xs text-ardoise-clair">
              {new Date(verification.date_upload).toLocaleString("fr-FR")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-ardoise-clair font-mono">
            Liveness : {(verification.score_liveness * 100).toFixed(0)}%
          </span>
          <Bouton
            variante="ghost"
            taille="petit"
            chargement={enCours}
            onClick={onSupprimer}
            title="Déplacer dans la corbeille"
          >
            🗑️
          </Bouton>
        </div>
      </div>
    </div>
  );
}

// --- Sous-composant : badge de statut coloré ---

function StatutBadge({ statut }: { statut: string }) {
  const couleur = COULEURS_STATUT[statut] || "text-ardoise";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${couleur.replace("text-", "bg-")}`}
      title={LABELS_STATUT[statut] || statut}
    />
  );
}
