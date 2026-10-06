"use client";
/**
 * Page publique de suivi (Plan B, étape S7) — « Suivi familial ».
 *
 * Accessible **sans connexion** depuis le code clair imprimé sur le ticket
 * (`…/suivi/DKR-2025-000001`) ou depuis le QR Code collé sur le colis. Elle
 * rassure la famille : trajet, statut, timeline et rappel des **SMS** envoyés.
 *
 * Un même écran sert pour un **colis** et pour un **enfant voyageant seul** :
 * le backend renvoie une vue unifiée (`type: "colis" | "enfant"`).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge, type BadgeVariante } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { formaterDateHeure } from "@/composants/logistique/format";
import { CarteTrajet } from "@/composants/logistique/CarteTrajet";
import { ErreurAPI } from "@/services/client_api";
import { logistiqueAPI } from "@/services/logistique_api";
import {
  LIBELLES_EVENEMENT,
  LIBELLES_EVENEMENT_SUIVI,
  type SuiviPublic,
} from "@/types/logistique";

/** Libellé lisible d'un statut, commun aux colis et aux enfants. */
const LIBELLES_STATUT: Record<string, string> = {
  enregistre: "Enregistré",
  enregistre_direct: "Enregistré en route",
  en_transit: "En transit",
  en_route: "En route",
  arrive: "Arrivé",
  livre: "Livré",
  annule: "Annulé",
};

/** Variante de badge par statut. */
const VARIANTES_STATUT: Record<string, BadgeVariante> = {
  enregistre: "info",
  enregistre_direct: "ocre",
  en_transit: "ocre",
  en_route: "ocre",
  arrive: "lagune",
  livre: "succes",
  annule: "terre",
};

/** Libellés d'événements (colis + enfant fusionnés). */
const LIBELLES_EVENEMENT_PUBLIC: Record<string, string> = {
  ...LIBELLES_EVENEMENT,
  ...LIBELLES_EVENEMENT_SUIVI,
};

/** Icône sobre par type d'événement. */
const ICONES_EVENEMENT: Record<string, string> = {
  enregistrement: "📦",
  depart: "🚚",
  mise_en_transit: "🛣️",
  arrivee: "📍",
  livraison: "✅",
  incident: "⚠️",
};

