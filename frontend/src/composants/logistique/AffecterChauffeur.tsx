"use client";
/**
 * « Qui va transporter ceci ? » — affectation d'un colis ou d'un passager à un car.
 *
 * Règle de terrain : on ne désigne **jamais** un chauffeur par un identifiant
 * technique. Trois façons, du plus rapide au plus sûr :
 *
 *   1. **Scanner sa carte DigiID** (QR) — le chauffeur présente sa carte ;
 *   2. **Saisir son code** — il le dicte, ou on colle l'URL du QR ;
 *   3. **Choisir dans la liste** des chauffeurs qui font ce trajet, avec une
 *      recherche par nom pour réduire la liste en la tapant.
 *
 * Dans tous les cas, on affiche **nom, prénom, numéro, licence et gare** avant de
 * valider : le guichet voit qui il engage.
 *
 * Le chauffeur peut être **changé** tant que l'enregistrement n'est pas parti
 * (statut `enregistre` / `planifie`) : dès le départ ou le transit, l'affectation
 * est figée (voir `attributionFigee`).
 */
import { useEffect, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeIdentite, IconeScan } from "@/composants/commun/Icones";
import { ErreurAPI } from "@/services/client_api";
import {
  attributionFigee,
  logistiqueAPI,
  type ChauffeurDisponible,
  type Voyage,
} from "@/services/logistique_api";
import { formaterDateHeure } from "./format";
import { LecteurQRCode } from "./LecteurQRCode";

type Methode = "liste" | "code" | "scan";

/** Un car n'est proposable que s'il peut encore embarquer quelque chose. */
const STATUTS_VOYAGE_UTILISABLES = new Set(["planifie", "en_cours"]);

/** Combien de chauffeurs on affiche d'un coup (la recherche affine ensuite). */
const MAX_CHAUFFEURS_AFFICHES = 12;

interface Proprietes {
  /** Trajet déclaré de l'enregistrement : filtre les chauffeurs et les cars. */
  gareDepartId: string;
  gareArriveeId: string;
  /** Ligne (trajet) de l'enregistrement, si connue : filtre les cars. */
  ligneId?: string | null;
  /** Voyage actuellement affecté (null = « à affecter »). */
  voyageIdActuel: string | null;
  /** Nom du chauffeur actuellement affecté, pour l'affichage. */
  chauffeurNomActuel?: string | null;
  /** Statut de l'enregistrement : décide si l'attribution est encore modifiable. */
  statut?: string | null;
  /** Appel API d'affectation (colis ou suivi familial). */
  surAffecter: (voyageId: string) => Promise<void>;
  /** Force la désactivation (en plus du statut). */
  desactive?: boolean;
  /** Message expliquant pourquoi c'est désactivé. */
  raisonDesactivation?: string;
}

