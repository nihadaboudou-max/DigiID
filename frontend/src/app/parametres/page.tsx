"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { Gestion2FA } from "@/composants/commun/Gestion2FA";
import { Modal } from "@/composants/commun/Modal";
import {
  IconeAlerte,
  IconeBouclier,
  IconeCheck,
  IconeCle,
  IconeEnvoyer,
  IconeFlecheRetour,
  IconeJournal,
  IconeLangue,
  IconeUtilisateur,
} from "@/composants/commun/Icones";
import { BoutonMuet } from "@/composants/accessibilite/BoutonMuet";
import { ReglagesVoix } from "@/composants/accessibilite/ReglagesVoix";
import { SelecteurLangue } from "@/composants/accessibilite/SelecteurLangue";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { useAuthentification } from "@/contextes/authentification";
import { useNotifications } from "@/contextes/notifications";
import { ErreurAPI, clientAPI } from "@/services/client_api";
import {
  obtenirMonActivitePaginee,
  modifierMonProfil,
  supprimerMonCompte,
  type ActiviteUtilisateur,
} from "@/services/profil";

const TAILLE_PAGE_ACTIVITE = 5;

type IdSectionParametres =
  | "identite"
  | "mot-de-passe"
  | "2fa"
  | "langue"
  | "activite"
  | "export"
  | "suppression";

