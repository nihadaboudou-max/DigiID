
"use client";
/**
 * Enregistrement d'un enfant voyageant seul — suivi familial (Plan B, étape S7).
 *
 * Fort impact social : la famille confie un enfant à un transporteur ; le
 * guichet crée un ticket ``ENFANT`` (QR + code ``ENF-…``) et le parent reçoit
 * un **SMS de confirmation**. Au départ puis à l'arrivée, un second SMS est
 * envoyé automatiquement (voir la liste des suivis). L'enfant dispose aussi
 * d'une **page publique** de suivi (`/suivi/ENF-…`) consultable sans compte.
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
import { TicketSuiviFamilialImprimable } from "./TicketSuiviFamilialImprimable";

export function EnregistrementSuiviFamilial() {
  const { utilisateur } = useAuthentification();

  // Référentiel
  const [gares, setGares] = useState<Gare[]>([]);
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [chargementRef, setChargementRef] = useState(true);
  const [gareGuichet, setGareGuichet] = useState<Gare | null>(null);

  // Formulaire
  const [enfantNom, setEnfantNom] = useState("");
  const [enfantAge, setEnfantAge] = useState("");
  const [enfantSexe, setEnfantSexe] = useState("");
  const [parentNom, setParentNom] = useState("");
  const [telephoneParent, setTelephoneParent] = useState("");
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

  const gareParId = useMemo(() => {
    const index = new Map<string, Gare>();
    gares.forEach((g) => index.set(g.id, g));
    return index;
  }, [gares]);

  const nombreChiffresTel = telephoneParent.replace(/\D/g, "").length;
  const ageNombre = enfantAge.trim() === "" ? null : Number(enfantAge.replace(/\D/g, ""));
  const ageValide =
    ageNombre === null || (Number.isInteger(ageNombre) && ageNombre >= 0 && ageNombre <= 120);

  const formulaireValide =
    enfantNom.trim().length >= 2 &&
    nombreChiffresTel >= 6 &&
    ageValide &&
    !!gareDepartId &&
    !!gareArriveeId &&
    gareDepartId !== gareArriveeId;

  function nouvelEnregistrement() {
    setResultat(null);
    setEnfantNom("");
    setEnfantAge("");
    setEnfantSexe("");
    setParentNom("");
    setTelephoneParent("");
    setVoyageId("");
    setGareArriveeId("");
    setGareDepartId(gareGuichet?.id ?? "");
    setErreur(null);
  }

  async function enregistrer() {
    setErreur(null);
    setEnregistrement(true);
    try {
      const reponse = await logistiqueAPI.suiviFamilial.creer({
        enfant_nom: enfantNom.trim(),
        enfant_age: ageNombre,
        enfant_sexe: enfantSexe || null,
        parent_nom: parentNom.trim() || null,
        telephone_parent: telephoneParent.trim(),
        gare_depart_id: gareDepartId,
        gare_arrivee_id: gareArriveeId,
        voyage_id: voyageId || null,
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

  // ─── Écran de succès : ticket imprimable + lien de suivi ───────────
  if (resultat) {
    return (
      <div className="space-y-5 apparition">
        <Alerte variante="succes" titre="Enfant enregistré — suivi activé">
          Un SMS de confirmation a été envoyé au parent
          {" "}
          ({resultat.suivi.telephone_parent}). Le parent sera prévenu par SMS
          au départ puis à l&apos;arrivée de l&apos;enfant.
        </Alerte>

        <TicketSuiviFamilialImprimable
          ticket={resultat.ticket}
          suivi={resultat.suivi}
        />

        <div className="no-print flex flex-wrap gap-3">
          <Bouton variante="primaire" onClick={nouvelEnregistrement}>
            <IconeIdentite className="h-4 w-4" /> Enregistrer un autre enfant
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
        <Carte
          titre="Enfant voyageant seul"
          description="Renseignez l'enfant et le parent à prévenir. Un SMS partira au départ puis à l'arrivée."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ChampSaisie
                libelle="Nom complet de l'enfant"
                required
                value={enfantNom}
                onChange={(e) => setEnfantNom(e.target.value)}
                placeholder="Ex : Awa Traoré"
              />
              <ChampSaisie
                libelle="Âge de l'enfant (années)"
                value={enfantAge}
                onChange={(e) => setEnfantAge(e.target.value)}
                inputMode="numeric"
                placeholder="Ex : 9"
                erreur={ageValide ? undefined : "Âge invalide (0 à 120)"}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ardoise">
                Sexe de l&apos;enfant
              </label>
              <select
                className="champ-saisie"
                value={enfantSexe}
                onChange={(e) => setEnfantSexe(e.target.value)}
              >
                <option value="">— Non précisé —</option>
                <option value="M">Garçon</option>
                <option value="F">Fille</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ChampSaisie
                libelle="Nom du parent / tuteur"
                value={parentNom}
                onChange={(e) => setParentNom(e.target.value)}
                placeholder="Ex : Ibrahim Traoré"
              />
              <ChampSaisie
                libelle="Téléphone du parent"
                required
                value={telephoneParent}
                onChange={(e) => setTelephoneParent(e.target.value)}
                inputMode="tel"
                placeholder="Ex : 77 123 45 67"
                aide="Au moins 6 chiffres — c'est sur ce numéro que partent les SMS."
                erreur={
                  nombreChiffresTel >= 6 || nombreChiffresTel === 0
                    ? undefined
                    : "Au moins 6 chiffres"
                }
              />
            </div>

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

            {voyages.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ardoise">
                  Voyage (optionnel)
                </label>
                <select
                  className="champ-saisie"
                  value={voyageId}
                  onChange={(e) => setVoyageId(e.target.value)}
                >
                  <option value="">— Affectation ultérieure —</option>
                  {voyages.map((v) => (
                    <option key={v.id} value={v.id}>
                      {new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(v.date_depart))}
                      {v.vehicule_immatriculation
                        ? ` · ${v.vehicule_immatriculation}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end">
              <Bouton
                variante="succes"
                chargement={enregistrement}
                disabled={enregistrement || !formulaireValide}
                onClick={enregistrer}
              >
                <IconeCheck className="h-4 w-4" /> Enregistrer &amp; activer le suivi
              </Bouton>
            </div>
          </div>
        </Carte>
      )}
    </div>
  );
}
