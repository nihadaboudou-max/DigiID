"use client";
/**
 * Détail d'un voyage côté chauffeur (S4).
 *
 * Affiche les informations du voyage et la liste des colis à bord, avec une
 * action « Scanner » par colis (départ / transit / arrivée).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeScan } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { formaterDate } from "@/composants/logistique/format";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { TableauColis } from "@/composants/logistique/TableauColis";
import { ErreurAPI } from "@/services/client_api";
import {
  libelleLigne,
  logistiqueAPI,
  type Ligne,
  type Voyage,
} from "@/services/logistique_api";
import {
  LIBELLES_STATUT_VOYAGE,
  VARIANTES_STATUT_VOYAGE,
  type Colis,
} from "@/types/logistique";

export default function PageDetailVoyageChauffeur() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const params = useParams();
  const voyageId = String(params?.id ?? "");

  const [voyage, setVoyage] = useState<Voyage | null>(null);
  const [ligne, setLigne] = useState<Ligne | null>(null);
  const [colis, setColis] = useState<Colis[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!voyageId) return;
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const [voyageCharge, repLignes, repColis] = await Promise.all([
          logistiqueAPI.voyages.obtenir(voyageId),
          logistiqueAPI.lignes.lister(),
          logistiqueAPI.colis.lister({ voyage_id: voyageId, par_page: 100 }),
        ]);
        if (annule) return;
        setVoyage(voyageCharge);
        setLigne(repLignes.elements.find((l) => l.id === voyageCharge.ligne_id) ?? null);
        setColis(repColis.elements);
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Voyage introuvable ou inaccessible.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [voyageId]);

  const compteurs = useMemo(() => {
    return {
      total: colis.length,
      a_transporter: colis.filter(
        (c) => c.statut === "enregistre" || c.statut === "en_transit",
      ).length,
      a_livrer: colis.filter((c) => c.statut === "arrive").length,
      livres: colis.filter((c) => c.statut === "livre").length,
    };
  }, [colis]);

  if (chargement) {
    return (
      <p className="text-ardoise-clair italic py-12 text-center">
        Chargement du voyage…
      </p>
    );
  }

  if (erreur || !voyage) {
    return (
      <div className="space-y-4">
        <Alerte variante="erreur" titre="Impossible d'afficher le voyage">
          {erreur ?? "Voyage introuvable."}
        </Alerte>
        <Link href="/chauffeur/dashboard">
          <Bouton variante="ghost">← Retour aux voyages</Bouton>
        </Link>
      </div>
    );
  }

  const statut = voyage.statut as keyof typeof LIBELLES_STATUT_VOYAGE;

  return (
    <div className="space-y-6 apparition">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/chauffeur/dashboard" className="hover:text-lagune">
          Mes voyages
        </Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">{libelleLigne(ligne)}</span>
      </nav>

      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-ardoise">{libelleLigne(ligne)}</h1>
          <Badge variante={VARIANTES_STATUT_VOYAGE[statut] ?? "neutre"} taille="moyen">
            {LIBELLES_STATUT_VOYAGE[statut] ?? voyage.statut}
          </Badge>
        </div>
        <Link href={`/chauffeur/scan?voyage_id=${voyage.id}`}>
          <Bouton variante="primaire">
            <IconeScan className="w-4 h-4" /> Scanner un colis
          </Bouton>
        </Link>
      </div>

      {/* Infos voyage */}
      <Carte titre="Informations du voyage">
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          <Ligne libelle="Départ" valeur={formaterDate(voyage.date_depart)} />
          <Ligne
            libelle="Arrivée"
            valeur={
              voyage.date_arrivee ? formaterDate(voyage.date_arrivee) : "—"
            }
          />
          <Ligne
            libelle="Véhicule"
            valeur={voyage.vehicule_immatriculation || "—"}
          />
          <Ligne libelle="Chauffeur" valeur={voyage.chauffeur_nom || "—"} />
        </dl>
      </Carte>

      {/* Compteurs colis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Compteur libelle="Total" valeur={compteurs.total} couleur="text-ardoise" />
        <Compteur
          libelle="À transporter"
          valeur={compteurs.a_transporter}
          couleur="text-blue-700"
        />
        <Compteur
          libelle="À livrer"
          valeur={compteurs.a_livrer}
          couleur="text-lagune"
        />
        <Compteur libelle="Livrés" valeur={compteurs.livres} couleur="text-green-700" />
      </div>

      {/* Liste des colis */}
      <Carte
        titre="Colis à bord"
        description={`${colis.length} colis pour ce voyage.`}
      >
        <TableauColis
          colis={colis}
          baseSuivi="/receveur/tickets"
          baseScan="/chauffeur/scan"
          messageVide="Aucun colis affecté à ce voyage pour le moment."
        />
      </Carte>
    </div>
  );
}

/** Ligne libellé/valeur. */
function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold">
        {libelle}
      </dt>
      <dd className="text-ardoise">{valeur}</dd>
    </div>
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
