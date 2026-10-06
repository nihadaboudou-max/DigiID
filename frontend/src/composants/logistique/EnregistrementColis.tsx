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
 * encaissés séparément, après le ticket.
 *
 * À l'enregistrement, le backend génère le ticket (numéro en clair + QR durable).
 */
import { useEffect, useMemo, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeCheck, IconeColis, IconeTicket } from "@/composants/commun/Icones";
import { BoutonVocal } from "@/composants/accessibilite/BoutonVocal";
import { PaiementColis } from "@/composants/paiement/PaiementColis";
import { useLangue } from "@/i18n/useLangue";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import {
  gareDeLActeur,
  logistiqueAPI,
  type ColisEnregistre,
  type Gare,
  type Voyage,
} from "@/services/logistique_api";
import { ControleurBagages } from "./ControleurBagages";
import { formaterFcfa } from "./format";
import { RechercheCarteDigiID } from "./RechercheCarteDigiID";
import { TicketImprimable } from "./TicketImprimable";
import { fraisServicePourArticles } from "@/types/paiement";

type Etape = 1 | 2 | 3 | 4;

const ETAPES: { numero: Etape; cleTitre: string }[] = [
  { numero: 1, cleTitre: "colis.etape.expediteur" },
  { numero: 2, cleTitre: "colis.etape.destinataire" },
  { numero: 3, cleTitre: "colis.etape.details" },
  { numero: 4, cleTitre: "colis.etape.recap" },
];

export function EnregistrementColis({
  digiidInitial,
}: {
  /** DigiID / lien de QR du client, quand l'agent arrive depuis /guichet/carte. */
  digiidInitial?: string;
} = {}) {
  const { utilisateur } = useAuthentification();
  const { t } = useLangue();

  // Référentiel
  const [gares, setGares] = useState<Gare[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
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
  const [voyageId, setVoyageId] = useState("");

  // État d'envoi
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [resultat, setResultat] = useState<ColisEnregistre | null>(null);

  // ─── Chargement du référentiel ─────────────────────────────────────
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

        // Pré-remplit la gare de départ depuis la fiche acteur du receveur.
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
  const chauffeurId = voyageSelectionne?.chauffeur_id ?? null;

  const nombreChiffresTel = destinataireTel.replace(/\D/g, "").length;
  const nombreChiffresTelExpediteur = expediteurTel.replace(/\D/g, "").length;

  const etapeExpediteurValide =
    expediteurNom.trim().length >= 2 && nombreChiffresTelExpediteur >= 6;

  const etapeDestinataireValide =
    destinataireNom.trim().length >= 2 &&
    nombreChiffresTel >= 6 &&
    !!gareDepartId &&
    !!gareArriveeId &&
    gareDepartId !== gareArriveeId;

  // Prix du transport : **facultatif** (vide = non renseigné).
  const fraisNombre = fraisFcfa.trim() === "" ? null : Number(fraisFcfa);
  const fraisValide = fraisNombre === null || (!Number.isNaN(fraisNombre) && fraisNombre >= 0);

  // Nombre d'articles : détermine le frais de service DigiID (barème par tranches).
  const nombreArticlesNombre = Number(nombreArticles.replace(/\D/g, ""));
  const nombreArticlesValide =
    Number.isInteger(nombreArticlesNombre) && nombreArticlesNombre >= 1;
  const fraisService = fraisServicePourArticles(
    nombreArticlesValide ? nombreArticlesNombre : 1,
  );
  // Attribution **obligatoire** : trajet + voyage + chauffeur précis.
  const attributionValide = !!voyageId && !!chauffeurId;
  const etapeDetailsValide = fraisValide && nombreArticlesValide && attributionValide;

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
    setVoyageId("");
    setGareArriveeId("");
    setGareDepartId(gareGuichet?.id ?? "");
    setErreur(null);
  }

  async function enregistrer() {
    setErreur(null);
    setEnregistrement(true);
    try {
      const poids = poidsKg ? Number(poidsKg.replace(",", ".")) : null;
      const valeur = valeurFcfa ? Number(valeurFcfa.replace(",", ".")) : null;
      const reponse = await logistiqueAPI.colis.creer({
        expediteur_nom: expediteurNom.trim() || null,
        expediteur_tel: expediteurTel.trim() || null,
        destinataire_nom: destinataireNom.trim(),
        destinataire_tel: destinataireTel.trim(),
        gare_depart_id: gareDepartId,
        gare_arrivee_id: gareArriveeId,
        description: description.trim() || null,
        poids_kg: poids !== null && !Number.isNaN(poids) ? poids : null,
        valeur_fcfa: valeur !== null && !Number.isNaN(valeur) ? valeur : null,
        nombre_articles: nombreArticlesValide ? nombreArticlesNombre : 1,
        nombre_bagages: nombreBagages,
        frais_fcfa:
          fraisNombre !== null && !Number.isNaN(fraisNombre) ? fraisNombre : null,
        voyage_id: voyageId,
        chauffeur_id: chauffeurId as string,
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

  // ─── Écran de succès : ticket imprimable ───────────────────────────
  if (resultat) {
    return (
      <div className="space-y-5 apparition">
        <Alerte variante="succes" titre={t("colis.succes.titre")}>
          {t("colis.succes.desc")}
        </Alerte>

        <TicketImprimable ticket={resultat.ticket} colis={resultat.colis} />

        {/* S6 — encaissement des frais + commission du receveur */}
        <PaiementColis colis={resultat.colis} />

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
    <div className="space-y-5">
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
                  placeholder="Ex : 77 123 45 67"
                  inputMode="tel"
                  aide="Au moins 6 chiffres — sert à joindre l'expéditeur si besoin."
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
                  placeholder="Ex : 77 123 45 67"
                  inputMode="tel"
                  aide="Au moins 6 chiffres — sert à prévenir le destinataire."
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
                        {v.vehicule_immatriculation
                          ? ` · ${v.vehicule_immatriculation}`
                          : ""}
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
                    voyageSelectionne
                      ? `${voyageSelectionne.vehicule_immatriculation ?? "Voyage"}${
                          voyageSelectionne.chauffeur_nom
                            ? ` · ${voyageSelectionne.chauffeur_nom}`
                            : ""
                        }`
                      : "—"
                  }
                />
                <Ligne
                  libelle="Frais de service DigiID (estimé)"
                  valeur={`${formaterFcfa(
                    fraisService.frais_fcfa,
                  )} (dont ${formaterFcfa(fraisService.part_receveur_fcfa)} receveur)`}
                />
              </dl>

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
                    !etapeDetailsValide
                  }
                  onClick={enregistrer}
                >
                  <IconeCheck className="w-4 h-4" /> {t("btn.enregistrer")}
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
