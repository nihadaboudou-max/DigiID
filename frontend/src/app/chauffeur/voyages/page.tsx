"use client";
/**
 * Chauffeur — « Mes trajets & départs » (planification + flexibilité).
 *
 * Le chauffeur est un **indépendant**. Cette page lui donne les deux gestes du
 * métier, qui cohabitent :
 *
 *   1. **Planifier** son propre départ — il choisit sa ligne, son car et son
 *      heure. Le départ devient aussitôt visible du **guichet** (receveur /
 *      gérant de gare), qui y charge les colis et oriente les passagers vers ce
 *      car : c'est ainsi qu'un chauffeur remplit son véhicule ;
 *   2. **Prendre** un départ libre déjà planifié par un gérant de gare.
 *
 * Sur les gares : elles n'appartiennent à personne. Le chauffeur s'y **gare**
 * pour prendre la clientèle ; ce sont le gérant de gare et le super-admin qui
 * les inscrivent dans le référentiel. Lui, il déclare seulement les **lignes**
 * qu'il dessert entre ces gares.
 *
 * Règles rappelées à l'écran :
 *   - un car déjà attribué ne se « vole » pas (les SMS partent sur ce nom) ;
 *   - on annule un départ tant qu'il n'est pas parti — ensuite les colis et
 *     passagers à bord en dépendent, on termine le voyage.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge, type BadgeVariante } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeColis } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { formaterDateHeure } from "@/composants/logistique/format";
import { ROLES_CHAUFFEUR } from "@/composants/logistique/roles";
import { useAuthentification } from "@/contextes/authentification";
import { useNotifications } from "@/contextes/notifications";
import { ErreurAPI } from "@/services/client_api";
import {
  libelleLigne,
  logistiqueAPI,
  type Gare,
  type Ligne,
  type Vehicule,
  type Voyage,
} from "@/services/logistique_api";

/** Libellé et couleur d'un statut de voyage (badge). */
const STATUTS: Record<string, { libelle: string; variante: BadgeVariante }> = {
  planifie: { libelle: "Planifié", variante: "info" },
  en_cours: { libelle: "En route", variante: "ocre" },
  termine: { libelle: "Terminé", variante: "succes" },
  annule: { libelle: "Annulé", variante: "terre" },
};

export default function PageChoisirVoyages() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_CHAUFFEUR}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

// ─── Utilitaires de date ─────────────────────────────────────────────

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

/** `2026-05-12T08:00` (saisie locale) → ISO UTC pour l'API. `null` si vide/invalide. */
function versISO(valeur: string): string | null {
  if (!valeur) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO → valeur d'un `<input type="datetime-local">` (heure locale). */
function versDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const decalage = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - decalage).toISOString().slice(0, 16);
}

/** Valeur par défaut d'un départ : le prochain créneau rond (08:00 si tôt). */
function prochainDepartLocal(): string {
  const date = new Date();
  if (date.getHours() < 5) date.setHours(8, 0, 0, 0);
  else date.setMinutes(date.getMinutes() + 30 - (date.getMinutes() % 30), 0, 0);
  return versDatetimeLocal(date.toISOString());
}

// ─── Page ────────────────────────────────────────────────────────────

