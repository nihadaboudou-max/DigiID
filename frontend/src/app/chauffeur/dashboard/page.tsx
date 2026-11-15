"use client";
/**
 * Tableau de bord du chauffeur (S4).
 *
 * Liste les voyages affectés au chauffeur par pages de cinq, avec le nombre de
 * colis à bord, et donne accès d'un clic aux colis d'un voyage et au scan.
 */
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import type { BadgeVariante } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import {
  IconeIdentite,
  IconeScan,
  IconeTicket,
  IconeCamion,
} from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ColisDuJour } from "@/composants/logistique/ColisDuJour";
import { formaterDateHeure } from "@/composants/logistique/format";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { PortefeuilleCarte } from "@/composants/paiement/PortefeuilleCarte";
import { useLangue } from "@/i18n/useLangue";
import { ErreurAPI } from "@/services/client_api";
import {
  logistiqueAPI,
  type ScoreConfianceChauffeur,
  type Voyage,
} from "@/services/logistique_api";
import {
  LIBELLES_STATUT_VOYAGE,
  VARIANTES_STATUT_VOYAGE,
} from "@/types/logistique";

const STYLE_NIVEAU_CONFIANCE: Record<
  "vert" | "orange" | "rouge",
  { badge: BadgeVariante; panneau: string; libelle: string }
> = {
  vert: {
    badge: "succes",
    panneau: "border-green-300 bg-green-50 text-green-900",
    libelle: "Bon niveau",
  },
  orange: {
    badge: "ocre",
    panneau: "border-amber-300 bg-amber-50 text-amber-900",
    libelle: "À améliorer",
  },
  rouge: {
    badge: "terre",
    panneau: "border-red-300 bg-red-50 text-red-900",
    libelle: "À suivre",
  },
};

