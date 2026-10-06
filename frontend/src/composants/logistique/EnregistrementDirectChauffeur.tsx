
"use client";
/**
 * EnregistrementDirectChauffeur — « le client monte en route, le chauffeur l'enregistre ».
 *
 * Cas très fréquent dans la réalité : un passager fait signe au car en cours de
 * trajet, ou confie un sac au chauffeur entre deux arrêts. Officiellement, ces
 * personnes n'existent alors nulle part : aucune trace, aucun SMS, aucun recours
 * en cas de perte.
 *
 * Ce formulaire referme ce trou **sans casser le modèle du guichet** :
 *  - le chauffeur ne peut créer que sur **son propre voyage** ;
 *  - le backend impose le chauffeur = utilisateur connecté et le mode
 *    `chauffeur_direct`, donc le colis reste traçable et attribuable ;
 *  - la gare de départ et d'arrivée sont celles du voyage : le chauffeur ne
 *    choisit rien, il ne peut donc pas se tromper.
 */
import { useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { IconeCheck } from "@/composants/commun/Icones";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import {
  ControleurBagages,
} from "@/composants/logistique/ControleurBagages";
import { RechercheCarteDigiID } from "@/composants/logistique/RechercheCarteDigiID";

type TypeEnregistrement = "colis" | "passager";

interface Proprietes {
  voyageId: string;
  /** Gare de départ du voyage (imposée : le chauffeur ne la choisit pas). */
  gareDepartId: string | null;
  /** Gare d'arrivée du voyage (imposée). */
  gareArriveeId: string | null;
  /** Appelé après un enregistrement réussi (rafraîchit le manifeste). */
  surSucces?: () => void;
}

export function EnregistrementDirectChauffeur({
  voyageId,
  gareDepartId,
  gareArriveeId,
  surSucces,
}: Proprietes) {
  const [type, setType] = useState<TypeEnregistrement>("colis");

  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [description, setDescription] = useState("");
  const [nombreArticles, setNombreArticles] = useState("1");
  const [nombreBagages, setNombreBagages] = useState(1);
  const [fraisFcfa, setFraisFcfa] = useState("");

  // Passager
  const [age, setAge] = useState("");
  const [sexe, setSexe] = useState("");
  const [procheNom, setProcheNom] = useState("");
  const [procheTelephone, setProcheTelephone] = useState("");

  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [codeCree, setCodeCree] = useState<string | null>(null);

  const nombreChiffresTel = telephone.replace(/\D/g, "").length;
  const telOk = nombreChiffresTel >= 6;
  const nomOk = nom.trim().length >= 2;
  const garesOk = !!gareDepartId && !!gareArriveeId && gareDepartId !== gareArriveeId;

  const formulaireValide =
    garesOk && nomOk && telOk && (type === "colis" || procheTelephone.replace(/\D/g, "").length >= 6);

  function reinitialiser() {
    setNom("");
    setTelephone("");
    setDescription("");
    setNombreArticles("1");
    setNombreBagages(1);
    setFraisFcfa("");
    setAge("");
    setSexe("");
    setProcheNom("");
    setProcheTelephone("");
    setErreur(null);
    setCodeCree(null);
  }

  async function enregistrer() {
    if (!gareDepartId || !gareArriveeId) {
      setErreur("Ce voyage n'a pas de trajet défini : impossible d'enregistrer en route.");
      return;
    }
    setErreur(null);
    setEnregistrement(true);
    try {
      const articles = Math.max(1, Number(nombreArticles.replace(/\D/g, "")) || 1);
      const frais = fraisFcfa.trim() === "" ? null : Number(fraisFcfa);

      if (type === "colis") {
        const reponse = await logistiqueAPI.colis.creer({
          destinataire_nom: nom.trim(),
          destinataire_tel: telephone.trim(),
          gare_depart_id: gareDepartId,
          gare_arrivee_id: gareArriveeId,
          description: description.trim() || null,
          nombre_articles: articles,
          nombre_bagages: nombreBagages,
          frais_fcfa: frais !== null && !Number.isNaN(frais) ? frais : null,
          voyage_id: voyageId,
          // Le backend force le chauffeur = utilisateur connecté : inutile (et
          // impossible) de connaître son propre UUID côté téléphone.
          enregistrement_direct: true,
        });
        setCodeCree(reponse.ticket.code_clair);
      } else {
        const ageNombre = age.trim() === "" ? null : Number(age.replace(/\D/g, ""));
        const reponse = await logistiqueAPI.suiviFamilial.creer({
          enfant_nom: nom.trim(),
          enfant_age: ageNombre !== null && !Number.isNaN(ageNombre) ? ageNombre : null,
          enfant_sexe: sexe || null,
          type_passager: "adulte",
          telephone_passager: telephone.trim(),
          telephone_parent: telephone.trim(),
          acheteur_nom: nom.trim(),
          acheteur_tel: telephone.trim(),
          proche_nom: procheNom.trim() || null,
          proche_telephone: procheTelephone.trim(),
          nombre_bagages: nombreBagages,
          gare_depart_id: gareDepartId,
          gare_arrivee_id: gareArriveeId,
          voyage_id: voyageId,
          enregistrement_direct: true,
        });
        setCodeCree(reponse.ticket.code_clair);
      }
      surSucces?.();
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Échec de l'enregistrement en route.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  if (codeCree) {
    return (
      <Carte
        titre="Client enregistré en route"
        variante="accent"
      >
        <Alerte variante="succes" titre="Enregistrement réussi">
          Le client peut désormais suivre son envoi avec le code ci-dessous, et les
          SMS de suivi partiront automatiquement.
        </Alerte>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge variante="lagune" taille="moyen">
            {codeCree}
          </Badge>
          <a
            href={`/suivi/${encodeURIComponent(codeCree)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-lagune hover:underline"
          >
            Ouvrir la page de suivi
          </a>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Bouton variante="primaire" onClick={reinitialiser}>
            <IconeCheck className="w-4 h-4" /> Enregistrer un autre client
          </Bouton>
        </div>
      </Carte>
    );
  }

  return (
    <Carte
      titre="Enregistrer un client monté en route"
      description="Un passager vous fait signe entre deux arrêts, ou vous confie un sac : créez sa fiche maintenant pour qu'il soit tracé et couvert par les SMS de suivi."
    >
      <div className="space-y-4">
        {/* Choix colis / passager */}
        <div className="flex gap-2">
          {(["colis", "passager"] as TypeEnregistrement[]).map((valeur) => (
            <button
              key={valeur}
              type="button"
              onClick={() => {
                setType(valeur);
                setCodeCree(null);
              }}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                type === valeur
                  ? "border-ocre bg-ocre/10 text-ocre-fonce"
                  : "border-ardoise/20 bg-white text-ardoise hover:bg-ocre/5"
              }`}
            >
              {valeur === "colis" ? "Colis confié" : "Passager"}
            </button>
          ))}
        </div>

        {!garesOk && (
          <Alerte variante="avertissement" titre="Trajet incomplet">
            Ce voyage n&apos;a pas de trajet (gares de départ et d&apos;arrivée) défini :
            l&apos;enregistrement en route est impossible.
          </Alerte>
        )}

        {/* Le client présente sa carte : tout se remplit sans faute de frappe. */}
        <RechercheCarteDigiID
          libelle={type === "colis" ? "DigiID du client (facultatif)" : "DigiID du passager (facultatif)"}
          titre="Le client a une carte DigiID ?"
          description="Présentez sa carte : le nom et le téléphone se remplissent automatiquement — les SMS partiront au bon numéro."
          surSelection={(contact) => {
            if (!contact) return;
            setNom(contact.nom_complet);
            if (contact.telephone) setTelephone(contact.telephone);
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ChampSaisie
            libelle={type === "colis" ? "Nom du destinataire" : "Nom du passager"}
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder={type === "colis" ? "Ex : Fatou Ndiaye" : "Ex : Moussa Diop"}
          />
          <ChampSaisie
            libelle={type === "colis" ? "Téléphone du destinataire" : "Téléphone du passager"}
            required
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            inputMode="tel"
            placeholder="Ex : 77 123 45 67"
            erreur={telOk || telephone === "" ? undefined : "Au moins 6 chiffres"}
          />
        </div>

        {type === "colis" ? (
          <>
            <ChampSaisie
              libelle="Description du colis"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex : sac de voyage noir, 1 carton…"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ChampSaisie
                libelle="Nombre d'articles"
                required
                inputMode="numeric"
                value={nombreArticles}
                onChange={(e) => setNombreArticles(e.target.value)}
              />
              <ChampSaisie
                libelle="Prix du transport (FCFA)"
                inputMode="numeric"
                value={fraisFcfa}
                onChange={(e) => setFraisFcfa(e.target.value)}
                placeholder="Facultatif"
                aide="Montant convenu avec le client — DigiID ne l'encaisse pas."
              />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ChampSaisie
                libelle="Âge (années)"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Ex : 32"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ardoise">Sexe</label>
                <select
                  className="champ-saisie"
                  value={sexe}
                  onChange={(e) => setSexe(e.target.value)}
                >
                  <option value="">— Non précisé —</option>
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ChampSaisie
                libelle="Proche de confiance (nom)"
                value={procheNom}
                onChange={(e) => setProcheNom(e.target.value)}
                placeholder="Ex : Awa Diop"
              />
              <ChampSaisie
                libelle="Téléphone du proche"
                required
                value={procheTelephone}
                onChange={(e) => setProcheTelephone(e.target.value)}
                inputMode="tel"
                placeholder="Ex : 77 987 65 43"
                aide="Sera prévenu au départ et à l'arrivée."
                erreur={
                  procheTelephone.replace(/\D/g, "").length >= 6 ||
                  procheTelephone === ""
                    ? undefined
                    : "Au moins 6 chiffres"
                }
              />
            </div>
          </>
        )}

        <ControleurBagages valeur={nombreBagages} onChange={setNombreBagages} />

        {erreur && (
          <Alerte variante="erreur" titre="Erreur">
            {erreur}
          </Alerte>
        )}

        <div className="flex justify-end">
          <Bouton
            variante="primaire"
            chargement={enregistrement}
            disabled={enregistrement || !formulaireValide}
            onClick={() => void enregistrer()}
          >
            <IconeCheck className="w-4 h-4" /> Enregistrer en route
          </Bouton>
        </div>

        <p className="text-xs text-ardoise-clair">
          L&apos;envoi sera marqué <strong>« enregistré en route »</strong> : au guichet
          comme à l&apos;arrivée, on saura qu&apos;il a été créé par le chauffeur et non
          au comptoir. Le trajet utilisé est celui de votre voyage.
        </p>
      </div>
    </Carte>
  );
}
