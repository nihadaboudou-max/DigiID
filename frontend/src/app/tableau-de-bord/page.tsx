"use client";

/**
 * Page Tableau de bord / Profil — Hub organisé en 4 menus.
 * Navigation, Suivi & Attestation, Attestation, Identité.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
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

export default function PageTableauDeBord() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen", "agent", "medecin", "police", "ong", "administrateur", "super_administrateur"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const router = useRouter();
  const { utilisateur } = useAuthentification();

  const [exportEnCours, setExportEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [montrerConfirmationSuppression, setMontrerConfirmationSuppression] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ScoreDetail | null>(null);

  useEffect(() => {
    if (utilisateur) {
      obtenirMonScore()
        .then(setScoreData)
        .catch(() => {});
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
      window.location.href = "/";
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la suppression.");
    } finally {
      setSuppressionEnCours(false);
      setMontrerConfirmationSuppression(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1 className="mt-1">Tableau de bord</h1>
        <p className="text-ardoise-clair mt-2">Bienvenue, {[utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || utilisateur.email}.</p>
      </div>

      {message && <Alerte variante="succes">{message}</Alerte>}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* === Résumé identité + Score === */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Carte>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-ocre/10 flex items-center justify-center text-ocre text-xl font-bold flex-shrink-0">
              {((utilisateur.prenom?.[0] || "") + (utilisateur.nom?.[0] || "")).toUpperCase() || "?"}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-ardoise truncate">{([utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || utilisateur.email)}</p>
              <p className="text-xs text-ardoise-clair font-mono truncate">{utilisateur.digiid_public || "—"}</p>
              <div className="flex gap-1 mt-1 flex-wrap">
                <Badge variante="lagune" taille="petit">{utilisateur.role.replace(/_/g, " ")}</Badge>
                <Badge variante={utilisateur.est_email_verifie ? "succes" : "terre"} taille="petit">{utilisateur.est_email_verifie ? "Email ✓" : "Email ✗"}</Badge>
              </div>
            </div>
          </div>
        </Carte>
        {scoreData && (
          <Link href="/score" className="block group">
            <Carte className="cursor-pointer hover:shadow-lg transition-all h-full">
              <p className="text-xs uppercase text-ardoise-clair font-semibold mb-1">Score de confiance</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-lagune">{scoreData.score_total}<span className="text-sm text-ardoise-clair">/100</span></span>
                <div className="flex-1">
                  <BarreProgression valeur={Math.min(scoreData.score_total, 100)} couleur="lagune" />
                </div>
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-ardoise-clair">Niveau: <strong>{scoreData.niveau || "—"}</strong></span>
                <span className="text-ocre group-hover:translate-x-1 transition-transform">Détails →</span>
              </div>
            </Carte>
          </Link>
        )}
      </div>

      {/* === MENU 1 : Navigation === */}
      <section>
        <h2 className="text-lg font-bold text-ardoise mb-3 flex items-center gap-2">
          <span className="text-ocre">🧭</span> Navigation
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <TuileMenu href="/citoyen/dashboard" icone="📊" label="Tableau de bord citoyen" />
          <TuileMenu href="/parametres" icone="⚙️" label="Paramètres" />
          <TuileMenu href="/notifications" icone="🔔" label="Notifications" />
          <TuileMenu href="/chatbot" icone="🤖" label="Assistant DigiID" />
          <TuileMenu href="/aide" icone="❓" label="Aide" />
        </div>
      </section>

      {/* === MENU 2 : Suivi & Attestation === */}
      <section>
        <h2 className="text-lg font-bold text-ardoise mb-3 flex items-center gap-2">
          <span className="text-lagune">📈</span> Suivi &amp; Attestation
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <TuileMenu href="/score" icone="🎯" label="Mon score" />
          <TuileMenu href="/badges" icone="🏆" label="Mes badges" />
          <TuileMenu href="/parrainage" icone="📨" label="Parrainage" />
          <TuileMenu href="/historique" icone="🕐" label="Activité" />
          <TuileMenu href="/citoyen/mes-ordonnances" icone="💊" label="Ordonnances" />
          <TuileMenu href="/citoyen/mon-dossier-medical" icone="🏥" label="Dossier médical" />
        </div>
      </section>

      {/* === MENU 3 : Attestation === */}
      <section>
        <h2 className="text-lg font-bold text-ardoise mb-3 flex items-center gap-2">
          <span className="text-succes">📜</span> Attestation
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <TuileMenu href="/attestations-communautaires" icone="🤝" label="Attestations communautaires" />
          <TuileMenu href="/documents" icone="📄" label="Mes documents" />
          <TuileMenu href="/profil/telecharger" icone="📥" label="Télécharger mon profil" />
        </div>
      </section>

      {/* === MENU 4 : Identité === */}
      <section>
        <h2 className="text-lg font-bold text-ardoise mb-3 flex items-center gap-2">
          <span className="text-terre">🆔</span> Identité
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <TuileMenu href="/documents-identite" icone="🆔" label="Documents d'identité" />
          <TuileMenu href="/identite/email" icone="📧" label="Vérification email" />
          <TuileMenu href="/identite/verification-cni" icone="🪪" label="Scan CNI" />
          <TuileMenu href="/identite/verification-visuelle" icone="📸" label="Reconnaissance faciale" />
          <TuileMenu href="/identite/role" icone="🔑" label="Rôle &amp; permissions" />
          <TuileMenu href="/identite/2fa" icone="🔐" label="2FA" />
          <TuileMenu href="/partage" icone="📱" label="Partager mon DigiID" />
          <TuileMenu href="/autorisations" icone="🔒" label="Autorisations" />
          <TuileMenu href="/consentements" icone="✅" label="Consentements" />
        </div>
      </section>

      {/* === 2FA si pas activée === */}
      {!utilisateur.deux_fa_active && (
        <Carte titre="🔐 Double authentification">
          <p className="text-sm text-ardoise-clair mb-3">
            Protège ton compte avec un code à 6 chiffres en plus de ton mot de passe.
          </p>
          <Gestion2FA varianteBouton="secondaire" />
        </Carte>
      )}

      {/* === Actions === */}
      <Carte titre="Actions" description="Gère ton compte DigiID">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Bouton variante="ghost" onClick={() => router.push("/parametres")}>⚙️ Paramètres</Bouton>
          <Bouton variante="ghost" chargement={exportEnCours} onClick={handleExporterDonnees}>📤 Exporter mes données</Bouton>
          <Link href="/profil/telecharger"><Bouton variante="ghost">📥 Télécharger mon profil</Bouton></Link>
          <Bouton variante="ghost" onClick={() => setMontrerConfirmationSuppression(true)} className="!border-terre !text-terre hover:!bg-terre hover:!text-white">🗑️ Supprimer mon compte</Bouton>
        </div>
      </Carte>

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

/** Tuile de lien pour les menus */
function TuileMenu({ href, icone, label }: { href: string; icone: string; label: string }) {
  return (
    <Link href={href} className="block group">
      <div className="carte cursor-pointer hover:shadow-lg transition-all text-center p-4 h-full">
        <p className="text-2xl mb-1">{icone}</p>
        <p className="text-xs font-semibold text-ardoise group-hover:text-ocre transition-colors leading-tight">{label}</p>
      </div>
    </Link>
  );
}
