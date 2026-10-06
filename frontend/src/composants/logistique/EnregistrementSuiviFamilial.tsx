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
  gareDeLActeur,
  logistiqueAPI,
  type Gare,
  type SuiviFamilialEnregistre,
  type Voyage,
} from "@/services/logistique_api";
import { ControleurBagages } from "./ControleurBagages";
import { formaterFcfa } from "./format";
import { RechercheCarteDigiID } from "./RechercheCarteDigiID";
import { TicketSuiviFamilialImprimable } from "./TicketSuiviFamilialImprimable";

type TypePassager = "enfant" | "adulte";

/** Frais de service fixe (doit refléter `frais_service_passager_fcfa` backend). */
const FRAIS_SERVICE_PASSAGER_FCFA = 100;

export function EnregistrementSuiviFamilial({
  digiidInitial,
}: {
  /** DigiID / lien de QR du client, quand l'agent arrive depuis /guichet/carte. */
  digiidInitial?: string;
} = {}) {
  const { utilisateur } = useAuthentification();

  // Référentiel
  const [gares, setGares] = useState<Gare[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
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
  const [voyageId, setVoyageId] = useState("");

  // État d'envoi
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [resultat, setResultat] = useState<SuiviFamilialEnregistre | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const [reponseGares, reponseVoyages] = await Promise.all([
          logistiqueAPI.gares.lister(),
          logistiqueAPI.voyages.lister().catch(() => ({ elements: [] as Voyage[] })),
        ]);
        if (annule) return;
        setGares(reponseGares.elements);
        setVoyages(reponseVoyages.elements);

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
  const chauffeurId = voyageSelectionne?.chauffeur_id ?? null;

  const nombreChiffresTel = (v: string) => v.replace(/\D/g, "").length;
  const telAcheteurOk = nombreChiffresTel(acheteurTel) >= 6;
  const telPassagerOk = nombreChiffresTel(telephonePassager) >= 6;
  const telProcheOk = nombreChiffresTel(procheTelephone) >= 6;

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

  const formulaireValide =
    enfantNom.trim().length >= 2 &&
    ageValide &&
    contactsValides &&
    telProcheOk &&
    !!gareDepartId &&
    !!gareArriveeId &&
    gareDepartId !== gareArriveeId &&
    !!voyageId &&
    !!chauffeurId;

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
    setVoyageId("");
    setGareArriveeId("");
    setGareDepartId(gareGuichet?.id ?? "");
    setErreur(null);
  }

  async function enregistrer() {
    setErreur(null);
    if (!chauffeurId) {
      setErreur(
        "Sélectionnez un voyage affecté à un chauffeur : l'attribution du chauffeur est obligatoire.",
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
        telephone_parent:
          (typePassager === "enfant" ? acheteurTel : telephonePassager).trim() ||
          null,
        type_passager: typePassager,
        telephone_passager:
          typePassager === "adulte" ? telephonePassager.trim() : null,
        acheteur_nom: typePassager === "enfant" ? acheteurNom.trim() : null,
        acheteur_tel: typePassager === "enfant" ? acheteurTel.trim() : null,
        proche_nom: procheNom.trim() || null,
        proche_telephone: procheTelephone.trim(),
        nombre_bagages: nombreBagages,
        gare_depart_id: gareDepartId,
        gare_arrivee_id: gareArriveeId,
        voyage_id: voyageId,
        chauffeur_id: chauffeurId,
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
            Frais de service : {formaterFcfa(resultat.suivi.frais_service_fcfa)}.
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
                    placeholder="Ex : 77 123 45 67"
                    erreur={
                      telAcheteurOk || acheteurTel === "" ? undefined : "Au moins 6 chiffres"
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
                  placeholder="Ex : 77 123 45 67"
                  erreur={
                    telPassagerOk || telephonePassager === ""
                      ? undefined
                      : "Au moins 6 chiffres"
                  }
                />
              )}

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
                  placeholder="Ex : 77 987 65 43"
                  aide="Prévenu en plus du responsable (départ, approche, arrivée)."
                  erreur={
                    telProcheOk || procheTelephone === "" ? undefined : "Au moins 6 chiffres"
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

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ardoise">
                  Voyage / chauffeur <span className="text-terre">*</span>
                </label>
                <select
                  className="champ-saisie"
                  value={voyageId}
                  onChange={(e) => setVoyageId(e.target.value)}
                >
                  <option value="">— Choisir un voyage —</option>
                  {voyages.map((v) => (
                    <option key={v.id} value={v.id} disabled={!v.chauffeur_id}>
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(v.date_depart))}
                      {v.vehicule_immatriculation ? ` · ${v.vehicule_immatriculation}` : ""}
                      {v.chauffeur_nom
                        ? ` · chauffeur : ${v.chauffeur_nom}`
                        : " · (aucun chauffeur affecté)"}
                    </option>
                  ))}
                </select>
                {voyageSelectionne && !chauffeurId && (
                  <p className="text-xs font-medium text-terre">
                    Ce voyage n&apos;a pas de chauffeur affecté — choisissez-en un autre.
                  </p>
                )}
                <p className="text-xs italic text-ardoise-clair">
                  Le chauffeur est attribué automatiquement d&apos;après le voyage sélectionné.
                </p>
              </div>

              <ControleurBagages valeur={nombreBagages} onChange={setNombreBagages} />

              <div className="flex flex-col gap-3 border-t border-ardoise-clair/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ardoise">
                  Frais de service :{" "}
                  <strong className="text-lagune">
                    {formaterFcfa(FRAIS_SERVICE_PASSAGER_FCFA)}
                  </strong>{" "}
                  <span className="text-xs text-ardoise-clair">
                    (fixe par passager, quel que soit le nombre de sacs)
                  </span>
                </p>
                <Bouton
                  variante="succes"
                  chargement={enregistrement}
                  disabled={enregistrement || !formulaireValide}
                  onClick={enregistrer}
                >
                  <IconeCheck className="h-4 w-4" /> Enregistrer &amp; activer le suivi{" "}
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
