"use client";

/**
 * Page dédiée — Création d'un profil utilisateur par le super admin.
 *
 * Avant : formulaire dans une modale (perte de données au clic extérieur).
 * Maintenant : page indépendante, stable, avec navigation.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { useNotifications } from "@/contextes/notifications";
import { creerProfilUtilisateur, type CreerProfilRequete } from "@/services/super_admin_utilisateurs";
import { ErreurAPI } from "@/services/client_api";

type TypeRole = "chef_police" | "chef_medical" | "chef_ong" | "chef_agent" | "agent_police" | "agent_medical" | "agent_terrain" | "agent_ong";

const ROLES_CREATION: { role: TypeRole; libelle: string; icone: string; description: string }[] = [
  // ─── Chefs de département ───
  {
    role: "chef_police",
    libelle: "Chef Police",
    icone: "👮‍♂️",
    description: "Gère les agents de police et les missions de son département",
  },
  {
    role: "chef_medical",
    libelle: "Chef Médical",
    icone: "🏥",
    description: "Gère les médecins et le personnel médical du département",
  },
  {
    role: "chef_ong",
    libelle: "Chef ONG",
    icone: "🤝",
    description: "Gère les agents ONG et les programmes d'aide",
  },
  {
    role: "chef_agent",
    libelle: "Chef Enrôlement",
    icone: "📋",
    description: "Gère les agents d'enrôlement et les inscriptions",
  },
  // ─── Agents ───
  {
    role: "agent_police",
    libelle: "Agent Police",
    icone: "👮",
    description: "Vérification d'identité dans le cadre légal",
  },
  {
    role: "agent_medical",
    libelle: "Agent Médical",
    icone: "🩺",
    description: "Accès aux dossiers médicaux en contexte de soin",
  },
  {
    role: "agent_terrain",
    libelle: "Agent Terrain / Enrôlement",
    icone: "📋",
    description: "Enrôlement et inscription des citoyens",
  },
  {
    role: "agent_ong",
    libelle: "Agent ONG",
    icone: "🤝",
    description: "Consultation des profils pour programmes d'aide",
  },
];

export default function PageCreationProfil() {
  const router = useRouter();
  const { notifier } = useNotifications();

  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState<TypeRole>("agent_terrain");
  const [ville, setVille] = useState("Dakar");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<{ email: string; prenom: string; nom: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);

    if (!email || !motDePasse || !prenom || !nom) {
      setErreur("Tous les champs obligatoires doivent être remplis.");
      return;
    }
    if (motDePasse.length < 12) {
      setErreur("Le mot de passe doit faire au moins 12 caractères.");
      return;
    }
    if (prenom.length < 2 || nom.length < 2) {
      setErreur("Prénom et nom doivent faire au moins 2 caractères.");
      return;
    }

    setChargement(true);
    try {
      const donnees: CreerProfilRequete = { email, mot_de_passe: motDePasse, prenom, nom, role, ville };
      const profil = await creerProfilUtilisateur(donnees);
      setSucces({ email: profil.email, prenom: profil.prenom ?? "", nom: profil.nom ?? "" });
      notifier(`Profil ${role} créé : ${profil.email}`, "succes");
    } catch (e) {
      const msg = e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la création";
      setErreur(msg);
    } finally {
      setChargement(false);
    }
  };

  // --- Écran de succès ---
  if (succes) {
    return (
      <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
        <div className="max-w-lg mx-auto py-6">
          <div className="carte text-center p-6">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl text-green-700">✓</span>
            </div>
            <h1 className="text-xl mb-2">Profil créé avec succès !</h1>
            <p className="text-ardoise-clair mb-4 text-sm">
              Le profil <strong>{succes.prenom} {succes.nom}</strong> ({succes.email}) est prêt.
            </p>
            <p className="text-xs text-ardoise-clair mb-4">
              L&apos;utilisateur recevra ses identifiants par email (en production).
              En mode démo, note les identifiants pour les lui communiquer.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Bouton variante="primaire" taille="petit" onClick={() => router.push("/super-admin/utilisateurs")}>
                ← Retour à la liste
              </Bouton>
              <Bouton variante="secondaire" taille="petit" onClick={() => { setSucces(null); setEmail(""); setMotDePasse(""); setPrenom(""); setNom(""); setRole("agent_terrain"); setVille("Dakar"); }}>
                + Créer un autre
              </Bouton>
            </div>
          </div>
        </div>
      </EnvelopperEspaceProtege>
    );
  }

  // --- Formulaire ---
  return (
    <EnvelopperEspaceProtege rolesAutorises={["super_administrateur"]}>
      <div className="max-w-2xl mx-auto">
        {/* En-tête compact */}
        <header className="mb-4">
          <p className="text-ocre font-semibold text-xs uppercase tracking-wider">
            Super administration
          </p>
          <h1 className="mt-1 text-2xl">Créer un profil</h1>
          <p className="text-ardoise-clair mt-1 text-sm">
            Crée un compte pour un agent, médecin, policier ou ONG. 
            Le formulaire reste stable — pas de risque de perte si tu cliques à côté.
          </p>
        </header>

        {erreur && <Alerte variante="erreur" titre="Erreur" className="mb-3">{erreur}</Alerte>}

        <form onSubmit={handleSubmit}>
          <Carte>
            {/* Sélection du rôle */}
            <div className="mb-4">
              <label className="text-[10px] uppercase text-ardoise-clair font-semibold mb-2 block">
                Rôle du profil
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ROLES_CREATION.map((r) => (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => setRole(r.role)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      role === r.role
                        ? "bg-ocre text-white border-ocre shadow-md"
                        : "bg-white text-ardoise border-ardoise-clair/20 hover:border-ocre hover:text-ocre hover:bg-ocre/5"
                    }`}
                  >
                    <span className="text-xl block mb-0.5">{r.icone}</span>
                    <span className="text-xs font-medium">{r.libelle}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-ardoise-clair mt-1.5 italic">
                {ROLES_CREATION.find((r) => r.role === role)?.description}
              </p>
            </div>

            <hr className="border-ardoise-clair/10 my-4" />

            {/* Identité */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] uppercase text-ardoise-clair font-semibold">
                  Prénom <span className="text-terre">*</span>
                </label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                  minLength={2}
                  className="w-full mt-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocre/30 focus:border-ocre transition-all"
                  placeholder="Amadou"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-ardoise-clair font-semibold">
                  Nom <span className="text-terre">*</span>
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  minLength={2}
                  className="w-full mt-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocre/30 focus:border-ocre transition-all"
                  placeholder="Diallo"
                />
              </div>
            </div>

            {/* Email */}
            <div className="mb-3">
              <label className="text-[10px] uppercase text-ardoise-clair font-semibold">
                Email <span className="text-terre">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full mt-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocre/30 focus:border-ocre transition-all"
                placeholder="agent@mairie-dakar.sn"
              />
            </div>

            {/* Mot de passe */}
            <div className="mb-3">
              <label className="text-[10px] uppercase text-ardoise-clair font-semibold">
                Mot de passe <span className="text-terre">*</span>
              </label>
              <input
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
                minLength={12}
                className="w-full mt-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocre/30 focus:border-ocre transition-all"
                placeholder="Au moins 12 caractères"
              />
              <p className="text-xs text-ardoise-clair mt-1">
                Minimum 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial.
              </p>
            </div>

            {/* Ville */}
            <div className="mb-3">
              <label className="text-[10px] uppercase text-ardoise-clair font-semibold">Ville</label>
              <input
                type="text"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ocre/30 focus:border-ocre transition-all"
                placeholder="Dakar"
              />
            </div>
          </Carte>

          {/* Boutons d'action */}
          <div className="flex flex-wrap justify-between gap-2 mt-4">
            <Link href="/super-admin/utilisateurs">
              <Bouton type="button" variante="ghost" taille="petit">← Annuler</Bouton>
            </Link>
            <Bouton type="submit" variante="primaire" taille="petit" chargement={chargement}>
              Créer le profil
            </Bouton>
          </div>
        </form>

        {/* Aide */}
        <Carte variante="pointilles" titre="À propos de la création de profils" className="mt-4">
          <ul className="space-y-1.5 text-xs text-ardoise">
            <li>✓ Le profil créé aura un accès immédiat au système.</li>
            <li>✓ Un email sera envoyé à l&apos;utilisateur avec ses identifiants (en production).</li>
            <li>✓ Le rôle peut être modifié ultérieurement depuis la liste des utilisateurs.</li>
            <li>✓ Toute création est tracée dans le journal d&apos;audit.</li>
          </ul>
        </Carte>
      </div>
    </EnvelopperEspaceProtege>
  );
}