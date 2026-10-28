"use client";
/**
 * Mes colis — espace chauffeur.
 *
 * Vue globale (tous mes cars) de ce qui voyage à bord. Le chauffeur y vérifie
 * ce qu'il transporte et livre directement (scan), sans dépendre d'un écran
 * « receveur » : c'est lui qui remet le colis au destinataire.
 *
 * Le ticket et l'impression restent au guichet (le ticket papier est collé sur
 * le colis à l'enregistrement) ; ici, l'action utile est la remise.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeColis } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { formaterDateHeure } from "@/composants/logistique/format";
import { useMesVoyages } from "@/composants/logistique/MonVoyageDuJour";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import {
  LIBELLES_STATUT_COLIS,
  VARIANTES_STATUT_COLIS,
  type Colis,
  type StatutColis,
} from "@/types/logistique";

export default function PageMesColis() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { voyages, lignes, chargement: chargementVoyages } = useMesVoyages();
  const [colis, setColis] = useState<Colis[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<"" | StatutColis>("");

  const charger = useCallback(async () => {
    if (voyages.length === 0) {
      setColis([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      // Filtre **côté serveur** : on ne rapatrie que les colis de ses propres cars.
      const reponses = await Promise.all(
        voyages.map((voyage) =>
          logistiqueAPI.colis.lister({ voyage_id: voyage.id, par_page: 100 }),
        ),
      );
      setColis(reponses.flatMap((reponse) => reponse.elements));
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger vos colis. Réessayez.",
      );
    } finally {
      setChargement(false);
    }
  }, [voyages]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // L'API a déjà restreint la liste à ses cars : aucun filtrage à refaire ici.
  const mesColis = colis;

  const ligneDu = useCallback(
    (voyageId: string | null) => {
      const voyage = voyages.find((v) => v.id === voyageId);
      const ligne = voyage ? lignes.find((l) => l.id === voyage.ligne_id) : null;
      return ligne
        ? `${ligne.gare_depart_nom ?? "?"} → ${ligne.gare_arrivee_nom ?? "?"}`
        : null;
    },
    [voyages, lignes],
  );

  const colisFiltres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return mesColis.filter((c) => {
      if (filtre && c.statut !== filtre) return false;
      if (!terme) return true;
      return [c.destinataire_nom, c.destinataire_tel, c.code_clair, c.description]
        .filter(Boolean)
        .some((champ) => String(champ).toLowerCase().includes(terme));
    });
  }, [mesColis, recherche, filtre]);

  const aLivrer = mesColis.filter((c) => c.statut !== "livre" && c.statut !== "annule")
    .length;

  return (
    <div className="space-y-5 apparition">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ardoise">Mes colis</h1>
          <p className="text-sm text-ardoise-clair">
            Ce que vous transportez. À la remise, scannez le QR du colis : le
            destinataire et l&apos;expéditeur sont prévenus.
          </p>
        </div>
        <Link href="/chauffeur/colis/nouveau">
          <Bouton variante="primaire" taille="petit">
            <IconeColis className="h-4 w-4" /> Enregistrer un colis
          </Bouton>
        </Link>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="carte py-4 text-center">
          <p className="text-2xl font-bold text-ardoise">{mesColis.length}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
            Colis à bord
          </p>
        </div>
        <div className="carte py-4 text-center">
          <p className="text-2xl font-bold text-ocre-fonce">{aLivrer}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
            À remettre
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label className="text-sm font-medium text-ardoise">Rechercher</label>
          <input
            className="champ-saisie"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Destinataire, téléphone ou code du colis"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ardoise">Statut</label>
          <select
            className="champ-saisie"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value as "" | StatutColis)}
          >
            <option value="">Tous les statuts</option>
            <option value="enregistre">Enregistrés</option>
            <option value="enregistre_direct">Enregistrés en route</option>
            <option value="en_transit">En transit</option>
            <option value="arrive">Arrivés</option>
            <option value="livre">Livrés</option>
            <option value="annule">Annulés</option>
          </select>
        </div>
      </div>

      <Carte
        titre={`${colisFiltres.length} colis`}
        description="Sélectionnez un colis pour consulter sa fiche et son suivi."
      >
        {chargement || chargementVoyages ? (
          <p className="py-8 text-center text-sm italic text-ardoise-clair">
            Chargement de vos colis…
          </p>
        ) : colisFiltres.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-ardoise-clair">
            Aucun colis pour ces critères.
          </p>
        ) : (
          <ul className="divide-y divide-ardoise-clair/10">
            {colisFiltres.map((c) => {
              const ligne = ligneDu(c.voyage_id);
              const contenu = (
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ardoise">
                      {c.destinataire_nom}
                    </span>
                    <Badge variante={VARIANTES_STATUT_COLIS[c.statut] ?? "neutre"}>
                      {LIBELLES_STATUT_COLIS[c.statut] ?? c.statut}
                    </Badge>
                  </span>
                  <span className="text-sm text-ardoise-clair">
                    {ligne ?? `${c.gare_depart_nom ?? "?"} → ${c.gare_arrivee_nom ?? "?"}`}
                  </span>
                  <span className="text-xs text-ardoise-clair">
                    {c.code_clair ?? "Code en attente"} · {c.nombre_articles} article(s)
                    {" · "}{formaterDateHeure(c.cree_le)}
                  </span>
                </span>
              );

              return (
                <li key={c.id}>
                  {c.code_clair ? (
                    <Link
                      href={`/chauffeur/colis/${encodeURIComponent(c.code_clair)}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-sable-clair focus-visible:outline focus-visible:outline-2 focus-visible:outline-lagune"
                    >
                      {contenu}
                      <span className="shrink-0 text-sm font-medium text-lagune">
                        Détails →
                      </span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-3">
                      {contenu}
                      <span className="shrink-0 text-xs text-ardoise-clair">
                        En attente
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Carte>
    </div>
  );
}
