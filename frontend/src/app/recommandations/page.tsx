"use client";

/**
 * Page Recommandations — suggestions personnalisees pour booster son score.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import {
  obtenirMesRecommandations, type RecommandationDetail, type ListeRecommandations,
} from "@/services/gamification";
import { ErreurAPI } from "@/services/client_api";

const COULEURS_PRIORITE: Record<string, string> = {
  haute: "border-l-terre bg-terre/5",
  moyenne: "border-l-ocre bg-ocre/5",
  basse: "border-l-lagune bg-lagune/5",
};

export default function PageRecommandations() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={[      
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [donnees, setDonnees] = useState<ListeRecommandations | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    obtenirMesRecommandations()
      .then(setDonnees)
      .catch((e) => setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur"))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <p className="text-ardoise-clair italic">Analyse de ton profil...</p>;
  if (erreur) return <Alerte variante="erreur">{erreur}</Alerte>;
  if (!donnees) return null;

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Suggestions personnalisees
        </p>
        <h1 className="mt-1">Comment ameliorer mon score</h1>
        <p className="text-ardoise-clair mt-2 max-w-2xl">
          Notre moteur IA a analyse ton profil et te suggere les actions les plus
          rapides pour faire grimper ton score DigiID.
        </p>
      </header>

      {donnees.total === 0 ? (
        <Alerte variante="succes" titre="Bravo !">
          Tu n'as plus de recommandation a appliquer — ton profil est complet et engage !
        </Alerte>
      ) : (
        <>
          <Carte variante="accent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ardoise-clair">Gain potentiel total</p>
                <p className="text-5xl font-bold text-ocre">
                  +{donnees.gain_total_potentiel}<span className="text-2xl text-ardoise-clair"> points</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ardoise-clair">Recommandations actives</p>
                <p className="text-3xl font-bold text-lagune">{donnees.total}</p>
              </div>
            </div>
          </Carte>

          <div className="space-y-3">
            {donnees.recommandations.map((r) => (
              <CarteReco key={r.code} reco={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CarteReco({ reco }: { reco: RecommandationDetail }) {
  return (
    <div className={`bg-white rounded-xl border border-ardoise-clair/10 border-l-4 ${COULEURS_PRIORITE[reco.priorite]} p-4 flex items-start gap-4`}>
      <div className="text-4xl flex-shrink-0">{reco.icone}</div>
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="!text-base !mb-0">{reco.titre}</h3>
          <Badge
            variante={reco.priorite === "haute" ? "terre" : reco.priorite === "moyenne" ? "ocre" : "lagune"}
            taille="petit"
          >
            {reco.priorite}
          </Badge>
        </div>
        <p className="text-sm text-ardoise-clair">{reco.description}</p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <span className="text-2xl font-bold text-lagune">+{reco.gain_estime}</span>
        <Link href={reco.lien_action}>
          <Bouton variante="primaire" taille="petit">Y aller</Bouton>
        </Link>
      </div>
    </div>
  );
}
