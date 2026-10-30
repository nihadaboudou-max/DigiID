"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_COMMERCANT } from "@/composants/logistique/roles";
import { TableauColis } from "@/composants/logistique/TableauColis";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import type { Colis } from "@/types/logistique";

export default function PageTableauDeBordCommercant() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_COMMERCANT}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [colis, setColis] = useState<Colis[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    void logistiqueAPI.colis
      .lister({ par_page: 100 })
      .then((reponse) => {
        if (!annule) setColis(reponse.elements);
      })
      .catch((e: unknown) => {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger vos dépôts. Réessayez.",
          );
        }
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, []);

  const compteurs = useMemo(
    () => ({
      total: colis.length,
      enTransport: colis.filter((item) =>
        ["en_transit", "arrive"].includes(item.statut),
      ).length,
      livres: colis.filter((item) => item.statut === "livre").length,
    }),
    [colis],
  );

  return (
    <div className="space-y-6 apparition">
      <header>
        <h1 className="text-2xl font-bold text-ardoise">Espace commerçant</h1>
        <p className="mt-1 text-sm text-ardoise-clair">
          Enregistrez les colis confiés par vos clients et suivez uniquement vos dépôts.
          Le transport et la remise finale sont gérés par le chauffeur et le guichet.
        </p>
      </header>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Compteur titre="Mes dépôts" nombre={compteurs.total} />
        <Compteur titre="En transport" nombre={compteurs.enTransport} />
        <Compteur titre="Livrés" nombre={compteurs.livres} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/commercant/colis/nouveau">
          <Bouton variante="primaire">Enregistrer un dépôt</Bouton>
        </Link>
        <Link href="/commercant/colis">
          <Bouton variante="secondaire">Voir tous mes dépôts</Bouton>
        </Link>
      </div>

      <Carte titre="Derniers dépôts">
        {chargement ? (
          <p className="py-6 text-center text-sm italic text-ardoise-clair">
            Chargement de vos dépôts…
          </p>
        ) : (
          <TableauColis
            colis={colis.slice(0, 5)}
            baseSuivi="/suivi"
            messageVide="Vous n'avez pas encore enregistré de dépôt."
          />
        )}
      </Carte>
    </div>
  );
}

function Compteur({ titre, nombre }: { titre: string; nombre: number }) {
  return (
    <div className="carte py-4 text-center">
      <p className="text-2xl font-bold text-lagune">{nombre}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
        {titre}
      </p>
    </div>
  );
}
