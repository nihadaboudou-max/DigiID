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
  onRafraichir: () => void;
};

const COULEURS_STATUT: Record<string, string> = {
  en_attente: "text-ocre",
  approuve: "text-green-700",
  rejete: "text-red-600", // ✅ CORRIGÉ : "text-rouge" n'existe pas par défaut dans Tailwind
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
      <p className="text-sm text-ardoise-clair italic text-center py-4">
        Chargement de l&apos;historique...
      </p>
    );
  }

  async function confirmerSuppression() {
    if (!suppressionId) return;
    setActionEnCours(suppressionId);
    setErreur(null);
    try {
      await supprimerPhoto(suppressionId);
      setSuppressionId(null);
      onRafraichir();
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la suppression.";
      setErreur(msg);
    } finally {
      setActionEnCours(null);
    }
  }

  async function gererRestauration(id: string) {
    setActionEnCours(id);
    setErreur(null);
    try {
      await restaurerPhoto(id);
      onRafraichir();
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la restauration.";
      setErreur(msg);
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
      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {/* Lignes actives */}
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
          <summary className="cursor-pointer text-sm text-ardoise-clair hover:text-ardoise font-medium list-none">
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

      <p className="text-xs text-ardoise-clair/60 text-right">
        {total} vérification{total > 1 ? "s" : ""} au total
      </p>

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

function StatutBadge({ statut }: { statut: string }) {
  const couleur = COULEURS_STATUT[statut] || "text-ardoise";
  // ✅ Sécurité : s'assure que la classe de couleur existe avant de la transformer en bg-
  const bgCouleur = couleur.includes("text-") ? couleur.replace("text-", "bg-") : "bg-ardoise";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${bgCouleur}`}
      title={LABELS_STATUT[statut] || statut}
    />
  );
}