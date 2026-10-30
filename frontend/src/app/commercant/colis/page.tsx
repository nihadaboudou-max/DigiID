"use client";

import { useEffect, useState } from "react";
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

export default function PageMesDepotsCommercant() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={ROLES_COMMERCANT}
      modeCommercantRequis
    >
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

  return (
    <div className="space-y-6 apparition">
      <header>
        <h1 className="text-2xl font-bold text-ardoise">Mes dépôts clients</h1>
        <p className="mt-1 text-sm text-ardoise-clair">
          Consultez les colis que vous avez enregistrés. Le suivi public permet au client
          de voir l&apos;avancement du transport.
        </p>
      </header>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      <Carte>
        {chargement ? (
          <p className="py-6 text-center text-sm italic text-ardoise-clair">
            Chargement de vos dépôts…
          </p>
        ) : (
          <TableauColis
            colis={colis}
            baseSuivi="/suivi"
            messageVide="Aucun dépôt enregistré pour le moment."
          />
        )}
      </Carte>

      <Link href="/commercant/colis/nouveau">
        <Bouton variante="primaire">Enregistrer un dépôt client</Bouton>
      </Link>
    </div>
  );
}
