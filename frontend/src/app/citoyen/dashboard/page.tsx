"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { IconeCamion, IconeCheck, IconeFlecheRetour, IconeUtilisateur } from "@/composants/commun/Icones";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { useAuthentification } from "@/contextes/authentification";
import { ErreurAPI } from "@/services/client_api";
import { identiteAPI, type VoyageCitoyen } from "@/services/identite_api";

interface StatutAffiche {
  libelle: string;
  classes: string;
}

function statutAffiche(statut: string): StatutAffiche {
  const normalise = statut
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]/g, " ");

  if (["livre", "arrive", "remis", "termine"].some((mot) => normalise.includes(mot))) {
    return { libelle: "Arrivé", classes: "bg-green-100 text-green-900" };
  }
  if (["route", "transit", "cours", "embarque", "depart"].some((mot) => normalise.includes(mot))) {
    return { libelle: "En route", classes: "bg-blue-100 text-blue-900" };
  }
  if (["annule", "echec", "rejete"].some((mot) => normalise.includes(mot))) {
    return { libelle: "Annulé", classes: "bg-red-100 text-red-900" };
  }
  if (!normalise) {
    return { libelle: "En attente", classes: "bg-orange-100 text-orange-900" };
  }

  const libelle = normalise.charAt(0).toLocaleUpperCase() + normalise.slice(1);
  return { libelle, classes: "bg-orange-100 text-orange-900" };
}

export default function CitoyenDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur, chargement: chargementAuth } = useAuthentification();
  const [codeSuivi, setCodeSuivi] = useState("");
  const [elements, setElements] = useState<VoyageCitoyen[]>([]);
  const [chargementEnvois, setChargementEnvois] = useState(true);
  const [erreurEnvois, setErreurEnvois] = useState<string | null>(null);
  const [erreurCode, setErreurCode] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (chargementAuth || !utilisateur) return;

    let ignore = false;
    setChargementEnvois(true);
    setErreurEnvois(null);
    identiteAPI
      .mesVoyagesPagines({ page: 1, parPage: 5 })
      .then((resultat) => {
        if (!ignore) setElements(resultat.elements);
      })
      .catch((erreur: unknown) => {
        if (!ignore) {
          setErreurEnvois(
            erreur instanceof ErreurAPI
              ? erreur.message_utilisateur
              : "Impossible de charger tes envois. Réessaie dans un instant.",
          );
        }
      })
      .finally(() => {
        if (!ignore) setChargementEnvois(false);
      });

    return () => {
      ignore = true;
    };
  }, [chargementAuth, utilisateur]);

  if (chargementAuth) {
    return (
      <div className="py-12 text-center text-lg text-ardoise-clair apparition">
        Chargement…
      </div>
    );
  }

  if (!utilisateur) return null;

  const verifications = [
    { libelle: "E-mail", fait: utilisateur.est_email_verifie },
    { libelle: "WhatsApp", fait: utilisateur.est_telephone_verifie === true },
    { libelle: "Pièce d'identité", fait: utilisateur.est_cni_verifiee === true },
    { libelle: "Visage", fait: utilisateur.est_visage_verifie === true },
  ];
  const pourcentage = Math.round(
    (verifications.filter((verification) => verification.fait).length /
      verifications.length) *
      100,
  );

  function suivreEnvoi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = codeSuivi.trim();
    if (code.length < 3) {
      setErreurCode("Saisis le code indiqué sur le ticket.");
      return;
    }

    setErreurCode(null);
    router.push(`/suivi/${encodeURIComponent(code)}`);
  }

  return (
    <div className="space-y-5 apparition pb-20">
      <Carte titre="Suivre un envoi">
        <form onSubmit={suivreEnvoi} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="code-suivi" className="font-semibold text-lg text-ardoise">
              Code de votre colis ou enfant
            </label>
            <input
              id="code-suivi"
              className="min-h-14 w-full rounded-xl border-2 border-ardoise-clair/20 px-4 text-lg text-ardoise focus:border-lagune focus:outline-none"
              value={codeSuivi}
              onChange={(event) => setCodeSuivi(event.target.value)}
              placeholder="Ex. DKR-2025-000123"
              autoComplete="off"
              aria-describedby={erreurCode ? "erreur-code-suivi" : undefined}
            />
            {erreurCode && (
              <p id="erreur-code-suivi" role="alert" className="text-lg font-semibold text-terre">
                {erreurCode}
              </p>
            )}
          </div>
          <Bouton
            type="submit"
            taille="grand"
            className="min-h-14 self-end sm:min-w-36"
          >
            <IconeCamion className="h-5 w-5" aria-hidden="true" />
            Suivre
          </Bouton>
        </form>
      </Carte>

      <Carte titre="Mes envois">
        {erreurEnvois ? (
          <Alerte variante="erreur" titre="Envois indisponibles">
            {erreurEnvois}
          </Alerte>
        ) : chargementEnvois ? (
          <p className="py-4 text-center text-lg text-ardoise-clair">
            Chargement de tes envois…
          </p>
        ) : elements.length === 0 ? (
          <p className="py-4 text-center text-lg text-ardoise">
            Tu n'as pas encore d'envoi à suivre.
          </p>
        ) : (
          <ul className="space-y-3">
            {elements.map((element) => {
              const statut = statutAffiche(element.statut);
              return (
                <li
                  key={`${element.type}-${element.id}`}
                  className="rounded-xl border border-ardoise-clair/15 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="break-all font-bold text-lg text-ardoise">
                      {element.code}
                    </p>
                    <span
                      className={`inline-flex min-h-10 items-center rounded-full px-4 py-1 font-bold text-lg ${statut.classes}`}
                    >
                      {statut.libelle}
                    </span>
                  </div>
                  <p className="mt-2 text-lg text-ardoise-clair">
                    {element.gare_depart_nom || "Départ"} →{" "}
                    {element.gare_arrivee_nom || "Arrivée"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/citoyen/envois"
          className="mt-4 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-lagune px-5 font-bold text-lg text-lagune hover:bg-lagune/5"
        >
          <IconeFlecheRetour className="h-5 w-5 rotate-180" aria-hidden="true" />
          Voir tous
        </Link>
      </Carte>

      <Carte titre={`Profil complet à ${pourcentage} %`}>
        <div
          className="h-4 overflow-hidden rounded-full bg-sable"
          role="progressbar"
          aria-label={`Profil complet à ${pourcentage} %`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pourcentage}
        >
          <div
            className="h-full rounded-full bg-lagune transition-[width]"
            style={{ width: `${pourcentage}%` }}
          />
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {verifications.map((verification) => (
            <li
              key={verification.libelle}
              className="flex min-h-12 items-center gap-2 text-lg text-ardoise"
            >
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  verification.fait
                    ? "bg-green-100 text-green-900"
                    : "bg-orange-100 text-orange-900"
                }`}
              >
                {verification.fait ? (
                  <IconeCheck className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">!</span>
                )}
              </span>
              {verification.libelle}
            </li>
          ))}
        </ul>

        <Link
          href="/profil"
          className="mt-4 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-lagune px-5 font-bold text-lg text-white hover:bg-lagune/90"
        >
          <IconeUtilisateur className="h-5 w-5" aria-hidden="true" />
          Compléter
        </Link>
      </Carte>
    </div>
  );
}
