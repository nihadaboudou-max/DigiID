/**
 * TableauBordAttestations — Vue d'ensemble des attestations communautaires.
 * 
 * Affiche :
 *   - Cartes de statistiques (reçues, envoyées, approuvées, en attente)
 *   - Score total de confiance issu des attestations
 *   - Nombre d'attestants uniques
 *   - Alertes pour les actions en attente
 *   - Liens rapides vers les sous-pages
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import {
  obtenirStatistiquesAttestations,
  type StatistiquesAttestations,
} from "@/services/attestations_communautaires";
import { ErreurAPI } from "@/services/client_api";

/**
 * Carte de statistique individuelle avec icône et valeur.
 */
function CarteStat({
  /** Étiquette de la statistique */
  libelle,
  /** Valeur numérique */
  valeur,
  /** Couleur d'accentuation */
  couleur = "text-lagune",
  /** Icône SVG (optionnelle) */
  icone,
}: {
  libelle: string;
  valeur: number | string;
  couleur?: string;
  icone?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-ardoise-clair/10 p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
      {icone && (
        <div className="w-10 h-10 rounded-lg bg-sable flex items-center justify-center flex-shrink-0">
          {icone}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-ardoise-clair/60 uppercase tracking-wide font-medium">
          {libelle}
        </p>
        <p className={couleur + " text-2xl font-bold mt-0.5"}>
          {valeur}
        </p>
      </div>
    </div>
  );
}

/**
 * Composant principal du tableau de bord.
 */
export function TableauBordAttestations() {
  // --- État ---
  const [stats, setStats] = useState<StatistiquesAttestations | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // --- Chargement des données ---
  useEffect(() => {
    chargerDonnees();
  }, []);

  async function chargerDonnees() {
    setChargement(true);
    setErreur(null);
    try {
      const donnees = await obtenirStatistiquesAttestations();
      setStats(donnees);
    } catch (e) {
      const message = e instanceof ErreurAPI
        ? e.message_utilisateur
        : "Impossible de charger les statistiques.";
      setErreur(message);
    } finally {
      setChargement(false);
    }
  }

  // --- États de chargement et d'erreur ---
  if (chargement) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-sable rounded-lg w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-sable rounded-xl" />
          ))}
        </div>
        <div className="h-48 bg-sable rounded-xl" />
      </div>
    );
  }

  if (erreur) {
    return (
      <Alerte variante="erreur" titre="Erreur de chargement">
        {erreur}
        <div className="mt-3">
          <Bouton variante="secondaire" onClick={chargerDonnees}>
            Réessayer
          </Bouton>
        </div>
      </Alerte>
    );
  }

  if (!stats) return null;

  // --- Déterminer s'il y a des actions en attente ---
  const aDesAttestationsEnAttente = stats.en_attente_recues > 0;

  return (
    <div className="space-y-6 apparition">
      {/* En-tête avec titre et lien de création */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ardoise">
            Mes attestations communautaires
          </h2>
          <p className="text-sm text-ardoise-clair mt-1">
            Reçois et échange des attestations de confiance avec ta communauté.
          </p>
        </div>
        <Link href="/attestations-communautaires/nouvelle">
          <Bouton variante="primaire">
            + Nouvelle attestation
          </Bouton>
        </Link>
      </div>

      {/* Alerte si des attestations sont en attente */}
      {aDesAttestationsEnAttente && (
        <Alerte
          variante="avertissement"
          titre="🟡 Attestations en attente"
        >
          Tu as{" "}
          <Link
            href="/attestations-communautaires/en-attente"
            className="font-semibold underline"
          >
            {stats.en_attente_recues} attestation{stats.en_attente_recues > 1 ? "s" : ""} reçue{stats.en_attente_recues > 1 ? "s" : ""}
          </Link>{" "}
          en attente de ta décision. Prends le temps de les examiner.
        </Alerte>
      )}

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Attestations reçues */}
        <CarteStat
          libelle="Reçues"
          valeur={stats.total_recues}
          couleur="text-lagune"
          icone={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-lagune">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
        />

        {/* Attestations envoyées */}
        <CarteStat
          libelle="Envoyées"
          valeur={stats.total_envoyees}
          couleur="text-ocre"
          icone={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-ocre">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          }
        />

        {/* Approuvées */}
        <CarteStat
          libelle="Approuvées"
          valeur={stats.approuvees_recues}
          couleur="text-green-600"
          icone={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-green-600">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          }
        />

        {/* En attente */}
        <CarteStat
          libelle="En attente"
          valeur={stats.en_attente_recues}
          couleur={stats.en_attente_recues > 0 ? "text-ocre" : "text-ardoise-clair"}
          icone={
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-ocre">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
      </div>

      {/* Statistiques détaillées */}
      <Carte titre="📊 Détail des statistiques">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
          {/* Colonne 1 : Réception */}
          <div className="space-y-3">
            <h4 className="font-semibold text-ardoise uppercase text-xs tracking-wide">
              Réception
            </h4>
            <div className="space-y-2">
              <LigneStat
                libelle="Total reçues"
                valeur={String(stats.total_recues)}
              />
              <LigneStat
                libelle="Approuvées"
                valeur={String(stats.approuvees_recues)}
                couleur="text-green-600"
              />
              <LigneStat
                libelle="Refusées"
                valeur={String(stats.refusees_recues)}
                couleur="text-red-600"
              />
              <LigneStat
                libelle="Expirées"
                valeur={String(stats.expirees_recues)}
                couleur="text-gray-400"
              />
            </div>
          </div>

          {/* Colonne 2 : Envoi */}
          <div className="space-y-3">
            <h4 className="font-semibold text-ardoise uppercase text-xs tracking-wide">
              Envoi
            </h4>
            <div className="space-y-2">
              <LigneStat
                libelle="Total envoyées"
                valeur={String(stats.total_envoyees)}
              />
              <LigneStat
                libelle="Approuvées"
                valeur={String(stats.approuvees_envoyees)}
                couleur="text-green-600"
              />
              <LigneStat
                libelle="En attente"
                valeur={String(stats.en_attente_envoyees)}
                couleur="text-ocre"
              />
            </div>
          </div>

          {/* Colonne 3 : Impact */}
          <div className="space-y-3">
            <h4 className="font-semibold text-ardoise uppercase text-xs tracking-wide">
              Impact &amp; Réseau
            </h4>
            <div className="space-y-2">
              <LigneStat
                libelle="Score de confiance"
                valeur={`+${stats.score_total_attestations}`}
                couleur="text-lagune font-bold"
              />
              <LigneStat
                libelle="Attestants uniques"
                valeur={String(stats.attestants_uniques)}
              />
              <LigneStat
                libelle="Taux d'approbation"
                valeur={
                  stats.total_recues > 0
                    ? `${Math.round((stats.approuvees_recues / stats.total_recues) * 100)}%`
                    : "—"
                }
              />
            </div>
          </div>
        </div>
      </Carte>

      {/* Liens rapides vers les sous-pages */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <LienRapide
          href="/attestations-communautaires/recues"
          libelle="Attestations reçues"
          description="Consulte les attestations que tu as reçues"
          icone="📥"
        />
        <LienRapide
          href="/attestations-communautaires/envoyees"
          libelle="Attestations envoyées"
          description="Gère les attestations que tu as écrites"
          icone="📤"
        />
        <LienRapide
          href="/attestations-communautaires/en-attente"
          libelle="En attente"
          description={
            stats.en_attente_recues > 0
              ? `${stats.en_attente_recues} attestation${stats.en_attente_recues > 1 ? "s" : ""} à traiter`
              : "Aucune en attente"
          }
          icone="⏳"
        />
        <LienRapide
          href="/attestations-communautaires/nouvelle"
          libelle="Nouvelle attestation"
          description="Atteste un membre de la communauté"
          icone="✍️"
        />
      </div>
    </div>
  );
}

/**
 * Ligne de statistique simple (libellé + valeur).
 */
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

/**
 * Lien rapide vers une sous-page sous forme de carte cliquable.
 */
function LienRapide({
  href,
  libelle,
  description,
  icone,
}: {
  href: string;
  libelle: string;
  description: string;
  icone: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl border border-ardoise-clair/10 p-4 hover:border-lagune/30 hover:shadow-sm transition-all duration-200 group cursor-pointer">
        <p className="text-2xl mb-2">{icone}</p>
        <p className="font-semibold text-ardoise group-hover:text-lagune transition-colors">
          {libelle}
        </p>
        <p className="text-xs text-ardoise-clair/60 mt-1">
          {description}
        </p>
      </div>
    </Link>
  );
}
