"use client";
/**
 * Guichet — « Cars & chauffeurs » (référentiel roulant).
 *
 * Le gérant de gare et le receveur inscrivent les cars qui se présentent et les
 * **affectent à leur chauffeur**, sans attendre que le super-admin soit
 * disponible. C'est cette affectation — ou la plaque que le chauffeur a
 * déclarée dans son dossier professionnel — qui décide des cars qu'un chauffeur
 * voit lorsqu'il planifie un départ : il ne peut donc pas engager le car d'un
 * collègue (les SMS de départ partent sur le nom du chauffeur désigné).
 *
 * Tout est tracé : enregistrement, affectation, retrait et mise hors service
 * sont écrits dans le journal d'audit (qui a fait quoi, quand, et d'où).
 */
import { useEffect, useMemo, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeCamion } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ROLES_REFERENTIEL_ROULANT } from "@/composants/logistique/roles";
import { useAuthentification } from "@/contextes/authentification";
import { useNotifications } from "@/contextes/notifications";
import { ErreurAPI } from "@/services/client_api";
import {
  gareDeLActeur,
  logistiqueAPI,
  type ChauffeurDisponible,
  type Gare,
  type Vehicule,
} from "@/services/logistique_api";

export default function PageCarsEtChauffeurs() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_REFERENTIEL_ROULANT}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const { notifier } = useNotifications();

  const [cars, setCars] = useState<Vehicule[]>([]);
  const [chauffeurs, setChauffeurs] = useState<ChauffeurDisponible[]>([]);
  const [gares, setGares] = useState<Gare[]>([]);
  const [maGare, setMaGare] = useState<Gare | null>(null);
  const [rechercheChauffeur, setRechercheChauffeur] = useState("");
  const [seulementMaGare, setSeulementMaGare] = useState(true);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);

  // ── Nouveau car ──
  const [nouveau, setNouveau] = useState({
    immatriculation: "",
    marque: "",
    capacite: "",
    gare_id: "",
    chauffeur_id: "",
  });
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [repCars, mesChauffeurs, repGares] = await Promise.all([
        logistiqueAPI.vehicules.lister(),
        logistiqueAPI.chauffeurs.lister().catch(() => [] as ChauffeurDisponible[]),
        logistiqueAPI.gares.lister().catch(() => ({ elements: [] as Gare[] })),
      ]);
      setCars(repCars.elements);
      setChauffeurs(mesChauffeurs);
      setGares(repGares.elements);
      const gare = utilisateur?.id ? await gareDeLActeur(utilisateur.id) : null;
      setMaGare(gare);
      setNouveau((precedent) => ({
        ...precedent,
        gare_id: precedent.gare_id || gare?.id || "",
      }));
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger le référentiel roulant. Réessayez plus tard.",
      );
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilisateur?.id]);

  /** Recherche d'un chauffeur côté serveur : les noms sont chiffrés au repos. */
  const chercherChauffeurs = async () => {
    setActionEnCours("recherche");
    try {
      const trouves = await logistiqueAPI.chauffeurs.lister({
        recherche: rechercheChauffeur.trim() || undefined,
      });
      setChauffeurs(trouves);
    } catch {
      notifier("Recherche impossible pour le moment.", "erreur");
    } finally {
      setActionEnCours(null);
    }
  };

  const carsAffiches = useMemo(() => {
    if (!seulementMaGare || !maGare) return cars;
    return cars.filter((car) => car.gare_id === maGare.id);
  }, [cars, seulementMaGare, maGare]);

  const nomChauffeur = (car: Vehicule) =>
    car.chauffeur_nom ?? (car.chauffeur_id ? "Chauffeur inconnu" : null);

  // ─── Actions ───────────────────────────────────────────────────────

  const enregistrer = async () => {
    const immatriculation = nouveau.immatriculation.trim().toUpperCase();
    if (immatriculation.length < 2) {
      notifier("Saisissez l'immatriculation du car (ex. AB-1234-XX).", "erreur");
      return;
    }
    setEnregistrement(true);
    try {
      const car = await logistiqueAPI.vehicules.creer({
        immatriculation,
        ...(nouveau.marque.trim() ? { marque: nouveau.marque.trim() } : {}),
        ...(nouveau.capacite ? { capacite: Number(nouveau.capacite) } : {}),
        ...(nouveau.gare_id ? { gare_id: nouveau.gare_id } : {}),
      });
      // Affectation dans la foulée : le guichet sait qui conduit le car.
      if (nouveau.chauffeur_id) {
        await logistiqueAPI.vehicules.affecter(car.id, nouveau.chauffeur_id);
      }
      notifier(
        nouveau.chauffeur_id
          ? "Car enregistré et affecté à son chauffeur."
          : "Car enregistré. Affectez-le à un chauffeur pour qu'il puisse planifier un départ.",
        "succes",
      );
      setNouveau({
        immatriculation: "",
        marque: "",
        capacite: "",
        gare_id: maGare?.id ?? "",
        chauffeur_id: "",
      });
      await charger();
    } catch (e) {
      notifier(
        e instanceof ErreurAPI ? e.message_utilisateur : "Enregistrement impossible",
        "erreur",
      );
    } finally {
      setEnregistrement(false);
    }
  };

  const affecter = async (car: Vehicule, chauffeurId: string) => {
    setActionEnCours(car.id);
    try {
      await logistiqueAPI.vehicules.affecter(car.id, chauffeurId || null);
      notifier(
        chauffeurId
          ? `Car ${car.immatriculation} affecté : le chauffeur le voit dans « Mes cars ».`
          : `Car ${car.immatriculation} retiré du chauffeur (non affecté).`,
        "succes",
      );
      await charger();
    } catch (e) {
      notifier(
        e instanceof ErreurAPI ? e.message_utilisateur : "Affectation impossible",
        "erreur",
      );
    } finally {
      setActionEnCours(null);
    }
  };

  const basculerActif = async (car: Vehicule) => {
    setActionEnCours(car.id);
    try {
      await logistiqueAPI.vehicules.modifier(car.id, { actif: !car.actif });
      notifier(
        car.actif
          ? "Car retiré du service (les voyages passés restent tracés)."
          : "Car remis en service.",
        "succes",
      );
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

  // ─── Rendu ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">Cars &amp; chauffeurs</h1>
        <p className="text-sm text-ardoise-clair max-w-3xl">
          Enregistrez les cars du terrain et <strong>affectez-les à leur
          chauffeur</strong>. Un chauffeur ne peut planifier un départ qu&apos;avec
          les cars qui lui sont affectés (ou dont il a déclaré la plaque dans son
          dossier professionnel) — un car ne se « vole » donc pas.
        </p>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      {/* ─── Enregistrer un car ───────────────────────────────────── */}
      <Carte
        titre="Enregistrer un car"
        description="Une plaque = un car. Le chauffeur peut être désigné tout de suite."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ChampSaisie
            libelle="Immatriculation"
            placeholder="ex. AB-1234-XX"
            required
            value={nouveau.immatriculation}
            onChange={(e) =>
              setNouveau((p) => ({
                ...p,
                immatriculation: e.target.value.toUpperCase(),
              }))
            }
          />
          <ChampSaisie
            libelle="Marque / type"
            placeholder="ex. Toyota Coaster"
            value={nouveau.marque}
            onChange={(e) => setNouveau((p) => ({ ...p, marque: e.target.value }))}
          />
          <ChampSaisie
            libelle="Capacité (places)"
            type="number"
            min={0}
            inputMode="numeric"
            placeholder="ex. 30"
            value={nouveau.capacite}
            onChange={(e) => setNouveau((p) => ({ ...p, capacite: e.target.value }))}
          />
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair">
              Gare de rattachement
            </label>
            <select
              value={nouveau.gare_id}
              onChange={(e) => setNouveau((p) => ({ ...p, gare_id: e.target.value }))}
              className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
            >
              <option value="">— Aucune (car itinérant) —</option>
              {gares.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nom} ({g.ville})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair">
              Chauffeur
            </label>
            <select
              value={nouveau.chauffeur_id}
              onChange={(e) =>
                setNouveau((p) => ({ ...p, chauffeur_id: e.target.value }))
              }
              className="w-full rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
            >
              <option value="">— Non affecté (plus tard) —</option>
              {chauffeurs.map((c) => (
                <option key={c.utilisateur_id} value={c.utilisateur_id}>
                  {c.nom_complet}
                  {c.telephone ? ` • ${c.telephone}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ardoise-clair">
              Vous ne le trouvez pas ? Cherchez par nom plus bas, puis affectez le
              car après l&apos;enregistrement.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-ardoise-clair/10 pt-4">
          <p className="text-xs text-ardoise-clair max-w-md">
            L&apos;affectation est immédiatement visible par le chauffeur, qui peut
            alors planifier son départ. Chaque geste est journalisé.
          </p>
          <Bouton chargement={enregistrement} onClick={enregistrer}>
            Enregistrer le car
          </Bouton>
        </div>
      </Carte>

      {/* ─── Les cars ─────────────────────────────────────────────── */}
      <Carte
        titre={`Les cars (${carsAffiches.length})`}
        description="Affectez un chauffeur, retirez-en un, ou mettez un car hors service."
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="grow sm:max-w-xs">
            <ChampSaisie
              libelle="Rechercher un chauffeur"
              placeholder="Nom, prénom, téléphone, licence…"
              value={rechercheChauffeur}
              onChange={(e) => setRechercheChauffeur(e.target.value)}
            />
          </div>
          <Bouton
            variante="secondaire"
            taille="petit"
            chargement={actionEnCours === "recherche"}
            onClick={chercherChauffeurs}
          >
            Chercher
          </Bouton>
          {maGare && (
            <label className="flex items-center gap-2 pb-2 text-xs text-ardoise-clair">
              <input
                type="checkbox"
                checked={seulementMaGare}
                onChange={(e) => setSeulementMaGare(e.target.checked)}
                className="rounded border-ardoise-clair/30"
              />
              Seulement les cars de {maGare.nom}
            </label>
          )}
        </div>

        {chargement ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Chargement des cars…
          </p>
        ) : carsAffiches.length === 0 ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Aucun car pour ces critères. Enregistrez-en un ci-dessus.
          </p>
        ) : (
          <ul className="space-y-3">
            {carsAffiches.map((car) => {
              const nom = nomChauffeur(car);
              const chauffeurCourantDansListe = chauffeurs.some(
                (c) => c.utilisateur_id === car.chauffeur_id,
              );
              return (
                <li
                  key={car.id}
                  className="rounded-xl border border-ardoise-clair/15 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <IconeCamion className="w-4 h-4 text-lagune" />
                        <span className="font-semibold text-ardoise">
                          {car.immatriculation}
                        </span>
                        {car.actif ? (
                          <Badge variante="succes">En service</Badge>
                        ) : (
                          <Badge variante="neutre">Hors service</Badge>
                        )}
                        {nom ? (
                          <Badge variante="ocre">{nom}</Badge>
                        ) : (
                          <Badge variante="info">Non affecté</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-ardoise-clair">
                        {[
                          car.marque,
                          car.capacite ? `${car.capacite} places` : null,
                          car.gare_nom,
                        ]
                          .filter(Boolean)
                          .join(" • ") || "Marque et capacité non renseignées"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-ardoise-clair">
                          Chauffeur
                        </label>
                        <select
                          value={car.chauffeur_id ?? ""}
                          disabled={actionEnCours === car.id}
                          onChange={(e) => affecter(car, e.target.value)}
                          className="rounded-lg border border-ardoise-clair/20 px-3 py-2 text-sm"
                        >
                          <option value="">— Non affecté —</option>
                          {/* Le chauffeur déjà désigné reste visible même s'il
                              sort du filtre de recherche en cours. */}
                          {nom && !chauffeurCourantDansListe && (
                            <option value={car.chauffeur_id ?? ""}>{nom}</option>
                          )}
                          {chauffeurs.map((c) => (
                            <option key={c.utilisateur_id} value={c.utilisateur_id}>
                              {c.nom_complet}
                              {c.numero_licence ? ` (${c.numero_licence})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Bouton
                        variante="ghost"
                        taille="petit"
                        chargement={actionEnCours === car.id}
                        onClick={() => basculerActif(car)}
                      >
                        {car.actif ? "Mettre hors service" : "Remettre en service"}
                      </Bouton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      <p className="text-xs text-ardoise-clair">
        Un car sans chauffeur reste dans le référentiel : affectez-le quand le
        chauffeur se présente. Pour supprimer définitivement un car, seul un
        administrateur dispose de la permission requise.
      </p>
    </div>
  );
}
