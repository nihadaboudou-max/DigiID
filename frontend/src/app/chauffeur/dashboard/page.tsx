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
import { logistiqueAPI, type Voyage } from "@/services/logistique_api";
import {
  LIBELLES_STATUT_VOYAGE,
  VARIANTES_STATUT_VOYAGE,
} from "@/types/logistique";

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
