"use client";

/**
 * Page Score → Mes accès (évaluation contextuelle)
 *
 * Branche le frontend sur le NOUVEL endpoint backend v2 :
 *   POST /api/v1/utilisateur/score/evaluer
 *
 * Principe du "score asymétrique" : selon le cas d'usage (crédit, aide
 * humanitaire, assurance...), le seuil requis n'est pas le même. Un score
 * de 45/100 suffit pour une aide ONG mais pas pour un microcrédit.
 * Cette page montre au citoyen ce que son score lui ouvre concrètement,
 * sans exposer de chiffre brut inutilement.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { useAuthentification } from "@/contextes/authentification";
import {
  evaluerScorePourContexte,
  type ResultatEvaluationContextuelle,
  type SeuilContexte,
} from "@/services/score";
import { ErreurAPI } from "@/services/client_api";

const ROLES_AUTORISES = [
  "citoyen",
  "agent_police",
  "chef_police",
  "agent_medical",
  "chef_medical",
  "agent_ong",
  "chef_ong",
  "agent_terrain",
  "chef_agent",
  "admin_domaine",
  "administrateur",
  "super_administrateur",
];

export default function PageContextesScore() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_AUTORISES}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [evaluation, setEvaluation] = useState<ResultatEvaluationContextuelle | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const digiid = utilisateur?.digiid_public ?? null;

  const chargerEvaluation = useCallback(async () => {
    if (!digiid) {
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      // contexte vide → le backend renvoie tous les cas d'usage
      const resultat = await evaluerScorePourContexte({
        digiid,
        contexte: "",
      });
      setEvaluation(resultat);
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Erreur lors de l'évaluation de tes accès",
      );
    } finally {
      setChargement(false);
    }
  }, [digiid]);

  useEffect(() => {
    chargerEvaluation();
  }, [chargerEvaluation]);

  if (chargement) {
    return <p className="text-ardoise-clair italic">Analyse de tes accès...</p>;
  }

  if (erreur) {
    return <Alerte variante="erreur" titre="Erreur">{erreur}</Alerte>;
  }

  if (!digiid) {
    return (
      <div className="space-y-8 apparition">
        <RetourScore />
        <Alerte variante="info" titre="DigiID public manquant">
          Ton DigiID public n&apos;est pas encore assigné à ton compte. Recontacte un
          administrateur pour activer la consultation de tes accès, ou reviens plus tard.
        </Alerte>
        <Link href="/score">
          <Bouton variante="ghost" taille="petit">← Retour au score</Bouton>
        </Link>
      </div>
    );
  }

  if (!evaluation) return null;

  const eligibles = evaluation.contextes.filter((c) => c.eligible);
  const nonEligibles = evaluation.contextes.filter((c) => !c.eligible);

  return (
    <div className="space-y-8 apparition">
      <RetourScore />

      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Score asymétrique
        </p>
        <h1 className="mt-1">Mes accès ouverts</h1>
        <p className="text-ardoise-clair mt-2 max-w-2xl">
          Ton score n&apos;a pas la même valeur selon l&apos;usage. Ce tableau montre,
          pour chaque cas d&apos;usage, si ton niveau actuel te rend éligible.
        </p>
      </header>

      {/* Résumé */}
      <div className="flex flex-wrap items-center gap-6">
        <Carte variante="accent" className="flex items-center gap-4">
          <p className="text-5xl font-bold text-lagune">{evaluation.score}</p>
          <div>
            <p className="text-xs uppercase text-ocre font-bold">Score actuel</p>
            <p className="text-sm text-ardoise-clair">
              {eligibles.length} accès ouverts sur {evaluation.contextes.length}
            </p>
          </div>
        </Carte>
        <p className="text-xs text-ardoise-clair italic max-w-md">
          Identifiant public utilisé : <code>{evaluation.digiid}</code>
        </p>
      </div>

      {/* Accès ouverts */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Déjà accessibles ({eligibles.length})</h2>
        {eligibles.length === 0 ? (
          <Alerte variante="info" titre="Aucun accès ouvert pour le moment">
            Ton score est encore en construction. Consulte les conseils d&apos;amélioration
            pour débloquer tes premiers accès.
          </Alerte>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {eligibles.map((c) => (
              <CarteContexteCle key={c.contexte} contexte={c} eligible />
            ))}
          </div>
        )}
      </section>

      {/* Accès à venir */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Accès à venir ({nonEligibles.length})</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {nonEligibles.map((c) => (
            <CarteContexteCle key={c.contexte} contexte={c} eligible={false} />
          ))}
        </div>
      </section>

      {/* Explication */}
      <Carte variante="pointilles" titre="Pourquoi les seuils varient ?">
        <p className="text-sm text-ardoise mb-3">
          C&apos;est le principe du <strong>score asymétrique</strong> : une institution ne
          demande pas la même preuve de confiance selon le risque de l&apos;opération.
          Ouvrir un compte bancaire exige plus de garanties que recevoir une aide
          humanitaire.
        </p>
        <p className="text-sm text-ardoise">
          Ton score brut reste <strong>confidentiel</strong> : cette page ne montre que
          le résultat éligible / non éligible par usage, comme le ferait un partenaire.
        </p>
      </Carte>

      {/* Navigation */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-ardoise-clair/10">
        <Link href="/score">
          <Bouton variante="ghost" taille="petit">← Vue d&apos;ensemble du score</Bouton>
        </Link>
        <Link href="/score/amelioration">
          <Bouton variante="secondaire" taille="petit">Conseils d&apos;amélioration →</Bouton>
        </Link>
      </div>
    </div>
  );
}

function RetourScore() {
  return (
    <nav className="flex items-center gap-2 text-sm text-ardoise-clair/70">
      <Link href="/score" className="hover:text-ocre transition-colors">Score</Link>
      <span className="text-ardoise-clair/30">/</span>
      <span className="text-ardoise font-semibold">Mes accès</span>
    </nav>
  );
}

function CarteContexteCle({
  contexte,
  eligible,
}: {
  contexte: SeuilContexte;
  eligible: boolean;
}) {
  return (
    <Carte className={eligible ? "border-green-200 bg-green-50/40" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="!text-base !mb-0">{contexte.libelle}</h3>
            <Badge variante={eligible ? "succes" : "neutre"} taille="petit">
              {eligible ? "Éligible" : "Non éligible"}
            </Badge>
          </div>
          <p className="text-sm text-ardoise-clair mt-1">{contexte.message}</p>
          <p className="text-xs text-ardoise-clair/60 italic mt-2">
            Seuil requis : {contexte.seuil_requis}/100
          </p>
        </div>
        <span
          className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
            eligible ? "bg-green-500" : "bg-ardoise-clair/40"
          }`}
          title={eligible ? "Éligible" : "Non éligible"}
        />
      </div>
    </Carte>
  );
}
