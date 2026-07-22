"use client";

/**
 * Page Mon Profil — pour le super administrateur.
 * Permet de modifier son profil, exporter ses données, gérer son mot de passe.
 */
import { useEffect, useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Alerte } from "@/composants/commun/Alerte";
import { ModalConfirmation } from "@/composants/commun/ModalConfirmation";
import { useAuthentification } from "@/contextes/authentification";
import { useNotifications } from "@/contextes/notifications";
import { clientAPI, ErreurAPI, obtenirTokenAcces } from "@/services/client_api";

export default function PageMonProfilSuperAdmin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const { notifier } = useNotifications();

  const [formulaire, setFormulaire] = useState({
    prenom: "",
    nom: "",
    ville: "",
    pays: "Sénégal",
  });
  const [enEdition, setEnEdition] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [modaleExportOuverte, setModaleExportOuverte] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [modaleChangementMotDePasse, setModaleChangementMotDePasse] = useState(false);

  const [mdpFormulaire, setMdpFormulaire] = useState({
    mot_de_passe_actuel: "",
    nouveau_mot_de_passe: "",
    confirmation: "",
  });
  const [mdpErreur, setMdpErreur] = useState("");
  const [mdpChargement, setMdpChargement] = useState(false);

  useEffect(() => {
    if (utilisateur) {
      setFormulaire({
        prenom: utilisateur.prenom || "",
        nom: utilisateur.nom || "",
        ville: (utilisateur as any).ville || "",
        pays: (utilisateur as any).pays || "Sénégal",
      });
    }
  }, [utilisateur]);

  const modifierChamp = (champ: keyof typeof formulaire) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormulaire((f) => ({ ...f, [champ]: e.target.value }));
    };
  };

  const gererSauvegarde = async (e: React.FormEvent) => {
    e.preventDefault();
    setChargement(true);
    try {
      await clientAPI.patch(
        "/api/v1/utilisateurs/moi",
        {
          prenom: formulaire.prenom,
          nom: formulaire.nom,
          ville: formulaire.ville,
          pays: formulaire.pays,
        }
      );

      notifier("Profil mis à jour avec succès !", "succes");
      setEnEdition(false);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la sauvegarde";
      notifier(msg, "erreur");
    } finally {
      setChargement(false);
    }
  };

  const gererAnnulation = () => {
    if (utilisateur) {
      setFormulaire({
        prenom: utilisateur.prenom || "",
        nom: utilisateur.nom || "",
        ville: (utilisateur as any).ville || "",
        pays: (utilisateur as any).pays || "Sénégal",
      });
    }
    setEnEdition(false);
  };

  const gererExportDonnees = async () => {
    setExportEnCours(true);
    try {
      const token = obtenirTokenAcces();
      const reponse = await fetch("/api/v1/utilisateurs/moi/exporter", {
        headers: {
          Authorization: `Bearer ${token || ""}`,
        },
      });

      if (!reponse.ok) {
        throw new ErreurAPI("EXPORT_ERR", "Impossible d'exporter les données", reponse.status);
      }

      const blob = await reponse.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `digiid-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notifier("Données exportées avec succès !", "succes");
      setModaleExportOuverte(false);
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur d'export";
      notifier(msg, "erreur");
    } finally {
      setExportEnCours(false);
    }
  };

  const gererChangementMotDePasse = async (e: React.FormEvent) => {
    e.preventDefault();
    setMdpErreur("");

    if (mdpFormulaire.nouveau_mot_de_passe !== mdpFormulaire.confirmation) {
      setMdpErreur("Les mots de passe ne correspondent pas.");
      return;
    }

    if (mdpFormulaire.nouveau_mot_de_passe.length < 12) {
      setMdpErreur("Le mot de passe doit faire au moins 12 caractères.");
      return;
    }

    setMdpChargement(true);
    try {
      await clientAPI.post(
        "/api/v1/utilisateurs/moi/changer-mot-de-passe",
        {
          mot_de_passe_actuel: mdpFormulaire.mot_de_passe_actuel,
          nouveau_mot_de_passe: mdpFormulaire.nouveau_mot_de_passe,
        }
      );

      notifier("Mot de passe modifié avec succès !", "succes");
      setModaleChangementMotDePasse(false);
      setMdpFormulaire({ mot_de_passe_actuel: "", nouveau_mot_de_passe: "", confirmation: "" });
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur de changement";
      setMdpErreur(msg);
    } finally {
      setMdpChargement(false);
    }
  };

  if (!utilisateur) {
    return (
      <div className="space-y-4">
        <header>
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">
            Super administration
          </p>
          <h1 className="mt-1 text-2xl">Mon profil</h1>
        </header>
        <p className="text-ardoise-clair italic text-center py-6">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête compact */}
      <header>
        <p className="text-ocre font-semibold text-xs uppercase tracking-wider">
          Super administration
        </p>
        <h1 className="mt-1 text-2xl">Mon profil</h1>
        <p className="text-ardoise-clair mt-1 text-sm max-w-2xl">
          Modifie tes informations personnelles et gère la sécurité de ton compte.
          Toutes les modifications sont tracées dans le journal d'audit.
        </p>
      </header>

      {/* Informations du compte */}
      <div className="grid md:grid-cols-3 gap-3">
        <Carte>
          <p className="text-[10px] uppercase text-ardoise-clair mb-1 font-semibold">Rôle</p>
          <Badge variante="ocre">Super administrateur</Badge>
        </Carte>

        <Carte>
          <p className="text-[10px] uppercase text-ardoise-clair mb-1 font-semibold">Email</p>
          <p className="text-sm font-semibold text-ardoise font-mono truncate">{utilisateur.email}</p>
        </Carte>

        <Carte>
          <p className="text-[10px] uppercase text-ardoise-clair mb-1 font-semibold">2FA</p>
          <Badge variante={(utilisateur as any).deux_fa_active ? "succes" : "terre"}>
            {(utilisateur as any).deux_fa_active ? "Activée" : "Désactivée"}
          </Badge>
        </Carte>
      </div>

      {/* Formulaire de modification du profil */}
      <Carte titre="Informations personnelles" description="Prénom, nom, ville et pays">
        <form onSubmit={gererSauvegarde} className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <ChampSaisie
              libelle="Prénom"
              value={formulaire.prenom}
              onChange={modifierChamp("prenom")}
              disabled={!enEdition}
              required
            />
            <ChampSaisie
              libelle="Nom"
              value={formulaire.nom}
              onChange={modifierChamp("nom")}
              disabled={!enEdition}
              required
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <ChampSaisie
              libelle="Ville"
              value={formulaire.ville}
              onChange={modifierChamp("ville")}
              disabled={!enEdition}
            />
            <ChampSaisie
              libelle="Pays"
              value={formulaire.pays}
              onChange={modifierChamp("pays")}
              disabled={!enEdition}
            />
          </div>

          <div className="flex gap-2 pt-3 border-t border-ardoise-clair/10">
            {!enEdition ? (
              <>
                <Bouton type="button" variante="primaire" onClick={() => setEnEdition(true)}>
                  Modifier mon profil
                </Bouton>
                <Bouton
                  type="button"
                  variante="ghost"
                  onClick={() => setModaleExportOuverte(true)}
                >
                  Exporter mes données
                </Bouton>
              </>
            ) : (
              <>
                <Bouton type="submit" variante="primaire" chargement={chargement}>
                  Enregistrer
                </Bouton>
                <Bouton type="button" variante="ghost" onClick={gererAnnulation}>
                  Annuler
                </Bouton>
              </>
            )}
          </div>
        </form>
      </Carte>

      {/* Sécurité */}
      <Carte titre="Sécurité" description="Mot de passe et double authentification">
        <div className="space-y-3">
          <div className="p-3 bg-sable rounded-lg">
            <p className="text-sm font-semibold text-ardoise mb-1">Mot de passe</p>
            <p className="text-xs text-ardoise-clair mb-2">
              Change régulièrement ton mot de passe. Minimum 12 caractères avec majuscule,
              minuscule, chiffre et caractère spécial.
            </p>
            <Bouton variante="ghost" onClick={() => setModaleChangementMotDePasse(true)}>
              Changer mon mot de passe
            </Bouton>
          </div>

          <div className="p-3 bg-sable rounded-lg">
            <p className="text-sm font-semibold text-ardoise mb-1">
              Double authentification (2FA)
            </p>
            <p className="text-xs text-ardoise-clair mb-2">
              Le 2FA est obligatoire pour les super administrateurs.
            </p>
            <Badge variante="succes">✓ Actif</Badge>
          </div>
        </div>
      </Carte>

      {/* Export RGPD */}
      <Carte titre="Portabilité des données (RGPD/CDP)" description="Télécharge toutes tes données personnelles">
        <div className="space-y-2">
          <p className="text-sm text-ardoise-clair">
            Conformément au RGPD et à la CDP, tu peux exporter toutes les données liées
            à ton compte. Fichier au format JSON structuré.
          </p>
          <div className="flex gap-2">
            <Bouton
              variante="ghost"
              onClick={() => setModaleExportOuverte(true)}
            >
              Exporter mes données
            </Bouton>
          </div>
        </div>
      </Carte>

      {/* Modale export */}
      <ModalConfirmation
        ouvert={modaleExportOuverte}
        titre="Exporter mes données"
        description="Télécharger toutes tes données personnelles"
        messageAlerte="L'export inclut toutes les données liées à ton compte : profil, historique de connexion, scores, badges, consentements, documents, etc."
        varianteAlerte="info"
        varianteBoutonConfirmer="primaire"
        texteBoutonAnnuler="Annuler"
        texteBoutonConfirmer="Exporter en JSON"
        chargement={exportEnCours}
        surAnnulation={() => setModaleExportOuverte(false)}
        surConfirmation={gererExportDonnees}
      />

      {/* Modale changement mot de passe */}
      <ModalConfirmation
        ouvert={modaleChangementMotDePasse}
        titre="Changer mon mot de passe"
        description="Sécurise ton compte avec un nouveau mot de passe"
        varianteAlerte="avertissement"
        texteBoutonAnnuler="Annuler"
        texteBoutonConfirmer="Changer le mot de passe"
        chargement={mdpChargement}
        surAnnulation={() => {
          setModaleChangementMotDePasse(false);
          setMdpErreur("");
          setMdpFormulaire({ mot_de_passe_actuel: "", nouveau_mot_de_passe: "", confirmation: "" });
        }}
        surConfirmation={gererChangementMotDePasse as any}
        contenuCorps={
          <form onSubmit={gererChangementMotDePasse} className="space-y-3">
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={mdpFormulaire.mot_de_passe_actuel}
                onChange={(e) => setMdpFormulaire((f) => ({ ...f, mot_de_passe_actuel: e.target.value }))}
                className="w-full px-3 py-2 border border-ardoise-clair/30 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={mdpFormulaire.nouveau_mot_de_passe}
                onChange={(e) => setMdpFormulaire((f) => ({ ...f, nouveau_mot_de_passe: e.target.value }))}
                className="w-full px-3 py-2 border border-ardoise-clair/30 rounded-lg text-sm"
                required
                minLength={12}
                placeholder="Au moins 12 caractères"
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                value={mdpFormulaire.confirmation}
                onChange={(e) => setMdpFormulaire((f) => ({ ...f, confirmation: e.target.value }))}
                className="w-full px-3 py-2 border border-ardoise-clair/30 rounded-lg text-sm"
                required
              />
            </div>
            {mdpErreur && (
              <p className="text-sm text-terre bg-terre/10 px-3 py-2 rounded">{mdpErreur}</p>
            )}
          </form>
        }
      />
    </div>
  );
}