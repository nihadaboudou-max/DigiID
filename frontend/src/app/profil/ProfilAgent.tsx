"use client";

import Link from "next/link";
import { useAuthentification } from "@/contextes/authentification";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";
import { Bouton } from "@/composants/commun/Bouton";

interface ProfilAgentProps {
  role: string;
  titre: string;
}

export default function ProfilAgent({ role, titre }: ProfilAgentProps) {
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

  // Couleurs selon le rôle
  const getCouleur = () => {
    if (role.includes("police")) return { bg: "bg-terre", text: "text-terre", ring: "ring-terre" };
    if (role.includes("medical") || role.includes("medecin")) return { bg: "bg-lagune", text: "text-lagune", ring: "ring-lagune" };
    if (role.includes("ong")) return { bg: "bg-ocre", text: "text-ocre", ring: "ring-ocre" };
    if (role.includes("agent") || role.includes("enrolement")) return { bg: "bg-lagune", text: "text-lagune", ring: "ring-lagune" };
    return { bg: "bg-lagune", text: "text-lagune", ring: "ring-lagune" };
  };

  const couleur = getCouleur();

  // Lien de retour selon le rôle
  const getLienRetour = () => {
    switch (role) {
      case "agent_police": return "/police/dashboard";
      case "chef_police": return "/chef-police";
      case "agent_medical": return "/medecin/dashboard";
      case "chef_medical": return "/chef-medical";
      case "agent_ong": return "/ong/dashboard";
      case "chef_ong": return "/chef-ong";
      case "agent_terrain": return "/agent/dashboard";
      case "chef_agent": return "/chef-enrolement";
      default: return "/tableau-de-bord";
    }
  };

  // Outils selon le rôle
  const getOutils = () => {
    switch (role) {
      case "agent_police":
        return [
          { href: "/police/verification", icone: "", label: "Vérification" },
          { href: "/police/recherche", icone: "🔎", label: "Recherche" },
          { href: "/police/scan-qr", icone: "📱", label: "Scan QR" },
          { href: "/police/alertes", icone: "🔔", label: "Alertes" },
          { href: "/police/historique", icone: "", label: "Historique" },
          { href: "/police/signalement", icone: "🚨", label: "Signalement" },
        ];
      case "chef_police":
        return [
          { href: "/chef-police/equipe", icone: "👥", label: "Mon équipe" },
          { href: "/chef-police/recherche", icone: "", label: "Recherche" },
          { href: "/chef-police/audit", icone: "📋", label: "Audit" },
          { href: "/chef-police/statistiques", icone: "📊", label: "Statistiques" },
          { href: "/chef-police/rapports", icone: "📄", label: "Rapports" },
          { href: "/chef-police/invitations", icone: "️", label: "Invitations" },
        ];
      case "agent_medical":
        return [
          { href: "/medecin/nouveau-dossier", icone: "➕", label: "Nouveau dossier" },
          { href: "/medecin/dossiers", icone: "", label: "Dossiers" },
          { href: "/medecin/ordonnances", icone: "💊", label: "Ordonnances" },
          { href: "/medecin/calendrier", icone: "", label: "Calendrier" },
          { href: "/medecin/attestations", icone: "📜", label: "Attestations" },
          { href: "/medecin/historique", icone: "🕐", label: "Historique" },
        ];
      case "chef_medical":
        return [
          { href: "/chef-medical/equipe", icone: "👥", label: "Médecins" },
          { href: "/chef-medical/recherche", icone: "🔎", label: "Recherche" },
          { href: "/chef-medical/audit", icone: "📋", label: "Audit" },
          { href: "/chef-medical/statistiques", icone: "", label: "Statistiques" },
          { href: "/chef-medical/rapports", icone: "📄", label: "Rapports" },
          { href: "/chef-medical/invitations", icone: "✉️", label: "Invitations" },
        ];
      case "agent_ong":
        return [
          { href: "/ong/beneficiaires", icone: "👥", label: "Bénéficiaires" },
          { href: "/ong/programme", icone: "📋", label: "Programmes" },
          { href: "/ong/missions", icone: "🚀", label: "Missions" },
          { href: "/ong/attestations", icone: "📜", label: "Attestations" },
        ];
      case "chef_ong":
        return [
          { href: "/chef-ong/agents", icone: "👥", label: "Agents ONG" },
          { href: "/chef-ong/missions", icone: "🚀", label: "Missions" },
          { href: "/chef-ong/programmes", icone: "", label: "Programmes" },
          { href: "/chef-ong/statistiques", icone: "📊", label: "Statistiques" },
          { href: "/chef-ong/rapports", icone: "📄", label: "Rapports" },
          { href: "/chef-ong/invitations", icone: "✉️", label: "Invitations" },
        ];
      case "agent_terrain":
        return [
          { href: "/agent/enrolement", icone: "➕", label: "Enrôlement" },
          { href: "/agent/scan", icone: "📱", label: "Scan CNI" },
          { href: "/agent/capture", icone: "📸", label: "Capture biométrique" },
        ];
      case "chef_agent":
        return [
          { href: "/chef-enrolement/equipe", icone: "👥", label: "Agents terrain" },
          { href: "/chef-enrolement/recherche", icone: "🔎", label: "Recherche" },
          { href: "/chef-enrolement/audit", icone: "", label: "Audit" },
          { href: "/chef-enrolement/statistiques", icone: "📊", label: "Statistiques" },
          { href: "/chef-enrolement/rapports", icone: "📄", label: "Rapports" },
          { href: "/chef-enrolement/invitations", icone: "✉️", label: "Invitations" },
        ];
      default:
        return [];
    }
  };

  const outils = getOutils();

  return (
    <div className="max-w-5xl mx-auto space-y-6 apparition pb-20">
      
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1>{titre}</h1>
        <p className="text-ardoise-clair mt-2">
          Consultez vos informations professionnelles et accédez à vos outils.
        </p>
      </div>

      {/* Carte principale d'identité */}
      <Carte>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className={`w-20 h-20 rounded-full ${couleur.bg}/10 flex items-center justify-center ${couleur.text} text-3xl font-bold flex-shrink-0`}>
            {initiales}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-2xl font-bold text-ardoise">{nomComplet}</h2>
            <p className="text-sm text-ardoise-clair font-mono">{utilisateur.digiid_public || "DigiID non généré"}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variante={role.includes("police") ? "terre" : role.includes("ong") ? "ocre" : "lagune"} taille="petit">
                {titre.replace("Profil ", "")}
              </Badge>
              <Badge variante={utilisateur.est_email_verifie ? "succes" : "terre"} taille="petit">
                {utilisateur.est_email_verifie ? "Email vérifié ✓" : "Email non vérifié"}
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
            <div>
              <span className="text-sm text-ardoise-clair">Membre depuis :</span> 
              <span className="text-sm text-ardoise ml-2">
                {utilisateur.date_creation ? new Date(utilisateur.date_creation).toLocaleDateString("fr-FR") : "—"}
              </span>
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

      {/* Score de confiance */}
      <Carte titre="🎯 Score de confiance">
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-lagune">{utilisateur.score_actuel ?? 0}</div>
          <div className="flex-1">
            <div className="h-2 bg-sable rounded-full overflow-hidden">
              <div className="h-full bg-lagune transition-all" style={{ width: `${Math.min(utilisateur.score_actuel ?? 0, 100)}%` }} />
            </div>
            <p className="text-xs text-ardoise-clair mt-1">Niveau de confiance de votre identité numérique</p>
          </div>
        </div>
      </Carte>

      {/* Outils professionnels */}
      {outils.length > 0 && (
        <Carte titre="🛠️ Mes outils">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {outils.map((outil) => (
              <Link key={outil.href} href={outil.href} className="block group">
                <div className="p-3 bg-sable rounded-lg hover:bg-sable/80 transition-all h-full border border-ardoise-clair/10">
                  <div className="text-2xl mb-1">{outil.icone}</div>
                  <p className="text-sm font-semibold text-ardoise group-hover:text-lagune">{outil.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </Carte>
      )}

      {/* Sécurité & Paramètres */}
      <Carte titre="🔐 Sécurité & Paramètres">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/parametres" className="block group">
            <div className="p-3 bg-sable rounded-lg hover:bg-sable/80 transition-all text-center">
              <div className="text-2xl mb-1">⚙️</div>
              <p className="text-xs font-semibold text-ardoise group-hover:text-ocre">Paramètres</p>
            </div>
          </Link>
          <Link href="/identite/2fa" className="block group">
            <div className="p-3 bg-sable rounded-lg hover:bg-sable/80 transition-all text-center">
              <div className="text-2xl mb-1">🔒</div>
              <p className="text-xs font-semibold text-ardoise group-hover:text-ocre">Double auth.</p>
            </div>
          </Link>
          <Link href="/identite/mot-de-passe" className="block group">
            <div className="p-3 bg-sable rounded-lg hover:bg-sable/80 transition-all text-center">
              <div className="text-2xl mb-1">🔑</div>
              <p className="text-xs font-semibold text-ardoise group-hover:text-ocre">Mot de passe</p>
            </div>
          </Link>
          <Link href="/profil/telecharger" className="block group">
            <div className="p-3 bg-sable rounded-lg hover:bg-sable/80 transition-all text-center">
              <div className="text-2xl mb-1"></div>
              <p className="text-xs font-semibold text-ardoise group-hover:text-ocre">Télécharger</p>
            </div>
          </Link>
        </div>
      </Carte>

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-3">
        <Link href="/parametres">
          <Bouton variante="primaire">⚙️ Modifier mes informations</Bouton>
        </Link>
        <Link href={getLienRetour()}>
          <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
        </Link>
      </div>
    </div>
  );
}