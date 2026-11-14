"use client";
/**
 * Page « Ma cagnotte » — espace receveur/chauffeur/commerçant (S6).
 *
 * Affiche le solde du portefeuille, l'historique de tous les mouvements
 * (gains et dépenses) et la liste des gains reçus (20 à 150 FCFA selon le
 * nombre d'articles du colis).
 */
import { useCallback, useEffect, useState } from "react";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconePortefeuille } from "@/composants/commun/Icones";
import { formaterDateHeure, formaterFcfa } from "@/composants/logistique/format";
import { PaginationListe } from "@/composants/logistique/PaginationListe";
import { ErreurAPI } from "@/services/client_api";
import { paiementAPI } from "@/services/paiement_api";
import {
  type Commission,
  type MouvementPortefeuille,
  type Portefeuille,
} from "@/types/paiement";

export function CagnotteContenu({
  titre = "Ma cagnotte",
  sousTitre = "Vos gains et vos dépenses.",
  messageVide = "Aucune opération. Enregistrez un colis pour recevoir votre premier gain.",
  paginationServeur = false,
}: {
  /** Titre affiché (adapté au rôle : receveur, chauffeur…). */
  titre?: string;
  sousTitre?: string;
  /** Message quand aucun mouvement n'existe encore. */
  messageVide?: string;
  /** Active les pages serveur de cinq éléments pour l'espace chauffeur. */
  paginationServeur?: boolean;
} = {}) {
  const [portefeuille, setPortefeuille] = useState<Portefeuille | null>(null);
  const [mouvements, setMouvements] = useState<MouvementPortefeuille[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [mouvementsPage, setMouvementsPage] = useState(1);
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [totalMouvements, setTotalMouvements] = useState(0);
  const [totalCommissions, setTotalCommissions] = useState(0);
  const [montantTotalCommissions, setMontantTotalCommissions] = useState(0);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const [pf, mvs, coms] = await Promise.all([
        paiementAPI.portefeuilles.moi(),
        paiementAPI.portefeuilles.mesMouvements({
          page: paginationServeur ? mouvementsPage : 1,
          par_page: paginationServeur ? 5 : 50,
        }),
        paiementAPI.commissions.moi({
          page: paginationServeur ? commissionsPage : 1,
          par_page: paginationServeur ? 5 : 50,
          ...(paginationServeur ? { inclure_total_montant: true } : {}),
        }),
      ]);
      setPortefeuille(pf);
      setMouvements(mvs.elements);
      setCommissions(coms.elements);
      setTotalMouvements(mvs.total);
      setTotalCommissions(coms.total);
      setMontantTotalCommissions(coms.montant_total_fcfa ?? 0);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Impossible de charger votre cagnotte. Réessayez plus tard.",
      );
    } finally {
      setChargement(false);
    }
  }, [commissionsPage, mouvementsPage, paginationServeur]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const commissionsMontantAffiche = paginationServeur
    ? montantTotalCommissions
    : commissions.reduce(
        (somme, commission) => somme + (commission.montant_fcfa || 0),
        0,
      );

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ardoise">{titre}</h1>
        <p className="text-sm text-ardoise-clair">{sousTitre}</p>
      </div>

      {erreur && <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>}

      {/* Solde */}
      <div className="carte-accent flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-lagune text-white flex items-center justify-center flex-shrink-0">
            <IconePortefeuille className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-lagune font-bold">
              Argent disponible
            </p>
            <p className="text-3xl font-bold text-ardoise">
              {chargement ? "…" : formaterFcfa(portefeuille?.solde_fcfa ?? 0)}
            </p>
            {portefeuille?.maj_le && (
              <p className="text-xs text-ardoise-clair mt-1">
                Dernier mouvement : {formaterDateHeure(portefeuille.maj_le)}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-ardoise-clair font-semibold">
            Total gagné
          </p>
          <p className="text-xl font-bold text-lagune">
            {chargement ? "…" : formaterFcfa(commissionsMontantAffiche)}
          </p>
          <div className="mt-2">
            <Bouton
              variante="ghost"
              taille="petit"
              chargement={chargement}
              onClick={charger}
            >
              Actualiser
            </Bouton>
          </div>
        </div>
      </div>

      {/* Mouvements */}
      <Carte
        titre="Mes opérations"
        description="Vos gains et vos dépenses, simplement."
      >
        {chargement ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Chargement…
          </p>
        ) : mouvements.length === 0 ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            {messageVide}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ardoise-clair border-b border-ardoise-clair/20">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Opération</th>
                  <th className="py-2 pr-3 font-semibold text-right">Montant</th>
                  <th className="py-2 font-semibold text-right">Reste</th>
                </tr>
              </thead>
              <tbody>
                {mouvements.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-ardoise-clair/10 last:border-0"
                  >
                    <td className="py-2 pr-3 text-ardoise-clair whitespace-nowrap">
                      {formaterDateHeure(m.cree_le)}
                    </td>
                    <td className="py-2 pr-3 text-ardoise">
                      {m.sens === "CREDIT" ? "Gain" : "Dépense"}
                    </td>
                    <td
                      className={
                        "py-2 pr-3 text-right font-semibold whitespace-nowrap " +
                        (m.sens === "CREDIT" ? "text-green-700" : "text-terre")
                      }
                    >
                      {m.sens === "CREDIT" ? "+" : "−"}
                      {formaterFcfa(m.montant_fcfa)}
                    </td>
                    <td className="py-2 text-right text-ardoise whitespace-nowrap">
                      {formaterFcfa(m.solde_apres)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {paginationServeur && (
          <PaginationListe
            page={mouvementsPage}
            total={totalMouvements}
            parPage={5}
            chargement={chargement}
            surChangement={setMouvementsPage}
          />
        )}
      </Carte>

      {/* Commissions */}
      <Carte
        titre="Mes gains"
        description="Vous gagnez 20 à 150 F par colis, selon le nombre d'articles."
      >
        {chargement ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Chargement…
          </p>
        ) : commissions.length === 0 ? (
          <p className="text-sm text-ardoise-clair italic py-6 text-center">
            Aucun gain pour l&apos;instant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ardoise-clair border-b border-ardoise-clair/20">
                  <th className="py-2 pr-3 font-semibold">Date</th>
                  <th className="py-2 pr-3 font-semibold">Statut</th>
                  <th className="py-2 font-semibold text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-ardoise-clair/10 last:border-0"
                  >
                    <td className="py-2 pr-3 text-ardoise-clair whitespace-nowrap">
                      {formaterDateHeure(c.verse_le ?? c.cree_le)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variante={c.statut === "verse" ? "succes" : "ocre"}>
                        {c.statut === "verse" ? "Versée" : "À verser"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right font-semibold text-green-700 whitespace-nowrap">
                      {formaterFcfa(c.montant_fcfa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {paginationServeur && (
          <PaginationListe
            page={commissionsPage}
            total={totalCommissions}
            parPage={5}
            chargement={chargement}
            surChangement={setCommissionsPage}
          />
        )}
      </Carte>
    </div>
  );
}
