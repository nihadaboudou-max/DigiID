"use client";
/**
 * Assistant d'enregistrement d'un colis — guichet receveur (S3).
 *
 * Parcours en 4 étapes pensé pour un agent peu à l'aise avec l'informatique :
 *   1. Expéditeur (qui dépose le colis ?)
 *   2. Destinataire (qui reçoit ? d'où vers où ?)
 *   3. Détails (nombre d'articles, poids, description…)
 *   4. Récapitulatif → enregistrement (net) → impression du ticket
 *
 * ⚠️ Le **prix du transport** est facultatif et n'est pas encaissé par DigiID :
 * il ne sert qu'à l'information du guichet (on ne veut pas donner l'impression
 * de surveiller les recettes du transporteur). Les **frais de service DigiID**
 * dépendent du **nombre d'articles** (100 / 200 / 350 / 500 FCFA) et sont
 * encaissés **à la fin de l'inscription**, avant génération du QR.
 *
 * À l'enregistrement, le backend encaisse puis génère le ticket (QR durable).
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeCheck, IconeColis, IconeTicket } from "@/composants/commun/Icones";
import { BoutonVocal } from "@/composants/accessibilite/BoutonVocal";
import { useLangue, useVoix } from "@/i18n/useLangue";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI, estErreurReseau } from "@/services/client_api";
import { mettreEnFile } from "@/services/offline/file_colis";
import { chargerAvecCache } from "@/services/offline/ref_cache";
import {
  MESSAGE_TELEPHONE_INVALIDE,
  formaterTelephone,
  normaliserTelephone,
} from "@/services/telephone";
import {
  gareDeLActeur,
  logistiqueAPI,
  type ArretLigne,
  type ColisEnregistre,
  type Gare,
  type Ligne,
  type Voyage,
} from "@/services/logistique_api";
import { ControleurBagages } from "./ControleurBagages";
import { formaterFcfa } from "./format";
import { RechercheCarteDigiID } from "./RechercheCarteDigiID";
import { SelectionVoyage, libelleVoyage } from "./SelectionVoyage";
import { TicketImprimable } from "./TicketImprimable";
import {
  fraisServicePourArticles,
  LIBELLES_MOYEN,
  type MoyenPaiement,
} from "@/types/paiement";

type Etape = 1 | 2 | 3 | 4;

const ETAPES: { numero: Etape; cleTitre: string }[] = [
  { numero: 1, cleTitre: "colis.etape.expediteur" },
  { numero: 2, cleTitre: "colis.etape.destinataire" },
  { numero: 3, cleTitre: "colis.etape.details" },
  { numero: 4, cleTitre: "colis.etape.recap" },
];

/**
 * Ce que le guide vocal dit à chaque étape (clés de traduction = phrases
 * parlables). L'agent du guichet travaille les mains occupées : il doit
 * pouvoir être guidé sans lire l'écran.
 */
const VOCAL_ETAPE: Record<Etape, string> = {
  1: "colis.vocal.expediteur",
  2: "colis.vocal.destinataire",
  3: "colis.vocal.details",
  4: "colis.vocal.recap",
};

