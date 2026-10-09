/**
 * Service API du domaine logistique.
 *  - S1 : référentiel (gares, lignes, véhicules, voyages, acteurs)
 *  - S2/S3 : colis de bout en bout (enregistrement, lecture, timeline, scan)
 */
import { clientAPI } from "@/services/client_api";
import type {
  Colis, ColisEnregistre, ColisEvenement, DonneesColis, DonneesScan, ResultatScan,
  SuiviFamilial, SuiviFamilialEnregistre, SuiviFamilialEvenement,
  DonneesSuiviFamilial, DonneesEvenementSuivi, ResultatEvenementSuivi,
  NotificationLogistique, SuiviPublic, Bagage,
  DonneesActionLot, ResultatActionLot, DonneesPreAlerte, ResultatPreAlerte,
} from "@/types/logistique";

export type {
  Colis, ColisEnregistre, ColisEvenement, DonneesColis, DonneesScan, ResultatScan,
  SuiviFamilial, SuiviFamilialEnregistre, SuiviFamilialEvenement,
  DonneesSuiviFamilial, DonneesEvenementSuivi, ResultatEvenementSuivi,
  NotificationLogistique, SuiviPublic, Bagage,
  DonneesActionLot, ResultatActionLot, DonneesPreAlerte, ResultatPreAlerte,
} from "@/types/logistique";

export interface ReponseListe<T> {
  elements: T[];
  total: number;
  page: number;
  par_page: number;
}

export interface Gare {
  id: string;
  nom: string;
  code: string;
  ville: string;
  domain_id: string | null;
  actif: boolean;
  cree_le: string;
}

export interface Ligne {
  id: string;
  gare_depart_id: string;
  gare_arrivee_id: string;
  distance_km: number | null;
  duree_min: number | null;
  actif: boolean;
  gare_depart_nom: string | null;
  gare_arrivee_nom: string | null;
  cree_le: string;
}

export interface Vehicule {
  id: string;
  immatriculation: string;
  marque: string | null;
  capacite: number | null;
  gare_id: string | null;
  gare_nom: string | null;
  /** Chauffeur à qui le car est affecté (null = car non affecté). */
  chauffeur_id: string | null;
  /** Nom lisible du chauffeur affecté — le guichet voit qui conduit le car. */
  chauffeur_nom: string | null;
  actif: boolean;
  cree_le: string;
}

export interface Voyage {
  id: string;
  ligne_id: string;
  vehicule_id: string;
  chauffeur_id: string | null;
  date_depart: string;
  date_arrivee: string | null;
  statut: string;
  vehicule_immatriculation: string | null;
  chauffeur_nom: string | null;
  /** Trajet lisible renvoyé par l'API : « Cotonou → Parakou ». */
  ligne_libelle: string | null;
  gare_depart_id: string | null;
  gare_arrivee_id: string | null;
  cree_le: string;
}

/**
 * Chauffeur proposé à l'attribution — on le **reconnaît**, on ne le tape pas.
 *
 * Reflète `ChauffeurDisponible` côté backend : fiche complète (nom, prénom,
 * téléphone, licence, gare) pour vérifier **qui** on désigne avant de valider.
 */
export interface ChauffeurDisponible {
  utilisateur_id: string;
  nom_complet: string;
  prenom: string | null;
  nom_famille: string | null;
  telephone: string | null;
  digiid_public: string | null;
  numero_licence: string | null;
  gare_id: string | null;
  gare_nom: string | null;
  /** Rattaché à la gare de départ, ou a déjà un voyage sur cette ligne. */
  fait_le_trajet: boolean;
  prochain_depart_le: string | null;
}

/** Horaire public d'un voyage (page citoyens) — aucune donnée sensible. */
export interface VoyagePublic {
  voyage_id: string;
  trajet: string;
  gare_depart: string | null;
  gare_arrivee: string | null;
  date_depart: string;
  vehicule: string | null;
  chauffeur_apercu: string | null;
  statut: string;
  capacite: number | null;
}

export interface Acteur {
  id: string;
  utilisateur_id: string;
  role: string;
  gare_id: string;
  numero_licence: string | null;
  actif: boolean;
  utilisateur_nom: string | null;
  gare_nom: string | null;
  // Fiche utilisateur déchiffrée (le super-admin voit qui il désigne).
  utilisateur_prenom: string | null;
  utilisateur_nom_famille: string | null;
  utilisateur_telephone: string | null;
  utilisateur_digiid_public: string | null;
  cree_le: string;
}

