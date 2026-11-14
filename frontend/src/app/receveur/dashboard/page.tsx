"use client";
/**
 * Tableau de bord du guichet logistique (receveur / gérant de gare) — S3.
 *
 * Aperçu des colis de la gare : compteurs par statut et derniers
 * enregistrements, avec accès direct aux actions du quotidien.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import {
  IconeColis, IconeIdentite, IconeScan, IconeTicket,
} from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ColisDuJour } from "@/composants/logistique/ColisDuJour";
import { DepartsDesChauffeurs } from "@/composants/logistique/DepartsDesChauffeurs";
import { ROLES_GUICHET } from "@/composants/logistique/roles";
import { PortefeuilleCarte } from "@/composants/paiement/PortefeuilleCarte";
import { useAuthentification } from "@/contextes/authentification";
import { useLangue } from "@/i18n/useLangue";
import { ErreurAPI } from "@/services/client_api";
import { gareDeLActeur, type Gare } from "@/services/logistique_api";

export default function PageTableauDeBordReceveur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}
function Contenu() {
  const { utilisateur } = useAuthentification();
  const { t, jouer } = useLangue();
  const [gare, setGare] = useState<Gare | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      setErreur(null);
      try {
        const gareCourante = utilisateur?.id
          ? await gareDeLActeur(utilisateur.id)
          : null;
        if (annule) return;
        setGare(gareCourante);
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger la gare de rattachement.",
          );
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, [utilisateur?.id]);

  return (
    <div className="space-y-6 apparition">
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">{t("receveur.titre")}</h1>
        <p className="text-sm text-ardoise-clair">
          {gare
            ? t("receveur.gare", { gare: `${gare.nom} (${gare.ville})` })
            : t("receveur.sans_gare")}
        </p>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionRapide
          href="/receveur/colis/nouveau"
          icone={<IconeColis className="w-6 h-6" />}
          titre={t("receveur.action.enregistrer")}
          description={t("receveur.action.enregistrer_desc")}
          onClick={() => jouer("btn.enregistrer_colis")}
        />
        {/* S7 — suivi familial : enfants voyageant seuls (SMS au départ/arrivée) */}
        <ActionRapide
          href="/receveur/suivi-familial"
          icone={<IconeIdentite className="w-6 h-6" />}
          titre="Suivi familial"
          description="Enfants voyageant seuls : SMS au parent au départ et à l'arrivée."
        />
        <ActionRapide
          href="/receveur/scan"
          icone={<IconeScan className="w-6 h-6" />}
          titre={t("receveur.action.scanner")}
          description={t("receveur.action.scanner_desc")}
          onClick={() => jouer("btn.valider_scan")}
        />
        <ActionRapide
          href="/receveur/tickets"
          icone={<IconeTicket className="w-6 h-6" />}
          titre={t("receveur.action.tickets")}
          description={t("receveur.action.tickets_desc")}
        />
      </div>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      <PortefeuilleCarte
        compact
        limiteMouvements={0}
        cheminCagnotte="/receveur/cagnotte"
      />

      <DepartsDesChauffeurs gareId={gare?.id} prochainSeulement />

      <ColisDuJour gareId={gare?.id} baseSuivi="/receveur/tickets" />

      <div className="text-right">
        <Link
          href="/receveur/analyses"
          className="text-sm font-semibold text-lagune hover:underline"
        >
          Voir les analyses et recommandations →
        </Link>
      </div>
    </div>
  );
}

/** Carte d'action rapide (raccourci du quotidien). */
function ActionRapide({
  href,
  icone,
  titre,
  description,
  onClick,
}: {
  href: string;
  icone: React.ReactNode;
  titre: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="carte hover:border-lagune/40 hover:shadow-md transition-all duration-200 group"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-lagune/10 text-lagune flex items-center justify-center flex-shrink-0 group-hover:bg-lagune group-hover:text-white transition-colors">
          {icone}
        </div>
        <div>
          <p className="font-semibold text-ardoise">{titre}</p>
          <p className="text-xs text-ardoise-clair mt-0.5">{description}</p>
        </div>
      </div>
    </Link>
  );
}
