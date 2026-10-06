"use client";
/**
 * ManifesteVoyage — la « feuille de route » du chauffeur.
 *
 * Un seul écran, imprimable, qui liste **tout ce qui est à bord** : colis et
 * passagers, avec les coordonnées **masquées** (le chauffeur n'a pas besoin de
 * connaître par cœur le numéro des familles ; il appelle depuis le central ou
 * depuis la fiche du ticket au moment utile).
 *
 * C'est ce document qui rend le trajet vérifiable : si un sac manque à l'arrivée,
 * on sait exactement ce qui avait été embarqué.
 */
import { useCallback, useEffect, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ErreurAPI } from "@/services/client_api";
import { identiteAPI } from "@/services/identite_api";
import type { LigneManifeste, ManifesteVoyage as TypeManifeste } from "@/types/identite";
import { LIBELLES_MODE_ENREGISTREMENT } from "@/types/logistique";

interface Proprietes {
  voyageId: string;
  /** Change cette valeur pour forcer un rechargement (après un ajout). */
  rafraichir?: number;
  /** Rendu compact quand le manifeste est intégré à un écran déjà chargé. */
  compact?: boolean;
}

export function ManifesteVoyage({
  voyageId,
  rafraichir = 0,
  compact = false,
}: Proprietes) {
  const [manifeste, setManifeste] = useState<TypeManifeste | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      setManifeste(await identiteAPI.chauffeur.manifeste(voyageId));
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger le manifeste.",
      );
    } finally {
      setChargement(false);
    }
  }, [voyageId]);

  useEffect(() => {
    void charger();
  }, [charger, rafraichir]);

  return (
    <Carte
      titre="Manifeste du voyage"
      description="Tout ce qui est à bord, en une feuille — à imprimer si besoin."
    >
      {chargement ? (
        <p className="text-sm text-ardoise-clair italic py-6 text-center">
          Chargement du manifeste…
        </p>
      ) : erreur || !manifeste ? (
        <Alerte variante="erreur" titre="Manifeste indisponible">
          {erreur ?? "Aucune donnée."}
        </Alerte>
      ) : (
        <div className={compact ? "space-y-4" : "space-y-6"}>
          {/* Compteurs */}
          <div className="grid grid-cols-3 gap-3">
            <Compteur libelle="Colis" valeur={manifeste.nb_colis} />
            <Compteur libelle="Passagers" valeur={manifeste.nb_passagers} />
            <Compteur libelle="Sacs" valeur={manifeste.nb_bagages} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ardoise-clair">
              {manifeste.gare_depart_nom ?? "?"} → {manifeste.gare_arrivee_nom ?? "?"}
              {manifeste.vehicule_immatriculation
                ? ` · ${manifeste.vehicule_immatriculation}`
                : ""}
            </span>
            <Bouton
              variante="ghost"
              taille="petit"
              className="no-print"
              onClick={() => window.print()}
            >
              Imprimer le manifeste
            </Bouton>
          </div>

          {manifeste.colis.length === 0 && manifeste.passagers.length === 0 ? (
            <p className="text-sm italic text-ardoise-clair">
              Rien n&apos;est encore chargé sur ce voyage.
            </p>
          ) : (
            <div className="space-y-6">
              <TableauManifeste
                titre="Colis à bord"
                lignes={manifeste.colis}
                vide="Aucun colis embarqué."
              />
              <TableauManifeste
                titre="Passagers à bord"
                lignes={manifeste.passagers}
                vide="Aucun passager enregistré."
              />
            </div>
          )}

          <p className="text-xs text-ardoise-clair">
            Les numéros de téléphone sont volontairement masqués sur cette feuille :
            ils restent disponibles dans la fiche de chaque ticket.
          </p>
        </div>
      )}
    </Carte>
  );
}

function TableauManifeste({
  titre,
  lignes,
  vide,
}: {
  titre: string;
  lignes: LigneManifeste[];
  vide: string;
}) {
  if (lignes.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-ardoise mb-2">{titre}</h4>
        <p className="text-sm italic text-ardoise-clair">{vide}</p>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-ardoise mb-2">
        {titre} <span className="text-ardoise-clair">({lignes.length})</span>
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ardoise-clair/20 text-left text-xs uppercase tracking-wider text-ardoise-clair">
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Pour</th>
              <th className="py-2 pr-3">Contact</th>
              <th className="py-2 pr-3">Sacs</th>
              <th className="py-2 pr-3">Origine</th>
              <th className="py-2 pr-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={`${ligne.type}-${ligne.id}`} className="border-b border-ardoise-clair/10">
                <td className="py-2 pr-3 font-mono text-xs text-ardoise">
                  {ligne.code}
                </td>
                <td className="py-2 pr-3 text-ardoise">{ligne.libelle}</td>
                <td className="py-2 pr-3 text-ardoise-clair">
                  {ligne.contact_masque ?? "—"}
                </td>
                <td className="py-2 pr-3 text-ardoise-clair">{ligne.nombre_bagages}</td>
                <td className="py-2 pr-3">
                  <Badge
                    variante={
                      ligne.mode_enregistrement === "chauffeur_direct"
                        ? "ocre"
                        : "neutre"
                    }
                  >
                    {LIBELLES_MODE_ENREGISTREMENT[ligne.mode_enregistrement] ??
                      ligne.mode_enregistrement}
                  </Badge>
                </td>
                <td className="py-2 pr-3 text-ardoise-clair">{ligne.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Compteur({ libelle, valeur }: { libelle: string; valeur: number }) {
  return (
    <div className="rounded-xl bg-sable-clair py-3 text-center">
      <p className="text-xl font-bold text-ardoise">{valeur}</p>
      <p className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold mt-0.5">
        {libelle}
      </p>
    </div>
  );
}