const BASE = "/api/v1/logistique";
const opts = { authentifie: true } as const;

export const logistiqueAPI = {
  gares: {
    lister: () => clientAPI.get<ReponseListe<Gare>>(`${BASE}/gares?par_page=100`, opts),
    creer: (d: Record<string, unknown>) => clientAPI.post<Gare>(`${BASE}/gares`, d, opts),
    supprimer: (id: string) => clientAPI.delete(`${BASE}/gares/${id}`, opts),
  },
  lignes: {
    lister: () => clientAPI.get<ReponseListe<Ligne>>(`${BASE}/lignes?par_page=100`, opts),
    creer: (d: Record<string, unknown>) => clientAPI.post<Ligne>(`${BASE}/lignes`, d, opts),
    /**
     * Modifie une ligne (trajet) — le chauffeur ajuste ses dessertes.
     *
     * Permission `logistique.planifier` (chauffeur) ou `logistique.ecrire`
     * (gérant de gare, super-admin).
     */
    modifier: (id: string, d: Record<string, unknown>) =>
      clientAPI.patch<Ligne>(`${BASE}/lignes/${id}`, d, opts),
    supprimer: (id: string) => clientAPI.delete(`${BASE}/lignes/${id}`, opts),
  },
  vehicules: {
    lister: () => clientAPI.get<ReponseListe<Vehicule>>(`${BASE}/vehicules?par_page=100`, opts),
    /**
     * Les cars **que je peux conduire** — la question du chauffeur.
     *
     * Le serveur ne renvoie que les cars affectés au compte connecté et celui
     * dont il a déclaré la plaque dans son dossier professionnel. Les autres
     * rôles (guichet, super-admin) reçoivent la liste complète : ce sont eux
     * qui affectent, ils doivent pouvoir chercher n'importe quel car.
     */
    listerMesVehicules: () =>
      clientAPI.get<Vehicule[]>(`${BASE}/vehicules/mes-vehicules`, opts),
    creer: (d: Record<string, unknown>) => clientAPI.post<Vehicule>(`${BASE}/vehicules`, d, opts),
    /** Modifie un car (plaque, marque, capacité, mise hors service). */
    modifier: (id: string, d: Record<string, unknown>) =>
      clientAPI.patch<Vehicule>(`${BASE}/vehicules/${id}`, d, opts),
    supprimer: (id: string) => clientAPI.delete(`${BASE}/vehicules/${id}`, opts),
    /**
     * Affecte un car à un chauffeur — ou l'en retire (`chauffeurId = null`).
     *
     * Permission `logistique.vehicule.affecter` : ouverte au gérant de gare et
     * au receveur, pour enregistrer un car qui se présente sans attendre le
     * super-admin. Le geste est tracé dans le journal d'audit.
     */
    affecter: (id: string, chauffeurId: string | null) =>
      clientAPI.post<Vehicule>(
        `${BASE}/vehicules/${id}/affectation`,
        { chauffeur_id: chauffeurId },
        opts,
      ),
  },
  voyages: {
    lister: (filtres?: {
      statut?: string;
      /** Cars d'un chauffeur donné (« mes voyages »). */
      chauffeur_id?: string;
      /** Cars d'une ligne (trajet) donnée. */
      ligne_id?: string;
      /** Uniquement les départs à venir (tri chronologique). */
      a_partir_de?: string;
      page?: number;
      par_page?: number;
    }) => {
      const qs = new URLSearchParams();
      qs.set("par_page", String(filtres?.par_page ?? 100));
      if (filtres?.page) qs.set("page", String(filtres.page));
      if (filtres?.statut) qs.set("statut", filtres.statut);
      if (filtres?.chauffeur_id) qs.set("chauffeur_id", filtres.chauffeur_id);
      if (filtres?.ligne_id) qs.set("ligne_id", filtres.ligne_id);
      if (filtres?.a_partir_de) qs.set("a_partir_de", filtres.a_partir_de);
      return clientAPI.get<ReponseListe<Voyage>>(`${BASE}/voyages?${qs.toString()}`, opts);
    },
    obtenir: (id: string) => clientAPI.get<Voyage>(`${BASE}/voyages/${id}`, opts),
    creer: (d: Record<string, unknown>) => clientAPI.post<Voyage>(`${BASE}/voyages`, d, opts),
    /**
     * Modifie un voyage : horaire/date d'arrivée, car, ou statut.
     *
     * Sert au chauffeur pour **ajuster** (`date_depart`) ou **annuler**
     * (`statut: "annule"`) un départ qu'il a planifié.
     */
    modifier: (id: string, d: Record<string, unknown>) =>
      clientAPI.patch<Voyage>(`${BASE}/voyages/${id}`, d, opts),
    supprimer: (id: string) => clientAPI.delete(`${BASE}/voyages/${id}`, opts),

    // ── Actions groupées du chauffeur (passagers ET colis) ──
    /** « Valider le Départ » : tous les passagers + colis en 1 clic. */
    validerDepart: (id: string, d?: DonneesActionLot) =>
      clientAPI.post<ResultatActionLot>(`${BASE}/voyages/${id}/depart`, d ?? {}, opts),
    /** « Arrivés » en lot (passagers + colis d'une même gare). */
    marquerArrivee: (id: string, d?: DonneesActionLot) =>
      clientAPI.post<ResultatActionLot>(`${BASE}/voyages/${id}/arrivee`, d ?? {}, opts),
    /** « Prévenir de l'approche » : SMS pré-alerte (passagers, proches, destinataires). */
    preAlerte: (id: string, d?: DonneesPreAlerte) =>
      clientAPI.post<ResultatPreAlerte>(`${BASE}/voyages/${id}/pre-alerte`, d ?? {}, opts),

    // ── Le chauffeur choisit ses voyages (flexibilité multi-lignes) ──
    /**
     * Se désigner comme chauffeur d'un voyage **planifié** encore libre.
     *
     * Répond au terrain : un chauffeur indépendant travaille sur plusieurs
     * lignes ; il prend un départ sans passer par le gérant de gare. Refusé si
     * un autre chauffeur est déjà engagé ou si le car est déjà parti.
     */
    rejoindre: (id: string) =>
      clientAPI.post<Voyage>(`${BASE}/voyages/${id}/chauffeur`, {}, opts),
    /** Se retirer d'un voyage **avant** le départ (libère le car). */
    quitter: (id: string) =>
      clientAPI.delete<Voyage>(`${BASE}/voyages/${id}/chauffeur`, opts),
  },
  acteurs: {
    lister: () => clientAPI.get<ReponseListe<Acteur>>(`${BASE}/acteurs?par_page=100`, opts),
    creer: (d: Record<string, unknown>) => clientAPI.post<Acteur>(`${BASE}/acteurs`, d, opts),
    supprimer: (id: string) => clientAPI.delete(`${BASE}/acteurs/${id}`, opts),
  },

  // ─── Chauffeurs : attribution sans identifiant technique ────────────
  // Le receveur scanne la carte du chauffeur, saisit son code, ou le choisit
  // dans la liste des chauffeurs qui font ce trajet (recherche par nom).
  chauffeurs: {
    lister: (filtres?: {
      gare_depart_id?: string;
      ligne_id?: string;
      utilisateur_id?: string;
      /** Nom, prénom, téléphone ou licence. */
      recherche?: string;
    }) => {
      const qs = new URLSearchParams();
      if (filtres?.gare_depart_id) qs.set("gare_depart_id", filtres.gare_depart_id);
      if (filtres?.ligne_id) qs.set("ligne_id", filtres.ligne_id);
      if (filtres?.utilisateur_id) qs.set("utilisateur_id", filtres.utilisateur_id);
      if (filtres?.recherche) qs.set("recherche", filtres.recherche);
      const suffixe = qs.toString();
      return clientAPI.get<ChauffeurDisponible[]>(
        `${BASE}/chauffeurs${suffixe ? `?${suffixe}` : ""}`,
        opts,
      );
    },
    /** Retrouve un chauffeur en scannant sa carte DigiID (ou en saisissant son code). */
    parCode: (code: string) =>
      clientAPI.get<ChauffeurDisponible>(
        `${BASE}/chauffeurs/par-code?code=${encodeURIComponent(code)}`,
        opts,
      ),
  },

  // ─── Horaires publics (page citoyens, sans connexion) ──────────────
  horaires: {
    /** Les cars qui partent : trajet, heure, véhicule, chauffeur (aperçu). */
    prochains: (filtres?: {
      gare_depart_id?: string;
      gare_arrivee_id?: string;
      limite?: number;
    }) => {
      const qs = new URLSearchParams();
      if (filtres?.gare_depart_id) qs.set("gare_depart_id", filtres.gare_depart_id);
      if (filtres?.gare_arrivee_id) qs.set("gare_arrivee_id", filtres.gare_arrivee_id);
      if (filtres?.limite) qs.set("limite", String(filtres.limite));
      const suffixe = qs.toString();
      return clientAPI.get<VoyagePublic[]>(
        `${BASE}/public/horaires${suffixe ? `?${suffixe}` : ""}`,
      );
    },
  },

  // ─── Colis (guichet receveur) ───────────────────────────────────────
  colis: {
    /** Enregistre un colis : génère le ticket (QR + numéro en clair). */
    creer: (d: DonneesColis) =>
      clientAPI.post<ColisEnregistre>(`${BASE}/colis`, d, opts),

    /** Liste paginée des colis, avec filtres (statut, gare, voyage). */
    lister: (filtres?: {
      statut?: string;
      gare_id?: string;
      voyage_id?: string;
      page?: number;
      par_page?: number;
    }) => {
      const qs = new URLSearchParams();
      qs.set("par_page", String(filtres?.par_page ?? 100));
      qs.set("page", String(filtres?.page ?? 1));
      if (filtres?.statut) qs.set("statut", filtres.statut);
      if (filtres?.gare_id) qs.set("gare_id", filtres.gare_id);
      if (filtres?.voyage_id) qs.set("voyage_id", filtres.voyage_id);
      return clientAPI.get<ReponseListe<Colis>>(`${BASE}/colis?${qs.toString()}`, opts);
    },

    /** Retrouve un colis par code clair (ou token QR). */
    parCode: (code: string) =>
      clientAPI.get<Colis>(`${BASE}/colis/${encodeURIComponent(code)}`, opts),

    /** Timeline (événements) d'un colis. */
    evenements: (colisId: string) =>
      clientAPI.get<ColisEvenement[]>(`${BASE}/colis/${colisId}/evenements`, opts),

    /**
     * Affecte (ou réaffecte) le colis à un voyage — le chauffeur en découle.
     *
     * Répond au terrain : au guichet on enregistre souvent le colis **avant**
     * de savoir quel car partira. On revient ensuite désigner le voyage.
     */
    affecter: (colisId: string, donnees: { voyage_id: string; chauffeur_id?: string }) =>
      clientAPI.post<Colis>(`${BASE}/colis/${colisId}/affectation`, donnees, opts),
  },

  // ─── Suivi familial (enfants voyageant seuls — S7) ────────────────
  suiviFamilial: {
    /** Enregistre un enfant suivi : ticket ``ENFANT`` + SMS au parent. */
    creer: (d: DonneesSuiviFamilial) =>
      clientAPI.post<SuiviFamilialEnregistre>(`${BASE}/suivi-familial`, d, opts),

    /** Liste paginée des enfants suivis. */
    lister: (filtres?: {
      statut?: string;
      voyage_id?: string;
      recherche?: string;
      page?: number;
      par_page?: number;
    }) => {
      const qs = new URLSearchParams();
      qs.set("par_page", String(filtres?.par_page ?? 100));
      qs.set("page", String(filtres?.page ?? 1));
      if (filtres?.statut) qs.set("statut", filtres.statut);
      if (filtres?.voyage_id) qs.set("voyage_id", filtres.voyage_id);
      if (filtres?.recherche) qs.set("recherche", filtres.recherche);
      return clientAPI.get<ReponseListe<SuiviFamilial>>(
        `${BASE}/suivi-familial?${qs.toString()}`,
        opts,
      );
    },

    /** Détail d'un suivi (nom de la gare, agent, ticket). */
    obtenir: (id: string) =>
      clientAPI.get<SuiviFamilial>(`${BASE}/suivi-familial/${id}`, opts),

    /** Marque une étape (départ / arrivée) et déclenche le SMS au parent. */
    enregistrerEvenement: (id: string, d: DonneesEvenementSuivi) =>
      clientAPI.post<ResultatEvenementSuivi>(
        `${BASE}/suivi-familial/${id}/evenement`,
        d,
        opts,
      ),

    /** Timeline d'un suivi familial. */
    evenements: (id: string) =>
      clientAPI.get<SuiviFamilialEvenement[]>(
        `${BASE}/suivi-familial/${id}/evenements`,
        opts,
      ),

    /** SMS émis pour un suivi familial (départ / arrivée). */
    notifications: (id: string) =>
      clientAPI.get<NotificationLogistique[]>(
        `${BASE}/suivi-familial/${id}/notifications`,
        opts,
      ),

    /** Affecte (ou réaffecte) le passager à un voyage — le chauffeur en découle. */
    affecter: (id: string, donnees: { voyage_id: string; chauffeur_id?: string }) =>
      clientAPI.post<SuiviFamilial>(
        `${BASE}/suivi-familial/${id}/affectation`,
        donnees,
        opts,
      ),
  },

  // ─── Scans (départ / transit / arrivée / livraison) ────────────────
  scans: {
    scanner: (d: DonneesScan) =>
      clientAPI.post<ResultatScan>(`${BASE}/scans`, d, opts),
  },

  // ─── Suivi public (sans connexion — page famille) ─────────────────
  suiviPublic: {
    /** Suivi d'un colis **ou** d'un enfant depuis son code (QR ou clair). */
    parCode: (code: string) =>
      clientAPI.get<SuiviPublic>(
        `${BASE}/public/suivi/${encodeURIComponent(code)}`,
      ),
  },
};

