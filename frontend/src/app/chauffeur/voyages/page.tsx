"use client";
/**
 * Chauffeur — « Choisir mes voyages » (flexibilité multi-lignes).
 *
 * Un chauffeur indépendant ne travaille pas sur une seule ligne : le matin il
 * peut être sur Dakar → Thiès, l'après-midi sur Thiès → Mbour, avec un autre
 * car. Cette page lui donne les **départs libres** à venir et lui permet de
 * s'engager lui-même — sans téléphoner au gérant de gare.
 *
 * Règles affichées noir sur blanc :
 *   - on ne prend que des départs **planifiés** (pas encore partis) ;
 *   - un car déjà attribué ne se « vole » pas (l'engagement est public, les SMS
 *     partent sur le nom du chauffeur) ;
 *   - on peut se retirer tant que le car n'est pas parti.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeColis } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { formaterDate } from "@/composants/logistique/format";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { useAuthentification } from "@/contextes/authentification";
import { useNotifications } from "@/contextes/notifications";
import { ErreurAPI } from "@/services/client_api";
import {
  libelleLigne,
  logistiqueAPI,
  type Ligne,
  type Voyage,
} from "@/services/logistique_api";

export default function PageChoisirVoyages() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

/** Bornes de la journée choisie (le chauffeur raisonne en « jour de travail »). */
function bornesDuJour(valeur: string): { debut: string; fin: string } | null {
  if (!valeur) return null;
  const debut = new Date(`${valeur}T00:00:00`);
  if (Number.isNaN(debut.getTime())) return null;
  const fin = new Date(debut.getTime() + 24 * 60 * 60 * 1000);
  return { debut: debut.toISOString(), fin: fin.toISOString() };
}

