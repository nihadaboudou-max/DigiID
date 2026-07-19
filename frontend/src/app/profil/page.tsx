"use client";

import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";
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

  if (chargement || !utilisateur) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-ardoise-clair italic">Chargement du profil...</p>
      </div>
    );
  }

  const initiales = ((utilisateur.prenom?.[0] || "") + (utilisateur.nom?.[0] || "")).toUpperCase() || "?";
  const nomComplet = [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || utilisateur.email;

  return (
    <div className="max-w-4xl mx-auto space-y-6 apparition pb-20">
      
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1>Mon Profil DigiID</h1>
        <p className="text-ardoise-clair mt-2">
          Consultez vos informations personnelles et l'état de vos vérifications.
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
            <p className="text-sm text-ardoise-clair font-mono">{utilisateur.digiid_public || "DigiID non généré"}</p>
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

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-3">
        <Link href="/parametres">
          <Bouton variante="primaire">⚙️ Modifier mes informations</Bouton>
        </Link>
        <Link href="/profil/telecharger">
          <Bouton variante="secondaire">📥 Télécharger mon profil</Bouton>
        </Link>
        <Link href="/tableau-de-bord">
          <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
        </Link>
      </div>

    </div>
  );
}