/**
 * Retrouve la gare de rattachement d'un agent logistique (acteur).
 *
 * Utilisé par le guichet pour pré-remplir la gare de départ (receveur)
 * et le contexte de scan (chauffeur/receveur). Renvoie `null` si l'agent
 * n'a pas encore de fiche acteur (le formulaire reste alors manuel).
 */
export async function gareDeLActeur(
  utilisateurId: string,
): Promise<Gare | null> {
  try {
    const [acteurs, gares] = await Promise.all([
      logistiqueAPI.acteurs.lister(),
      logistiqueAPI.gares.lister(),
    ]);
    const acteur = acteurs.elements.find((a) => a.utilisateur_id === utilisateurId);
    if (!acteur) return null;
    return gares.elements.find((g) => g.id === acteur.gare_id) ?? null;
  } catch {
    // Un agent sans permission de lecture du référentiel ne doit pas bloquer le guichet.
    return null;
  }
}

/**
 * Libellé lisible d'une ligne : « Gare départ → Gare arrivée » (S4).
 *
 * Le backend renvoie les noms de gares enrichis (`gare_depart_nom`,
 * `gare_arrivee_nom`) ; on retombe sur un libellé neutre si absents.
 */
export function libelleLigne(ligne: Ligne | null | undefined): string {
  if (!ligne) return "Trajet inconnu";
  return `${ligne.gare_depart_nom ?? "?"} → ${ligne.gare_arrivee_nom ?? "?"}`;
}