export default function PageParametres() {
  return (
    <EnvelopperEspaceProtege
      rolesAutorises={[
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
      ]}
    >
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter();
  const { notifier } = useNotifications();
  const { utilisateur, seDeconnecter } = useAuthentification();

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sauvegardeIdentite, setSauvegardeIdentite] = useState(false);
  const [exportChargement, setExportChargement] = useState(false);
  const [sectionOuverte, setSectionOuverte] =
    useState<IdSectionParametres | null>(null);

  const [activites, setActivites] = useState<ActiviteUtilisateur[]>([]);
  const [pageActivite, setPageActivite] = useState(1);
  const [totalActivites, setTotalActivites] = useState(0);
  const [instantaneActivite, setInstantaneActivite] = useState<{
    date: string;
    id: string;
  } | null>(null);
  const [chargementActivite, setChargementActivite] = useState(false);
  const [erreurActivite, setErreurActivite] = useState<string | null>(null);

  const [suppressionOuverte, setSuppressionOuverte] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null);

  useEffect(() => {
    if (utilisateur) {
      setNom(utilisateur.nom || "");
      setPrenom(utilisateur.prenom || "");
    }
  }, [utilisateur]);

  if (!utilisateur) return null;
  const idUtilisateur = utilisateur.id;

  async function chargerActivite(
    page: number,
    instantane: { date: string; id: string } | null = null,
  ) {
    setChargementActivite(true);
    setErreurActivite(null);
    try {
      const resultat = await obtenirMonActivitePaginee(
        page,
        TAILLE_PAGE_ACTIVITE,
        instantane,
      );
      setActivites(resultat.elements);
      setTotalActivites(resultat.total);
      setPageActivite(resultat.page);
      setInstantaneActivite(
        resultat.snapshot_date && resultat.snapshot_id
          ? {
              date: resultat.snapshot_date,
              id: resultat.snapshot_id,
            }
          : null,
      );
    } catch (erreur) {
      setErreurActivite(
        erreur instanceof ErreurAPI
          ? erreur.message_utilisateur
          : "Impossible de charger l'activité récente. Réessaie.",
      );
    } finally {
      setChargementActivite(false);
    }
  }

  function basculerSection(section: IdSectionParametres) {
    const ouvrir = sectionOuverte !== section;
    setSectionOuverte(ouvrir ? section : null);
    if (ouvrir && section === "activite") {
      setPageActivite(1);
      setInstantaneActivite(null);
      void chargerActivite(1);
    }
  }

  async function gererSauvegardeIdentite() {
    const nomTrim = nom.trim();
    const prenomTrim = prenom.trim();

    if (!nomTrim || !prenomTrim) {
      notifier("Le nom et le prénom sont obligatoires.", "erreur");
      return;
    }

    setSauvegardeIdentite(true);
    try {
      await modifierMonProfil({ nom: nomTrim, prenom: prenomTrim });
      notifier("Identité mise à jour avec succès.", "succes");
    } catch {
      notifier("Erreur lors de la mise à jour. Vérifiez les données.", "erreur");
    } finally {
      setSauvegardeIdentite(false);
    }
  }

  async function gererExportDonnees() {
    setExportChargement(true);
    try {
      const donnees = await clientAPI.get("/api/v1/utilisateur/profil/export", {
        authentifie: true,
      });
      const blob = new Blob([JSON.stringify(donnees, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = url;
      lien.download = `digiid-export-${idUtilisateur}.json`;
      lien.click();
      URL.revokeObjectURL(url);
      notifier("Export téléchargé avec succès.", "succes");
    } catch {
      notifier("Erreur lors de l'export des données.", "erreur");
    } finally {
      setExportChargement(false);
    }
  }

  async function confirmerSuppression() {
    setSuppressionEnCours(true);
    setErreurSuppression(null);
    try {
      await supprimerMonCompte();
      notifier(
        "Compte supprimé. La purge définitive des données est prévue sous 30 jours.",
        "succes",
      );
      await seDeconnecter();
    } catch (erreur) {
      setErreurSuppression(
        erreur instanceof ErreurAPI
          ? erreur.message_utilisateur
          : "La suppression n'a pas abouti. Réessaie.",
      );
      setSuppressionEnCours(false);
    }
  }

  const totalPagesActivite = Math.max(
    1,
    Math.ceil(totalActivites / TAILLE_PAGE_ACTIVITE),
  );
  const phrase2FA =
    utilisateur.role === "citoyen"
      ? "Facultative, la double authentification ajoute un code temporaire pour mieux protéger ton compte."
      : "La double authentification ajoute un code temporaire pour renforcer la protection de ton compte.";

  return (
    <div className="mx-auto max-w-3xl space-y-4 apparition pb-20">
      <header className="mb-2">
        <p className="text-ocre font-semibold text-lg uppercase tracking-wider">
          Paramètres
        </p>
        <h1 className="mt-1 text-3xl font-bold text-ardoise">
          Sécurité et préférences
        </h1>
      </header>

      <SectionParametres
        id="identite"
        titre="Identité personnelle"
        Icone={IconeUtilisateur}
        ouverte={sectionOuverte === "identite"}
        onBasculer={() => basculerSection("identite")}
      >
        <p className="mb-4 text-lg text-ardoise-clair">
          Vérifie que ces informations correspondent à ta pièce d'identité.
        </p>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-2 font-semibold text-lg text-ardoise">
            Nom de famille
            <input
              type="text"
              value={nom}
              onChange={(event) => setNom(event.target.value.toUpperCase())}
              className="min-h-14 w-full rounded-xl border-2 border-ardoise-clair/20 bg-white px-4 font-normal focus:border-lagune focus:outline-none"
              placeholder="NOM"
            />
          </label>
          <label className="block space-y-2 font-semibold text-lg text-ardoise">
            Prénom
            <input
              type="text"
              value={prenom}
              onChange={(event) => setPrenom(event.target.value)}
              className="min-h-14 w-full rounded-xl border-2 border-ardoise-clair/20 bg-white px-4 font-normal focus:border-lagune focus:outline-none"
              placeholder="Prénom"
            />
          </label>
        </div>
        <Bouton
          variante="primaire"
          taille="grand"
          className="min-h-14"
          chargement={sauvegardeIdentite}
          onClick={() => void gererSauvegardeIdentite()}
        >
          <IconeCheck className="h-5 w-5" aria-hidden="true" />
          Enregistrer
        </Bouton>
      </SectionParametres>

      <SectionParametres
        id="mot-de-passe"
        titre="Mot de passe"
        Icone={IconeCle}
        ouverte={sectionOuverte === "mot-de-passe"}
        onBasculer={() => basculerSection("mot-de-passe")}
      >
        <p className="mb-4 text-lg text-ardoise">
          Choisis un mot de passe fort que tu n'utilises sur aucun autre service.
        </p>
        <Bouton
          variante="ghost"
          taille="grand"
          className="min-h-14"
          onClick={() => router.push("/mot-de-passe-oublie")}
        >
          <IconeCle className="h-5 w-5" aria-hidden="true" />
          Réinitialiser mon mot de passe
        </Bouton>
      </SectionParametres>

      <SectionParametres
        id="2fa"
        titre="Double authentification"
        Icone={IconeBouclier}
        ouverte={sectionOuverte === "2fa"}
        onBasculer={() => basculerSection("2fa")}
      >
        <p className="mb-4 text-lg text-ardoise">{phrase2FA}</p>
        <p className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold text-ardoise">
          État :
          <Badge
            variante={utilisateur.deux_fa_active ? "succes" : "neutre"}
            taille="moyen"
          >
            {utilisateur.deux_fa_active ? "Activée" : "Désactivée"}
          </Badge>
        </p>
        <Gestion2FA className="min-h-14 text-lg" />
      </SectionParametres>

      <SectionParametres
        id="langue"
        titre="Langue et lecture à voix haute"
        Icone={IconeLangue}
        ouverte={sectionOuverte === "langue"}
        onBasculer={() => basculerSection("langue")}
      >
        <p className="mb-4 text-lg text-ardoise">
          Choisis le français, le fon, le bariba ou le dendi et règle la lecture à voix haute.
        </p>
        <SelecteurLangue variante="compacte" />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-ardoise-clair/10 pt-4">
          <p className="font-semibold text-lg text-ardoise">
            Lecture à voix haute
          </p>
          <BoutonMuet />
        </div>
        <div className="mt-4 border-t border-ardoise-clair/10 pt-4">
          <ReglagesVoix />
        </div>
      </SectionParametres>

      <SectionParametres
        id="activite"
        titre="Activité récente"
        Icone={IconeJournal}
        ouverte={sectionOuverte === "activite"}
        onBasculer={() => basculerSection("activite")}
      >
        <p className="mb-4 text-lg text-ardoise">
          Consulte les dernières actions enregistrées sur ton compte.
        </p>
        {erreurActivite && (
          <Alerte variante="erreur" titre="Activité indisponible">
            <p className="text-lg">{erreurActivite}</p>
            <Bouton
              variante="ghost"
              taille="grand"
              className="mt-3 min-h-14"
              onClick={() =>
                void chargerActivite(pageActivite, instantaneActivite)
              }
            >
              <IconeJournal className="h-5 w-5" aria-hidden="true" />
              Réessayer
            </Bouton>
          </Alerte>
        )}

        {!erreurActivite && chargementActivite && (
          <p className="py-6 text-center text-lg text-ardoise-clair">
            Chargement de l'activité…
          </p>
        )}

        {!erreurActivite && !chargementActivite && activites.length === 0 && (
          <p className="rounded-xl bg-sable-clair p-4 text-center text-lg text-ardoise">
            Aucune activité enregistrée pour le moment.
          </p>
        )}

        {!erreurActivite && !chargementActivite && activites.length > 0 && (
          <>
            <ol className="space-y-3">
              {activites.map((activite) => (
                <li
                  key={activite.id}
                  className="rounded-xl border border-ardoise-clair/15 bg-white p-4"
                >
                  <p className="font-semibold text-lg text-lagune">
                    {activite.type.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-lg text-ardoise">
                    {activite.description}
                  </p>
                  <time
                    className="mt-2 block text-lg text-ardoise-clair"
                    dateTime={activite.date}
                  >
                    {new Date(activite.date).toLocaleString("fr-FR")}
                  </time>
                </li>
              ))}
            </ol>
            <nav
              aria-label="Pagination de l'activité récente"
              className="mt-4 flex flex-wrap items-center justify-between gap-3"
            >
              <Bouton
                type="button"
                variante="ghost"
                taille="grand"
                className="min-h-14"
                disabled={pageActivite <= 1 || chargementActivite}
                onClick={() =>
                  void chargerActivite(pageActivite - 1, instantaneActivite)
                }
              >
                <IconeFlecheRetour className="h-5 w-5" aria-hidden="true" />
                Précédent
              </Bouton>
              <span className="font-semibold text-lg text-ardoise">
                Page {pageActivite} sur {totalPagesActivite}
              </span>
              <Bouton
                type="button"
                variante="ghost"
                taille="grand"
                className="min-h-14"
                disabled={
                  pageActivite >= totalPagesActivite || chargementActivite
                }
                onClick={() =>
                  void chargerActivite(pageActivite + 1, instantaneActivite)
                }
              >
                Suivant
                <IconeFlecheRetour
                  className="h-5 w-5 rotate-180"
                  aria-hidden="true"
                />
              </Bouton>
            </nav>
          </>
        )}
      </SectionParametres>

      <SectionParametres
        id="export"
        titre="Exporter mes données"
        Icone={IconeEnvoyer}
        ouverte={sectionOuverte === "export"}
        onBasculer={() => basculerSection("export")}
      >
        <p className="mb-4 text-lg text-ardoise">
          Télécharge une copie de tes données personnelles au format JSON.
        </p>
        <Bouton
          variante="ghost"
          taille="grand"
          className="min-h-14"
          chargement={exportChargement}
          onClick={() => void gererExportDonnees()}
        >
          <IconeEnvoyer className="h-5 w-5" aria-hidden="true" />
          Exporter mes données
        </Bouton>
      </SectionParametres>

      <SectionParametres
        id="suppression"
        titre="Supprimer mon compte"
        Icone={IconeAlerte}
        ouverte={sectionOuverte === "suppression"}
        onBasculer={() => basculerSection("suppression")}
      >
        <Alerte variante="erreur" titre="Cette action est irréversible">
          <p className="text-lg">
            Ton compte sera désactivé et tes données personnelles seront
            définitivement purgées sous 30 jours.
          </p>
        </Alerte>
        <Bouton
          variante="danger"
          taille="grand"
          className="mt-4 min-h-14"
          onClick={() => {
            setErreurSuppression(null);
            setSuppressionOuverte(true);
          }}
        >
          <IconeAlerte className="h-5 w-5" aria-hidden="true" />
          Supprimer mon compte
        </Bouton>
      </SectionParametres>

      <Modal
        ouvert={suppressionOuverte}
        surFermeture={() => {
          if (!suppressionEnCours) setSuppressionOuverte(false);
        }}
        titre="Confirmer la suppression du compte"
        taille="petit"
      >
        <div className="space-y-4">
          <p className="text-lg text-ardoise">
            Ton compte sera désactivé immédiatement. La purge définitive de tes
            données est prévue sous 30 jours.
          </p>
          {erreurSuppression && (
            <Alerte variante="erreur" titre="Suppression impossible">
              {erreurSuppression}
            </Alerte>
          )}
          <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
            <Bouton
              variante="ghost"
              taille="grand"
              className="min-h-14"
              disabled={suppressionEnCours}
              onClick={() => setSuppressionOuverte(false)}
            >
              <IconeFlecheRetour className="h-5 w-5" aria-hidden="true" />
              Annuler
            </Bouton>
            <Bouton
              variante="danger"
              taille="grand"
              className="min-h-14"
              chargement={suppressionEnCours}
              onClick={() => void confirmerSuppression()}
            >
              <IconeAlerte className="h-5 w-5" aria-hidden="true" />
              Confirmer la suppression
            </Bouton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SectionParametres({
  id,
  titre,
  Icone,
  ouverte,
  onBasculer,
  children,
}: {
  id: IdSectionParametres;
  titre: string;
  Icone: typeof IconeCle;
  ouverte: boolean;
  onBasculer: () => void;
  children: ReactNode;
}) {
  const identifiant = `parametres-${id}`;
  return (
    <section className="overflow-hidden rounded-2xl border border-ardoise-clair/15 bg-white shadow-sm">
      <h2>
        <button
          type="button"
          aria-expanded={ouverte}
          aria-controls={`${identifiant}-contenu`}
          onClick={onBasculer}
          className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-4 text-left text-xl font-bold text-lagune hover:bg-lagune/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lagune/50"
        >
          <span className="flex items-center gap-3">
            <Icone className="h-6 w-6 shrink-0" aria-hidden="true" />
            {titre}
          </span>
          <IconeFlecheRetour
            className={`h-5 w-5 shrink-0 transition-transform ${
              ouverte ? "-rotate-90" : "rotate-180"
            }`}
            aria-hidden="true"
          />
        </button>
      </h2>
      <div
        id={`${identifiant}-contenu`}
        hidden={!ouverte}
        className="border-t border-ardoise-clair/10 p-5"
      >
        {children}
      </div>
    </section>
  );
}
