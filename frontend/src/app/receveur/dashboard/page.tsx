"use client";
/**
 * Tableau de bord du guichet logistique (receveur / gérant de gare) — S3.
 *
 * Aperçu des colis de la gare : compteurs par statut et derniers
 * enregistrements, avec accès direct aux actions du quotidien.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import {
  IconeColis, IconeIdentite, IconePortefeuille, IconeScan, IconeTicket,
} from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_GUICHET } from "@/composants/logistique/roles";
import { TableauColis } from "@/composants/logistique/TableauColis";
import { PortefeuilleCarte } from "@/composants/paiement/PortefeuilleCarte";
import { useAuthentification } from "@/contextes/authentification";
import { useLangue } from "@/i18n/useLangue";
import { ErreurAPI } from "@/services/client_api";
import { gareDeLActeur, logistiqueAPI, type Gare } from "@/services/logistique_api";
import type { Colis } from "@/types/logistique";

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
  const [colis, setColis] = useState<Colis[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const gareCourante = utilisateur?.id
          ? await gareDeLActeur(utilisateur.id)
          : null;
        if (annule) return;
        setGare(gareCourante);

        const reponse = await logistiqueAPI.colis.lister(
          gareCourante ? { gare_id: gareCourante.id, par_page: 100 } : { par_page: 100 },
        );
        if (!annule) setColis(reponse.elements);
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger les colis. Réessayez plus tard.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [utilisateur?.id]);

  const compteurs = useMemo(() => {
    return {
      total: colis.length,
      enregistre: colis.filter((c) => c.statut === "enregistre").length,
      en_transit: colis.filter((c) => c.statut === "en_transit").length,
      arrive: colis.filter((c) => c.statut === "arrive").length,
      livre: colis.filter((c) => c.statut === "livre").length,
    };
  }, [colis]);

  const recents = useMemo(() => colis.slice(0, 10), [colis]);

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
        {/* S6 — cagnotte du guichet (commissions) */}
        <ActionRapide
          href="/receveur/cagnotte"
          icone={<IconePortefeuille className="w-6 h-6" />}
          titre="Ma cagnotte"
          description="Commissions reçues sur les colis encaissés."
        />
      </div>

      {/* S6 — portefeuille : solde + derniers mouvements */}
      <PortefeuilleCarte limiteMouvements={3} />

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {/* Compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Compteur libelle={t("receveur.compteur.total")} valeur={compteurs.total} couleur="text-ardoise" />
        <Compteur libelle={t("receveur.compteur.enregistres")} valeur={compteurs.enregistre} couleur="text-blue-700" />
        <Compteur libelle={t("receveur.compteur.en_transit")} valeur={compteurs.en_transit} couleur="text-ocre-fonce" />
        <Compteur libelle={t("receveur.compteur.arrives")} valeur={compteurs.arrive} couleur="text-lagune" />
        <Compteur libelle={t("receveur.compteur.livres")} valeur={compteurs.livre} couleur="text-green-700" />
      </div>

      {/* Derniers colis */}
      <Carte
        titre={t("receveur.derniers")}
        description={gare ? `Colis de la gare ${gare.nom} ou à destination.` : undefined}
      >
        {chargement ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Chargement des colis…
          </p>
        ) : (
          <TableauColis
            colis={recents}
            messageVide="Aucun colis enregistré. Commencez par créer un ticket."
          />
        )}
        {!chargement && colis.length > recents.length && (
          <div className="mt-4">
            <Link href="/receveur/tickets">
              <Bouton variante="ghost" taille="petit">
                Voir tous les colis →
              </Bouton>
            </Link>
          </div>
        )}
      </Carte>
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

/** Compteur coloré (statistiques rapides). */
function Compteur({
  libelle,
  valeur,
  couleur,
}: {
  libelle: string;
  valeur: number;
  couleur: string;
}) {
  return (
    <div className="carte text-center py-4">
      <p className={`text-2xl font-bold ${couleur}`}>{valeur}</p>
      <p className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold mt-1">
        {libelle}
      </p>
    </div>
  );
}
