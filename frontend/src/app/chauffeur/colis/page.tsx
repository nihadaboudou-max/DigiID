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
import { IconeColis, IconeScan } from "@/composants/commun/Icones";
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
  const [filtre, setFiltre] = useState<"" | "en_transit" | "livre">("");

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
            onChange={(e) => setFiltre(e.target.value as "" | "en_transit" | "livre")}
          >
            <option value="">Tous</option>
            <option value="en_transit">En transit</option>
            <option value="livre">Livrés</option>
          </select>
        </div>
      </div>

      <Carte
        titre={`${colisFiltres.length} colis`}
        description="Seuls les colis rattachés à l'un de vos cars apparaissent ici."
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
          <ul className="space-y-3">
            {colisFiltres.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-ardoise-clair/10 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ardoise">
                        {c.destinataire_nom}
                      </p>
                      <Badge
                        variante={VARIANTES_STATUT_COLIS[c.statut] ?? "neutre"}
                      >
                        {LIBELLES_STATUT_COLIS[c.statut] ?? c.statut}
                      </Badge>
                      {c.statut === "annule" && <Badge variante="terre">Annulé</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-ardoise">
                      {c.gare_depart_nom ?? "?"}{" "}
                      <span className="text-ocre">→</span>{" "}
                      {c.gare_arrivee_nom ?? "?"}
                      {ligneDu(c.voyage_id) ? (
                        <span className="text-xs text-ardoise-clair">
                          {" "}
                          ({ligneDu(c.voyage_id)})
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-ardoise-clair">
                      Destinataire : {c.destinataire_tel}
                      {c.description ? ` · ${c.description}` : ""}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-ardoise-clair">
                      {c.code_clair ? (
                        <Link
                          href={`/chauffeur/colis/${encodeURIComponent(c.code_clair)}`}
                          className="text-lagune hover:underline"
                        >
                          {c.code_clair}
                        </Link>
                      ) : (
                        "code en attente"
                      )}{" "}
                      · {c.nombre_articles} article(s) · {formaterDateHeure(c.cree_le)}
                    </p>
                  </div>

                  <div className="flex flex-col items-stretch gap-2">
                    {c.statut !== "livre" && c.statut !== "annule" && (
                      <Link
                        href={`/chauffeur/scan?code=${encodeURIComponent(
                          c.code_clair ?? "",
                        )}&type=livraison`}
                      >
                        <Bouton variante="primaire" taille="petit" className="w-full">
                          <IconeScan className="h-4 w-4" /> Remettre au destinataire
                        </Bouton>
                      </Link>
                    )}
                    {c.code_clair && (
                      <Link href={`/chauffeur/colis/${encodeURIComponent(c.code_clair)}`}>
                        <Bouton variante="ghost" taille="petit" className="w-full">
                          <IconeColis className="h-4 w-4" /> Voir la fiche
                        </Bouton>
                      </Link>
                    )}
                    {c.voyage_id && (
                      <Link href={`/chauffeur/voyages/${c.voyage_id}`}>
                        <Bouton variante="ghost" taille="petit" className="w-full">
                          <IconeColis className="h-4 w-4" /> Mon car
                        </Bouton>
                      </Link>
                    )}
                    <Bouton
                      variante="ghost"
                      taille="petit"
                      onClick={() => void charger()}
                    >
                      Actualiser
                    </Bouton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Carte>
    </div>
  );
}
