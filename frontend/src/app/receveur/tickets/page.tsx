"use client";
/**
 * Liste / recherche des colis du guichet (S3).
 *
 * Filtre par statut et recherche par numéro de ticket ou nom de destinataire
 * (filtrage côté client sur la liste chargée).
 */
import { useEffect, useMemo, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeColis } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_GUICHET } from "@/composants/logistique/roles";
import { TableauColis } from "@/composants/logistique/TableauColis";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import { gareDeLActeur, logistiqueAPI } from "@/services/logistique_api";
import { LIBELLES_STATUT_COLIS, type Colis, type StatutColis } from "@/types/logistique";
import Link from "next/link";

const STATUTS: (StatutColis | "tous")[] = [
  "tous",
  "enregistre",
  "en_transit",
  "arrive",
  "livre",
];

export default function PageTickets() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_GUICHET}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [colis, setColis] = useState<Colis[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState<StatutColis | "tous">("tous");
  const [limiterAGare, setLimiterAGare] = useState(true);
  const [gareId, setGareId] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      if (utilisateur?.id) {
        const gare = await gareDeLActeur(utilisateur.id);
        if (!annule) setGareId(gare?.id ?? null);
      }
    })();
    return () => {
      annule = true;
    };
  }, [utilisateur?.id]);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const reponse = await logistiqueAPI.colis.lister({
          par_page: 100,
          ...(limiterAGare && gareId ? { gare_id: gareId } : {}),
        });
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
  }, [limiterAGare, gareId]);

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return colis.filter((c) => {
      if (filtreStatut !== "tous" && c.statut !== filtreStatut) return false;
      if (!terme) return true;
      return (
        (c.code_clair ?? "").toLowerCase().includes(terme) ||
        c.destinataire_nom.toLowerCase().includes(terme) ||
        c.destinataire_tel.toLowerCase().includes(terme)
      );
    });
  }, [colis, recherche, filtreStatut]);

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Colis &amp; tickets</h1>
        <p className="text-sm text-ardoise-clair">
          Retrouvez un colis par son numéro ou le nom du destinataire.
        </p>
      </div>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      <Carte>
        <div className="space-y-4">
          <ChampSaisie
            libelle="Rechercher"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Numéro de ticket, nom ou téléphone du destinataire…"
          />

          <div className="flex flex-wrap items-center gap-2">
            {STATUTS.map((statut) => {
              const actif = filtreStatut === statut;
              return (
                <button
                  key={statut}
                  type="button"
                  onClick={() => setFiltreStatut(statut)}
                  className={
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors " +
                    (actif
                      ? "bg-lagune text-white"
                      : "bg-sable text-ardoise hover:bg-sable/70")
                  }
                >
                  {statut === "tous" ? "Tous" : LIBELLES_STATUT_COLIS[statut]}
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-2 text-xs text-ardoise-clair">
            <input
              type="checkbox"
              checked={limiterAGare}
              onChange={(e) => setLimiterAGare(e.target.checked)}
              className="rounded border-ardoise-clair/30"
            />
            Limiter à ma gare de rattachement
          </label>
        </div>
      </Carte>

      <Carte>
        {chargement ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Chargement des colis…
          </p>
        ) : (
          <>
            <TableauColis
              colis={filtres}
              messageVide={
                recherche || filtreStatut !== "tous"
                  ? "Aucun colis ne correspond à votre recherche."
                  : "Aucun colis enregistré pour le moment."
              }
            />
            <p className="text-xs text-ardoise-clair mt-3">
              {filtres.length} colis affiché{filtres.length > 1 ? "s" : ""}
              {colis.length !== filtres.length ? ` sur ${colis.length}` : ""}.
            </p>
          </>
        )}
      </Carte>

      <div>
        <Link href="/receveur/colis/nouveau">
          <Bouton variante="primaire">
            <IconeColis className="w-4 h-4" /> Enregistrer un nouveau colis
          </Bouton>
        </Link>
      </div>
    </div>
  );
}