export function EnregistrementColis({
  digiidInitial,
  voyageImposeId,
  chauffeurImposeId,
  attributionFacultative = false,
  enregistrementDirect = false,
}: {
  /** DigiID / lien de QR du client, quand l'agent arrive depuis /guichet/carte. */
  digiidInitial?: string;
  /** Voyage imposé (espace chauffeur : le colis part dans SON car). */
  voyageImposeId?: string;
  /** Chauffeur imposé : celui qui enregistre en route est le conducteur. */
  chauffeurImposeId?: string;
  /** Guichet : autorise « je ne sais pas encore quel car partira ». */
  attributionFacultative?: boolean;
  /**
   * Enregistrement **en route par le chauffeur** : le backend inscrit le mode
   * « chauffeur_direct » et le statut « enregistré en route » (traçabilité).
   */
  enregistrementDirect?: boolean;
} = {}) {
  const { utilisateur } = useAuthentification();
  const { t } = useLangue();
  const { guide, lireTexte } = useVoix();

  // Référentiel
  const [gares, setGares] = useState<Gare[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargementRef, setChargementRef] = useState(true);
  const [gareGuichet, setGareGuichet] = useState<Gare | null>(null);

  // Formulaire
  const [etape, setEtape] = useState<Etape>(1);
  const [expediteurNom, setExpediteurNom] = useState("");
  const [expediteurTel, setExpediteurTel] = useState("");
  const [destinataireNom, setDestinataireNom] = useState("");
  const [destinataireTel, setDestinataireTel] = useState("");
  const [gareDepartId, setGareDepartId] = useState("");
  const [gareArriveeId, setGareArriveeId] = useState("");
  const [description, setDescription] = useState("");
  const [poidsKg, setPoidsKg] = useState("");
  const [valeurFcfa, setValeurFcfa] = useState("");
  const [nombreArticles, setNombreArticles] = useState("1");
  // Nombre de sacs (1 à 10) — traçabilité, sans impact sur le prix.
  const [nombreBagages, setNombreBagages] = useState(1);
  const [fraisFcfa, setFraisFcfa] = useState("");
  const [voyageId, setVoyageId] = useState(voyageImposeId ?? "");
  /**
   * Au guichet, on ignore souvent quel car partira (« le prochain ») : cocher
   * cette case enregistre le colis tout de suite, l'affectation venant après.
   */
  const [affecterPlusTard, setAffecterPlusTard] = useState(false);
  /** Arrêt précis de descente (null = terminus ou gare libre). */
  const [arretDestinationId, setArretDestinationId] = useState("");
  const [arretsLigne, setArretsLigne] = useState<ArretLigne[]>([]);
  /** Paiement inclus à l'inscription, avant le QR. */
  const [moyenPaiement, setMoyenPaiement] = useState<MoyenPaiement>("especes");
  const [telephonePaiement, setTelephonePaiement] = useState("");

  // État d'envoi
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [resultat, setResultat] = useState<ColisEnregistre | null>(null);
  /** Colis mis en file locale faute de réseau (id_local) — bandeau de succès. */
  const [colisEnFile, setColisEnFile] = useState<string | null>(null);

  // ─── Guidage vocal de l'assistant (S5) ─────────────────────────────

  /**
   * Au **changement d'étape** seulement : à l'ouverture de l'écran, le guide
   * global a déjà raconté la page ; ici on dit quoi faire maintenant.
   */
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    if (!guide) return;
    const minuterie = window.setTimeout(() => lireTexte(t(VOCAL_ETAPE[etape])), 250);
    return () => window.clearTimeout(minuterie);
  }, [etape, guide, lireTexte, t]);

  /** Le ticket vient d'être créé : c'est LE moment important pour l'agent. */
  useEffect(() => {
    if (!resultat || !guide) return;
    lireTexte(t("colis.vocal.succes"));
  }, [resultat, guide, lireTexte, t]);

  // ─── Chargement du référentiel ─────────────────────────────────────
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        // Le référentiel est mis en cache localement : sans réseau, le
        // formulaire reste utilisable (gares/voyages resservis depuis
        // IndexedDB) — sinon écran vide et aucun colis enregistrable.
        const [reponseGares, reponseVoyages, reponseLignes] = await Promise.all([
          chargerAvecCache("gares", () => logistiqueAPI.gares.lister()),
          chargerAvecCache("voyages", () =>
            logistiqueAPI.voyages.lister().catch(() => ({ elements: [] as Voyage[] })),
          ),
          chargerAvecCache("lignes", () =>
            logistiqueAPI.lignes.lister().catch(() => ({ elements: [] as Ligne[] })),
          ),
        ]);
        if (annule) return;
        setGares(reponseGares.elements);
        setVoyages(reponseVoyages.elements);
        setLignes(reponseLignes.elements);

        // Pré-remplit la gare de départ depuis la fiche acteur du receveur.
        if (utilisateur?.id) {
          // Hors-ligne, cette fiche n'est pas disponible : ce n'est pas bloquant.
          const gare = await gareDeLActeur(utilisateur.id).catch(() => null);
          if (!annule && gare) {
            setGareGuichet(gare);
            setGareDepartId(gare.id);
          }
        }
      } catch (e) {
        if (!annule) {
          // Hors ligne avec cache : on continue avec le référentiel local.
          setErreur(
            estErreurReseau(e)
              ? "Hors ligne : gares et voyages affichés depuis ce poste. Le colis sera synchronisé au retour du réseau."
              : e instanceof ErreurAPI
                ? e.message_utilisateur
                : "Impossible de charger les gares. Réessayez.",
          );
        }
      } finally {
        if (!annule) setChargementRef(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [utilisateur?.id]);

  const gareParId = useMemo(() => {
    const index = new Map<string, Gare>();
    gares.forEach((g) => index.set(g.id, g));
    return index;
  }, [gares]);

  // Voyage sélectionné → chauffeur associé (attribution obligatoire).
  const voyageSelectionne = useMemo(
    () => voyages.find((v) => v.id === voyageId) ?? null,
    [voyages, voyageId],
  );
  const chauffeurId = chauffeurImposeId ?? voyageSelectionne?.chauffeur_id ?? null;
  const ligneVoyage = useMemo(
    () =>
      voyageSelectionne
        ? lignes.find((l) => l.id === voyageSelectionne.ligne_id) ?? null
        : null,
    [lignes, voyageSelectionne],
  );

  // Arrêts de la ligne du voyage (pour associer la destination précise).
  useEffect(() => {
    let annule = false;
    const ligneId = voyageSelectionne?.ligne_id;
    if (!ligneId) {
      setArretsLigne([]);
      return;
    }
    const deja = ligneVoyage?.arrets;
    if (deja && deja.length > 0) {
      setArretsLigne(deja.filter((a) => a.actif !== false));
      return;
    }
    (async () => {
      try {
        const liste = await logistiqueAPI.lignes.arrets.lister(ligneId);
        if (!annule) setArretsLigne(liste.filter((a) => a.actif !== false));
      } catch {
        if (!annule) setArretsLigne([]);
      }
    })();
    return () => {
      annule = true;
    };
  }, [voyageSelectionne?.ligne_id, ligneVoyage?.arrets]);

  // ─── Numéros de téléphone (miroir de la validation serveur) ────────
  // Un numéro doit être joignable : sinon le colis est introuvable et les SMS
  // partent dans le vide. `null` = saisie invalide.
  const telDestinataire = normaliserTelephone(destinataireTel);
  const telExpediteur =
    expediteurTel.trim() === "" ? null : normaliserTelephone(expediteurTel);

  const etapeExpediteurValide =
    expediteurNom.trim().length >= 2 &&
    (expediteurTel.trim() === "" || telExpediteur !== null);

  const etapeDestinataireValide =
    destinataireNom.trim().length >= 2 &&
    telDestinataire !== null &&
    !!gareDepartId &&
    !!gareArriveeId &&
    gareDepartId !== gareArriveeId;

  // Prix du transport : **facultatif** (vide = non renseigné).
  const fraisNombre = fraisFcfa.trim() === "" ? null : Number(fraisFcfa);
  const fraisValide =
    fraisNombre === null || (!Number.isNaN(fraisNombre) && fraisNombre >= 0);

  // Nombre d'articles : détermine le frais de service DigiID (barème par tranches).
  const nombreArticlesNombre = Number(nombreArticles.replace(/\D/g, ""));
  const nombreArticlesValide =
    Number.isInteger(nombreArticlesNombre) && nombreArticlesNombre >= 1;
  const fraisService = fraisServicePourArticles(
    nombreArticlesValide ? nombreArticlesNombre : 1,
  );
  // Attribution : un car précis, **ou** — au guichet — un report explicite
  // (« le prochain car »). Dans l'espace chauffeur, le car est imposé.
  const attributionValide = voyageImposeId
    ? true
    : affecterPlusTard || (!!voyageId && !!chauffeurId);
  // Voyage connu : destination = arrêt intermédiaire ou terminus (clé « terminus »).
  const destinationArretValide =
    affecterPlusTard || !voyageSelectionne ? true : arretDestinationId !== "";
  const telPaiementWave =
    moyenPaiement === "wave" ? normaliserTelephone(telephonePaiement) : true;
  const paiementValide =
    moyenPaiement === "especes" ||
    (moyenPaiement === "wave" && telPaiementWave !== null && telephonePaiement.trim() !== "");
  const etapeDetailsValide =
    fraisValide &&
    nombreArticlesValide &&
    attributionValide &&
    destinationArretValide;

  /** Réinitialise le formulaire pour un nouvel enregistrement. */
  function nouvelEnregistrement() {
    setResultat(null);
    setEtape(1);
    setExpediteurNom("");
    setExpediteurTel("");
    setDestinataireNom("");
    setDestinataireTel("");
    setDescription("");
    setPoidsKg("");
    setValeurFcfa("");
    setNombreArticles("1");
    setNombreBagages(1);
    setFraisFcfa("");
    setVoyageId(voyageImposeId ?? "");
    setAffecterPlusTard(false);
    setGareArriveeId("");
    setArretDestinationId("");
    setMoyenPaiement("especes");
    setTelephonePaiement("");
    setGareDepartId(gareGuichet?.id ?? "");
    setErreur(null);
  }

  async function enregistrer() {
    setErreur(null);

    // Garde-fou : le bouton est déjà désactivé, mais on ne laisse jamais
    // partir un numéro invalide (source de colis « injoignables »).
    if (!telDestinataire || (expediteurTel.trim() !== "" && !telExpediteur)) {
      setErreur(MESSAGE_TELEPHONE_INVALIDE);
      setEtape(1);
      return;
    }

    setEnregistrement(true);
    try {
      const poids = poidsKg ? Number(poidsKg.replace(",", ".")) : null;
      const valeur = valeurFcfa ? Number(valeurFcfa.replace(",", ".")) : null;
      const charge = {
        expediteur_nom: expediteurNom.trim() || null,
        // Numéros **normalisés** : +2290197123456 (ou +226… si étranger).
        expediteur_tel: telExpediteur,
        destinataire_nom: destinataireNom.trim(),
        destinataire_tel: telDestinataire,
        gare_depart_id: gareDepartId,
        gare_arrivee_id: gareArriveeId,
        arret_destination_id:
          arretDestinationId && arretDestinationId !== "terminus"
            ? arretDestinationId
            : null,
        description: description.trim() || null,
        poids_kg: poids !== null && !Number.isNaN(poids) ? poids : null,
        valeur_fcfa: valeur !== null && !Number.isNaN(valeur) ? valeur : null,
        nombre_articles: nombreArticlesValide ? nombreArticlesNombre : 1,
        nombre_bagages: nombreBagages,
        frais_fcfa:
          fraisNombre !== null && !Number.isNaN(fraisNombre) ? fraisNombre : null,
        // Le colis peut rester « à affecter » (guichet) : on n'envoie alors ni
        // voyage ni chauffeur, et le receveur complète depuis la fiche du colis.
        voyage_id: affecterPlusTard ? null : voyageId || null,
        chauffeur_id: affecterPlusTard ? undefined : (chauffeurId ?? undefined),
        enregistrement_direct: enregistrementDirect || undefined,
        // Paiement **avant** QR : même transaction côté serveur.
        moyen_paiement: moyenPaiement,
        telephone_paiement:
          moyenPaiement === "wave"
            ? (normaliserTelephone(telephonePaiement) ?? telephonePaiement.trim())
            : null,
      };

      try {
        setResultat(await logistiqueAPI.colis.creer(charge));
      } catch (erreurEnvoi) {
        // Pas de réseau (ou serveur injoignable) : le colis est enregistré
        // LOCALEMENT puis rejoué à la reconnexion.
        // ⚠️ `estErreurReseau` est indispensable : `client_api` emballe aussi
        // les pannes réseau dans `ErreurAPI` (code RESEAU / HTTP 0). L'ancien
        // test `instanceof ErreurAPI` les prenait pour des refus métier et
        // n'enregistrait donc jamais rien hors-ligne.
        if (!estErreurReseau(erreurEnvoi)) throw erreurEnvoi;

        const enAttente = await mettreEnFile(charge);
        setColisEnFile(enAttente.id_local);
      }
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Échec de l'enregistrement. Vérifiez les informations puis réessayez.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  // ─── Écran « enregistré hors-ligne » (en attente de synchronisation) ─
  if (colisEnFile) {
    return (
      <div className="space-y-5 apparition" data-vocal-zone>
        <Alerte variante="avertissement" titre="Colis enregistré sur ce poste">
          <p className="text-sm">
            Pas de réseau : le colis de <strong>{destinataireNom}</strong> (
            {formaterTelephone(telDestinataire)}) est conservé ici et sera envoyé
            automatiquement dès le retour de la connexion. Le ticket sera généré
            à ce moment-là.
          </p>
        </Alerte>

        <Carte>
          <dl className="space-y-2 text-sm">
            <Ligne libelle="Destinataire" valeur={destinataireNom} />
            <Ligne
              libelle="Téléphone"
              valeur={formaterTelephone(telDestinataire)}
            />
            <Ligne
              libelle="Départ"
              valeur={gareParId.get(gareDepartId)?.nom ?? "—"}
            />
            <Ligne
              libelle="Arrivée"
              valeur={gareParId.get(gareArriveeId)?.nom ?? "—"}
            />
            <Ligne libelle="Référence locale" valeur={colisEnFile.slice(0, 8)} />
          </dl>
          <p className="mt-4 flex items-center gap-2 text-xs text-ardoise-clair">
            <IconeColis className="w-4 h-4" />
            Synchronisation automatique au retour du réseau (indicateur en bas à
            droite).
          </p>
          <div className="mt-4">
            <Bouton
              variante="primaire"
              onClick={() => {
                setColisEnFile(null);
                nouvelEnregistrement();
              }}
            >
              <IconeColis className="w-4 h-4" /> Enregistrer un autre colis
            </Bouton>
          </div>
        </Carte>
      </div>
    );
  }

  // ─── Écran de succès : ticket imprimable ───────────────────────────
  if (resultat) {
    return (
      <div
        className="space-y-5 apparition"
        data-vocal-zone
        data-vocal-annonce={t("colis.vocal.succes")}
      >
        <Alerte variante="succes" titre={t("colis.succes.titre")}>
          {t("colis.succes.desc")}
        </Alerte>
        <TicketImprimable ticket={resultat.ticket} colis={resultat.colis} />

        <Alerte variante="info" titre="Frais de service encaissés">
          Paiement enregistré avec l&apos;inscription (
          {LIBELLES_MOYEN[moyenPaiement] ?? moyenPaiement}
          ) — le QR a été généré ensuite.
        </Alerte>

        <div className="no-print flex flex-wrap gap-3">
          <BoutonVocal
            variante="primaire"
            cleAudio="btn.autre_colis"
            texteAudio={t("btn.autre_colis")}
            onClick={nouvelEnregistrement}
          >
            <IconeColis className="w-4 h-4" /> {t("btn.autre_colis")}
          </BoutonVocal>
          <a href={`/receveur/tickets/${encodeURIComponent(resultat.ticket.code_clair)}`}>
            <Bouton variante="ghost">
              <IconeTicket className="w-4 h-4" /> {t("btn.voir_suivi")}
            </Bouton>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-vocal-zone data-vocal-annonce={t(VOCAL_ETAPE[etape])}>
      {/* Fil des étapes */}
      <ol className="flex items-center gap-2 text-sm">
        {ETAPES.map((e, i) => {
          const actif = e.numero === etape;
          const passe = e.numero < etape;
          return (
            <li key={e.numero} className="flex items-center gap-2">
              <span
                className={
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold " +
                  (actif
                    ? "bg-lagune text-white"
                    : passe
                      ? "bg-ocre text-white"
                      : "bg-sable-clair text-ardoise-clair")
                }
              >
                {passe ? <IconeCheck className="w-3.5 h-3.5" /> : e.numero}
              </span>
              <span
                className={
                  actif ? "font-semibold text-ardoise" : "text-ardoise-clair"
                }
              >
                {t(e.cleTitre)}
              </span>
              {i < ETAPES.length - 1 && (
                <span className="w-6 h-px bg-ardoise-clair/20 mx-1" />
              )}
            </li>
          );
        })}
      </ol>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {chargementRef ? (
        <Carte>
          <p className="text-ardoise-clair italic">Chargement des gares…</p>
        </Carte>
      ) : (
        <>
          {/* ─── Étape 1 : Expéditeur ─── */}
          {etape === 1 && (
            <Carte
              titre={t("colis.expediteur.titre")}
              description={t("colis.expediteur.desc")}
            >
              <div className="space-y-4">
                {/* Le client présente sa carte : nom et téléphone remplis d'exactitude,
                    sans ressaisie — et les SMS partiront vers le bon numéro. */}
                <RechercheCarteDigiID
                  libelle="DigiID de l'expéditeur (facultatif)"
                  titre="L'expéditeur a une carte DigiID ?"
                  description="Présentez sa carte (ou saisissez son DigiID) : le nom et le téléphone ci-dessous se remplissent automatiquement."
                  rechercheInitiale={digiidInitial}
                  surSelection={(contact) => {
                    if (!contact) return;
                    setExpediteurNom(contact.nom_complet);
                    if (contact.telephone) setExpediteurTel(contact.telephone);
                  }}
                />
                <ChampSaisie
                  libelle="Nom de l'expéditeur"
                  required
                  value={expediteurNom}
                  onChange={(e) => setExpediteurNom(e.target.value)}
                  placeholder="Ex : Moussa Diallo"
                />
                <ChampSaisie
                  libelle="Téléphone de l'expéditeur"
                  required
                  value={expediteurTel}
                  onChange={(e) => setExpediteurTel(e.target.value)}
                  placeholder="+229 01 97 12 34 56"
                  inputMode="tel"
                  type="tel"
                  aide="Format +229 · un numéro invalide est refusé (SMS inutile sinon)."
                />
                <div className="flex justify-end">
                  <BoutonVocal
                    variante="primaire"
                    cleAudio="btn.continuer"
                    texteAudio={t("btn.continuer")}
                    disabled={!etapeExpediteurValide}
                    onClick={() => setEtape(2)}
                  >
                    {t("btn.continuer")}
                  </BoutonVocal>
                </div>
              </div>
            </Carte>
          )}

          {/* ─── Étape 2 : Destinataire ─── */}
          {etape === 2 && (
            <Carte
              titre={t("colis.destinataire.titre")}
              description={t("colis.destinataire.desc")}
            >
              <div className="space-y-4">
                {/* Le destinataire peut aussi présenter son code : même geste
                    rapide que pour l'expéditeur, mêmes SMS fiables. */}
                <RechercheCarteDigiID
                  libelle="DigiID du destinataire (facultatif)"
                  titre="Le destinataire a une carte DigiID ?"
                  description="Scannez son QR dynamique (ou saisissez son DigiID) : le nom et le téléphone ci-dessous se remplissent automatiquement."
                  surSelection={(contact) => {
                    if (!contact) return;
                    setDestinataireNom(contact.nom_complet);
                    if (contact.telephone) setDestinataireTel(contact.telephone);
                  }}
                />
                <ChampSaisie
                  libelle="Nom du destinataire"
                  required
                  value={destinataireNom}
                  onChange={(e) => setDestinataireNom(e.target.value)}
                  placeholder="Ex : Fatou Ndiaye"
                />
                <ChampSaisie
                  libelle="Téléphone du destinataire"
                  required
                  value={destinataireTel}
                  onChange={(e) => setDestinataireTel(e.target.value)}
                  placeholder="+229 01 97 12 34 56"
                  inputMode="tel"
                  type="tel"
                  aide="Format +229 · sert à prévenir le destinataire à l'arrivée."
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-ardoise">
                      Gare de départ <span className="text-terre">*</span>
                    </label>
                    <select
                      className="champ-saisie"
                      value={gareDepartId}
                      onChange={(e) => setGareDepartId(e.target.value)}
                    >
                      <option value="">— Choisir —</option>
                      {gares.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nom} ({g.ville})
                        </option>
                      ))}
                    </select>
                    {gareGuichet && gareDepartId === gareGuichet.id && (
                      <p className="text-xs text-ardoise-clair italic">
                        Pré-rempli avec votre gare de rattachement.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-ardoise">
                      Gare d'arrivée <span className="text-terre">*</span>
                    </label>
                    <select
                      className="champ-saisie"
                      value={gareArriveeId}
                      onChange={(e) => setGareArriveeId(e.target.value)}
                    >
                      <option value="">— Choisir —</option>
                      {gares
                        .filter((g) => g.id !== gareDepartId)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nom} ({g.ville})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-between">
                  <BoutonVocal
                    variante="ghost"
                    cleAudio="btn.retour"
                    texteAudio={t("btn.retour")}
                    onClick={() => setEtape(1)}
                  >
                    ← {t("btn.retour")}
                  </BoutonVocal>
                  <BoutonVocal
                    variante="primaire"
                    cleAudio="btn.continuer"
                    texteAudio={t("btn.continuer")}
                    disabled={!etapeDestinataireValide}
                    onClick={() => setEtape(3)}
                  >
                    {t("btn.continuer")}
                  </BoutonVocal>
                </div>
              </div>
            </Carte>
          )}

          {/* ─── Étape 3 : Détails & frais ─── */}
          {etape === 3 && (
            <Carte
              titre={t("colis.details.titre")}
              description={t("colis.details.desc")}
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-lagune/20 bg-lagune/5 px-4 py-3 space-y-3">
                  <ChampSaisie
                    libelle="Nombre d'articles dans le colis"
                    required
                    value={nombreArticles}
                    onChange={(e) => setNombreArticles(e.target.value)}
                    inputMode="numeric"
                    placeholder="Ex : 3"
                    aide="Détermine le frais de service DigiID : 100 F (1-3 articles), 200 F (4-6), 350 F (7-10), 500 F (plus de 10)."
                    erreur={nombreArticlesValide ? undefined : "Entrez un nombre entier ≥ 1"}
                  />
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="text-sm text-ardoise-clair">
                      Frais de service DigiID estimés
                    </span>
                    <span className="text-xl font-bold text-lagune">
                      {formaterFcfa(fraisService.frais_fcfa)}
                    </span>
                  </div>
                  <p className="text-xs text-ardoise-clair">
                    dont {formaterFcfa(fraisService.part_receveur_fcfa)} pour la
                    cagnotte du receveur. Le montant définitif est confirmé au
                    moment de l&apos;encaissement.
                  </p>
                </div>

                <ChampSaisie
                  libelle="Description du colis"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex : Sac de riz 25 kg, carton de tissus…"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ChampSaisie
                    libelle="Poids (kg)"
                    value={poidsKg}
                    onChange={(e) => setPoidsKg(e.target.value)}
                    inputMode="decimal"
                    placeholder="Ex : 12"
                  />
                  <ChampSaisie
                    libelle="Valeur déclarée (FCFA)"
                    value={valeurFcfa}
                    onChange={(e) => setValeurFcfa(e.target.value)}
                    inputMode="numeric"
                    placeholder="Ex : 50000"
                  />
                  <ChampSaisie
                    libelle="Prix du transport (FCFA)"
                    value={fraisFcfa}
                    onChange={(e) => setFraisFcfa(e.target.value)}
                    inputMode="numeric"
                    placeholder="Facultatif"
                    aide="Facultatif — votre prix, purement indicatif. Il n'est pas encaissé par DigiID."
                    erreur={fraisValide ? undefined : "Montant invalide"}
                  />
                </div>

                <ControleurBagages valeur={nombreBagages} onChange={setNombreBagages} />

                {!affecterPlusTard && voyageSelectionne && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-ardoise">
                      Arrêt de destination <span className="text-terre">*</span>
                    </label>
                    <select
                      className="champ-saisie"
                      value={arretDestinationId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setArretDestinationId(v);
                        if (v === "terminus" && ligneVoyage) {
                          setGareArriveeId(ligneVoyage.gare_arrivee_id);
                        } else {
                          const arret = arretsLigne.find((a) => a.id === v);
                          if (arret) setGareArriveeId(arret.gare_id);
                        }
                      }}
                    >
                      <option value="">— Choisir l&apos;arrêt de descente —</option>
                      {arretsLigne.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.ordre}. {a.gare_nom ?? "Arrêt"}
                        </option>
                      ))}
                      {ligneVoyage && (
                        <option value="terminus">
                          Terminus — {ligneVoyage.gare_arrivee_nom ?? "Arrivée"}
                        </option>
                      )}
                    </select>
                    <p className="text-xs italic text-ardoise-clair">
                      Positionne le colis dans la feuille de route du chauffeur
                      selon l&apos;ordre des arrêts.
                    </p>
                  </div>
                )}

                {voyageImposeId && (
                  <div className="rounded-xl border border-ocre/30 bg-ocre/5 px-4 py-3">
                    <p className="text-sm font-medium text-ardoise">
                      Car imposé : ce colis part dans votre car.
                    </p>
                    <p className="text-xs text-ardoise-clair">
                      {voyageSelectionne
                        ? libelleVoyage(voyageSelectionne)
                        : "Voyage en cours de chargement…"}
                    </p>
                  </div>
                )}

                {!voyageImposeId && (
                  <div className="space-y-2">
                    <SelectionVoyage
                      voyages={voyages}
                      lignes={lignes}
                      valeur={voyageId}
                      surSelection={(id) => {
                        setVoyageId(id);
                        if (id) setAffecterPlusTard(false);
                      }}
                      gareDepartId={gareDepartId}
                      gareArriveeId={gareArriveeId}
                      exigerChauffeur
                      obligatoire={!affecterPlusTard}
                      desactive={affecterPlusTard}
                      aide="Le chauffeur est déduit du car choisi : vous n'avez aucun identifiant à saisir."
                    />

                    {attributionFacultative && (
                      <label className="flex items-start gap-2 rounded-lg bg-sable/60 px-3 py-2 text-xs text-ardoise">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-ardoise-clair/30"
                          checked={affecterPlusTard}
                          onChange={(e) => {
                            setAffecterPlusTard(e.target.checked);
                            if (e.target.checked) setVoyageId("");
                          }}
                        />
                        <span>
                          Je ne sais pas encore quel car partira — enregistrer
                          maintenant et affecter le chauffeur plus tard
                          (retrouvable depuis la liste des colis).
                        </span>
                      </label>
                    )}
                  </div>
                )}

                <div className="flex justify-between">
                  <Bouton variante="ghost" onClick={() => setEtape(2)}>
                    ← Retour
                  </Bouton>
                  <Bouton
                    variante="primaire"
                    disabled={!etapeDetailsValide}
                    onClick={() => setEtape(4)}
                  >
                    Récapitulatif
                  </Bouton>
                </div>
              </div>
            </Carte>
          )}

          {/* ─── Étape 4 : Récapitulatif ─── */}
          {etape === 4 && (
            <Carte titre={t("colis.recap.titre")}>
              <dl className="space-y-2 text-sm">
                <Ligne libelle="Expéditeur" valeur={expediteurNom} />
                <Ligne libelle="Téléphone expéditeur" valeur={expediteurTel} />
                <Ligne libelle="Destinataire" valeur={destinataireNom} />
                <Ligne libelle="Téléphone" valeur={destinataireTel} />
                <Ligne
                  libelle="Départ"
                  valeur={gareParId.get(gareDepartId)?.nom ?? "—"}
                />
                <Ligne
                  libelle="Arrivée"
                  valeur={gareParId.get(gareArriveeId)?.nom ?? "—"}
                />
                {description.trim() && (
                  <Ligne libelle="Description" valeur={description.trim()} />
                )}
                {poidsKg && <Ligne libelle="Poids" valeur={`${poidsKg} kg`} />}
                {valeurFcfa && (
                  <Ligne
                    libelle="Valeur déclarée"
                    valeur={`${valeurFcfa} FCFA`}
                  />
                )}
                {fraisNombre !== null && (
                  <Ligne
                    libelle="Prix du transport (facultatif)"
                    valeur={formaterFcfa(
                      Number.isNaN(fraisNombre) ? 0 : fraisNombre,
                    )}
                  />
                )}
                <Ligne
                  libelle="Nombre d'articles"
                  valeur={String(nombreArticlesValide ? nombreArticlesNombre : 1)}
                />
                <Ligne libelle="Nombre de sacs" valeur={String(nombreBagages)} />
                <Ligne
                  libelle="Voyage / chauffeur"
                  valeur={
                    affecterPlusTard
                      ? "À affecter plus tard (guichet)"
                      : voyageSelectionne
                        ? `${voyageSelectionne.vehicule_immatriculation ?? "Voyage"}${
                            voyageSelectionne.chauffeur_nom
                              ? ` · ${voyageSelectionne.chauffeur_nom}`
                              : ""
                          }`
                        : "—"
                  }
                />
                <Ligne
                  libelle="Arrêt de destination"
                  valeur={
                    arretDestinationId === "terminus"
                      ? `Terminus — ${ligneVoyage?.gare_arrivee_nom ?? gareParId.get(gareArriveeId)?.nom ?? "—"}`
                      : arretsLigne.find((a) => a.id === arretDestinationId)?.gare_nom ??
                        gareParId.get(gareArriveeId)?.nom ??
                        "—"
                  }
                />
                <Ligne
                  libelle="Frais de service DigiID"
                  valeur={`${formaterFcfa(
                    fraisService.frais_fcfa,
                  )} (dont ${formaterFcfa(fraisService.part_receveur_fcfa)} receveur)`}
                />
              </dl>

              {/* Paiement inclus avant validation → QR généré ensuite */}
              <div className="mt-5 space-y-3 rounded-xl border border-lagune/20 bg-lagune/5 px-4 py-3">
                <p className="text-sm font-semibold text-ardoise">
                  Moyen de paiement des frais de service
                </p>
                <p className="text-xs text-ardoise-clair">
                  Encaissement avant génération du ticket QR.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["especes", "wave"] as MoyenPaiement[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMoyenPaiement(m)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        moyenPaiement === m
                          ? "border-lagune bg-lagune text-white"
                          : "border-ardoise/20 bg-white text-ardoise hover:bg-lagune/10"
                      }`}
                    >
                      {LIBELLES_MOYEN[m] ?? m}
                    </button>
                  ))}
                </div>
                {moyenPaiement === "wave" && (
                  <ChampSaisie
                    libelle="Téléphone Wave"
                    required
                    value={telephonePaiement}
                    onChange={(e) => setTelephonePaiement(e.target.value)}
                    inputMode="tel"
                    type="tel"
                    placeholder="+229 01 97 12 34 56"
                    aide="Numéro Wave du payeur."
                  />
                )}
              </div>

              <div className="flex justify-between mt-6">
                <BoutonVocal
                  variante="ghost"
                  cleAudio="btn.retour"
                  texteAudio={t("btn.retour")}
                  onClick={() => setEtape(3)}
                >
                  ← {t("btn.retour")}
                </BoutonVocal>
                <BoutonVocal
                  variante="succes"
                  cleAudio="btn.enregistrer"
                  texteAudio={t("btn.enregistrer")}
                  chargement={enregistrement}
                  disabled={
                    enregistrement ||
                    !etapeExpediteurValide ||
                    !etapeDestinataireValide ||
                    !etapeDetailsValide ||
                    !paiementValide
                  }
                  onClick={enregistrer}
                >
                  <IconeCheck className="w-4 h-4" /> Payer &amp; {t("btn.enregistrer")}
                </BoutonVocal>
              </div>
            </Carte>
          )}
        </>
      )}
    </div>
  );
}

/** Petite ligne libellé/valeur du récapitulatif. */
function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ardoise-clair/10 pb-1.5">
      <dt className="text-ardoise-clair">{libelle}</dt>
      <dd className="font-medium text-ardoise text-right">{valeur}</dd>
    </div>
  );
}
