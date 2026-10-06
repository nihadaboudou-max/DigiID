"use client";
/**
 * Mon dossier professionnel logistique.
 *
 * Le plan prévoit que chaque acteur du transport (chauffeur, receveur) tienne un
 * dossier vérifiable : pièce d'identité, permis de conduire et véhicule. Le
 * gérant de gare valide ensuite les éléments — un dossier « vérifié » inspire
 * confiance aux familles qui confient un enfant ou un colis.
 *
 * Règle importante : **modifier un élément contrôlé remet le dossier en attente**.
 * On ne peut pas se faire valider puis changer discrètement d'immatriculation.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { Alerte } from "@/composants/commun/Alerte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { ErreurAPI } from "@/services/client_api";
import {
  identiteAPI,
  LIBELLES_CHAMPS_PROFIL,
  LIBELLES_VERIFICATION_PROFIL,
  type DonneesProfilLogistique,
  type ProfilLogistique,
  type TypeProfilLogistique,
} from "@/services/identite_api";

/** Rôles ayant un dossier professionnel logistique. */
const ROLES_PROFIL = [
  "chauffeur",
  "receveur",
  "gerant_gare",
  "commercant",
  "super_administrateur",
  "super_admin",
];

export default function PageMonDossierLogistique() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={ROLES_PROFIL}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

const FORMULAIRE_VIDE: DonneesProfilLogistique = {
  type_profil: "chauffeur",
  type_piece: "",
  numero_piece: "",
  permis_numero: "",
  permis_categorie: "",
  permis_expiration: null,
  vehicule_immatriculation: "",
  vehicule_marque: "",
  vehicule_modele: "",
  vehicule_capacite: null,
};