function aujourdHui(): string {
  const maintenant = new Date();
  const mois = String(maintenant.getMonth() + 1).padStart(2, "0");
  const jour = String(maintenant.getDate()).padStart(2, "0");
  return `${maintenant.getFullYear()}-${mois}-${jour}`;
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const { notifier } = useNotifications();

  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [jour, setJour] = useState(aujourdHui());
  const [ligneChoisie, setLigneChoisie] = useState("");
  const [afficherTout, setAfficherTout] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
      // On interroge à partir du début du jour choisi : les départs du jour
      // restent visibles même si l'heure est déjà passée (retard fréquent).
      const bornes = bornesDuJour(jour);
      const [repLignes, repVoyages] = await Promise.all([
        logistiqueAPI.lignes.lister(),
        logistiqueAPI.voyages.lister({
          statut: "planifie",
          a_partir_de: bornes?.debut,
        }),
      ]);
      setLignes(repLignes.elements);
      setVoyages(repVoyages.elements);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger les départs. Réessayez plus tard.",
      );
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jour]);

  const lignesParId = useMemo(() => {
    const map: Record<string, Ligne> = {};
    lignes.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [lignes]);

  const bornes = bornesDuJour(jour);

  const depart = voyages
    .filter((v) => v.statut === "planifie")
    .filter((v) => v.chauffeur_id !== utilisateur?.id)
    .filter((v) => !ligneChoisie || v.ligne_id === ligneChoisie)
    .filter((v) => {
      if (afficherTout || !bornes) return true;
      const quand = new Date(v.date_depart).getTime();
      return (
        quand >= new Date(bornes.debut).getTime() &&
        quand < new Date(bornes.fin).getTime()
      );
    })
    .sort(
      (a, b) =>
        new Date(a.date_depart).getTime() - new Date(b.date_depart).getTime(),
    );

  const mesDepart = voyages
    .filter((v) => v.chauffeur_id === utilisateur?.id && v.statut === "planifie")
    .sort(
      (a, b) =>
        new Date(a.date_depart).getTime() - new Date(b.date_depart).getTime(),
    );

  const agir = async (voyage: Voyage, action: "rejoindre" | "quitter") => {
    setActionEnCours(voyage.id);
    try {
      if (action === "rejoindre") {
        await logistiqueAPI.voyages.rejoindre(voyage.id);
        notifier("Départ rejoint : ce car vous est attribué.", "succes");
      } else {
        await logistiqueAPI.voyages.quitter(voyage.id);
        notifier("Vous vous êtes retiré de ce départ.", "succes");
      }
      await charger();
    } catch (e) {
      notifier(
        e instanceof ErreurAPI ? e.message_utilisateur : "Action impossible",
        "erreur",
      );
    } finally {
      setActionEnCours(null);
    }
  };

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Choisir mes voyages</h1>
        <p className="text-sm text-ardoise-clair max-w-2xl">
          Prenez un départ libre, sur n&apos;importe quelle ligne, avec le car
          affecté au voyage. Un car est déjà engagé ? Le nom du chauffeur est
          affiché : voyez le gérant de gare pour le remplacer.
        </p>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      {/* Mes départs déjà pris : on les voit en premier, ce sont les engagements. */}
      <Carte
        titre="Mes prochains départs"
        description="Les voyages dont vous êtes le chauffeur désigné."
      >
        {chargement ? (
          <p className="text-sm text-ardoise-clair italic py-4 text-center">
            Chargement…
          </p>
        ) : mesDepart.length === 0 ? (
          <p className="text-sm text-ardoise-clair italic py-4 text-center">
            Aucun départ engagé pour le moment. Choisissez-en un ci-dessous.
          </p>
        ) : (
          <ul className="space-y-3">
            {mesDepart.map((voyage) => (
              <li
                key={voyage.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ocre/30 bg-ocre/5 p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ardoise">
                      {voyage.ligne_libelle ??
                        libelleLigne(lignesParId[voyage.ligne_id])}
                    </span>
                    <Badge variante="ocre">Mon départ</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ardoise-clair">
                    {formaterDate(voyage.date_depart)}
                    {voyage.vehicule_immatriculation
                      ? ` • Car ${voyage.vehicule_immatriculation}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/chauffeur/voyages/${voyage.id}`}>
                    <Bouton variante="secondaire" taille="petit">
                      <IconeColis className="w-4 h-4" /> Colis à bord
                    </Bouton>
                  </Link>
                  <Bouton
                    variante="ghost"
                    taille="petit"
                    chargement={actionEnCours === voyage.id}
                    onClick={() => agir(voyage, "quitter")}
                  >
                    Me retirer
                  </Bouton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      <Carte
        titre="Départs libres"
        description="Voyages planifiés sans chauffeur : vous pouvez vous engager vous-même."
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair">
              Jour
            </label>
            <input
              type="date"
              value={jour}
              onChange={(e) => setJour(e.target.value)}
              className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair">
              Ligne
            </label>
            <select
              value={ligneChoisie}
              onChange={(e) => setLigneChoisie(e.target.value)}
              className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
            >
              <option value="">Toutes les lignes</option>
              {lignes.map((l) => (
                <option key={l.id} value={l.id}>
                  {libelleLigne(l)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-xs text-ardoise-clair">
            <input
              type="checkbox"
              checked={afficherTout}
              onChange={(e) => setAfficherTout(e.target.checked)}
              className="rounded border-ardoise-clair/30"
            />
            Voir aussi les jours suivants
          </label>
        </div>

        {chargement ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Chargement des départs…
          </p>
        ) : depart.length === 0 ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Aucun départ libre pour ces critères. Essayez « Voir aussi les jours
            suivants » ou une autre ligne.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ardoise-clair/10 text-left text-xs uppercase text-ardoise-clair">
                  <th className="py-2 pr-3 font-semibold">Départ</th>
                  <th className="py-2 pr-3 font-semibold">Trajet</th>
                  <th className="py-2 pr-3 font-semibold">Car</th>
                  <th className="py-2 pr-3 font-semibold">Chauffeur</th>
                  <th className="py-2 pr-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {depart.map((voyage) => {
                  const libre = !voyage.chauffeur_id;
                  return (
                    <tr key={voyage.id}>
                      <td className="border-b border-ardoise-clair/5 py-2 pr-3">
                        {formaterDate(voyage.date_depart)}
                      </td>
                      <td className="border-b border-ardoise-clair/5 py-2 pr-3">
                        {voyage.ligne_libelle ??
                          libelleLigne(lignesParId[voyage.ligne_id])}
                      </td>
                      <td className="border-b border-ardoise-clair/5 py-2 pr-3">
                        {voyage.vehicule_immatriculation ?? "—"}
                      </td>
                      <td className="border-b border-ardoise-clair/5 py-2 pr-3">
                        {libre ? (
                          <Badge variante="succes">Libre</Badge>
                        ) : (
                          <span className="text-ardoise-clair">
                            {voyage.chauffeur_nom ?? "Déjà attribué"}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-ardoise-clair/5 py-2 pr-3 text-right">
                        {libre ? (
                          <Bouton
                            variante="primaire"
                            taille="petit"
                            chargement={actionEnCours === voyage.id}
                            onClick={() => agir(voyage, "rejoindre")}
                          >
                            Prendre ce départ
                          </Bouton>
                        ) : (
                          <span className="text-xs italic text-ardoise-clair">
                            Engagé
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
    </div>
  );
}
