"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { IconeCopier, IconeCheck } from "@/composants/commun/Icones";
import { useAuthentification } from "@/contextes/authentification";

export default function PageProfil() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={[
      "citoyen", "agent_police", "chef_police", "agent_medical", "chef_medical", 
      "agent_ong", "chef_ong", "agent_terrain", "chef_agent", "admin_domaine", 
      "administrateur", "super_administrateur"
    ]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur, chargement } = useAuthentification();
  const [copie, setCopie] = useState(false);

  if (chargement || !utilisateur) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-ardoise-clair italic">Chargement du profil...</p>
      </div>
    );
  }

  const initiales = ((utilisateur.prenom?.[0] || "") + (utilisateur.nom?.[0] || "")).toUpperCase() || "?";
  const nomComplet = [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || utilisateur.email;
  const digiId = utilisateur.digiid_public || "DigiID non généré";

  const urlProfil = typeof window !== "undefined" 
    ? `${window.location.origin}/profil/${digiId}`
    : `https://digiid.africa/profil/${digiId}`;

  async function copierIdentifiant() {
    try {
      await navigator.clipboard.writeText(digiId);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = digiId;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  async function copierLien() {
    try {
      await navigator.clipboard.writeText(urlProfil);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = urlProfil;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  async function partager() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mon identité numérique DigiID",
          text: `Voici mon identifiant DigiID : ${digiId}`,
          url: urlProfil,
        });
      } catch { /* Annulé */ }
    } else {
      copierLien();
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 apparition pb-20">
      
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1>Mon Profil DigiID</h1>
        <p className="text-ardoise-clair mt-2">
          Consultez vos informations personnelles et partagez votre identité numérique.
        </p>
      </div>

      {/* Carte principale d'identité */}
      <Carte>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-lagune/10 flex items-center justify-center text-lagune text-3xl font-bold flex-shrink-0">
            {initiales}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-2xl font-bold text-ardoise">{nomComplet}</h2>
            <p className="text-sm text-ardoise-clair font-mono">{digiId}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variante="lagune" taille="petit">
                {utilisateur.role?.replace(/_/g, " ").toUpperCase()}
              </Badge>
              <Badge variante={utilisateur.est_actif ? "succes" : "terre"} taille="petit">
                {utilisateur.est_actif ? "Compte actif" : "Compte inactif"}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-ardoise-clair/10">
          {/* Coordonnées */}
          <div className="space-y-3">
            <p className="text-xs uppercase text-ardoise-clair font-semibold">Coordonnées</p>
            <div>
              <span className="text-sm text-ardoise-clair">Email :</span> 
              <span className="text-sm text-ardoise ml-2">{utilisateur.email}</span>
            </div>
            <div>
              <span className="text-sm text-ardoise-clair">Téléphone :</span> 
              <span className="text-sm text-ardoise ml-2">{utilisateur.telephone || "Non renseigné"}</span>
            </div>
            <div>
              <span className="text-sm text-ardoise-clair">Ville :</span> 
              <span className="text-sm text-ardoise ml-2">{utilisateur.ville || "Non renseignée"}</span>
            </div>
          </div>

          {/* État des vérifications */}
          <div className="space-y-3">
            <p className="text-xs uppercase text-ardoise-clair font-semibold">État des vérifications</p>
            <div className="flex items-center justify-between p-2 bg-sable rounded-lg">
              <span className="text-sm text-ardoise">📧 Email vérifié</span>
              <Badge variante={utilisateur.est_email_verifie ? "succes" : "terre"} taille="petit">
                {utilisateur.est_email_verifie ? "Oui" : "Non"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-sable rounded-lg">
              <span className="text-sm text-ardoise">👤 Visage vérifié</span>
              <Badge variante={utilisateur.est_visage_verifie ? "succes" : "terre"} taille="petit">
                {utilisateur.est_visage_verifie ? "Oui" : "Non"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2 bg-sable rounded-lg">
              <span className="text-sm text-ardoise">🪪 CNI vérifiée</span>
              <Badge variante={utilisateur.est_cni_verifiee ? "succes" : "terre"} taille="petit">
                {utilisateur.est_cni_verifiee ? "Oui" : "Non"}
              </Badge>
            </div>
          </div>
        </div>
      </Carte>

      {/* Section identifiant DigiID (fusionnée depuis /partage, SANS QR code statique) */}
      <Carte>
        <p className="text-xs uppercase text-ocre font-bold mb-4 tracking-wider">
          Mon identifiant DigiID
        </p>
        <p className="text-3xl font-mono font-bold text-lagune break-all mb-6 tracking-wider">
          {digiId}
        </p>
        <div className="flex flex-wrap gap-3">
          <Bouton variante="secondaire" onClick={copierIdentifiant}>
            {copie ? (
              <><IconeCheck className="w-4 h-4" /> Copié !</>
            ) : (
              <><IconeCopier className="w-4 h-4" /> Copier mon DigiID</>
            )}
          </Bouton>
          {typeof navigator?.share === 'function' ? (
            <Bouton variante="primaire" onClick={partager}>
              📤 Partager
            </Bouton>
          ) : (
            <Bouton variante="primaire" onClick={copierLien}>
              🔗 Copier le lien
            </Bouton>
          )}
          <Link href="/profil/telecharger">
            <Bouton variante="ghost">📋 Télécharger mon profil numérique</Bouton>
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-ardoise-clair/10">
          <p className="text-xs text-ardoise-clair font-semibold mb-2">Statut du profil</p>
          <div className="flex flex-wrap gap-2">
            <Badge variante={utilisateur.est_email_verifie ? "succes" : "terre"} taille="petit">
              ✉️ {utilisateur.est_email_verifie ? "Vérifié" : "Non vérifié"}
            </Badge>
            <Badge variante={utilisateur.est_visage_verifie ? "succes" : "terre"} taille="petit">
              👤 Visage {utilisateur.est_visage_verifie ? "✓" : "✗"}
            </Badge>
            <Badge variante={utilisateur.est_cni_verifiee ? "succes" : "terre"} taille="petit">
              🆔 CNI {utilisateur.est_cni_verifiee ? "✓" : "✗"}
            </Badge>
          </div>
        </div>
      </Carte>

      {/* Qui peut interroger mon DigiID */}
      <Carte titre="Qui peut interroger mon DigiID ?">
        <div className="grid sm:grid-cols-3 gap-4">
          <BlocUsage titre="Banques" detail="Vérification d'identité avant ouverture de compte." statut="actif" />
          <BlocUsage titre="Hôpitaux" detail="Accès au dossier médical, ordonnances." statut="actif" />
          <BlocUsage titre="Administration" detail="Aides sociales, certificats." statut="phase-4" />
        </div>
      </Carte>

      {/* Sécurité */}
      <Alerte variante="avertissement" titre="🔐 Sécurité">
        <p className="text-sm">Ne partage ton DigiID qu'avec des institutions de confiance. Chaque consultation est tracée.</p>
      </Alerte>

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-3">
        <Link href="/parametres">
          <Bouton variante="primaire">⚙️ Modifier mes informations</Bouton>
        </Link>
        <Link href="/autorisations">
          <Bouton variante="secondaire">🔑 Autorisations</Bouton>
        </Link>
        <Link href="/citoyen/dashboard">
          <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
        </Link>
      </div>

    </div>
  );
}

function BlocUsage({ titre, detail, statut }: {
  titre: string; detail: string; statut: "actif" | "phase-4";
}) {
  return (
    <div className="bg-sable-clair rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-lagune">{titre}</h4>
        {statut === "actif" ? (
          <Badge variante="succes">Actif</Badge>
        ) : (
          <Badge variante="ocre">À venir</Badge>
        )}
      </div>
      <p className="text-xs text-ardoise-clair">{detail}</p>
    </div>
  );
}