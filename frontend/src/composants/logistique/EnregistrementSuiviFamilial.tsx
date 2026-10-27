"use client";
/**
 * Enregistrement d'un passager — suivi familial (Plan B, étape S7 / P0 ajusté).
 *
 * Fort impact social : la famille confie un enfant (ou un adulte voyage seul) à
 * un transporteur. Le guichet crée un ticket ``ENFANT`` (QR + code ``ENF-…``) et
 * le parent reçoit un **SMS de confirmation**. Au départ, à l'approche puis à
 * l'arrivée, des SMS sont envoyés automatiquement. L'enfant dispose aussi d'une
 * **page publique** de suivi (`/suivi/ENF-…`) consultable sans compte.
 *
 * Ajustements P0 :
 *  - **Contacts** : acheteur du ticket (enfant) / numéro du passager (adulte)
 *    **et** un proche de confiance à prévenir obligatoirement.
 *  - **Attribution obligatoire** : le passager est lié à un chauffeur précis
 *    (via un voyage) et à un trajet précis.
 *  - **Bagages** : compteur 1 à 10 sacs → une étiquette QR par sac (traçabilité,
 *    **sans impact** sur le prix).
 *  - **Tarif fixe** : 100 FCFA par passager/enfant, quel que soit le nombre de sacs.
 */
import { useEffect, useMemo, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeCheck, IconeIdentite } from "@/composants/commun/Icones";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import {
  MESSAGE_TELEPHONE_INVALIDE,
  normaliserTelephone,
} from "@/services/telephone";
import {
  gareDeLActeur,
  logistiqueAPI,
  type ArretLigne,
  type Gare,
  type Ligne,
  type SuiviFamilialEnregistre,
  type Voyage,
} from "@/services/logistique_api";
import { ControleurBagages } from "./ControleurBagages";
import { formaterFcfa } from "./format";
import { RechercheCarteDigiID } from "./RechercheCarteDigiID";
import { SelectionVoyage, libelleVoyage } from "./SelectionVoyage";
import { TicketSuiviFamilialImprimable } from "./TicketSuiviFamilialImprimable";
import { LIBELLES_MOYEN, type MoyenPaiement } from "@/types/paiement";

type TypePassager = "enfant" | "adulte";

/** Frais de service fixe (doit refléter `frais_service_passager_fcfa` backend). */
const FRAIS_SERVICE_PASSAGER_FCFA = 100;