export function AffecterChauffeur({
  gareDepartId,
  gareArriveeId,
  ligneId = null,
  voyageIdActuel,
  chauffeurNomActuel,
  statut = null,
  surAffecter,
  desactive = false,
  raisonDesactivation,
}: Proprietes) {
  const fige = desactive || attributionFigee(statut);

  const [methode, setMethode] = useState<Methode>("liste");
  const [recherche, setRecherche] = useState("");
  const [chauffeurs, setChauffeurs] = useState<ChauffeurDisponible[]>([]);
  const [chargementListe, setChargementListe] = useState(true);
  const [code, setCode] = useState("");
  const [chauffeur, setChauffeur] = useState<ChauffeurDisponible | null>(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [chargementVoyages, setChargementVoyages] = useState(false);
  const [choix, setChoix] = useState(voyageIdActuel ?? "");
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  /** Ligne déduite du trajet quand l'appelant ne la connaît pas. */
  const [ligneResolue, setLigneResolue] = useState<string | null>(ligneId ?? null);

  // ── Ligne du trajet : l'appelant ne l'a pas toujours (colis, suivi familial) ──
  useEffect(() => {
    if (ligneId) {
      setLigneResolue(ligneId);
      return;
    }
    if (fige) return;
    let annule = false;
    (async () => {
      try {
        const reponse = await logistiqueAPI.lignes.lister();
        const trouvee = reponse.elements.find(
          (l) =>
            l.gare_depart_id === gareDepartId &&
            l.gare_arrivee_id === gareArriveeId,
        );
        if (!annule) setLigneResolue(trouvee?.id ?? null);
      } catch {
        // Sans ligne résolue : on montre tous les cars du chauffeur.
      }
    })();
    return () => {
      annule = true;
    };
  }, [ligneId, gareDepartId, gareArriveeId, fige]);

  // ── Liste des chauffeurs du trajet (recherche côté serveur, débattue) ──
  useEffect(() => {
    if (fige) return;
    let annule = false;
    const minuteur = setTimeout(async () => {
      setChargementListe(true);
      try {
        const elements = await logistiqueAPI.chauffeurs.lister({
          gare_depart_id: gareDepartId,
          ligne_id: ligneResolue ?? undefined,
          recherche: recherche.trim() || undefined,
        });
        if (!annule) setChauffeurs(elements);
      } catch {
        if (!annule) {
          setErreur("Impossible de charger la liste des chauffeurs de ce trajet.");
        }
      } finally {
        if (!annule) setChargementListe(false);
      }
    }, recherche ? 300 : 0);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [gareDepartId, ligneResolue, recherche, fige]);

  // ── Les cars de CE chauffeur sur CE trajet ──
  useEffect(() => {
    if (!chauffeur || fige) {
      setVoyages([]);
      return;
    }
    let annule = false;
    setChargementVoyages(true);
    (async () => {
      try {
        // Fenêtre de 12 h en arrière : un car déjà parti (statut « en cours »)
        // reste proposable par le guichet.
        const depuis = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
        const reponse = await logistiqueAPI.voyages.lister({
          chauffeur_id: chauffeur.utilisateur_id,
          a_partir_de: depuis,
          par_page: 50,
        });
        if (annule) return;
        const utilisables = reponse.elements.filter(
          (voyage) =>
            STATUTS_VOYAGE_UTILISABLES.has(voyage.statut) &&
            (!ligneResolue || voyage.ligne_id === ligneResolue),
        );
        setVoyages(utilisables);
        // Un seul car sur ce trajet : on le sélectionne d'office (moins de gestes).
        if (utilisables.length === 1) setChoix(utilisables[0].id);
      } catch {
        if (!annule) setErreur("Impossible de charger les cars de ce chauffeur.");
      } finally {
        if (!annule) setChargementVoyages(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [chauffeur, ligneResolue, fige]);

  /** Retrouve un chauffeur par sa carte DigiID / son code (scan ou saisie). */
  async function chercherParCode(texte?: string) {
    const valeur = (texte ?? code).trim();
    if (!valeur) {
      setErreur("Scannez la carte du chauffeur ou saisissez son code.");
      return;
    }
    setRechercheEnCours(true);
    setErreur(null);
    setSucces(null);
    setChauffeur(null);
    try {
      const fiche = await logistiqueAPI.chauffeurs.parCode(valeur);
      setChauffeur(fiche);
      setCode(valeur);
      setChoix("");
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Aucun chauffeur enregistré pour ce code. Vérifiez la carte.",
      );
    } finally {
      setRechercheEnCours(false);
    }
  }

  function choisirChauffeur(fiche: ChauffeurDisponible) {
    setChauffeur(fiche);
    setChoix("");
    setErreur(null);
    setSucces(null);
  }

  async function affecter() {
    if (!choix) return;
    setErreur(null);
    setSucces(null);
    setEnregistrement(true);
    try {
      await surAffecter(choix);
      setSucces(
        chauffeur
          ? `Affecté à ${chauffeur.nom_complet}.`
          : "Affectation enregistrée.",
      );
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Échec de l'affectation. Réessayez.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  const chauffeursAffiches = chauffeurs.slice(0, MAX_CHAUFFEURS_AFFICHES);

  return (
    <Carte
      titre="Chauffeur & car"
      description="Scannez la carte du chauffeur, saisissez son code, ou choisissez-le dans la liste : le chauffeur affecté apparaît sur le ticket."
      variante={voyageIdActuel ? "standard" : "accent"}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ardoise-clair">Situation actuelle :</span>
          {voyageIdActuel ? (
            <Badge variante="succes">
              {chauffeurNomActuel ? `Chauffeur : ${chauffeurNomActuel}` : "Affecté"}
            </Badge>
          ) : (
            <Badge variante="ocre">À affecter — aucun car désigné</Badge>
          )}
          {!fige && voyageIdActuel && (
            <span className="text-xs text-ardoise-clair">
              Encore modifiable tant que le car n&apos;est pas parti.
            </span>
          )}
        </div>

        {erreur && (
          <Alerte variante="erreur" titre="Erreur">
            {erreur}
          </Alerte>
        )}
        {succes && (
          <Alerte variante="succes" titre="Affectation enregistrée">
            {succes}
          </Alerte>
        )}

        {fige ? (
          <p className="rounded-lg border border-dashed border-ardoise-clair/40 px-3 py-3 text-sm text-ardoise-clair">
            {raisonDesactivation ??
              "Le car est déjà parti (départ / transit enregistré) : le chauffeur ne peut plus être changé."}
          </p>
        ) : (
          <>
            {/* ── Méthode : scan, code ou liste ── */}
            <div className="flex flex-wrap gap-2">
              <Bouton
                type="button"
                variante={methode === "scan" ? "primaire" : "ghost"}
                taille="petit"
                onClick={() => setMethode("scan")}
              >
                <IconeScan className="w-4 h-4" /> Scanner sa carte
              </Bouton>
              <Bouton
                type="button"
                variante={methode === "code" ? "primaire" : "ghost"}
                taille="petit"
                onClick={() => setMethode("code")}
              >
                <IconeIdentite className="w-4 h-4" /> Saisir son code
              </Bouton>
              <Bouton
                type="button"
                variante={methode === "liste" ? "primaire" : "ghost"}
                taille="petit"
                onClick={() => setMethode("liste")}
              >
                Liste des chauffeurs du trajet
              </Bouton>
            </div>

            {methode === "scan" && (
              <LecteurQRCode
                id="lecteur-qr-chauffeur"
                surDecode={(texte) => void chercherParCode(texte)}
                libelleBouton="Ouvrir la caméra et scanner la carte"
              />
            )}

            {methode === "code" && (
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1">
                  <ChampSaisie
                    libelle="DigiID / code du QR de la carte du chauffeur"
                    value={code}
                    placeholder="Ex. A1B2C3D4E5F6 ou https://…/identite/carte?token=…"
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void chercherParCode();
                      }
                    }}
                  />
                </div>
                <Bouton
                  type="button"
                  variante="primaire"
                  chargement={rechercheEnCours}
                  disabled={rechercheEnCours || !code.trim()}
                  onClick={() => void chercherParCode()}
                >
                  Retrouver le chauffeur
                </Bouton>
              </div>
            )}

            {methode === "liste" && (
              <div className="space-y-3">
                <ChampSaisie
                  libelle="Rechercher un chauffeur (nom, prénom, numéro)"
                  value={recherche}
                  placeholder="Ex. Amadou"
                  onChange={(e) => setRecherche(e.target.value)}
                />
                {chargementListe ? (
                  <p className="text-sm italic text-ardoise-clair">
                    Chargement des chauffeurs de ce trajet…
                  </p>
                ) : chauffeurs.length === 0 ? (
                  <p className="text-sm text-ardoise-clair">
                    Aucun chauffeur trouvé pour ce trajet. Un chauffeur doit avoir une
                    fiche « acteur » (rattaché à une gare ou avec un voyage sur cette
                    ligne) : demandez au super-admin de l&apos;enregistrer.
                  </p>
                ) : (
                  <ul className="divide-y divide-ardoise-clair/10 rounded-xl border border-ardoise-clair/20">
                    {chauffeursAffiches.map((fiche) => (
                      <li key={fiche.utilisateur_id}>
                        <button
                          type="button"
                          onClick={() => choisirChauffeur(fiche)}
                          className={`w-full text-left px-3 py-2.5 hover:bg-lagune/5 transition-colors ${
                            chauffeur?.utilisateur_id === fiche.utilisateur_id
                              ? "bg-lagune/10"
                              : ""
                          }`}
                        >
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-ardoise">
                              {fiche.nom_complet}
                            </span>
                            {fiche.fait_le_trajet && (
                              <Badge variante="lagune">fait ce trajet</Badge>
                            )}
                          </span>
                          <span className="block text-xs text-ardoise-clair">
                            {fiche.telephone
                              ? `📞 ${fiche.telephone}`
                              : "Téléphone non renseigné"}
                            {fiche.gare_nom ? ` · ${fiche.gare_nom}` : ""}
                            {fiche.numero_licence
                              ? ` · Licence ${fiche.numero_licence}`
                              : ""}
                          </span>
                          {fiche.prochain_depart_le && (
                            <span className="block text-xs text-ardoise-clair">
                              Prochain départ :{" "}
                              {formaterDateHeure(fiche.prochain_depart_le)}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {chauffeurs.length > MAX_CHAUFFEURS_AFFICHES && (
                  <p className="text-xs text-ardoise-clair">
                    {chauffeurs.length - MAX_CHAUFFEURS_AFFICHES} autre(s) chauffeur(s) —
                    affinez avec la recherche.
                  </p>
                )}
              </div>
            )}

            {/* ── Fiche du chauffeur retenu : on vérifie AVANT de valider ── */}
            {chauffeur && (
              <div className="rounded-xl border border-lagune/25 bg-lagune/5 p-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ardoise">{chauffeur.nom_complet}</p>
                  {chauffeur.digiid_public && (
                    <Badge variante="lagune">{chauffeur.digiid_public}</Badge>
                  )}
                  {chauffeur.fait_le_trajet && (
                    <Badge variante="neutre">fait ce trajet</Badge>
                  )}
                </div>
                <p className="text-sm text-ardoise-clair">
                  {chauffeur.prenom
                    ? `Prénom : ${chauffeur.prenom}`
                    : "Prénom non renseigné"}
                  {chauffeur.nom_famille ? ` · Nom : ${chauffeur.nom_famille}` : ""}
                </p>
                <p className="text-sm text-ardoise-clair">
                  {chauffeur.telephone
                    ? `📞 ${chauffeur.telephone}`
                    : "Téléphone non renseigné"}
                  {chauffeur.gare_nom ? ` · Gare : ${chauffeur.gare_nom}` : ""}
                  {chauffeur.numero_licence
                    ? ` · Licence ${chauffeur.numero_licence}`
                    : ""}
                </p>
              </div>
            )}

            {/* ── Le car : le voyage du chauffeur sur ce trajet ── */}
            {chauffeur && (
              <div className="space-y-3 border-t border-ardoise-clair/20 pt-3">
                {chargementVoyages ? (
                  <p className="text-sm italic text-ardoise-clair">
                    Chargement des cars de {chauffeur.nom_complet}…
                  </p>
                ) : voyages.length === 0 ? (
                  <Alerte variante="avertissement" titre="Aucun car sur ce trajet">
                    {chauffeur.nom_complet} n&apos;a pas de voyage planifié sur ce
                    trajet. Demandez au gérant de gare (ou au chauffeur lui-même) de
                    créer le voyage, puis revenez affecter.
                  </Alerte>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-ardoise">
                      Car de {chauffeur.nom_complet} sur ce trajet
                    </label>
                    <select
                      className="champ-saisie"
                      value={choix}
                      onChange={(e) => {
                        setChoix(e.target.value);
                        setSucces(null);
                      }}
                    >
                      <option value="">Sélectionner un car…</option>
                      {voyages.map((voyage) => (
                        <option key={voyage.id} value={voyage.id}>
                          {[
                            voyage.vehicule_immatriculation ?? "Car",
                            voyage.ligne_libelle,
                            formaterDateHeure(voyage.date_depart),
                          ]
                            .filter(Boolean)
                            .join(" — ")}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-ardoise-clair">
                    L&apos;affectation est tracée dans le suivi (qui a affecté, quand).
                  </p>
                  <Bouton
                    variante="primaire"
                    chargement={enregistrement}
                    disabled={enregistrement || !choix || choix === voyageIdActuel}
                    onClick={() => void affecter()}
                  >
                    {voyageIdActuel ? "Changer de chauffeur" : "Affecter"}
                  </Bouton>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Carte>
  );
}