function Contenu() {
  const { utilisateur } = useAuthentification();
  const { notifier } = useNotifications();

  const [gares, setGares] = useState<Gare[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [jour, setJour] = useState(aujourdHui());
  const [ligneChoisie, setLigneChoisie] = useState("");
  const [afficherTout, setAfficherTout] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  // ── Planification d'un départ ──
  const [plan, setPlan] = useState({
    ligne_id: "",
    vehicule_id: "",
    date_depart: "",
    duree_min: "",
  });
  const [creationLigne, setCreationLigne] = useState(false);
  const [creationVehicule, setCreationVehicule] = useState(false);
  const [planification, setPlanification] = useState(false);

  // ── Correction d'un départ déjà planifié ──
  const [edition, setEdition] = useState<
    { id: string; date_depart: string; vehicule_id: string } | null
  >(null);

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
      // On part du début de la journée : un car en retard (ou parti ce matin)
      // reste visible, et les départs à venir arrivent en premier.
      const depuis = bornesDuJour(aujourdHui())?.debut;
      const [repGares, repLignes, repVehicules, repVoyages, repMesVoyages] =
        await Promise.all([
          logistiqueAPI.gares.lister().catch(() => ({ elements: [] as Gare[] })),
          logistiqueAPI.lignes.lister(),
          logistiqueAPI.vehicules.lister(),
          logistiqueAPI.voyages.lister({ a_partir_de: depuis, par_page: 100 }),
          // Mes voyages à part : si le réseau a plus de 100 départs à venir, les
          // miens doivent quand même remonter (le filtre est fait côté serveur).
          logistiqueAPI.voyages.lister({
            chauffeur_id: utilisateur?.id,
            par_page: 100,
          }),
        ]);
      setGares(repGares.elements);
      setLignes(repLignes.elements);
      setVehicules(repVehicules.elements);
      const voyagesParId = new Map<string, Voyage>();
      repVoyages.elements.forEach((v) => voyagesParId.set(v.id, v));
      repMesVoyages.elements.forEach((v) => voyagesParId.set(v.id, v));
      setVoyages([...voyagesParId.values()]);
      setPlan((precedent) => ({
        ...precedent,
        date_depart: precedent.date_depart || prochainDepartLocal(),
        ligne_id: precedent.ligne_id || repLignes.elements[0]?.id || "",
        vehicule_id: precedent.vehicule_id || repVehicules.elements[0]?.id || "",
      }));
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger vos départs. Réessayez plus tard.",
      );
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
    // Recharge si la session change (l'identité du chauffeur conditionne ses cars).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilisateur?.id]);

  const lignesParId = useMemo(() => {
    const map: Record<string, Ligne> = {};
    lignes.forEach((l) => {
      map[l.id] = l;
    });
    return map;
  }, [lignes]);

  /** Libellé d'un voyage : trajet lisible fourni par l'API, sinon reconstitué. */
  const trajetDe = (voyage: Voyage) =>
    voyage.ligne_libelle ?? libelleLigne(lignesParId[voyage.ligne_id]);

  const triChronologique = (a: Voyage, b: Voyage) =>
    new Date(a.date_depart).getTime() - new Date(b.date_depart).getTime();

  /** Mes engagements en cours : mes départs planifiés et mes cars en route. */
  const mesDepart = voyages
    .filter(
      (v) =>
        v.chauffeur_id === utilisateur?.id &&
        (v.statut === "planifie" || v.statut === "en_cours"),
    )
    .sort(triChronologique);

  /** Départs libres (les miens exclus : je les vois déjà ci-dessus). */
  const depart = voyages
    .filter((v) => v.statut === "planifie")
    .filter((v) => v.chauffeur_id !== utilisateur?.id)
    .filter((v) => !ligneChoisie || v.ligne_id === ligneChoisie)
    .filter((v) => {
      const bornes = bornesDuJour(jour);
      if (afficherTout || !bornes) return true;
      const quand = new Date(v.date_depart).getTime();
      return (
        quand >= new Date(bornes.debut).getTime() &&
        quand < new Date(bornes.fin).getTime()
      );
    })
    .sort(triChronologique);

  // ─── Actions ───────────────────────────────────────────────────────

  const planifier = async () => {
    const departISO = versISO(plan.date_depart);
    if (!plan.ligne_id || !plan.vehicule_id || !departISO) {
      notifier("Choisissez une ligne, un car et l'heure de départ.", "erreur");
      return;
    }
    setPlanification(true);
    try {
      const duree = Number(plan.duree_min);
      const arrivee =
        duree > 0
          ? new Date(new Date(departISO).getTime() + duree * 60_000).toISOString()
          : undefined;
      await logistiqueAPI.voyages.creer({
        ligne_id: plan.ligne_id,
        vehicule_id: plan.vehicule_id,
        chauffeur_id: utilisateur?.id,
        date_depart: departISO,
        statut: "planifie",
        ...(arrivee ? { date_arrivee: arrivee } : {}),
      });
      notifier(
        "Départ planifié. Les receveurs et gérants de gare le voient et peuvent y charger des colis.",
        "succes",
      );
      setPlan((precedent) => ({
        ...precedent,
        date_depart: prochainDepartLocal(),
        duree_min: "",
      }));
      await charger();
    } catch (e) {
      notifier(
        e instanceof ErreurAPI ? e.message_utilisateur : "Planification impossible",
        "erreur",
      );
    } finally {
      setPlanification(false);
    }
  };

  const enregistrerEdition = async () => {
    if (!edition) return;
    const departISO = versISO(edition.date_depart);
    if (!departISO) {
      notifier("Heure de départ invalide.", "erreur");
      return;
    }
    setActionEnCours(edition.id);
    try {
      await logistiqueAPI.voyages.modifier(edition.id, {
        date_depart: departISO,
        vehicule_id: edition.vehicule_id,
      });
      notifier("Départ mis à jour : le guichet voit le nouvel horaire.", "succes");
      setEdition(null);
      await charger();
    } catch (e) {
      notifier(
        e instanceof ErreurAPI ? e.message_utilisateur : "Modification impossible",
        "erreur",
      );
    } finally {
      setActionEnCours(null);
    }
  };

  const annulerVoyage = async (voyage: Voyage) => {
    setActionEnCours(voyage.id);
    try {
      await logistiqueAPI.voyages.modifier(voyage.id, { statut: "annule" });
      notifier(
        "Départ annulé. Les colis et passagers déjà chargés doivent être réaffectés.",
        "succes",
      );
      await charger();
    } catch (e) {
      notifier(
        e instanceof ErreurAPI ? e.message_utilisateur : "Annulation impossible",
        "erreur",
      );
    } finally {
      setActionEnCours(null);
    }
  };

  const rejoindre = async (voyage: Voyage) => {
    setActionEnCours(voyage.id);
    try {
      await logistiqueAPI.voyages.rejoindre(voyage.id);
      notifier("Départ rejoint : ce car vous est attribué.", "succes");
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

  const retirer = async (voyage: Voyage) => {
    setActionEnCours(voyage.id);
    try {
      await logistiqueAPI.voyages.quitter(voyage.id);
      notifier("Vous vous êtes retiré de ce départ.", "succes");
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

  /** (Dés)active une ligne ou un car : on n'efface pas l'historique des voyages. */
  const basculerActif = async (
    type: "ligne" | "vehicule",
    id: string,
    actif: boolean,
  ) => {
    setActionEnCours(id);
    try {
      if (type === "ligne") await logistiqueAPI.lignes.modifier(id, { actif });
      else await logistiqueAPI.vehicules.modifier(id, { actif });
      notifier(
        actif ? "Remis en service." : "Retiré du service (les voyages passés restent tracés).",
        "succes",
      );
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

  // ─── Rendu ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Mes trajets &amp; départs</h1>
        <p className="text-sm text-ardoise-clair max-w-3xl">
          Déclarez vos <strong>lignes</strong> entre les gares existantes, puis{" "}
          <strong>planifiez vos départs</strong> avec votre car. Un départ planifié
          est aussitôt visible des receveurs et gérants de gare : ils y chargent
          des colis et orientent les passagers vers vous. Vous pouvez aussi
          prendre un départ libre d&apos;un autre.
        </p>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      {gares.length === 0 && (
        <Alerte variante="info" titre="Aucune gare dans le référentiel">
          Pour créer une ligne, il faut d&apos;abord au moins une gare. Les gares
          sont inscrites par le <strong>gérant de gare</strong> ou le super-admin —
          une gare n&apos;appartient à personne : on s&apos;y gare pour prendre la
          clientèle.
        </Alerte>
      )}

      {/* ─── Planifier mon départ ─────────────────────────────────── */}
      <Carte
        titre="Planifier un départ"
        description="Vous choisissez le trajet et l'heure ; le guichet remplit le car (colis et passagers)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair">
              Ligne (trajet)
            </label>
            <select
              value={creationLigne ? "__nouvelle_ligne__" : plan.ligne_id}
              onChange={(e) => {
                if (e.target.value === "__nouvelle_ligne__") {
                  setCreationLigne(true);
                  return;
                }
                setCreationLigne(false);
                setPlan((p) => ({ ...p, ligne_id: e.target.value }));
              }}
              className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
            >
              {lignes.length === 0 && <option value="">— Aucune ligne —</option>}
              {lignes.map((l) => (
                <option key={l.id} value={l.id}>
                  {libelleLigne(l)}
                  {l.actif ? "" : " (retirée)"}
                </option>
              ))}
              <option value="__nouvelle_ligne__">＋ Déclarer une nouvelle ligne…</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair">
              Mon car
            </label>
            <select
              value={creationVehicule ? "__nouveau_vehicule__" : plan.vehicule_id}
              onChange={(e) => {
                if (e.target.value === "__nouveau_vehicule__") {
                  setCreationVehicule(true);
                  return;
                }
                setCreationVehicule(false);
                setPlan((p) => ({ ...p, vehicule_id: e.target.value }));
              }}
              className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
            >
              {vehicules.length === 0 && <option value="">— Aucun car —</option>}
              {vehicules.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.immatriculation}
                  {v.marque ? ` — ${v.marque}` : ""}
                  {v.capacite ? ` (${v.capacite} pl.)` : ""}
                </option>
              ))}
              <option value="__nouveau_vehicule__">＋ Enregistrer un nouveau car…</option>
            </select>
          </div>

          <ChampSaisie
            libelle="Départ le"
            type="datetime-local"
            value={plan.date_depart}
            onChange={(e) => setPlan((p) => ({ ...p, date_depart: e.target.value }))}
          />

          <ChampSaisie
            libelle="Durée estimée du trajet (minutes)"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="ex. 240"
            aide="Facultatif — sert à annoncer l'heure d'arrivée aux familles."
            value={plan.duree_min}
            onChange={(e) => setPlan((p) => ({ ...p, duree_min: e.target.value }))}
          />
        </div>

        {creationLigne && (
          <FormulaireNouvelleLigne
            gares={gares}
            onAnnuler={() => setCreationLigne(false)}
            onCree={(ligne) => {
              setCreationLigne(false);
              setPlan((p) => ({ ...p, ligne_id: ligne.id }));
            }}
          />
        )}

        {creationVehicule && (
          <FormulaireNouveauVehicule
            onAnnuler={() => setCreationVehicule(false)}
            onCree={(vehicule) => {
              setCreationVehicule(false);
              setPlan((p) => ({ ...p, vehicule_id: vehicule.id }));
            }}
          />
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ardoise-clair/10 pt-4">
          <p className="text-xs text-ardoise-clair max-w-md">
            Dès la planification, le départ apparaît dans le tableau de bord des
            guichets : c&apos;est là que la clientèle et les colis vous sont
            dirigés.
          </p>
          <Bouton chargement={planification} onClick={planifier}>
            Planifier ce départ
          </Bouton>
        </div>
      </Carte>

      {/* ─── Mes départs ──────────────────────────────────────────── */}
      <Carte
        titre="Mes départs"
        description="Les voyages dont vous êtes le chauffeur désigné : à corriger ou à annuler tant qu'ils ne sont pas partis."
      >
        {chargement ? (
          <p className="text-sm text-ardoise-clair italic py-4 text-center">
            Chargement…
          </p>
        ) : mesDepart.length === 0 ? (
          <p className="text-sm text-ardoise-clair italic py-4 text-center">
            Aucun départ engagé. Planifiez-en un ci-dessus, ou prenez un départ
            libre ci-dessous.
          </p>
        ) : (
          <ul className="space-y-3">
            {mesDepart.map((voyage) => {
              const statut = STATUTS[voyage.statut] ?? {
                libelle: voyage.statut,
                variante: "neutre" as BadgeVariante,
              };
              const enEdition = edition?.id === voyage.id;
              return (
                <li
                  key={voyage.id}
                  className="rounded-xl border border-ocre/30 bg-ocre/5 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ardoise">
                          {trajetDe(voyage)}
                        </span>
                        <Badge variante={statut.variante}>{statut.libelle}</Badge>
                        <Badge variante="ocre">Mon départ</Badge>
                      </div>
                      <p className="mt-1 text-sm text-ardoise-clair">
                        {formaterDateHeure(voyage.date_depart)}
                        {voyage.vehicule_immatriculation
                          ? ` • Car ${voyage.vehicule_immatriculation}`
                          : ""}
                      </p>
                    </div>

                    {!enEdition && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/chauffeur/voyages/${voyage.id}`}>
                          <Bouton variante="secondaire" taille="petit">
                            <IconeColis className="w-4 h-4" /> Colis à bord
                          </Bouton>
                        </Link>
                        {voyage.statut === "planifie" && (
                          <>
                            <Bouton
                              variante="ghost"
                              taille="petit"
                              onClick={() =>
                                setEdition({
                                  id: voyage.id,
                                  date_depart: versDatetimeLocal(voyage.date_depart),
                                  vehicule_id: voyage.vehicule_id,
                                })
                              }
                            >
                              Ajuster
                            </Bouton>
                            <Bouton
                              variante="ghost"
                              taille="petit"
                              chargement={actionEnCours === voyage.id}
                              onClick={() => annulerVoyage(voyage)}
                            >
                              Annuler le départ
                            </Bouton>
                          </>
                        )}
                        {voyage.statut === "en_cours" && (
                          <Bouton
                            variante="ghost"
                            taille="petit"
                            chargement={actionEnCours === voyage.id}
                            onClick={() => retirer(voyage)}
                          >
                            Me retirer
                          </Bouton>
                        )}
                      </div>
                    )}
                  </div>

                  {enEdition && edition && (
                    <div className="mt-4 grid gap-3 rounded-lg border border-ardoise-clair/15 bg-white p-3 sm:grid-cols-2">
                      <ChampSaisie
                        libelle="Nouveau départ"
                        type="datetime-local"
                        value={edition.date_depart}
                        onChange={(e) =>
                          setEdition({ ...edition, date_depart: e.target.value })
                        }
                      />
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-ardoise">
                          Car
                        </label>
                        <select
                          value={edition.vehicule_id}
                          onChange={(e) =>
                            setEdition({ ...edition, vehicule_id: e.target.value })
                          }
                          className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
                        >
                          {vehicules.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.immatriculation}
                              {v.capacite ? ` (${v.capacite} pl.)` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <Bouton
                          taille="petit"
                          chargement={actionEnCours === edition.id}
                          onClick={enregistrerEdition}
                        >
                          Enregistrer
                        </Bouton>
                        <Bouton
                          variante="ghost"
                          taille="petit"
                          onClick={() => setEdition(null)}
                        >
                          Annuler
                        </Bouton>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      {/* ─── Départs libres ───────────────────────────────────────── */}
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
            suivants », une autre ligne — ou planifiez votre propre départ.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ardoise-clair/10 text-left text-xs uppercase text-ardoise-clair">
                  <th className="py-2 pr-3 font-semibold">Départ</th>
                  <th className="py-2 pr-3 font-semibold">Trajet</th>
                  <th className="py-2 pr-3 font-semibold">Car</th>
                  <th className="py-2 pr-3 font-semibold">Disponibilité</th>
                  <th className="py-2 pr-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {depart.map((voyage) => (
                  <tr key={voyage.id}>
                    <td className="border-b border-ardoise-clair/5 py-2 pr-3">
                      {formaterDateHeure(voyage.date_depart)}
                    </td>
                    <td className="border-b border-ardoise-clair/5 py-2 pr-3">
                      {trajetDe(voyage)}
                    </td>
                    <td className="border-b border-ardoise-clair/5 py-2 pr-3">
                      {voyage.vehicule_immatriculation ?? "—"}
                    </td>
                    <td className="border-b border-ardoise-clair/5 py-2 pr-3">
                      <Badge variante="succes">Libre</Badge>
                    </td>
                    <td className="border-b border-ardoise-clair/5 py-2 pr-3 text-right">
                      <Bouton
                        variante="primaire"
                        taille="petit"
                        chargement={actionEnCours === voyage.id}
                        onClick={() => rejoindre(voyage)}
                      >
                        Prendre ce départ
                      </Bouton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Carte>

      {/* ─── Mes lignes & mes cars ────────────────────────────────── */}
      <Carte
        titre="Mes lignes &amp; mes cars"
        description="Ce que vous desservez. Retirer une ligne ou un car ne supprime aucun voyage passé."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-ardoise-clair">
              Lignes déclarées ({lignes.length})
            </p>
            {lignes.length === 0 ? (
              <p className="text-sm text-ardoise-clair italic">
                Aucune ligne. Déclarez la première ci-dessus.
              </p>
            ) : (
              <ul className="space-y-2">
                {lignes.map((ligne) => (
                  <li
                    key={ligne.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ardoise-clair/15 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ardoise">
                        {libelleLigne(ligne)}
                      </p>
                      <p className="text-xs text-ardoise-clair">
                        {[
                          ligne.distance_km ? `${ligne.distance_km} km` : null,
                          ligne.duree_min ? `${ligne.duree_min} min` : null,
                        ]
                          .filter(Boolean)
                          .join(" • ") || "Distance et durée non renseignées"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!ligne.actif && <Badge variante="neutre">Retirée</Badge>}
                      <Bouton
                        variante="ghost"
                        taille="petit"
                        chargement={actionEnCours === ligne.id}
                        onClick={() => basculerActif("ligne", ligne.id, !ligne.actif)}
                      >
                        {ligne.actif ? "Retirer" : "Remettre"}
                      </Bouton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-ardoise-clair">
              Mes cars ({vehicules.length})
            </p>
            {vehicules.length === 0 ? (
              <p className="text-sm text-ardoise-clair italic">
                Aucun car. Enregistrez le vôtre ci-dessus.
              </p>
            ) : (
              <ul className="space-y-2">
                {vehicules.map((vehicule) => (
                  <li
                    key={vehicule.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ardoise-clair/15 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ardoise">
                        {vehicule.immatriculation}
                      </p>
                      <p className="text-xs text-ardoise-clair">
                        {[
                          vehicule.marque,
                          vehicule.capacite ? `${vehicule.capacite} places` : null,
                        ]
                          .filter(Boolean)
                          .join(" • ") || "Marque et capacité non renseignées"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!vehicule.actif && <Badge variante="neutre">Retiré</Badge>}
                      <Bouton
                        variante="ghost"
                        taille="petit"
                        chargement={actionEnCours === vehicule.id}
                        onClick={() =>
                          basculerActif("vehicule", vehicule.id, !vehicule.actif)
                        }
                      >
                        {vehicule.actif ? "Retirer" : "Remettre"}
                      </Bouton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Carte>
    </div>
  );
}

// ─── Sous-formulaires (créés à la volée depuis la planification) ─────

/** Déclaration d'une ligne entre deux gares **déjà** inscrites au référentiel. */
function FormulaireNouvelleLigne({
  gares,
  onCree,
  onAnnuler,
}: {
  gares: Gare[];
  onCree: (ligne: Ligne) => void;
  onAnnuler: () => void;
}) {
  const { notifier } = useNotifications();
  const [gareDepart, setGareDepart] = useState("");
  const [gareArrivee, setGareArrivee] = useState("");
  const [distance, setDistance] = useState("");
  const [duree, setDuree] = useState("");
  const [enCours, setEnCours] = useState(false);

  const creer = async () => {
    if (!gareDepart || !gareArrivee) {
      notifier("Choisissez la gare de départ et la gare d'arrivée.", "erreur");
      return;
    }
    if (gareDepart === gareArrivee) {
      notifier("Le départ et l'arrivée doivent être deux gares différentes.", "erreur");
      return;
    }
    setEnCours(true);
    try {
      const ligne = await logistiqueAPI.lignes.creer({
        gare_depart_id: gareDepart,
        gare_arrivee_id: gareArrivee,
        ...(distance ? { distance_km: Number(distance) } : {}),
        ...(duree ? { duree_min: Number(duree) } : {}),
      });
      notifier("Ligne déclarée : elle est désormais proposée à tous les chauffeurs.", "succes");
      onCree(ligne);
    } catch (e) {
      notifier(
        e instanceof ErreurAPI ? e.message_utilisateur : "Création de la ligne impossible",
        "erreur",
      );
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-lagune/30 bg-lagune/5 p-3">
      <p className="mb-3 text-sm font-medium text-ardoise">
        Déclarer une ligne (elle servira à tous les chauffeurs)
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair">
            Gare de départ
          </label>
          <select
            value={gareDepart}
            onChange={(e) => setGareDepart(e.target.value)}
            className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {gares.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nom} ({g.ville})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair">
            Gare d&apos;arrivée
          </label>
          <select
            value={gareArrivee}
            onChange={(e) => setGareArrivee(e.target.value)}
            className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {gares.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nom} ({g.ville})
              </option>
            ))}
          </select>
        </div>
        <ChampSaisie
          libelle="Distance (km)"
          type="number"
          min={0}
          placeholder="ex. 410"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
        />
        <ChampSaisie
          libelle="Durée (minutes)"
          type="number"
          min={0}
          placeholder="ex. 420"
          value={duree}
          onChange={(e) => setDuree(e.target.value)}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Bouton taille="petit" chargement={enCours} onClick={creer}>
          Déclarer la ligne
        </Bouton>
        <Bouton variante="ghost" taille="petit" onClick={onAnnuler}>
          Annuler
        </Bouton>
      </div>
    </div>
  );
}

/** Enregistrement d'un car (une plaque = un car ; l'immatriculation est unique). */
function FormulaireNouveauVehicule({
  onCree,
  onAnnuler,
}: {
  onCree: (vehicule: Vehicule) => void;
  onAnnuler: () => void;
}) {
  const { notifier } = useNotifications();
  const [immatriculation, setImmatriculation] = useState("");
  const [marque, setMarque] = useState("");
  const [capacite, setCapacite] = useState("");
  const [enCours, setEnCours] = useState(false);

  const creer = async () => {
    if (immatriculation.trim().length < 2) {
      notifier("Saisissez l'immatriculation de votre car.", "erreur");
      return;
    }
    setEnCours(true);
    try {
      const vehicule = await logistiqueAPI.vehicules.creer({
        immatriculation: immatriculation.trim(),
        ...(marque.trim() ? { marque: marque.trim() } : {}),
        ...(capacite ? { capacite: Number(capacite) } : {}),
      });
      notifier("Car enregistré : vous pouvez planifier un départ avec.", "succes");
      onCree(vehicule);
    } catch (e) {
      notifier(
        e instanceof ErreurAPI ? e.message_utilisateur : "Enregistrement impossible",
        "erreur",
      );
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-lagune/30 bg-lagune/5 p-3">
      <p className="mb-3 text-sm font-medium text-ardoise">
        Enregistrer mon car (une plaque = un car)
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <ChampSaisie
          libelle="Immatriculation"
          placeholder="ex. AB-1234-XX"
          required
          value={immatriculation}
          onChange={(e) => setImmatriculation(e.target.value.toUpperCase())}
        />
        <ChampSaisie
          libelle="Marque"
          placeholder="ex. Toyota Coaster"
          value={marque}
          onChange={(e) => setMarque(e.target.value)}
        />
        <ChampSaisie
          libelle="Capacité (places)"
          type="number"
          min={0}
          placeholder="ex. 30"
          value={capacite}
          onChange={(e) => setCapacite(e.target.value)}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Bouton taille="petit" chargement={enCours} onClick={creer}>
          Enregistrer le car
        </Bouton>
        <Bouton variante="ghost" taille="petit" onClick={onAnnuler}>
          Annuler
        </Bouton>
      </div>
    </div>
  );
}