function Contenu() {
  const [dossier, setDossier] = useState<ProfilLogistique | null>(null);
  const [formulaire, setFormulaire] =
    useState<DonneesProfilLogistique>(FORMULAIRE_VIDE);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      try {
        const existant = await identiteAPI.profils.mien();
        if (annule) return;
        setDossier(existant);
        setFormulaire({
          type_profil: existant.type_profil,
          type_piece: existant.type_piece ?? "",
          numero_piece: existant.numero_piece ?? "",
          permis_numero: existant.permis_numero ?? "",
          permis_categorie: existant.permis_categorie ?? "",
          permis_expiration: existant.permis_expiration,
          vehicule_immatriculation: existant.vehicule_immatriculation ?? "",
          vehicule_marque: existant.vehicule_marque ?? "",
          vehicule_modele: existant.vehicule_modele ?? "",
          vehicule_capacite: existant.vehicule_capacite,
        });
      } catch (e) {
        // 404 = aucun dossier : ce n'est pas une erreur, c'est le premier passage.
        if (e instanceof ErreurAPI && e.code_http === 404) {
          if (!annule) setDossier(null);
        } else if (!annule) {
          setErreur(
            e instanceof ErreurAPI
              ? e.message_utilisateur
              : "Impossible de charger votre dossier.",
          );
        }
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, []);

  function modifier<K extends keyof DonneesProfilLogistique>(
    cle: K,
    valeur: DonneesProfilLogistique[K],
  ) {
    setFormulaire((precedent) => ({ ...precedent, [cle]: valeur }));
    setSucces(null);
  }

  async function enregistrer() {
    setErreur(null);
    setSucces(null);
    setEnregistrement(true);
    try {
      const reponse = await identiteAPI.profils.enregistrer(formulaire);
      setDossier(reponse);
      setSucces(
        reponse.est_verifie
          ? "Dossier enregistré. Il était déjà vérifié : vos éléments contrôlés n'ont pas changé."
          : "Dossier enregistré. Un gérant de gare doit maintenant vérifier vos pièces.",
      );
    } catch (e) {
      setErreur(
        e instanceof ErreurAPI
          ? e.message_utilisateur
          : "Échec de l'enregistrement du dossier.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) {
    return (
      <p className="text-ardoise-clair italic py-12 text-center">
        Chargement de votre dossier…
      </p>
    );
  }

  const estChauffeur = formulaire.type_profil === "chauffeur";

  return (
    <div className="space-y-6 apparition">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-ardoise">
            Mon dossier professionnel
          </h1>
          <p className="text-sm text-ardoise-clair">
            Pièce d&apos;identité, permis et véhicule : les éléments que le gérant de
            gare contrôle avant de vous laisser transporter des colis ou des enfants.
          </p>
        </div>
        <Link href="/identite/carte">
          <Bouton variante="ghost" taille="petit">
            Ma carte DigiID
          </Bouton>
        </Link>
      </div>

      {erreur && (
        <Alerte variante="erreur" titre="Erreur">
          {erreur}
        </Alerte>
      )}
      {succes && (
        <Alerte variante="succes" titre="Enregistré">
          {succes}
        </Alerte>
      )}

      {dossier && <ResumeDossier dossier={dossier} />}

      <Carte
        titre={dossier ? "Mettre à jour mes informations" : "Créer mon dossier"}
        description="Modifier un élément contrôlé (pièce, permis, immatriculation) remet automatiquement le dossier en attente de vérification."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ardoise">
              Mon activité <span className="text-terre">*</span>
            </label>
            <div className="flex gap-2">
              {(["chauffeur", "receveur"] as TypeProfilLogistique[]).map((valeur) => (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => modifier("type_profil", valeur)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    formulaire.type_profil === valeur
                      ? "border-lagune bg-lagune-teinte text-lagune"
                      : "border-ardoise/20 bg-white text-ardoise hover:bg-lagune-teinte/40"
                  }`}
                >
                  {valeur === "chauffeur" ? "Chauffeur" : "Receveur"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ChampSaisie
              libelle="Type de pièce d'identité"
              value={formulaire.type_piece ?? ""}
              onChange={(e) => modifier("type_piece", e.target.value)}
              placeholder="Ex : CNI, passeport"
            />
            <ChampSaisie
              libelle="Numéro de la pièce"
              value={formulaire.numero_piece ?? ""}
              onChange={(e) => modifier("numero_piece", e.target.value)}
              placeholder="Ex : 1234567890123"
            />
          </div>

          {estChauffeur && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ChampSaisie
                  libelle="Numéro de permis"
                  value={formulaire.permis_numero ?? ""}
                  onChange={(e) => modifier("permis_numero", e.target.value)}
                />
                <ChampSaisie
                  libelle="Catégorie du permis"
                  value={formulaire.permis_categorie ?? ""}
                  onChange={(e) => modifier("permis_categorie", e.target.value)}
                  placeholder="Ex : C, D"
                />
                <ChampSaisie
                  libelle="Expiration du permis"
                  type="date"
                  value={formulaire.permis_expiration ?? ""}
                  onChange={(e) =>
                    modifier("permis_expiration", e.target.value || null)
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ChampSaisie
                  libelle="Immatriculation"
                  value={formulaire.vehicule_immatriculation ?? ""}
                  onChange={(e) =>
                    modifier("vehicule_immatriculation", e.target.value)
                  }
                  placeholder="Ex : DK-1234-AB"
                />
                <ChampSaisie
                  libelle="Marque"
                  value={formulaire.vehicule_marque ?? ""}
                  onChange={(e) => modifier("vehicule_marque", e.target.value)}
                />
                <ChampSaisie
                  libelle="Modèle"
                  value={formulaire.vehicule_modele ?? ""}
                  onChange={(e) => modifier("vehicule_modele", e.target.value)}
                />
                <ChampSaisie
                  libelle="Capacité (places)"
                  inputMode="numeric"
                  value={
                    formulaire.vehicule_capacite === null
                      ? ""
                      : String(formulaire.vehicule_capacite)
                  }
                  onChange={(e) => {
                    const chiffres = e.target.value.replace(/\D/g, "");
                    modifier(
                      "vehicule_capacite",
                      chiffres === "" ? null : Number(chiffres),
                    );
                  }}
                />
              </div>
            </>
          )}

          <div className="flex justify-end">
            <Bouton
              variante="primaire"
              chargement={enregistrement}
              disabled={enregistrement}
              onClick={() => void enregistrer()}
            >
              Enregistrer mon dossier
            </Bouton>
          </div>
        </div>
      </Carte>
    </div>
  );
}

/** État du dossier : statut, éléments manquants et éléments déjà validés. */
function ResumeDossier({ dossier }: { dossier: ProfilLogistique }) {
  const manquants = dossier.champs_manquants ?? [];
  const variante =
    dossier.statut_verification === "verifie"
      ? "succes"
      : dossier.statut_verification === "rejete"
        ? "terre"
        : "ocre";

  return (
    <Carte titre="État de mon dossier" variante={dossier.est_verifie ? "accent" : "standard"}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Badge variante={variante} taille="moyen">
          {LIBELLES_VERIFICATION_PROFIL[dossier.statut_verification]}
        </Badge>
        {dossier.identifiant_public && (
          <Badge variante="neutre">{dossier.identifiant_public}</Badge>
        )}
        {dossier.utilisateur_nom && (
          <span className="text-sm text-ardoise-clair">{dossier.utilisateur_nom}</span>
        )}
      </div>

      <ul className="text-sm space-y-1.5">
        <Element valide={dossier.piece_verifiee} libelle="Pièce d'identité" />
        {dossier.type_profil === "chauffeur" && (
          <>
            <Element valide={dossier.permis_verifie} libelle="Permis de conduire" />
            <Element
              valide={!!dossier.vehicule_immatriculation}
              libelle="Véhicule renseigné"
            />
          </>
        )}
        <Element valide={dossier.photo_verifiee} libelle="Photo d'identité" />
      </ul>

      {manquants.length > 0 && (
        <div className="mt-3 pt-3 border-t border-ardoise-clair/10">
          <p className="text-sm font-semibold text-ocre-fonce mb-1">
            Reste à vérifier :
          </p>
          <ul className="text-sm text-ardoise-clair list-disc list-inside">
            {manquants.map((champ) => (
              <li key={champ}>{LIBELLES_CHAMPS_PROFIL[champ] ?? champ}</li>
            ))}
          </ul>
        </div>
      )}

      {dossier.verifie_le && (
        <p className="text-xs text-ardoise-clair mt-3">
          Vérifié le{" "}
          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(
            new Date(dossier.verifie_le),
          )}
          {dossier.verifie_par_nom ? ` par ${dossier.verifie_par_nom}` : ""}.
        </p>
      )}
    </Carte>
  );
}

function Element({ valide, libelle }: { valide: boolean; libelle: string }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
          valide ? "bg-green-100 text-green-700" : "bg-ardoise-clair/20 text-ardoise-clair"
        }`}
      >
        {valide ? "✓" : "–"}
      </span>
      <span className={valide ? "text-ardoise" : "text-ardoise-clair"}>{libelle}</span>
    </li>
  );
}
