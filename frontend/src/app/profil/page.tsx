"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { Alerte } from "@/composants/commun/Alerte";
import { Gestion2FA } from "@/composants/commun/Gestion2FA";
import { useAuthentification } from "@/contextes/authentification";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { exporterMesDonnees, obtenirMonActivite } from "@/services/profil";
import { obtenirMonScore } from "@/services/score";
import type { ActiviteUtilisateur } from "@/services/profil";
import type { ScoreDetail } from "@/services/score";
import { ModalConfirmation } from "@/composants/commun/ModalConfirmation";

export default function PageProfil() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur, rafraichirProfil } = useAuthentification();

  const [modeEdition, setModeEdition] = useState(false);
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("");
  const [chargement, setChargement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [montrerConfirmationSuppression, setMontrerConfirmationSuppression] = useState(false);
  const [scoreData, setScoreData] = useState<ScoreDetail | null>(null);
  const [activites, setActivites] = useState<ActiviteUtilisateur[]>([]);
  const [chargementDonnees, setChargementDonnees] = useState(true);

  useEffect(() => {
    if (utilisateur) {
      setTelephone(utilisateur.telephone || "");
      setVille(utilisateur.ville || "");
      chargerDonnees();
    }
  }, [utilisateur]);

  async function chargerDonnees() {
    setChargementDonnees(true);
    try {
      const [score, activite] = await Promise.allSettled([
        obtenirMonScore(),
        obtenirMonActivite(10),
      ]);
      if (score.status === "fulfilled") setScoreData(score.value);
      if (activite.status === "fulfilled") setActivites(activite.value);
    } catch { /* silencieux */ }
    setChargementDonnees(false);
  }

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
      setMessage("Profil mis à jour avec succès !");
      setModeEdition(false);
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la mise à jour.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mes informations</p>
        <h1 className="mt-1">Mon profil</h1>
      </div>
      {message && <p className="text-sm text-succes bg-succes/10 p-3 rounded">{message}</p>}
      {erreur && <p className="text-sm text-terre bg-terre/10 p-3 rounded">{erreur}</p>}
      <Carte titre="Identité civile">
        {modeEdition ? (
          <div className="space-y-4">
            <ChampSaisie
              libelle="Téléphone"
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+221 77 123 45 67"
              aide="Format international recommandé pour recevoir les codes de vérification."
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
              <Champ libelle="Prénom" valeur={utilisateur.prenom} />
              <Champ libelle="Nom" valeur={utilisateur.nom} />
              <Champ libelle="Email" valeur={utilisateur.email} />
              <Champ libelle="Téléphone" valeur={utilisateur.telephone || "—"} />
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

      <Carte titre="Mon identifiant DigiID">
        <p className="text-3xl font-mono font-bold text-lagune break-all">{utilisateur.digiid_public}</p>
      </Carte>

      <Carte titre="État du compte">
        <div className="space-y-3">
          <LigneÉtat libelle="Statut" valeur={<Badge variante="succes">Actif</Badge>} />
          <LigneÉtat libelle="Rôle" valeur={<Badge variante="lagune">{utilisateur.role.replace(/_/g, " ")}</Badge>} />
          <LigneÉtat
            libelle="Email vérifié"
            valeur={
              utilisateur.est_email_verifie
                ? <Badge variante="succes">Vérifié</Badge>
                : <Link href="/identite/email" className="text-sm text-lagune hover:underline">Vérifier maintenant</Link>
            }
          />
          <LigneÉtat libelle="2FA activée" valeur={utilisateur.deux_fa_active ? <Badge variante="succes">Activée</Badge> : <Badge variante="neutre">Désactivée</Badge>} />
        </div>
        {!utilisateur.deux_fa_active && (
          <div className="mt-4 pt-4 border-t border-ardoise-clair/10">
            <p className="text-sm text-ardoise-clair mb-3">
              Protège ton compte avec un code à 6 chiffres en plus de ton mot de passe.
            </p>
            <Gestion2FA varianteBouton="secondaire" />
          </div>
        )}
      </Carte>

      {utilisateur.attestations_recues?.length > 0 && (
        <Carte titre="Attestations reçues">
          <div className="space-y-2">
            {utilisateur.attestations_recues.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 rounded border border-ardoise-clair/10">
                <div className="flex items-center gap-2">
                  <Badge variante={a.statut === "APPROUVEE" ? "succes" : a.statut === "EN_ATTENTE" ? "info" : "neutre"} taille="petit">{a.statut}</Badge>
                  <span className="text-sm font-medium text-ardoise">{a.titre}</span>
                </div>
                <span className="text-xs text-ardoise-clair">{a.poids_score} pts</span>
              </div>
            ))}
          </div>
        </Carte>
      )}

      <Carte titre="Vérifications d'identité">
        <Link href="/identite"><Bouton variante="primaire">Accéder au menu Identité →</Bouton></Link>
      </Carte>

      {scoreData && (
        <Carte titre="🎯 Score">
          <div className="flex items-center gap-4">
            <p className="text-4xl font-bold text-lagune">{scoreData.score_total}<span className="text-sm text-ardoise-clair">/100</span></p>
            <div className="flex-1">
              <BarreProgression valeur={Math.min(scoreData.score_total, 100)} couleur="lagune" />
              <div className="flex justify-between mt-1 text-xs"><span className="text-ardoise-clair">Niveau: <strong>{scoreData.niveau||"—"}</strong></span><Link href="/score" className="text-ocre">Détails →</Link></div>
            </div>
          </div>
        </Carte>
      )}

      <Carte titre="🕐 Activité récente">
        {chargementDonnees ? <p className="text-ardoise-clair italic text-sm">Chargement...</p>
        : activites.length > 0 ? <div className="space-y-1">
            {activites.slice(0, 5).map((a,i) => (
              <div key={a.id||i} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-sable">
                <span>{a.type==="connexion_reussie"?"🔑":a.type==="modification_profil"?"✏️":"📋"}</span>
                <p className="flex-1 text-ardoise truncate text-xs">{a.description||a.type.replace(/_/g," ")}</p>
                <span className="text-[10px] text-ardoise-clair/60 whitespace-nowrap">{new Date(a.date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
              </div>
            ))}
            <Link href="/autorisations" className="text-xs text-ocre">Tout l'historique →</Link>
          </div>
        : <p className="text-ardoise-clair italic text-sm">Aucune.</p>}
      </Carte>

      <Carte titre="🔗 Accès rapide">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <Link href="/partage" className="p-2 bg-sable rounded-lg hover:bg-sable/80 text-center"><p className="text-xl">📱</p><p className="text-[10px] font-semibold text-ardoise">Partage</p></Link>
          <Link href="/autorisations" className="p-2 bg-sable rounded-lg hover:bg-sable/80 text-center"><p className="text-xl">🔒</p><p className="text-[10px] font-semibold text-ardoise">Accès</p></Link>
          <Link href="/profil/telecharger" className="p-2 bg-sable rounded-lg hover:bg-sable/80 text-center"><p className="text-xl">📥</p><p className="text-[10px] font-semibold text-ardoise">Export</p></Link>
          <Link href="/consentements" className="p-2 bg-sable rounded-lg hover:bg-sable/80 text-center"><p className="text-xl">✅</p><p className="text-[10px] font-semibold text-ardoise">Consentements</p></Link>
          <Link href="/score" className="p-2 bg-sable rounded-lg hover:bg-sable/80 text-center"><p className="text-xl">📊</p><p className="text-[10px] font-semibold text-ardoise">Score</p></Link>
          <Link href="/badges" className="p-2 bg-sable rounded-lg hover:bg-sable/80 text-center"><p className="text-xl">🏆</p><p className="text-[10px] font-semibold text-ardoise">Badges</p></Link>
        </div>
      </Carte>

      {/* Actions */}
      <Carte titre="Actions sur mes données" description="Conformément à la loi 2008-12 (Sénégal)">
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
          <Link href="/profil/telecharger">
            <Bouton variante="ghost">
              📥 Télécharger mon profil
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

function LigneÉtat({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-ardoise-clair/10 last:border-0">
      <span className="text-ardoise">{libelle}</span>
      {valeur}
    </div>
  );
}
