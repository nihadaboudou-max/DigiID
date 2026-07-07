"use client";

/**
 * Page Tableau de bord / Profil — page d'accueil utilisateur.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { Alerte } from "@/composants/commun/Alerte";
import { Gestion2FA } from "@/composants/commun/Gestion2FA";
import { useAuthentification } from "@/contextes/authentification";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { exporterMesDonnees } from "@/services/profil";
import { obtenirMonScore } from "@/services/score";
import type { ScoreDetail } from "@/services/score";
import { ModalConfirmation } from "@/composants/commun/ModalConfirmation";

export default function PageTableauDeBord() {
  return (
    // ✅ CORRECTION : Ajout des rôles de chefs
    <EnvelopperEspaceProtege rolesAutorises={[
      "citoyen", "agent", "medecin", "police", "ong",
      "chef_police", "chef_medical", "chef_ong", "chef_agent",
      "administrateur", "super_administrateur"
    ]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur } = useAuthentification();
  const [exportEnCours, setExportEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);
  const [montrerConfirmationSuppression, setMontrerConfirmationSuppression] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ScoreDetail | null>(null);

  useEffect(() => {
    if (utilisateur) {
      obtenirMonScore().then(setScoreData).catch(() => {});
    }
  }, [utilisateur]);

  if (!utilisateur) return null;

  async function handleExporterDonnees() {
    setExportEnCours(true);
    setMessage(null); setErreur(null);
    try {
      const donnees = await exporterMesDonnees();
      const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `digiid-export-${new Date().toISOString().split("T")[0]}.json`; a.click();
      URL.revokeObjectURL(url);
      setMessage("Données exportées avec succès !");
    } catch (e) {
      setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de l'export.");
    } finally { setExportEnCours(false); }
  }

  async function handleSupprimerCompte() {
    setSuppressionEnCours(true); setErreur(null);
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

  const initiales = ((utilisateur.prenom?.[0] || "") + (utilisateur.nom?.[0] || "")).toUpperCase() || "?";
  const nomComplet = [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || utilisateur.email;

  return (
    <div className="space-y-8 apparition">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1 className="mt-1">Tableau de bord</h1>
      </div>

      {message && <Alerte variante="succes">{message}</Alerte>}
      {erreur && <Alerte variante="erreur">{erreur}</Alerte>}

      {/* Profil rapide */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Carte className="sm:col-span-2">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-ocre/10 flex items-center justify-center text-ocre text-2xl font-bold flex-shrink-0">{initiales}</div>
            <div className="min-w-0">
              <p className="font-bold text-ardoise text-lg truncate">{nomComplet}</p>
              <p className="text-sm text-ardoise-clair font-mono truncate">{utilisateur.digiid_public || "—"}</p>
              <div className="flex gap-1 mt-1 flex-wrap">
                <Badge variante="lagune" taille="petit">{utilisateur.role.replace(/_/g, " ")}</Badge>
                <Badge variante={utilisateur.est_email_verifie ? "succes" : "terre"} taille="petit">{utilisateur.est_email_verifie ? "Email ✓" : "Email ✗"}</Badge>
                <Badge variante={utilisateur.deux_fa_active ? "succes" : "neutre"} taille="petit">{utilisateur.deux_fa_active ? "2FA ✓" : "2FA ✗"}</Badge>
              </div>
            </div>
          </div>
        </Carte>

        {scoreData && (
          <Link href="/score" className="block group">
            <Carte className="cursor-pointer hover:shadow-lg transition-all h-full">
              <p className="text-xs uppercase text-ardoise-clair font-semibold mb-1">Score</p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-lagune">{scoreData.score_total}<span className="text-sm text-ardoise-clair">/100</span></span>
                <div className="flex-1"><BarreProgression valeur={Math.min(scoreData.score_total, 100)} couleur="lagune" /></div>
              </div>
              <div className="flex justify-between mt-1 text-xs">
                <span className="text-ardoise-clair">Niveau: <strong>{scoreData.niveau || "—"}</strong></span>
                <span className="text-ocre group-hover:translate-x-1 transition-transform">Détails →</span>
              </div>
            </Carte>
          </Link>
        )}
      </div>

      {/* Accès rapide */}
      <Carte titre="Accès rapide">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <LienRapide href="/profil" icone="👤" label="Mon profil" />
          <LienRapide href="/score" icone="🎯" label="Mon score" />
          <LienRapide href="/partage" icone="📱" label="Partager" />
          <LienRapide href="/badges" icone="🏆" label="Badges" />
          <LienRapide href="/parametres" icone="⚙️" label="Paramètres" />
          <LienRapide href="/notifications" icone="🔔" label="Notifications" />
          <LienRapide href="/citoyen/mes-ordonnances" icone="💊" label="Ordonnances" />
          <LienRapide href="/chatbot" icone="🤖" label="Assistant" />
        </div>
      </Carte>

      {/* 2FA */}
      {!utilisateur.deux_fa_active && (
        <Carte titre="🔐 Double authentification">
          <p className="text-sm text-ardoise-clair mb-3">Protège ton compte avec un code à 6 chiffres.</p>
          <Gestion2FA varianteBouton="secondaire" />
        </Carte>
      )}

      {/* Actions */}
      <Carte titre="Actions" description="Gère ton compte DigiID">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Bouton variante="ghost" onClick={() => window.location.href = "/parametres"}>⚙️ Paramètres</Bouton>
          <Bouton variante="ghost" chargement={exportEnCours} onClick={handleExporterDonnees}>📤 Exporter mes données</Bouton>
          <Link href="/profil/telecharger"><Bouton variante="ghost">📥 Télécharger mon profil</Bouton></Link>
          <Bouton variante="ghost" onClick={() => setMontrerConfirmationSuppression(true)} className="!border-terre !text-terre hover:!bg-terre hover:!text-white">🗑️ Supprimer mon compte</Bouton>
        </div>
      </Carte>

      <ModalConfirmation
        ouvert={montrerConfirmationSuppression}
        titre="Supprimer mon compte"
        description="Cette action est irréversible. Toutes tes données personnelles seront définitivement effacées."
        messageAlerte="Cette action est irréversible et sera tracée dans le journal d'audit."
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

function LienRapide({ href, icone, label }: { href: string; icone: string; label: string }) {
  return (
    <Link href={href} className="p-3 bg-sable rounded-xl hover:bg-sable/80 transition-all text-center group">
      <p className="text-2xl mb-1">{icone}</p>
      <p className="text-xs font-semibold text-ardoise group-hover:text-ocre">{label}</p>
    </Link>
  );
}