/**
 * Retrouve les voyages affectés à un chauffeur (S4).
 *
 * L'API de liste ne filtre pas par chauffeur : on filtre côté client sur
 * `chauffeur_id` (identifiant utilisateur du chauffeur).
 */
export async function voyagesDuChauffeur(
  utilisateurId: string,
): Promise<Voyage[]> {
  const reponse = await logistiqueAPI.voyages.lister({
    chauffeur_id: utilisateurId,
    par_page: 100,
  });
  return reponse.elements;
}

/**
 * Départs à venir, **tous chauffeurs confondus** — la vue du guichet.
 *
 * Quand un chauffeur indépendant planifie son voyage, le receveur et le gérant
 * de gare doivent le voir : c'est ainsi qu'ils lui trouvent de la clientèle et
 * des colis (ils enregistrent, puis affectent au car du chauffeur). On tolère
 * deux heures de retard sur le départ pour qu'un car en route reste affiché.
 */
export async function departsAVenir(): Promise<Voyage[]> {
  const depuis = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const reponse = await logistiqueAPI.voyages.lister({
    a_partir_de: depuis,
    par_page: 100,
  });
  return reponse.elements
    .filter((v) => v.statut === "planifie" || v.statut === "en_cours")
    .sort(
      (a, b) =>
        new Date(a.date_depart).getTime() - new Date(b.date_depart).getTime(),
    );
}

/**
 * Statuts à partir desquels un enregistrement ne peut plus être réaffecté.
 *
 * Règle terrain : « on peut changer de chauffeur **tant que** le colis n'est pas
 * parti ». Dès le départ (transit / en route) ou à l'arrivée, le chauffeur est
 * engagé : le changer fausserait le suivi et les SMS déjà envoyés.
 */
const STATUTS_ATTRIBUTION_FIGEE = new Set([
  "en_transit",
  "en_route",
  "arrive",
  "livre",
  "annule",
]);

export function attributionFigee(statut: string | null | undefined): boolean {
  if (!statut) return false;
  return STATUTS_ATTRIBUTION_FIGEE.has(statut);
}
