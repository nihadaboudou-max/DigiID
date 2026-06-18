"use client";

/**
 * Page profil utilisateur — informations personnelles avec mode édition.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Gestion2FA } from "@/composants/commun/Gestion2FA";
import { TableauBordVerifications } from "@/composants/verifications";
import { useAuthentification } from "@/contextes/authentification";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { exporterMesDonnees } from "@/services/profil";
import { ModalConfirmation } from "@/composants/commun/ModalConfirmation";
import {
  obtenirStatutVerification,
  type VerificationDetail,
} from "@/services/verification_visuelle";

export default function PageProfil() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur, rafraichirProfil } = useAuthentification();
  const [verifVisage, setVerifVisage] = useState<VerificationDetail | null>(null);
  const [chargementVerif, setChargementVerif] = useState(true);

  useEffect(() => {
    obtenirStatutVerification()
      .then(setVerifVisage)
      .catch(() => setVerifVisage(null))
      .finally(() => setChargementVerif(false));
  }, []);

  const [modeEdition, setModeEdition] = useState(false);
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("");
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [montrerConfirmationSuppression, setMontrerConfirmationSuppression] = useState(false);

  useEffect(() => {
    if (utilisateur) {
      setTelephone(utilisateur.telephone || "");
      setVille(utilisateur.ville || "");
    }
  }, [utilisateur]);

  if (!utilisateur) return null;

  async function handleExporterDonnees() {
    setExportEnCours(true);
    setMessage(null);
    setErreur(null);
    try {
      const donnees = await exporterMesDonnees();
      const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `digiid-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Données exportées avec succès !");
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de l'export.");
    } finally {
      setExportEnCours(false);
    }
  }

  async function handleSupprimerCompte() {
    setSuppressionEnCours(true);
    setErreur(null);
    try {
      await clientAPI.delete("/api/v1/utilisateur/compte", { authentifie: true });
      // Déconnecter l'utilisateur
      window.location.href = "/";
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la suppression.");
    } finally {
      setSuppressionEnCours(false);
      setMontrerConfirmationSuppression(false);
    }
  }

  async function sauvegarder() {
    setChargement(true);
    setMessage(null);
    setErreur(null);
    try {
      await clientAPI.patch(
        "/api/v1/utilisateur/profil",
        { telephone: telephone || null, ville: ville || null },
        { authentifie: true },
      );
      await rafraichirProfil();
      setMessage("Profil mis a jour avec succes !");
      setModeEdition(false);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la mise a jour.");
    } finally {
      setChargement(false);
    }
  }

  async function verifierEmail() {
    try {
      await clientAPI.post(
        "/api/v1/verification/envoyer-email",
        {},
        { authentifie: true },
      );
      // Rediriger vers la page de verification
      window.location.href = "/verification";
    } catch {
      setErreur("Impossible d'envoyer le code. Reessaie plus tard.");
    }
  }

  return (
    <div className="space-y-8 apparition">
      <header>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">
          Mes informations
        </p>
        <h1 className="mt-1">Mon profil</h1>
        <p className="text-ardoise-clair mt-2">
          Toutes les donnees que DigiID conserve sur toi, classees et chiffrees.
        </p>
      </header>

      {/* === SECTION VÉRIFICATIONS IDENTITÉ (Étape 1, 2, 3) === */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🛡️</span>
          <h2 className="text-xl font-bold text-gray-800">
            Mes vérifications d&apos;identité
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
            Nouveau
          </span>
        </div>
        <TableauBordVerifications />
      </section>

      <hr className="border-gray-200 my-8" />

      <Alerte variante="info" titre="Tes donnees t'appartiennent">
        Toutes ces informations sont chiffrees au repos avec AES-256-GCM.
        Meme les administrateurs de DigiID ne peuvent pas les lire en clair.
      </Alerte>

      {message && <Alerte variante="succes">{message}</Alerte>}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Identite */}
      <Carte titre="Identite civile">
        {modeEdition ? (
          <div className="space-y-4">
            <ChampSaisie
              libelle="Telephone"
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+221 77 123 45 67"
              aide="Format international recommande pour recevoir les codes de verification."
            />
            <ChampSaisie
              libelle="Ville"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              placeholder="Dakar"
            />
            <div className="flex gap-3 pt-2">
              <Bouton variante="primaire" chargement={chargement} onClick={sauvegarder}>
                Enregistrer
              </Bouton>
              <Bouton variante="ghost" onClick={() => setModeEdition(false)}>
                Annuler
              </Bouton>
            </div>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <Champ libelle="Prenom" valeur={utilisateur.prenom} />
              <Champ libelle="Nom" valeur={utilisateur.nom} />
              <Champ libelle="Email" valeur={utilisateur.email} />
              <Champ libelle="Telephone" valeur={utilisateur.telephone || "—"} />
              <Champ libelle="Ville" valeur={utilisateur.ville} />
            </div>
            <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
              <Bouton variante="ghost" onClick={() => setModeEdition(true)}>
                Modifier mon profil
              </Bouton>
            </div>
          </>
        )}
      </Carte>

      {/* Identifiant DigiID */}
      <Carte titre="Mon identifiant DigiID" description="C'est ce que tu partages a un tiers">
        <p className="text-3xl font-mono font-bold text-lagune break-all mb-2">
          {utilisateur.digiid_public}
        </p>
        <p className="text-xs text-ardoise-clair italic">
          16 caracteres. Unique. Stable. Reconnu par les partenaires DigiID.
        </p>
      </Carte>

      {/* Etat du compte */}
      <Carte titre="Etat du compte">
        <div className="space-y-3">
          <LigneEtat libelle="Statut" valeur={<Badge variante="succes">Actif</Badge>} />
          <LigneEtat libelle="Role" valeur={<Badge variante="lagune">{utilisateur.role.replace(/_/g, " ")}</Badge>} />
          <LigneEtat
            libelle="Email verifie"
            valeur={
              utilisateur.est_email_verifie
                ? <Badge variante="succes">Verifie</Badge>
                : <button type="button" onClick={verifierEmail} className="text-sm text-lagune hover:underline">Verifier maintenant</button>
            }
          />
          <LigneEtat libelle="2FA activee" valeur={utilisateur.deux_fa_active ? <Badge variante="succes">Active</Badge> : <Badge variante="neutre">Desactivee</Badge>} />
          <LigneEtat
            libelle="Visage verifie"
            valeur={
              chargementVerif
                ? <span className="text-xs text-ardoise-clair italic">Chargement...</span>
                : verifVisage?.statut === "approuve"
                ? <><Badge variante="succes">Verifie</Badge> <span className="text-xs text-ardoise-clair ml-1">{Math.round(verifVisage.score_liveness * 100)}%</span></>
                : <Link href="/verification-visuelle" className="text-sm text-lagune hover:underline">Verifier maintenant</Link>
            }
          />
        </div>
        {!utilisateur.deux_fa_active && (
          <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
            <p className="text-sm text-ardoise-clair mb-3">
              Protege ton compte avec un code a 6 chiffres en plus de ton mot de passe.
            </p>
            <Gestion2FA varianteBouton="secondaire" />
          </div>
        )}
      </Carte>

      {/* Actions */}
      <Carte titre="Actions sur mes donnees" description="Conformement a la loi 2008-12 (Senegal)">
        <div className="grid sm:grid-cols-2 gap-3">
          <Bouton variante="ghost" onClick={() => setModeEdition(true)}>
            Modifier mon profil
          </Bouton>
          <Bouton variante="ghost" chargement={exportEnCours} onClick={handleExporterDonnees}>
            Exporter mes données
          </Bouton>
          <Link href="/consentements">
            <Bouton variante="ghost">
              Gérer mes consentements
            </Bouton>
          </Link>
          <Bouton variante="ghost" onClick={() => setMontrerConfirmationSuppression(true)} className="!border-terre !text-terre hover:!bg-terre hover:!text-white">
            Supprimer mon compte
          </Bouton>
        </div>
      </Carte>

      {/* Modale de confirmation pour la suppression du compte */}
      <ModalConfirmation
        ouvert={montrerConfirmationSuppression}
        titre="Supprimer mon compte"
        description="Cette action est irréversible. Toutes tes données personnelles seront définitivement effacées."
        messageAlerte="Tu es sur le point de supprimer définitivement ton compte DigiID. Cette action est irréversible et sera tracée dans le journal d'audit."
        varianteAlerte="erreur"
        texteBoutonConfirmer="Supprimer mon compte"
        varianteBoutonConfirmer="ghost"
        couleurBoutonConfirmer="terre"
        chargement={suppressionEnCours}
        surAnnulation={() => setMontrerConfirmationSuppression(false)}
        surConfirmation={handleSupprimerCompte}
      />
    </div>
  );
}

function Champ({ libelle, valeur }: { libelle: string; valeur: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1 pb-3 border-b border-ardoise-clair/10 last:border-0">
      <span className="text-xs text-ardoise-clair uppercase tracking-wide">{libelle}</span>
      <span className="font-medium text-ardoise">{valeur || "—"}</span>
    </div>
  );
}

function LigneEtat({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-ardoise-clair/10 last:border-0">
      <span className="text-ardoise">{libelle}</span>
      {valeur}
    </div>
  );
}
