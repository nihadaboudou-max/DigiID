
"use client";

/**
 * Super-admin — référentiel logistique (gares, lignes, véhicules, voyages, acteurs).
 * Référentiel global (non cloisonné par domaine/département) : réservé au super-admin.
 */
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { Alerte } from "@/composants/commun/Alerte";
import { useNotifications } from "@/contextes/notifications";
import { ErreurAPI } from "@/services/client_api";
import {
  logistiqueAPI as api,
  type Acteur,
  type ChauffeurDisponible,
  type Gare,
  type Ligne,
  type Vehicule,
  type Voyage,
} from "@/services/logistique_api";
import {
  listerTousUtilisateurs,
  type UtilisateurComplet,
} from "@/services/super_admin_utilisateurs";

const ONGLETS = ["Gares", "Lignes", "Véhicules", "Voyages", "Acteurs"] as const;
type Onglet = (typeof ONGLETS)[number];

const clsInput = "w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm";

const nombreOuNull = (v: string) => (v.trim() === "" ? null : Number(v));

export default function PageLogistiqueSuperAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur", "super_admin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { notifier } = useNotifications();
  const [onglet, setOnglet] = useState<Onglet>("Gares");
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [gares, setGares] = useState<Gare[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [acteurs, setActeurs] = useState<Acteur[]>([]);

  const charger = async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [g, l, v, voy, a] = await Promise.all([
        api.gares.lister(),
        api.lignes.lister(),
        api.vehicules.lister(),
        api.voyages.lister(),
        api.acteurs.lister(),
      ]);
      setGares(g.elements);
      setLignes(l.elements);
      setVehicules(v.elements);
      setVoyages(voy.elements);
      setActeurs(a.elements);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de chargement");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    charger();
  }, []);

  const supprimer = async (action: () => Promise<unknown>, message: string) => {
    if (!confirm("Confirmer la suppression ?")) return;
    try {
      await action();
      notifier(message, "succes");
      charger();
    } catch (e) {
      notifier(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de suppression", "erreur");
    }
  };

  const optionsGares = gares.map((g) => ({ valeur: g.id, libelle: `${g.code} — ${g.nom} (${g.ville})` }));

  return (
    <div className="space-y-4">
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">Super administration</p>
        <h1 className="mt-1 text-2xl">Référentiel logistique</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Référentiel global du réseau : gares, lignes, véhicules, voyages et acteurs. Non cloisonné par domaine.
        </p>
      </header>

      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      <div className="flex gap-2 flex-wrap">
        {ONGLETS.map((o) => (
          <Bouton
            key={o}
            variante={o === onglet ? "primaire" : "ghost"}
            taille="petit"
            onClick={() => setOnglet(o)}
          >
            {o}
          </Bouton>
        ))}
      </div>

      {chargement ? (
        <Carte>
          <p className="text-center italic py-6 text-ardoise-clair">Chargement...</p>
        </Carte>
      ) : (
        <>
          {onglet === "Gares" && (
            <SectionGare
              gares={gares}
              rafraichir={charger}
              supprimer={(id) => supprimer(() => api.gares.supprimer(id), "Gare supprimée")}
            />
          )}
          {onglet === "Lignes" && (
            <SectionLigne
              lignes={lignes}
              optionsGares={optionsGares}
              rafraichir={charger}
              supprimer={(id) => supprimer(() => api.lignes.supprimer(id), "Ligne supprimée")}
            />
          )}
          {onglet === "Véhicules" && (
            <SectionVehicule
              vehicules={vehicules}
              optionsGares={optionsGares}
              rafraichir={charger}
              supprimer={(id) => supprimer(() => api.vehicules.supprimer(id), "Véhicule supprimé")}
            />
          )}
          {onglet === "Voyages" && (
            <SectionVoyage
              voyages={voyages}
              lignes={lignes}
              vehicules={vehicules}
              rafraichir={charger}
              supprimer={(id) => supprimer(() => api.voyages.supprimer(id), "Voyage supprimé")}
            />
          )}
          {onglet === "Acteurs" && (
            <SectionActeur
              acteurs={acteurs}
              optionsGares={optionsGares}
              rafraichir={charger}
              supprimer={(id) => supprimer(() => api.acteurs.supprimer(id), "Acteur supprimé")}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Éléments de formulaire réutilisables ────────────────────────────

function ChampSimple({
  libelle, value, onChange, type = "text", requis, placeholder,
}: {
  libelle: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  requis?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">{libelle}</label>
      <input
        className={clsInput}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={requis}
        placeholder={placeholder}
      />
    </div>
  );
}

function ChampSelect({
  libelle, value, onChange, options, requis, placeholder = "Sélectionner...",
}: {
  libelle: string;
  value: string;
  onChange: (v: string) => void;
  options: { valeur: string; libelle: string }[];
  requis?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">{libelle}</label>
      <select
        className={clsInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={requis}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>{o.libelle}</option>
        ))}
      </select>
    </div>
  );
}

function TableauSimple({ entetes, children }: { entetes: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-ardoise-clair border-b border-ardoise-clair/10">
            {entetes.map((h) => (
              <th key={h} className="py-2 pr-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function LigneVide({ colonnes, message }: { colonnes: number; message: string }) {
  return (
    <tr>
      <td colSpan={colonnes} className="py-4 text-center italic text-ardoise-clair">{message}</td>
    </tr>
  );
}

function BoutonSupprimer({ onClick }: { onClick: () => void }) {
  return (
    <Bouton variante="danger" taille="petit" onClick={onClick}>
      Supprimer
    </Bouton>
  );
}

/**
 * Annuaire restreint à un rôle : on choisit une **personne**, jamais un UUID.
 *
 * Les noms étant chiffrés au repos, la recherche par nom se fait après
 * déchiffrement, côté client (le backend ne peut pas filtrer dessus).
 */
function SelecteurUtilisateur({
  role,
  valeur,
  surChoix,
}: {
  role: string;
  valeur: string;
  surChoix: (id: string) => void;
}) {
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurComplet[]>([]);
  const [recherche, setRecherche] = useState("");
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    (async () => {
      try {
        const reponse = await listerTousUtilisateurs({
          role,
          limite: 100,
          est_supprime: false,
        });
        if (!annule) setUtilisateurs(reponse.utilisateurs);
      } catch {
        if (!annule) setUtilisateurs([]);
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [role]);

  const terme = recherche.trim().toLowerCase();
  const filtres = terme
    ? utilisateurs.filter((u) =>
        `${u.prenom ?? ""} ${u.nom ?? ""} ${u.telephone ?? ""} ${u.email} ${
          u.ville ?? ""
        }`
          .toLowerCase()
          .includes(terme),
      )
    : utilisateurs;
  const choisi = utilisateurs.find((u) => u.id === valeur) ?? null;

  if (chargement) {
    return (
      <p className="text-xs italic text-ardoise-clair">
        Chargement des comptes « {role} »…
      </p>
    );
  }
  if (utilisateurs.length === 0) {
    return (
      <div className="rounded-lg bg-ocre/10 p-2 text-xs text-ardoise">
        Aucun compte avec le rôle « {role} ». Créez d&apos;abord le compte dans
        <span className="font-medium"> Super admin → Utilisateurs</span>, puis
        revenez ici pour l&apos;inscrire au référentiel logistique.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ChampSimple
        libelle="Rechercher dans l'annuaire"
        value={recherche}
        onChange={setRecherche}
        placeholder="Nom, prénom ou numéro"
      />
      <ChampSelect
        libelle="Utilisateur"
        value={valeur}
        onChange={surChoix}
        requis
        options={filtres.map((u) => ({
          valeur: u.id,
          libelle: `${u.prenom ?? "?"} ${u.nom ?? ""} — ${
            u.telephone ?? "tél. non renseigné"
          }${u.ville ? ` — ${u.ville}` : ""}`,
        }))}
        placeholder={filtres.length > 0 ? "Choisir un utilisateur…" : "Aucun résultat"}
      />
      {choisi && (
        <div className="space-y-0.5 rounded-lg border border-lagune/25 bg-lagune/5 p-2 text-xs text-ardoise">
          <p className="font-semibold">
            {choisi.prenom} {choisi.nom}
          </p>
          <p>📞 {choisi.telephone ?? "Téléphone non renseigné"}</p>
          <p>✉️ {choisi.email}</p>
          <p>
            Ville : {choisi.ville ?? "—"} · Rôle : {choisi.role}
          </p>
        </div>
      )}
    </div>
  );
}

const clsCellule = "py-2 pr-3 border-b border-ardoise-clair/5";

// ─── Section Gares ───────────────────────────────────────────────────

function SectionGare({
  gares, rafraichir, supprimer,
}: {
  gares: Gare[];
  rafraichir: () => void;
  supprimer: (id: string) => void;
}) {
  const { notifier } = useNotifications();
  const [f, setF] = useState({ nom: "", code: "", ville: "" });
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    try {
      await api.gares.creer(f);
      notifier("Gare créée", "succes");
      setF({ nom: "", code: "", ville: "" });
      rafraichir();
    } catch (err) {
      notifier(err instanceof ErreurAPI ? err.message_utilisateur : "Erreur", "erreur");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Carte>
        <h2 className="font-semibold mb-3">Nouvelle gare</h2>
        <form onSubmit={soumettre} className="space-y-3">
          <ChampSimple libelle="Nom" value={f.nom} onChange={(v) => setF({ ...f, nom: v })} requis />
          <ChampSimple libelle="Code" value={f.code} onChange={(v) => setF({ ...f, code: v })} requis placeholder="COO, PKO…" />
          <ChampSimple libelle="Ville" value={f.ville} onChange={(v) => setF({ ...f, ville: v })} requis />
          <Bouton type="submit" variante="primaire" chargement={enCours}>Créer</Bouton>
        </form>
      </Carte>
      <Carte>
        <h2 className="font-semibold mb-3">{gares.length} gare(s)</h2>
        <TableauSimple entetes={["Code", "Nom", "Ville", "Statut", ""]}>
          {gares.length === 0 ? (
            <LigneVide colonnes={5} message="Aucune gare." />
          ) : (
            gares.map((g) => (
              <tr key={g.id}>
                <td className={clsCellule}><span className="font-mono font-semibold">{g.code}</span></td>
                <td className={clsCellule}>{g.nom}</td>
                <td className={clsCellule}>{g.ville}</td>
                <td className={clsCellule}>{g.actif ? <Badge variante="succes">Actif</Badge> : <Badge variante="neutre">Inactif</Badge>}</td>
                <td className={clsCellule}><BoutonSupprimer onClick={() => supprimer(g.id)} /></td>
              </tr>
            ))
          )}
        </TableauSimple>
      </Carte>
    </div>
  );
}

// ─── Section Lignes ──────────────────────────────────────────────────

function SectionLigne({
  lignes, optionsGares, rafraichir, supprimer,
}: {
  lignes: Ligne[];
  optionsGares: { valeur: string; libelle: string }[];
  rafraichir: () => void;
  supprimer: (id: string) => void;
}) {
  const { notifier } = useNotifications();
  const [f, setF] = useState({ depart: "", arrivee: "", distance: "", duree: "" });
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    try {
      await api.lignes.creer({
        gare_depart_id: f.depart,
        gare_arrivee_id: f.arrivee,
        distance_km: nombreOuNull(f.distance),
        duree_min: nombreOuNull(f.duree),
      });
      notifier("Ligne créée", "succes");
      setF({ depart: "", arrivee: "", distance: "", duree: "" });
      rafraichir();
    } catch (err) {
      notifier(err instanceof ErreurAPI ? err.message_utilisateur : "Erreur", "erreur");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Carte>
        <h2 className="font-semibold mb-3">Nouvelle ligne</h2>
        <form onSubmit={soumettre} className="space-y-3">
          <ChampSelect libelle="Gare de départ" value={f.depart} onChange={(v) => setF({ ...f, depart: v })} options={optionsGares} requis />
          <ChampSelect libelle="Gare d'arrivée" value={f.arrivee} onChange={(v) => setF({ ...f, arrivee: v })} options={optionsGares} requis />
          <ChampSimple libelle="Distance (km)" type="number" value={f.distance} onChange={(v) => setF({ ...f, distance: v })} />
          <ChampSimple libelle="Durée (min)" type="number" value={f.duree} onChange={(v) => setF({ ...f, duree: v })} />
          <Bouton type="submit" variante="primaire" chargement={enCours}>Créer</Bouton>
        </form>
      </Carte>
      <Carte>
        <h2 className="font-semibold mb-3">{lignes.length} ligne(s)</h2>
        <TableauSimple entetes={["Départ", "Arrivée", "Distance", "Durée", ""]}>
          {lignes.length === 0 ? (
            <LigneVide colonnes={5} message="Aucune ligne." />
          ) : (
            lignes.map((l) => (
              <tr key={l.id}>
                <td className={clsCellule}>{l.gare_depart_nom ?? l.gare_depart_id}</td>
                <td className={clsCellule}>{l.gare_arrivee_nom ?? l.gare_arrivee_id}</td>
                <td className={clsCellule}>{l.distance_km != null ? `${l.distance_km} km` : "—"}</td>
                <td className={clsCellule}>{l.duree_min != null ? `${l.duree_min} min` : "—"}</td>
                <td className={clsCellule}><BoutonSupprimer onClick={() => supprimer(l.id)} /></td>
              </tr>
            ))
          )}
        </TableauSimple>
      </Carte>
    </div>
  );
}

// ─── Section Véhicules ───────────────────────────────────────────────

function SectionVehicule({
  vehicules, optionsGares, rafraichir, supprimer,
}: {
  vehicules: Vehicule[];
  optionsGares: { valeur: string; libelle: string }[];
  rafraichir: () => void;
  supprimer: (id: string) => void;
}) {
  const { notifier } = useNotifications();
  const [f, setF] = useState({
    immatriculation: "", marque: "", capacite: "", gare_id: "", chauffeur_id: "",
  });
  const [enCours, setEnCours] = useState(false);
  const [affectationEnCours, setAffectationEnCours] = useState<string | null>(null);

  // Annuaire des chauffeurs : on désigne une **personne**, jamais un UUID.
  const [chauffeurs, setChauffeurs] = useState<ChauffeurDisponible[]>([]);
  const [rechercheChauffeur, setRechercheChauffeur] = useState("");
  const [chargementChauffeurs, setChargementChauffeurs] = useState(false);

  useEffect(() => {
    let annule = false;
    setChargementChauffeurs(true);
    (async () => {
      try {
        const elements = await api.chauffeurs.lister({
          recherche: rechercheChauffeur.trim() || undefined,
        });
        if (!annule) setChauffeurs(elements);
      } catch {
        if (!annule) setChauffeurs([]);
      } finally {
        if (!annule) setChargementChauffeurs(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [rechercheChauffeur]);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    try {
      await api.vehicules.creer({
        immatriculation: f.immatriculation,
        marque: f.marque || null,
        capacite: nombreOuNull(f.capacite),
        gare_id: f.gare_id || null,
        // Le car est confié d'emblée à son chauffeur : sans affectation, il
        // n'apparaîtrait dans « Mes cars » d'aucun chauffeur.
        chauffeur_id: f.chauffeur_id || null,
      });
      notifier("Véhicule créé", "succes");
      setF({ immatriculation: "", marque: "", capacite: "", gare_id: "", chauffeur_id: "" });
      rafraichir();
    } catch (err) {
      notifier(err instanceof ErreurAPI ? err.message_utilisateur : "Erreur", "erreur");
    } finally {
      setEnCours(false);
    }
  };

  /** Affecte (ou retire) le chauffeur d'un car déjà enregistré. */
  const affecter = async (vehicule: Vehicule, chauffeurId: string) => {
    setAffectationEnCours(vehicule.id);
    try {
      await api.vehicules.affecter(vehicule.id, chauffeurId || null);
      notifier(
        chauffeurId
          ? `Car ${vehicule.immatriculation} affecté`
          : `Car ${vehicule.immatriculation} retiré du chauffeur`,
        "succes",
      );
      rafraichir();
    } catch (err) {
      notifier(err instanceof ErreurAPI ? err.message_utilisateur : "Erreur", "erreur");
    } finally {
      setAffectationEnCours(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Carte>
        <h2 className="font-semibold mb-3">Nouveau véhicule</h2>
        <form onSubmit={soumettre} className="space-y-3">
          <ChampSimple libelle="Immatriculation" value={f.immatriculation} onChange={(v) => setF({ ...f, immatriculation: v })} requis placeholder="AB-1234-RB" />
          <ChampSimple libelle="Marque" value={f.marque} onChange={(v) => setF({ ...f, marque: v })} />
          <ChampSimple libelle="Capacité" type="number" value={f.capacite} onChange={(v) => setF({ ...f, capacite: v })} />
          <ChampSelect libelle="Gare" value={f.gare_id} onChange={(v) => setF({ ...f, gare_id: v })} options={optionsGares} placeholder="Aucune" />
          <ChampSimple
            libelle="Filtrer les chauffeurs"
            value={rechercheChauffeur}
            onChange={setRechercheChauffeur}
            placeholder="Nom, prénom ou numéro"
          />
          {chargementChauffeurs ? (
            <p className="text-xs italic text-ardoise-clair">Chargement des chauffeurs…</p>
          ) : (
            <ChampSelect
              libelle="Chauffeur"
              value={f.chauffeur_id}
              onChange={(v) => setF({ ...f, chauffeur_id: v })}
              options={chauffeurs.map((c) => ({
                valeur: c.utilisateur_id,
                libelle: `${c.nom_complet}${c.telephone ? ` — ${c.telephone}` : ""}`,
              }))}
              placeholder="Aucun (à affecter plus tard)"
            />
          )}
          <Bouton type="submit" variante="primaire" chargement={enCours}>Créer</Bouton>
        </form>
      </Carte>
      <Carte>
        <h2 className="font-semibold mb-3">{vehicules.length} véhicule(s)</h2>
        <TableauSimple entetes={["Immatriculation", "Marque", "Capacité", "Gare", "Chauffeur", ""]}>
          {vehicules.length === 0 ? (
            <LigneVide colonnes={6} message="Aucun véhicule." />
          ) : (
            vehicules.map((v) => (
              <tr key={v.id}>
                <td className={clsCellule}><span className="font-mono font-semibold">{v.immatriculation}</span></td>
                <td className={clsCellule}>{v.marque ?? "—"}</td>
                <td className={clsCellule}>{v.capacite ?? "—"}</td>
                <td className={clsCellule}>{v.gare_nom ?? "—"}</td>
                <td className={clsCellule}>
                  {/* Affectation directe : le car entre aussitôt dans « Mes cars » du chauffeur. */}
                  <select
                    className={clsInput}
                    value={v.chauffeur_id ?? ""}
                    disabled={affectationEnCours === v.id}
                    onChange={(e) => affecter(v, e.target.value)}
                  >
                    <option value="">— Non affecté —</option>
                    {/* Le chauffeur en place reste visible même hors du filtre en cours. */}
                    {v.chauffeur_nom &&
                      !chauffeurs.some((c) => c.utilisateur_id === v.chauffeur_id) && (
                        <option value={v.chauffeur_id ?? ""}>{v.chauffeur_nom}</option>
                      )}
                    {chauffeurs.map((c) => (
                      <option key={c.utilisateur_id} value={c.utilisateur_id}>
                        {c.nom_complet}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={clsCellule}><BoutonSupprimer onClick={() => supprimer(v.id)} /></td>
              </tr>
            ))
          )}
        </TableauSimple>
      </Carte>
    </div>
  );
}

// ─── Section Voyages ─────────────────────────────────────────────────

function SectionVoyage({
  voyages, lignes, vehicules, rafraichir, supprimer,
}: {
  voyages: Voyage[];
  lignes: Ligne[];
  vehicules: Vehicule[];
  rafraichir: () => void;
  supprimer: (id: string) => void;
}) {
  const { notifier } = useNotifications();
  const [f, setF] = useState({ ligne_id: "", vehicule_id: "", chauffeur_id: "", date_depart: "", statut: "planifie" });
  const [enCours, setEnCours] = useState(false);
  // Chauffeurs proposés à partir de la gare de départ de la ligne choisie.
  const [chauffeurs, setChauffeurs] = useState<ChauffeurDisponible[]>([]);
  const [rechercheChauffeur, setRechercheChauffeur] = useState("");
  const [chargementChauffeurs, setChargementChauffeurs] = useState(false);

  const gareDepartId =
    lignes.find((l) => l.id === f.ligne_id)?.gare_depart_id ?? null;

  useEffect(() => {
    let annule = false;
    setChargementChauffeurs(true);
    (async () => {
      try {
        const elements = await api.chauffeurs.lister({
          gare_depart_id: gareDepartId ?? undefined,
          recherche: rechercheChauffeur.trim() || undefined,
        });
        if (!annule) setChauffeurs(elements);
      } catch {
        if (!annule) setChauffeurs([]);
      } finally {
        if (!annule) setChargementChauffeurs(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [gareDepartId, rechercheChauffeur]);

  const chauffeurChoisi =
    chauffeurs.find((c) => c.utilisateur_id === f.chauffeur_id) ?? null;

  const optionsLignes = lignes.map((l) => ({
    valeur: l.id,
    libelle: `${l.gare_depart_nom ?? "?"} → ${l.gare_arrivee_nom ?? "?"}`,
  }));
  const optionsVehicules = vehicules.map((v) => ({ valeur: v.id, libelle: v.immatriculation }));

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    try {
      await api.voyages.creer({
        ligne_id: f.ligne_id,
        vehicule_id: f.vehicule_id,
        chauffeur_id: f.chauffeur_id.trim() || null,
        date_depart: new Date(f.date_depart).toISOString(),
        statut: f.statut,
      });
      notifier("Voyage créé", "succes");
      setF({ ligne_id: "", vehicule_id: "", chauffeur_id: "", date_depart: "", statut: "planifie" });
      rafraichir();
    } catch (err) {
      notifier(err instanceof ErreurAPI ? err.message_utilisateur : "Erreur", "erreur");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Carte>
        <h2 className="font-semibold mb-3">Nouveau voyage</h2>
        <form onSubmit={soumettre} className="space-y-3">
          <ChampSelect libelle="Ligne" value={f.ligne_id} onChange={(v) => setF({ ...f, ligne_id: v })} options={optionsLignes} requis />
          <ChampSelect libelle="Véhicule" value={f.vehicule_id} onChange={(v) => setF({ ...f, vehicule_id: v })} options={optionsVehicules} requis />
          {/* Annuaire des chauffeurs : on choisit une personne, pas un UUID. */}
          <ChampSimple
            libelle="Filtrer les chauffeurs"
            value={rechercheChauffeur}
            onChange={setRechercheChauffeur}
            placeholder="Nom, prénom ou numéro"
          />
          {chargementChauffeurs ? (
            <p className="text-xs italic text-ardoise-clair">Chargement des chauffeurs…</p>
          ) : (
            <ChampSelect
              libelle={gareDepartId ? "Chauffeur (gare de départ)" : "Chauffeur"}
              value={f.chauffeur_id}
              onChange={(v) => setF({ ...f, chauffeur_id: v })}
              options={chauffeurs.map((c) => ({
                valeur: c.utilisateur_id,
                libelle: `${c.nom_complet}${c.telephone ? ` — ${c.telephone}` : ""}`,
              }))}
              placeholder="Aucun chauffeur"
            />
          )}
          {chauffeurChoisi && (
            <div className="space-y-0.5 rounded-lg border border-ocre/25 bg-ocre/5 p-2 text-xs text-ardoise">
              <p className="font-semibold">{chauffeurChoisi.nom_complet}</p>
              <p>📞 {chauffeurChoisi.telephone ?? "Téléphone non renseigné"}</p>
              <p>
                {chauffeurChoisi.numero_licence
                  ? `Licence ${chauffeurChoisi.numero_licence}`
                  : "Licence non renseignée"}
                {chauffeurChoisi.gare_nom ? ` · ${chauffeurChoisi.gare_nom}` : ""}
              </p>
            </div>
          )}
          <ChampSimple libelle="Départ" type="datetime-local" value={f.date_depart} onChange={(v) => setF({ ...f, date_depart: v })} requis />
          <ChampSelect
            libelle="Statut"
            value={f.statut}
            onChange={(v) => setF({ ...f, statut: v })}
            placeholder="Planifié"
            options={[
              { valeur: "planifie", libelle: "Planifié" },
              { valeur: "en_cours", libelle: "En cours" },
              { valeur: "termine", libelle: "Terminé" },
              { valeur: "annule", libelle: "Annulé" },
            ]}
          />
          <Bouton type="submit" variante="primaire" chargement={enCours}>Créer</Bouton>
        </form>
      </Carte>
      <Carte>
        <h2 className="font-semibold mb-3">{voyages.length} voyage(s)</h2>
        <TableauSimple entetes={["Départ", "Trajet", "Véhicule", "Chauffeur", "Statut", ""]}>
          {voyages.length === 0 ? (
            <LigneVide colonnes={6} message="Aucun voyage." />
          ) : (
            voyages.map((v) => (
              <tr key={v.id}>
                <td className={clsCellule}>{new Date(v.date_depart).toLocaleString("fr-FR")}</td>
                <td className={clsCellule}>{v.ligne_libelle ?? v.ligne_id}</td>
                <td className={clsCellule}>{v.vehicule_immatriculation ?? v.vehicule_id}</td>
                <td className={clsCellule}>{v.chauffeur_nom ?? "—"}</td>
                <td className={clsCellule}><Badge variante="lagune">{v.statut}</Badge></td>
                <td className={clsCellule}><BoutonSupprimer onClick={() => supprimer(v.id)} /></td>
              </tr>
            ))
          )}
        </TableauSimple>
      </Carte>
    </div>
  );
}

// ─── Section Acteurs ─────────────────────────────────────────────────

function SectionActeur({
  acteurs, optionsGares, rafraichir, supprimer,
}: {
  acteurs: Acteur[];
  optionsGares: { valeur: string; libelle: string }[];
  rafraichir: () => void;
  supprimer: (id: string) => void;
}) {
  const { notifier } = useNotifications();
  const [f, setF] = useState({ utilisateur_id: "", role: "receveur", gare_id: "", numero_licence: "" });
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    try {
      await api.acteurs.creer({
        utilisateur_id: f.utilisateur_id,
        role: f.role,
        gare_id: f.gare_id,
        numero_licence: f.numero_licence || null,
      });
      notifier("Acteur créé", "succes");
      setF({ utilisateur_id: "", role: "receveur", gare_id: "", numero_licence: "" });
      rafraichir();
    } catch (err) {
      notifier(err instanceof ErreurAPI ? err.message_utilisateur : "Erreur", "erreur");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Carte>
        <h2 className="font-semibold mb-3">Nouvel acteur</h2>
        <form onSubmit={soumettre} className="space-y-3">
          {/* Le rôle d'abord : il détermine l'annuaire proposé juste en dessous. */}
          <ChampSelect
            libelle="Rôle"
            value={f.role}
            onChange={(v) => setF({ ...f, role: v, utilisateur_id: "" })}
            placeholder="Receveur"
            options={[
              { valeur: "receveur", libelle: "Receveur" },
              { valeur: "chauffeur", libelle: "Chauffeur" },
              { valeur: "gerant_gare", libelle: "Gérant de gare" },
              { valeur: "commercant", libelle: "Commerçant" },
            ]}
          />
          <SelecteurUtilisateur
            role={f.role}
            valeur={f.utilisateur_id}
            surChoix={(id) => setF({ ...f, utilisateur_id: id })}
          />
          <ChampSelect libelle="Gare" value={f.gare_id} onChange={(v) => setF({ ...f, gare_id: v })} options={optionsGares} requis />
          <ChampSimple libelle="N° licence" value={f.numero_licence} onChange={(v) => setF({ ...f, numero_licence: v })} placeholder="Optionnel" />
          <Bouton type="submit" variante="primaire" chargement={enCours} disabled={!f.utilisateur_id}>Créer</Bouton>
        </form>
      </Carte>
      <Carte>
        <h2 className="font-semibold mb-3">{acteurs.length} acteur(s)</h2>
        <TableauSimple entetes={["Utilisateur", "Téléphone", "Rôle", "Gare", "Licence", ""]}>
          {acteurs.length === 0 ? (
            <LigneVide colonnes={6} message="Aucun acteur." />
          ) : (
            acteurs.map((a) => (
              <tr key={a.id}>
                <td className={clsCellule}>
                  <span className="font-medium">
                    {a.utilisateur_prenom ?? ""}{" "}
                    {a.utilisateur_nom_famille ?? a.utilisateur_nom ?? a.utilisateur_id}
                  </span>
                </td>
                <td className={clsCellule}>{a.utilisateur_telephone ?? "—"}</td>
                <td className={clsCellule}><Badge variante="ocre">{a.role}</Badge></td>
                <td className={clsCellule}>{a.gare_nom ?? "—"}</td>
                <td className={clsCellule}>{a.numero_licence ?? "—"}</td>
                <td className={clsCellule}><BoutonSupprimer onClick={() => supprimer(a.id)} /></td>
              </tr>
            ))
          )}
        </TableauSimple>
      </Carte>
    </div>
  );
}