export default function PageTableauDeBordChauffeur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}
function Contenu() {
  const { t, jouer } = useLangue();
  const [prochainVoyage, setProchainVoyage] = useState<Voyage | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [scoreConfiance, setScoreConfiance] =
    useState<ScoreConfianceChauffeur | null>(null);
  const [chargementScore, setChargementScore] = useState(true);
  const [erreurScore, setErreurScore] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const depuis = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const reponse = await logistiqueAPI.voyages.lister({
          a_partir_de: depuis,
          statuts: ["planifie", "en_cours"],
          page: 1,
          par_page: 1,
        });
        if (!annule) setProchainVoyage(reponse.elements[0] ?? null);
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger le prochain départ.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  useEffect(() => {
    let annule = false;
    logistiqueAPI.chauffeurs
      .monScoreConfiance()
      .then((score) => {
        if (!annule) setScoreConfiance(score);
      })
      .catch((e) => {
        if (!annule) {
          setErreurScore(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger votre score de confiance.",
          );
        }
      })
      .finally(() => {
        if (!annule) setChargementScore(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  return (
    <div className="space-y-6 apparition">
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">{t("chauffeur.titre")}</h1>
        <p className="text-sm text-ardoise-clair">
          {t("chauffeur.sous_titre")}
        </p>
      </div>

      {/* Actions rapides : les gestes du terrain, sans passer par le guichet */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LienRapideChauffeur
          href="/chauffeur/voyages"
          titre="Planifier un voyage"
          description="Choisissez la ligne, le car et l'heure du départ."
          icone={<IconeCamion className="w-6 h-6" />}
        />
        <LienRapideChauffeur
          href="/chauffeur/scan"
          titre={t("chauffeur.scan_carte")}
          description={t("chauffeur.scan_carte_desc")}
          icone={<IconeScan className="w-6 h-6" />}
          onClick={() => jouer("btn.scanner_un_colis")}
        />
        <LienRapideChauffeur
          href="/chauffeur/passagers/nouveau"
          titre="Enregistrer un passager"
          description="Adulte ou enfant : la famille est prévenue par SMS."
          icone={<IconeIdentite className="w-6 h-6" />}
        />
        <LienRapideChauffeur
          href="/chauffeur/colis"
          titre="Mes colis"
          description="Ce que vous transportez et ce qu'il reste à remettre."
          icone={<IconeTicket className="w-6 h-6" />}
        />
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      <PortefeuilleCarte
        compact
        limiteMouvements={0}
        cheminCagnotte="/chauffeur/cagnotte"
      />

      <Carte
        titre="Mon score de confiance"
        description="Calculé chaque nuit à partir de vos activités des 30 derniers jours."
      >
        {chargementScore ? (
          <p className="py-4 text-center text-sm italic text-ardoise-clair">
            Chargement de votre score…
          </p>
        ) : erreurScore ? (
          <Alerte variante="erreur" titre="Score indisponible">
            {erreurScore}
          </Alerte>
        ) : !scoreConfiance?.disponible ||
          scoreConfiance.score_total === null ||
          scoreConfiance.niveau === null ? (
          <p className="py-4 text-sm text-ardoise-clair">
            Le premier score sera disponible après le prochain calcul quotidien.
          </p>
        ) : (
          <ScoreConfiance score={scoreConfiance} />
        )}
      </Carte>

      <Carte
        titre="Prochain départ"
        description="Votre prochain voyage planifié ou en cours."
      >
        {chargement ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Chargement du prochain départ…
          </p>
        ) : !prochainVoyage ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Aucun départ à venir pour le moment.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-ardoise">
                  {prochainVoyage.ligne_libelle ?? "Trajet à confirmer"}
                </p>
                <Badge
                  variante={
                    VARIANTES_STATUT_VOYAGE[
                      prochainVoyage.statut as keyof typeof VARIANTES_STATUT_VOYAGE
                    ] ?? "neutre"
                  }
                >
                  {LIBELLES_STATUT_VOYAGE[
                    prochainVoyage.statut as keyof typeof LIBELLES_STATUT_VOYAGE
                  ] ?? prochainVoyage.statut}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-ardoise-clair">
                {formaterDateHeure(prochainVoyage.date_depart)}
                {prochainVoyage.vehicule_immatriculation
                  ? ` · Car ${prochainVoyage.vehicule_immatriculation}`
                  : ""}
              </p>
            </div>
            <Link href={`/chauffeur/voyages/${prochainVoyage.id}`}>
              <Bouton variante="secondaire" taille="petit">
                Ouvrir l&apos;étape courante
              </Bouton>
            </Link>
          </div>
        )}
      </Carte>

      <ColisDuJour baseSuivi="/chauffeur/colis" baseScan="/chauffeur/scan" />

      <div className="text-right">
        <Link
          href="/chauffeur/analyses"
          className="text-sm font-semibold text-lagune hover:underline"
        >
          Voir les analyses et recommandations →
        </Link>
      </div>
    </div>
  );
}

function ScoreConfiance({ score }: { score: ScoreConfianceChauffeur }) {
  if (!score.niveau || score.score_total === null) return null;
  const style = STYLE_NIVEAU_CONFIANCE[score.niveau];

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${style.panneau}`}
      >
        <div>
          <p className="text-sm font-semibold">Votre score</p>
          <p className="text-4xl font-bold">{score.score_total}/100</p>
        </div>
        <Badge variante={style.badge} taille="moyen">
          {style.libelle}
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ComposanteConfiance
          libelle="Régularité"
          score={score.score_regularite}
          mesuree={score.regularite_mesuree}
          detail={
            score.regularite_mesuree
              ? `${score.nombre_depart_a_lheure} départ(s) à l’heure sur ${score.nombre_depart_analyse}`
              : undefined
          }
        />
        <ComposanteConfiance
          libelle="Volume livré"
          score={score.score_volume}
          mesuree={score.volume_mesure}
          detail={
            score.volume_mesure
              ? `${score.nombre_colis_livres} colis livrés`
              : undefined
          }
        />
        <ComposanteConfiance
          libelle="Litiges"
          score={score.score_litiges}
          mesuree={score.litiges_mesures}
        />
        <ComposanteConfiance
          libelle="Avis"
          score={score.score_avis}
          mesuree={score.avis_mesures}
        />
      </div>
      {score.est_provisoire && (
        <p className="text-xs text-ardoise-clair">
          Score provisoire : litiges et avis ne sont pas encore mesurés; leurs
          composantes utilisent une valeur neutre de 50/100.
        </p>
      )}
    </div>
  );
}

function ComposanteConfiance({
  libelle,
  score,
  mesuree,
  detail,
}: {
  libelle: string;
  score: number | null;
  mesuree: boolean;
  detail?: string;
}) {
  return (
    <div className="rounded-lg bg-sable p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ardoise">{libelle}</p>
        <span className="font-bold text-ardoise">{score ?? "—"}/100</span>
      </div>
      <p className="mt-1 text-xs text-ardoise-clair">
        {detail ?? (mesuree ? "Mesuré" : "Non mesuré — valeur neutre")}
      </p>
    </div>
  );
}

/** Raccourci du tableau de bord chauffeur (icône + libellé + explication). */
function LienRapideChauffeur({
  href,
  titre,
  description,
  icone,
  onClick,
}: {
  href: string;
  titre: string;
  description: string;
  icone: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="carte group block transition-all duration-200 hover:border-ocre/40 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-ocre/15 text-ocre-fonce transition-colors group-hover:bg-ocre group-hover:text-white">
          {icone}
        </div>
        <div>
          <p className="font-semibold text-ardoise">{titre}</p>
          <p className="mt-0.5 text-xs text-ardoise-clair">{description}</p>
        </div>
      </div>
    </Link>
  );
}