export function EnregistrementSuiviFamilial({
  digiidInitial,
  voyageImposeId,
  chauffeurImposeId,
  attributionFacultative = false,
  enregistrementDirect = false,
}: {
  /** DigiID / lien de QR du client, quand l'agent arrive depuis /guichet/carte. */
  digiidInitial?: string;
  /** Voyage imposé (espace chauffeur) : le passager voyage dans SON car. */
  voyageImposeId?: string;
  /** Chauffeur imposé : celui qui enregistre en route est le conducteur. */
  chauffeurImposeId?: string;
  /** Guichet : autorise « je ne sais pas encore quel car partira ». */
  attributionFacultative?: boolean;
  /** Enregistrement **en route par le chauffeur** (mode « chauffeur_direct »). */
  enregistrementDirect?: boolean;
} = {}) {
  const { utilisateur } = useAuthentification();

  // Référentiel
  const [gares, setGares] = useState<Gare[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargementRef, setChargementRef] = useState(true);
  const [gareGuichet, setGareGuichet] = useState<Gare | null>(null);

  // Formulaire
  const [typePassager, setTypePassager] = useState<TypePassager>("enfant");
  const [enfantNom, setEnfantNom] = useState("");
  const [enfantAge, setEnfantAge] = useState("");
  const [enfantSexe, setEnfantSexe] = useState("");
  const [parentNom, setParentNom] = useState("");
  // Enfant : acheteur du ticket. Adulte : numéro propre.
  const [acheteurNom, setAcheteurNom] = useState("");
  const [acheteurTel, setAcheteurTel] = useState("");
  const [telephonePassager, setTelephonePassager] = useState("");
  // Proche de confiance (obligatoire).
  const [procheNom, setProcheNom] = useState("");
  const [procheTelephone, setProcheTelephone] = useState("");
  // Bagages (1 à 10).
  const [nombreBagages, setNombreBagages] = useState(1);
  // Attribution : gares + voyage (+ chauffeur déduit du voyage).
  const [gareDepartId, setGareDepartId] = useState("");
  const [gareArriveeId, setGareArriveeId] = useState("");
  const [voyageId, setVoyageId] = useState(voyageImposeId ?? "");
  /** Au guichet, on ignore souvent quel car partira : report d'affectation. */
  const [affecterPlusTard, setAffecterPlusTard] = useState(false);
  const [arretDestinationId, setArretDestinationId] = useState("");
  const [arretsLigne, setArretsLigne] = useState<ArretLigne[]>([]);
  const [moyenPaiement, setMoyenPaiement] = useState<MoyenPaiement | null>(null);
  const [telephonePaiement, setTelephonePaiement] = useState("");

  // État d'envoi
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [resultat, setResultat] = useState<SuiviFamilialEnregistre | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const [reponseGares, reponseVoyages, reponseLignes] = await Promise.all([
          logistiqueAPI.gares.lister(),
          logistiqueAPI.voyages.lister().catch(() => ({ elements: [] as Voyage[] })),
          logistiqueAPI.lignes.lister().catch(() => ({ elements: [] as Ligne[] })),
        ]);
        if (annule) return;
        setGares(reponseGares.elements);
        setVoyages(
          reponseVoyages.elements.filter(
            (voyage) => !["termine", "annule"].includes(voyage.statut),
          ),
        );
        setLignes(reponseLignes.elements);

        if (utilisateur?.id) {
          const gare = await gareDeLActeur(utilisateur.id);
          if (!annule && gare) {
            setGareGuichet(gare);
            setGareDepartId(gare.id);
          }
        }
      } catch (e) {
        if (!annule) {
          setErreur(
            e instanceof ErreurAPI
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

  // Voyage sélectionné et chauffeur associé (attribution obligatoire).
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
  // « Au moins 6 chiffres » laissait passer `123456`, `000000`… : le proche
  // n'était jamais joignable et les SMS partaient dans le vide.
  const telAcheteur = normaliserTelephone(acheteurTel);
  const telPassager = normaliserTelephone(telephonePassager);
  const telProche = normaliserTelephone(procheTelephone);
  const telAcheteurOk = telAcheteur !== null;
  const telPassagerOk = telPassager !== null;
  const telProcheOk = telProche !== null;

  const ageNombre =
    enfantAge.trim() === "" ? null : Number(enfantAge.replace(/\D/g, ""));
  const ageValide =
    ageNombre === null ||
    (Number.isInteger(ageNombre) && ageNombre >= 0 && ageNombre <= 120);

  // Contacts obligatoires selon le type de passager.
  const contactsValides =
    typePassager === "enfant"
      ? acheteurNom.trim().length >= 2 && telAcheteurOk
      : telPassagerOk;

  const destinationArretValide =
    affecterPlusTard || !voyageSelectionne ? true : arretDestinationId !== "";
  const paiementValide =
    moyenPaiement === "especes" ||
    ((moyenPaiement === "mtn" || moyenPaiement === "moov") &&
      normaliserTelephone(telephonePaiement) !== null &&
      telephonePaiement.trim() !== "");

  const formulaireValide =
    enfantNom.trim().length >= 2 &&
    ageValide &&
    contactsValides &&
    telProcheOk &&
    !!gareDepartId &&
    !!gareArriveeId &&
    gareDepartId !== gareArriveeId &&
    destinationArretValide &&
    paiementValide &&
    (voyageImposeId
      ? true
      : affecterPlusTard || (!!voyageId && !!chauffeurId));

  function nouvelEnregistrement() {
    setResultat(null);
    setTypePassager("enfant");
    setEnfantNom("");
    setEnfantAge("");
    setEnfantSexe("");
    setParentNom("");
    setAcheteurNom("");
    setAcheteurTel("");
    setTelephonePassager("");
    setProcheNom("");
    setProcheTelephone("");
    setNombreBagages(1);
    setVoyageId(voyageImposeId ?? "");
    setAffecterPlusTard(false);
    setGareArriveeId("");
    setArretDestinationId("");
    setMoyenPaiement(null);
    setTelephonePaiement("");
    setGareDepartId(gareGuichet?.id ?? "");
    setErreur(null);
  }

  async function enregistrer() {
    setErreur(null);
    if (!moyenPaiement || !paiementValide) {
      setErreur("Choisissez un moyen de paiement valide avant de confirmer l'enregistrement.");
      return;
    }
    if (!attributionFacultative && !voyageImposeId && !chauffeurId) {
      setErreur(
        "Sélectionnez un voyage affecté à un chauffeur, ou cochez « affecter le chauffeur plus tard ».",
      );
      return;
    }
    setEnregistrement(true);
    try {
      const reponse = await logistiqueAPI.suiviFamilial.creer({
        enfant_nom: enfantNom.trim(),
        enfant_age: ageNombre,
        enfant_sexe: enfantSexe || null,
        parent_nom: parentNom.trim() || null,
        // Numéros normalisés en +229… (le backend refuse le reste).
        telephone_parent:
          (typePassager === "enfant" ? telAcheteur : telPassager) ?? null,
        type_passager: typePassager,
        telephone_passager: typePassager === "adulte" ? telPassager : null,
        acheteur_nom: typePassager === "enfant" ? acheteurNom.trim() : null,
        acheteur_tel: typePassager === "enfant" ? telAcheteur : null,
        proche_nom: procheNom.trim() || null,
        proche_telephone: telProche ?? "",
        nombre_bagages: nombreBagages,
        gare_depart_id: gareDepartId,
        gare_arrivee_id: gareArriveeId,
        arret_destination_id:
          arretDestinationId && arretDestinationId !== "terminus"
            ? arretDestinationId
            : null,
        voyage_id: affecterPlusTard ? null : voyageId || null,
        chauffeur_id: affecterPlusTard ? undefined : (chauffeurId ?? undefined),
        enregistrement_direct: enregistrementDirect || undefined,
        moyen_paiement: moyenPaiement,
        telephone_paiement:
          moyenPaiement === "mtn" || moyenPaiement === "moov"
            ? (normaliserTelephone(telephonePaiement) ?? telephonePaiement.trim())
            : null,
      });
      setResultat(reponse);
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

  const libellePassager = typePassager === "enfant" ? "de l'enfant" : "du passager";

  // ─── Écran de succès : ticket imprimable + étiquettes sacs + lien de suivi ───
  if (resultat) {
    const bagages = resultat.suivi.bagages ?? [];
    return (
      <div className="space-y-5 apparition">
        <Alerte variante="succes" titre="Passager enregistré — suivi activé">
          Un SMS de confirmation a été envoyé ({resultat.suivi.telephone_parent}). La
          famille sera prévenue par SMS au départ, à l&apos;approche puis à l&apos;arrivée.
          {" "}
          <strong>
            Frais : {formaterFcfa(resultat.suivi.frais_service_fcfa)} — moyen choisi :{" "}
            {moyenPaiement ? LIBELLES_MOYEN[moyenPaiement] ?? moyenPaiement : "—"}.
          </strong>
        </Alerte>

        {bagages.length > 0 && (
          <Carte
            titre={`${bagages.length} étiquette(s) bagage`}
            description="Une étiquette QR par sac — à imprimer et attacher à chaque sac (vérification anti-fraude à l'arrivée)."
          >
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {bagages.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-ardoise-clair/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-ardoise">{b.numero_serie}</span>
                  <code className="text-xs text-ardoise-clair">{b.code_clair}</code>
                </li>
              ))}
            </ul>
          </Carte>
        )}

        <TicketSuiviFamilialImprimable
          ticket={resultat.ticket}
          suivi={resultat.suivi}
        />

        <div className="no-print flex flex-wrap gap-3">
          <Bouton variante="primaire" onClick={nouvelEnregistrement}>
            <IconeIdentite className="h-4 w-4" /> Enregistrer un autre passager
          </Bouton>
          <a
            href={`/suivi/${encodeURIComponent(resultat.ticket.code_clair)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Bouton variante="ghost">Ouvrir la page de suivi public</Bouton>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}

      {chargementRef ? (
        <Carte>
          <p className="italic text-ardoise-clair">Chargement des gares…</p>
        </Carte>
      ) : (
        <>
          <Carte
            titre="Passager & contacts"
            description="Renseignez le passager, l'acheteur du ticket (pour un enfant) et un proche de confiance à prévenir."
          >
            <div className="space-y-4">
              {/* La personne au guichet présente sa carte : le nom et le téléphone du
                  responsable sont remplis exactement — c'est ce qui garantit que les
                  SMS de suivi partiront au bon numéro. */}
              <RechercheCarteDigiID
                libelle="DigiID du responsable (facultatif)"
                titre="La personne au guichet a une carte DigiID ?"
                rechercheInitiale={digiidInitial}
                description={
                  typePassager === "enfant"
                    ? "Présentez sa carte : le nom et le téléphone de l'acheteur du ticket seront pré-remplis."
                    : "Présentez sa carte : le nom et le téléphone du passager seront pré-remplis."
                }
                surSelection={(contact) => {
                  if (!contact) return;
                  if (typePassager === "enfant") {
                    setAcheteurNom(contact.nom_complet);
                    if (contact.telephone) setAcheteurTel(contact.telephone);
                    if (!procheNom) setProcheNom(contact.nom_complet);
                  } else {
                    setEnfantNom(contact.nom_complet);
                    if (contact.telephone) setTelephonePassager(contact.telephone);
                  }
                }}
              />
              {/* Type de passager */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ardoise">
                  Type de passager <span className="text-terre">*</span>
                </label>
                <div className="flex gap-2">
                  {(["enfant", "adulte"] as TypePassager[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypePassager(t)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        typePassager === t
                          ? "border-lagune bg-lagune-teinte text-lagune"
                          : "border-ardoise/20 bg-white text-ardoise hover:bg-lagune-teinte/40"
                      }`}
                    >
                      {t === "enfant" ? "Enfant" : "Adulte"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ChampSaisie
                  libelle={
                    typePassager === "enfant"
                      ? "Nom complet de l'enfant"
                      : "Nom complet du passager"
                  }
                  required
                  value={enfantNom}
                  onChange={(e) => setEnfantNom(e.target.value)}
                  placeholder={
                    typePassager === "enfant" ? "Ex : Awa Traoré" : "Ex : Moussa Diop"
                  }
                />
                <ChampSaisie
                  libelle="Âge (années)"
                  value={enfantAge}
                  onChange={(e) => setEnfantAge(e.target.value)}
                  inputMode="numeric"
                  placeholder="Ex : 9"
                  erreur={ageValide ? undefined : "Âge invalide (0 à 120)"}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ardoise">Sexe</label>
                <select
                  className="champ-saisie"
                  value={enfantSexe}
                  onChange={(e) => setEnfantSexe(e.target.value)}
                >
                  <option value="">— Non précisé —</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>

              <ChampSaisie
                libelle={
                  typePassager === "enfant"
                    ? "Nom du parent / tuteur (optionnel)"
                    : "Nom du proche contacté (optionnel)"
                }
                value={parentNom}
                onChange={(e) => setParentNom(e.target.value)}
              />

              {/* Contacts selon le type */}
              {typePassager === "enfant" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ChampSaisie
                    libelle="Nom de l'acheteur du ticket"
                    required
                    value={acheteurNom}
                    onChange={(e) => setAcheteurNom(e.target.value)}
                    placeholder="Ex : Ibrahim Traoré"
                    aide="La personne qui a payé le voyage de l'enfant."
                  />
                  <ChampSaisie
                    libelle="Téléphone de l'acheteur"
                    required
                    value={acheteurTel}
                    onChange={(e) => setAcheteurTel(e.target.value)}
                    inputMode="tel"
                    type="tel"
                    placeholder="+229 01 97 12 34 56"
                    erreur={
                      telAcheteurOk || acheteurTel === ""
                        ? undefined
                        : MESSAGE_TELEPHONE_INVALIDE
                    }
                  />
                </div>
              ) : (
                <ChampSaisie
                  libelle="Téléphone du passager"
                  required
                  value={telephonePassager}
                  onChange={(e) => setTelephonePassager(e.target.value)}
                  inputMode="tel"
                  type="tel"
                  placeholder="+229 01 97 12 34 56"
                  erreur={
                    telPassagerOk || telephonePassager === ""
                      ? undefined
                      : MESSAGE_TELEPHONE_INVALIDE
                  }
                />
              )}

              {/* Le proche de confiance a lui aussi le droit au scan : un numéro
                  mal recopié, et c'est le parent qui n'est pas prévenu. */}
              <RechercheCarteDigiID
                libelle="DigiID du proche de confiance (facultatif)"
                titre="Le proche de confiance a une carte DigiID ?"
                description="Scannez son QR dynamique (ou saisissez son DigiID) : son nom et son téléphone se remplissent automatiquement."
                surSelection={(contact) => {
                  if (!contact) return;
                  setProcheNom(contact.nom_complet);
                  if (contact.telephone) setProcheTelephone(contact.telephone);
                }}
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ChampSaisie
                  libelle="Nom du proche de confiance"
                  value={procheNom}
                  onChange={(e) => setProcheNom(e.target.value)}
                  placeholder="Ex : Fatou Traoré"
                />
                <ChampSaisie
                  libelle="Téléphone du proche de confiance"
                  required
                  value={procheTelephone}
                  onChange={(e) => setProcheTelephone(e.target.value)}
                  inputMode="tel"
                  type="tel"
                  placeholder="+229 01 97 12 34 56"
                  aide="Prévenu en plus du responsable (départ, approche, arrivée)."
                  erreur={
                    telProcheOk || procheTelephone === ""
                      ? undefined
                      : MESSAGE_TELEPHONE_INVALIDE
                  }
                />
              </div>
            </div>
          </Carte>

          <Carte
            titre="Trajet & attribution"
            description="Le passager doit être lié à un chauffeur précis et à un voyage précis."
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    <p className="text-xs italic text-ardoise-clair">
                      Pré-rempli avec votre gare de rattachement.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ardoise">
                    Gare d&apos;arrivée <span className="text-terre">*</span>
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

              {voyageImposeId && (
                <div className="rounded-xl border border-ocre/30 bg-ocre/5 px-4 py-3">
                  <p className="text-sm font-medium text-ardoise">
                    Car imposé : ce passager voyage dans votre car.
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
                        maintenant et affecter le chauffeur plus tard (le parent
                        est prévenu dès l'enregistrement).
                      </span>
                    </label>
                  )}
                </div>
              )}

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
                    Positionne le passager dans la feuille de route du chauffeur.
                  </p>
                </div>
              )}

              <div className="space-y-3 rounded-xl border border-lagune/20 bg-lagune/5 px-4 py-3">
                <p className="text-sm font-semibold text-ardoise">
                  Moyen de paiement ({formaterFcfa(FRAIS_SERVICE_PASSAGER_FCFA)})
                </p>
                <p className="text-xs text-ardoise-clair">
                  Encaissement avant génération du ticket QR.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["especes", "mtn", "moov"] as MoyenPaiement[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMoyenPaiement(m)}
                      aria-pressed={moyenPaiement === m}
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
                {!moyenPaiement && (
                  <p className="text-xs font-medium text-terre">
                    Sélectionnez le moyen utilisé avant de valider.
                  </p>
                )}
                {(moyenPaiement === "mtn" || moyenPaiement === "moov") && (
                  <ChampSaisie
                    libelle={`Téléphone ${LIBELLES_MOYEN[moyenPaiement]}`}
                    required
                    value={telephonePaiement}
                    onChange={(e) => setTelephonePaiement(e.target.value)}
                    inputMode="tel"
                    type="tel"
                    placeholder="+229 01 97 12 34 56"
                    aide={`Numéro du payeur pour ${LIBELLES_MOYEN[moyenPaiement]}. Paiement simulé en attendant l'intégration opérateur.`}
                  />
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-ardoise-clair/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ardoise">
                  Frais de service :{" "}
                  <strong className="text-lagune">
                    {formaterFcfa(FRAIS_SERVICE_PASSAGER_FCFA)}
                  </strong>{" "}
                  <span className="text-xs text-ardoise-clair">
                    (fixe · payé avant le QR)
                  </span>
                </p>
                <Bouton
                  variante="succes"
                  chargement={enregistrement}
                  disabled={enregistrement || !formulaireValide}
                  onClick={enregistrer}
                >
                  <IconeCheck className="h-4 w-4" /> Payer &amp; activer le suivi{" "}
                  {libellePassager}
                </Bouton>
              </div>
            </div>
          </Carte>
        </>
      )}
    </div>
  );
}