export default function PageSuiviPublic() {
  const parametres = useParams<{ code: string | string[] }>();
  const code = Array.isArray(parametres.code) ? parametres.code[0] : parametres.code;

  const [suivi, setSuivi] = useState<SuiviPublic | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!code) return;
    setChargement(true);
    setErreur(null);
    try {
      const resultat = await logistiqueAPI.suiviPublic.parCode(code);
      setSuivi(resultat);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger le suivi. Vérifiez le code et réessayez.",
      );
    } finally {
      setChargement(false);
    }
  }, [code]);

  useEffect(() => {
    void charger();
  }, [charger]);

  return (
    <div className="min-h-screen bg-sable-clair px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6 apparition">
        {/* En-tête */}
        <header className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-lagune">
            DigiID
          </p>
          <h1 className="mt-1 text-2xl font-bold text-ardoise">
            Suivi en temps réel
          </h1>
          <p className="text-sm text-ardoise-clair">
            Colis & enfants voyageant seuls — informations rassurantes pour la famille.
          </p>
          {code && (
            <p className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-ardoise shadow-sm">
              Code : {code}
            </p>
          )}
        </header>

        {chargement && (
          <Carte>
            <p className="py-10 text-center text-sm italic text-ardoise-clair">
              Chargement du suivi…
            </p>
          </Carte>
        )}

        {!chargement && erreur && (
          <div className="space-y-4">
            <Alerte variante="erreur" titre="Suivi introuvable">
              {erreur}
            </Alerte>
            <div className="flex justify-center gap-3">
              <Bouton variante="ghost" taille="petit" onClick={() => void charger()}>
                Réessayer
              </Bouton>
              <Link href="/">
                <Bouton variante="primaire" taille="petit">
                  Accueil DigiID
                </Bouton>
              </Link>
            </div>
          </div>
        )}

        {!chargement && suivi && (
          <>
            {/* Carte identité + trajet */}
            <Carte>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ardoise-clair">
                    {suivi.type === "enfant" ? "Enfant suivi" : "Colis"}
                  </p>
                  <p className="text-lg font-bold text-ardoise">
                    {suivi.type === "enfant"
                      ? suivi.enfant?.enfant_nom
                      : suivi.colis?.destinataire_nom}
                  </p>
                  {suivi.type === "enfant" && suivi.enfant?.enfant_age != null && (
                    <p className="text-xs text-ardoise-clair">
                      {suivi.enfant.enfant_age} ans
                      {suivi.enfant.enfant_sexe === "M"
                        ? " · Garçon"
                        : suivi.enfant.enfant_sexe === "F"
                        ? " · Fille"
                        : ""}
                    </p>
                  )}
                  {suivi.type === "enfant" && suivi.enfant && (
                    <p className="text-xs text-ardoise-clair">
                      {suivi.enfant.nombre_bagages} sac
                      {suivi.enfant.nombre_bagages > 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <Badge
                  variante={VARIANTES_STATUT[suivi.statut] ?? "neutre"}
                  taille="moyen"
                >
                  {LIBELLES_STATUT[suivi.statut] ?? suivi.statut}
                </Badge>
              </div>

              {/* Trajet */}
              <div className="mt-5 flex items-center justify-between gap-2 rounded-xl bg-sable px-4 py-3">
                <span className="text-sm font-semibold text-ardoise">
                  {suivi.gare_depart_nom ?? "Départ"}
                </span>
                <span className="text-lg text-ocre">→</span>
                <span className="text-sm font-semibold text-ardoise text-right">
                  {suivi.gare_arrivee_nom ?? "Arrivée"}
                </span>
              </div>

              {(suivi.date_depart || suivi.vehicule_immatriculation) && (
                <p className="mt-2 text-xs text-ardoise-clair">
                  {suivi.date_depart && `Départ prévu : ${formaterDateHeure(suivi.date_depart)}`}
                  {suivi.vehicule_immatriculation &&
                    ` · Véhicule ${suivi.vehicule_immatriculation}`}
                </p>
              )}

              {/* Schéma du trajet : où en est l'envoi, sans carte externe. */}
              <div className="mt-4 border-t border-ardoise-clair/10 pt-4">
                <CarteTrajet
                  gareDepart={suivi.gare_depart_nom}
                  gareArrivee={suivi.gare_arrivee_nom}
                  statut={suivi.statut}
                  evenements={suivi.evenements}
                />
              </div>

              {suivi.type === "colis" && suivi.colis && (
                <p className="mt-2 text-xs text-ardoise-clair">
                  {suivi.colis.nombre_articles} article
                  {suivi.colis.nombre_articles > 1 ? "s" : ""}
                  {" · "}
                  {suivi.colis.nombre_bagages} sac
                  {suivi.colis.nombre_bagages > 1 ? "s" : ""}
                  {suivi.colis.description ? ` · ${suivi.colis.description}` : ""}
                </p>
              )}
            </Carte>

            {/* Timeline */}
            <Carte titre="Étapes du voyage">
              {suivi.evenements.length === 0 ? (
                <p className="text-sm italic text-ardoise-clair">
                  Aucune étape enregistrée pour le moment.
                </p>
              ) : (
                <ol className="relative">
                  {suivi.evenements.map((evenement, index) => {
                    const estDernier = index === suivi.evenements.length - 1;
                    return (
                      <li
                        key={`${evenement.type_evenement}-${evenement.horodatage}-${index}`}
                        className="relative pb-6 pl-10 last:pb-0"
                      >
                        {!estDernier && (
                          <span className="absolute left-[15px] top-6 bottom-0 w-0.5 bg-ardoise-clair/15" />
                        )}
                        <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm shadow-sm">
                          <span aria-hidden="true">
                            {ICONES_EVENEMENT[evenement.type_evenement] ?? "•"}
                          </span>
                        </span>
                        <div>
                          <p className="font-semibold text-ardoise">
                            {LIBELLES_EVENEMENT_PUBLIC[evenement.type_evenement] ??
                              evenement.type_evenement}
                          </p>
                          <p className="text-xs text-ardoise-clair">
                            {formaterDateHeure(evenement.horodatage)}
                            {evenement.gare_nom ? ` · ${evenement.gare_nom}` : ""}
                            {evenement.localisation ? ` · ${evenement.localisation}` : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Carte>

            {/* SMS envoyés (rendus visibles en mode mock) */}
            <Carte
              titre="Notifications SMS"
              description={
                suivi.nb_personnes_notifiees > 0
                  ? `${suivi.nb_personnes_notifiees} personne(s) prévenue(s) par SMS.`
                  : "Aucun SMS envoyé pour le moment."
              }
            >
              {suivi.notifications.length === 0 ? (
                <p className="text-sm italic text-ardoise-clair">
                  Les SMS de départ et d&apos;arrivée apparaîtront ici une fois envoyés.
                </p>
              ) : (
                <ul className="space-y-3">
                  {suivi.notifications.map((notification, index) => (
                    <li
                      key={`${notification.type_evenement}-${index}`}
                      className="rounded-xl border border-ardoise-clair/10 bg-sable/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-lagune">
                          {LIBELLES_EVENEMENT_PUBLIC[notification.type_evenement] ??
                            notification.type_evenement}
                        </span>
                        <span className="text-[11px] text-ardoise-clair">
                          {notification.telephone_masque ?? "—"} ·{" "}
                          {formaterDateHeure(notification.cree_le)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-ardoise">{notification.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>

            <p className="text-center text-xs text-ardoise-clair">
              Le suivi est fourni par DigiID. Le numéro de téléphone de la famille
              reste protégé ; seuls des extraits masqués sont affichés.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
