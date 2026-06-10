"use client";

/**
 * Page Admin — Attestations Communautaires.
 * 
 * Permet aux administrateurs de :
 *   - Voir les statistiques globales du système d'attestations
 *   - Lister TOUTES les attestations avec filtres
 *   - Supprimer des attestations inappropriées (modération)
 * 
 * Réservé aux rôles : administrateur, super_administrateur
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { ModalConfirmation } from "@/composants/commun/ModalConfirmation";
import { useNotifications } from "@/contextes/notifications";
import {
  listerToutesAttestations,
  obtenirStatistiquesGlobales,
  supprimerAttestationAdmin,
  type StatistiquesGlobalesAttestations,
  type AttestationResume,
} from "@/services/admin_attestations";
import { ErreurAPI } from "@/services/client_api";

// ============================================================================
// Constantes
// ============================================================================

const ETIQUETTES_STATUTS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  APPROUVEE: "Approuvée",
  REFUSEE: "Refusée",
  EXPIREE: "Expirée",
};

const COULEURS_STATUTS: Record<string, string> = {
  EN_ATTENTE: "bg-ocre/10 text-ocre-fonce",
  APPROUVEE: "bg-green-100 text-green-700",
  REFUSEE: "bg-red-100 text-red-700",
  EXPIREE: "bg-gray-100 text-gray-500",
};

const STATUTS_FILTRES = [
  { valeur: "", libelle: "Tous" },
  { valeur: "EN_ATTENTE", libelle: "En attente" },
  { valeur: "APPROUVEE", libelle: "Approuvées" },
  { valeur: "REFUSEE", libelle: "Refusées" },
  { valeur: "EXPIREE", libelle: "Expirées" },
];

// ============================================================================
// Composant principal
// ============================================================================

export default function PageAdminAttestations() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

// ============================================================================
// Contenu
// ============================================================================

function Contenu() {
  const { notifier } = useNotifications();

  // --- État des statistiques ---
  const [stats, setStats] = useState<StatistiquesGlobalesAttestations | null>(null);
  const [chargementStats, setChargementStats] = useState(true);
  const [erreurStats, setErreurStats] = useState<string | null>(null);

  // --- État de la liste ---
  const [attestations, setAttestations] = useState<AttestationResume[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pagesTotales, setPagesTotales] = useState(1);
  const [chargementListe, setChargementListe] = useState(true);
  const [erreurListe, setErreurListe] = useState<string | null>(null);

  // --- Filtres ---
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreType, setFiltreType] = useState("");

  // --- Modale de suppression ---
  const [attestationASupprimer, setAttestationASupprimer] = useState<string | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const LIMITE = 20;

  // --- Chargement des données ---
  const chargerDonnees = useCallback(async () => {
    setChargementStats(true);
    setChargementListe(true);
    setErreurStats(null);
    setErreurListe(null);

    try {
      const [statistiques, liste] = await Promise.all([
        obtenirStatistiquesGlobales(),
        listerToutesAttestations({
          statut: filtreStatut || undefined,
          type_attestation: filtreType || undefined,
          page,
          limite: LIMITE,
        }),
      ]);
      setStats(statistiques);
      setAttestations(liste.attestations);
      setTotal(liste.total);
      setPagesTotales(liste.pages_totales);
    } catch (e) {
      const message = e instanceof ErreurAPI
        ? e.message_utilisateur
        : "Erreur de chargement des données.";
      setErreurStats(message);
      setErreurListe(message);
    } finally {
      setChargementStats(false);
      setChargementListe(false);
    }
  }, [filtreStatut, filtreType, page]);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  // --- Suppression ---
  async function gererSuppression() {
    if (!attestationASupprimer) return;
    setSuppressionEnCours(true);
    try {
      await supprimerAttestationAdmin(attestationASupprimer);
      notifier("🗑️ Attestation supprimée avec succès.", "succes");
      setAttestationASupprimer(null);
      chargerDonnees();
    } catch (e) {
      notifier(
        e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la suppression.",
        "erreur",
      );
    } finally {
      setSuppressionEnCours(false);
    }
  }

  // --- Changement de filtre ---
  function changerFiltreStatut(valeur: string) {
    setFiltreStatut(valeur);
    setPage(1);
  }

  function changerFiltreType(valeur: string) {
    setFiltreType(valeur);
    setPage(1);
  }

  // --- Formatage date ---
  function formaterDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  // --- Types d'attestation disponibles ---
  const typesDisponibles = stats?.repartition_types.map((t) => t.type) || [];

  return (
    <div className="space-y-8 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/admin/tableau-de-bord" className="hover:text-lagune transition-colors">
          Tableau de bord
        </Link>
        <span className="text-ardoise-clair/30">/</span>
        <span className="text-ardoise font-semibold">Attestations</span>
      </nav>

      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-terre font-semibold text-sm uppercase tracking-wider">Administration</p>
          <h1 className="mt-1">Attestations communautaires</h1>
          <p className="text-ardoise-clair mt-2 max-w-2xl">
            Modération du réseau de confiance. Visualise et gère l&apos;ensemble
            des attestations du système.
          </p>
        </div>
        <Link href="/admin/tableau-de-bord">
          <Bouton variante="ghost" taille="petit">← Retour</Bouton>
        </Link>
      </div>

      {/* KPIs — Statistiques globales */}
      {chargementStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-sable rounded-xl" />
          ))}
        </div>
      ) : erreurStats ? (
        <Alerte variante="erreur" titre="Erreur de chargement">
          {erreurStats}
        </Alerte>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CarteKPI
            libelle="Total attestations"
            valeur={stats.total}
            icone="📜"
            couleur="text-lagune"
          />
          <CarteKPI
            libelle="Approuvées"
            valeur={stats.approuvees}
            icone="✅"
            couleur="text-green-600"
          />
          <CarteKPI
            libelle="En attente"
            valeur={stats.en_attente}
            icone="⏳"
            couleur={stats.en_attente > 0 ? "text-ocre" : "text-ardoise-clair"}
          />
          <CarteKPI
            libelle="Créées aujourd'hui"
            valeur={stats.creees_aujourd_hui}
            icone="📅"
            couleur="text-lagune"
          />
        </div>
      ) : null}

      {/* Statistiques détaillées */}
      {stats && !chargementStats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <Carte titre="📊 Répartition par statut">
            <div className="space-y-2">
              <LigneStat libelle="Approuvées" valeur={String(stats.approuvees)} couleur="text-green-600" />
              <LigneStat libelle="En attente" valeur={String(stats.en_attente)} couleur="text-ocre" />
              <LigneStat libelle="Refusées" valeur={String(stats.refusees)} couleur="text-red-600" />
              <LigneStat libelle="Expirées" valeur={String(stats.expirees)} couleur="text-gray-400" />
            </div>
          </Carte>
          <Carte titre="🎯 Impact réseau">
            <div className="space-y-2">
              <LigneStat libelle="Score total système" valeur={`+${stats.score_total_systeme}`} couleur="text-lagune" />
              <LigneStat libelle="Poids moyen" valeur={String(stats.poids_moyen)} />
              <LigneStat libelle="Attestants uniques" valeur={String(stats.attestants_uniques)} />
              <LigneStat libelle="Attestés uniques" valeur={String(stats.attestes_uniques)} />
            </div>
          </Carte>
          <Carte titre="📁 Répartition par type">
            <div className="space-y-2">
              {stats.repartition_types.map((t) => (
                <LigneStat
                  key={t.type}
                  libelle={t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                  valeur={String(t.nombre)}
                />
              ))}
            </div>
          </Carte>
        </div>
      )}

      {/* Liste des attestations */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2>Liste des attestations</h2>
          <span className="text-xs text-ardoise-clair/60">
            {total} attestation{total > 1 ? "s" : ""}
          </span>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ardoise-clair/60 font-medium uppercase tracking-wide">
              Statut :
            </span>
            <div className="flex flex-wrap gap-1">
              {STATUTS_FILTRES.map((filtre) => (
                <button
                  key={filtre.valeur}
                  onClick={() => changerFiltreStatut(filtre.valeur)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all duration-200 ${
                    filtreStatut === filtre.valeur
                      ? "bg-lagune text-white border-lagune"
                      : "bg-white text-ardoise-clair border-ardoise-clair/20 hover:border-lagune/50"
                  }`}
                >
                  {filtre.libelle}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-ardoise-clair/60 font-medium uppercase tracking-wide">
              Type :
            </span>
            <select
              value={filtreType}
              onChange={(e) => changerFiltreType(e.target.value)}
              className="px-3 py-1.5 text-xs border border-ardoise-clair/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-lagune/20"
            >
              <option value="">Tous les types</option>
              {typesDisponibles.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Erreur liste */}
        {erreurListe && (
          <Alerte variante="erreur" titre="Erreur">
            {erreurListe}
          </Alerte>
        )}

        {/* Chargement */}
        {chargementListe && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-sable rounded-xl" />
            ))}
          </div>
        )}

        {/* Liste vide */}
        {!chargementListe && !erreurListe && attestations.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-ardoise-clair/20">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-ardoise-clair font-medium">
              Aucune attestation trouvée
            </p>
            <p className="text-sm text-ardoise-clair/60 mt-1">
              Essaie de modifier les filtres.
            </p>
          </div>
        )}

        {/* Tableau des attestations */}
        {!chargementListe && !erreurListe && attestations.length > 0 && (
          <div className="bg-white rounded-xl border border-ardoise-clair/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-sable border-b border-ardoise-clair/10">
                    <th className="text-left px-4 py-3 text-xs uppercase text-ardoise-clair font-bold">Titre</th>
                    <th className="text-left px-4 py-3 text-xs uppercase text-ardoise-clair font-bold">Attestant</th>
                    <th className="text-left px-4 py-3 text-xs uppercase text-ardoise-clair font-bold">Attesté</th>
                    <th className="text-center px-4 py-3 text-xs uppercase text-ardoise-clair font-bold">Type</th>
                    <th className="text-center px-4 py-3 text-xs uppercase text-ardoise-clair font-bold">Statut</th>
                    <th className="text-center px-4 py-3 text-xs uppercase text-ardoise-clair font-bold">Poids</th>
                    <th className="text-center px-4 py-3 text-xs uppercase text-ardoise-clair font-bold">Date</th>
                    <th className="text-center px-4 py-3 text-xs uppercase text-ardoise-clair font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ardoise-clair/5">
                  {attestations.map((att) => (
                    <tr key={att.id} className="hover:bg-sable/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-ardoise truncate max-w-[200px]">
                          {att.titre}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-ardoise-clair">
                        {att.attestant_nom_complet}
                      </td>
                      <td className="px-4 py-3 text-sm text-ardoise-clair">
                        {att.atteste_nom_complet}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[10px] uppercase text-ardoise-clair/40 bg-sable-clair px-1.5 py-0.5 rounded">
                          {att.type_attestation}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${COULEURS_STATUTS[att.statut] || "bg-gray-100 text-gray-600"}`}>
                          {ETIQUETTES_STATUTS[att.statut] || att.statut}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        <span className="font-mono text-ocre">+{att.poids_score}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-ardoise-clair">
                        {formaterDate(att.date_soumission)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setAttestationASupprimer(att.id)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Supprimer cette attestation"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagesTotales > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Bouton
              variante="secondaire"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Précédent
            </Bouton>
            <span className="text-sm text-ardoise-clair px-3">
              Page {page} sur {pagesTotales}
            </span>
            <Bouton
              variante="secondaire"
              disabled={page >= pagesTotales}
              onClick={() => setPage((p) => Math.min(pagesTotales, p + 1))}
            >
              Suivant →
            </Bouton>
          </div>
        )}
      </section>

      {/* Modal de confirmation de suppression */}
      {attestationASupprimer && (
        <ModalConfirmation
          ouvert
          titre="Supprimer cette attestation ?"
          messageAlerte="Cette action est irréversible et sera tracée dans le journal d'audit."
          surConfirmation={gererSuppression}
          surAnnulation={() => setAttestationASupprimer(null)}
          chargement={suppressionEnCours}
          varianteAlerte="erreur"
        />
      )}
    </div>
  );
}

// ============================================================================
// Sous-composants
// ============================================================================

/** Carte KPI pour les statistiques */
function CarteKPI({
  libelle,
  valeur,
  icone,
  couleur,
}: {
  libelle: string;
  valeur: number | string;
  icone: string;
  couleur: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-ardoise-clair/10 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs uppercase text-ardoise-clair/60 font-semibold tracking-wider">
          {libelle}
        </p>
        <span className="text-lg">{icone}</span>
      </div>
      <p className={`text-2xl md:text-3xl font-bold ${couleur}`}>{valeur}</p>
    </div>
  );
}

/** Ligne de statistique */
function LigneStat({
  libelle,
  valeur,
  couleur = "text-ardoise",
}: {
  libelle: string;
  valeur: string;
  couleur?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ardoise-clair/70">{libelle}</span>
      <span className={`font-semibold ${couleur}`}>{valeur}</span>
    </div>
  );
}
