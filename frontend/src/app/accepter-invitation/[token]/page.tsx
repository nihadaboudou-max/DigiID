"use client";
/**
 * Page publique — Accepter une invitation Super Admin.
 * La personne crée son compte avec le rôle prédéfini par l'invitation.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { clientAPI, ErreurAPI } from "@/services/client_api";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Bouton } from "@/composants/commun/Bouton";
import { Alerte } from "@/composants/commun/Alerte";
import { Carte } from "@/composants/commun/Carte";
import { Badge } from "@/composants/commun/Badge";

interface InvitationInfo {
  email: string;
  role: string;
  domaine_nom: string | null;
  departement_nom: string | null;
  date_expiration: string;
}

// Mapping des rôles pour affichage
const LABELS_ROLES: Record<string, string> = {
  admin_domaine: "Administrateur de Domaine",
  chef_police: "Chef de Département Police",
  chef_medical: "Chef de Département Médical",
  chef_ong: "Chef de Département ONG",
  chef_agent: "Chef de Département Enrôlement",
  agent_police: "Agent Police",
  agent_medical: "Agent Médical",
  agent_ong: "Agent ONG",
  agent_terrain: "Agent Terrain",
  administrateur: "Administrateur",
  super_administrateur: "Super Administrateur",
};

// Couleurs par rôle (utilisant les variantes valides)
const COULEURS_ROLES: Record<string, "lagune" | "ocre" | "terre" | "succes" | "neutre"> = {
  admin_domaine: "ocre",
  chef_police: "terre",
  chef_medical: "lagune",
  chef_ong: "ocre",
  chef_agent: "lagune",
  agent_police: "terre",
  agent_medical: "lagune",
  agent_ong: "ocre",
  agent_terrain: "lagune",
};

export default function PageAccepterInvitation() {
  const params = useParams();
  const token = params.token as string;

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ville, setVille] = useState("");
  const [telephone, setTelephone] = useState("");
  const [soumissionEnCours, setSoumissionEnCours] = useState(false);
  const [erreurSoumission, setErreurSoumission] = useState<string | null>(null);

  // Vérifier le token au chargement
  useEffect(() => {
    const verifierToken = async () => {
      try {
        const data = await clientAPI.get<InvitationInfo>(
          `/api/v1/invitations/verifier/${token}`,
          { authentifie: false }
        );
        setInvitation(data);
      } catch (e) {
        setErreur(e instanceof ErreurAPI ? e.message_utilisateur : "Invitation invalide ou expirée.");
      } finally {
        setChargement(false);
      }
    };
    verifierToken();
  }, [token]);

  const gererSoumission = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreurSoumission(null);

    // Validations
    if (motDePasse !== confirmation) {
      setErreurSoumission("Les mots de passe ne correspondent pas.");
      return;
    }
    if (motDePasse.length < 12) {
      setErreurSoumission("Le mot de passe doit faire au moins 12 caractères.");
      return;
    }
    if (prenom.length < 2 || nom.length < 2) {
      setErreurSoumission("Prénom et nom doivent faire au moins 2 caractères.");
      return;
    }

    setSoumissionEnCours(true);
    try {
      await clientAPI.post(
        `/api/v1/invitations/accepter/${token}`,
        {
          prenom,
          nom,
          mot_de_passe: motDePasse,
          ville: ville || null,
          telephone: telephone || null,
        },
        { authentifie: false }
      );
      setSucces(true);
    } catch (e) {
      setErreurSoumission(e instanceof ErreurAPI ? e.message_utilisateur : "Erreur lors de la création du compte.");
    } finally {
      setSoumissionEnCours(false);
    }
  };

  // Indicateur de force du mot de passe
  const forceMotDePasse = (): { niveau: string; couleur: string; pourcentage: number } => {
    if (motDePasse.length === 0) return { niveau: "", couleur: "", pourcentage: 0 };
    let score = 0;
    if (motDePasse.length >= 12) score += 2;
    if (/[A-Z]/.test(motDePasse)) score += 1;
    if (/[a-z]/.test(motDePasse)) score += 1;
    if (/[0-9]/.test(motDePasse)) score += 1;
    if (/[^A-Za-z0-9]/.test(motDePasse)) score += 1;

    if (score <= 2) return { niveau: "Faible", couleur: "bg-terre", pourcentage: 25 };
    if (score <= 3) return { niveau: "Moyen", couleur: "bg-ocre", pourcentage: 50 };
    if (score <= 4) return { niveau: "Bon", couleur: "bg-lagune", pourcentage: 75 };
    return { niveau: "Fort", couleur: "bg-green-600", pourcentage: 100 };
  };

  const force = forceMotDePasse();

  if (chargement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sable-clair p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-lagune border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-ardoise-clair italic">Vérification de l'invitation...</p>
        </div>
      </div>
    );
  }

  if (erreur) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sable-clair p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-terre/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-xl font-bold text-ardoise mb-2">Invitation invalide</h1>
          <p className="text-sm text-ardoise-clair mb-4">{erreur}</p>
          <Link href="/connexion" className="text-lagune font-semibold text-sm hover:underline">
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  if (succes) {
    const labelRole = invitation ? LABELS_ROLES[invitation.role] || invitation.role : "";
    const couleurRole = COULEURS_ROLES[invitation?.role || ""] || "lagune";
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-sable-clair p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-xl font-bold text-ardoise mb-2">Compte créé avec succès !</h1>
          <p className="text-sm text-ardoise-clair mb-2">
            Bienvenue <strong>{prenom} {nom}</strong> !
          </p>
          <div className="bg-sable rounded-lg p-3 mb-4">
            <p className="text-xs text-ardoise-clair mb-1">Votre rôle</p>
            <Badge variante={couleurRole} taille="moyen">
              {labelRole}
            </Badge>
            {invitation?.domaine_nom && (
              <p className="text-xs text-ardoise-clair mt-2">
                Domaine : <strong>{invitation.domaine_nom}</strong>
              </p>
            )}
          </div>
          <p className="text-xs text-ardoise-clair mb-4">
            Vous pouvez maintenant vous connecter avec votre email et mot de passe.
          </p>
          <Link href="/connexion" className="inline-block bg-lagune text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-lagune/90 transition-colors">
            Se connecter →
          </Link>
        </div>
      </div>
    );
  }

  const labelRole = invitation ? LABELS_ROLES[invitation.role] || invitation.role : "";
  const couleurRole = COULEURS_ROLES[invitation?.role || ""] || "lagune";

  return (
    <div className="min-h-screen flex items-center justify-center bg-sable-clair p-4 py-8">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-6">
        {/* En-tête */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-lagune/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">✉️</span>
          </div>
          <h1 className="text-xl font-bold text-ardoise">Accepter l'invitation</h1>
          <p className="text-sm text-ardoise-clair mt-1">
            Créez votre compte{" "}
            <Badge variante={couleurRole} taille="petit">
              {labelRole}
            </Badge>
          </p>
        </div>

        {/* Infos invitation */}
        <div className="bg-sable rounded-lg p-3 mb-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-ardoise-clair mb-0.5">Email</p>
              <p className="font-semibold text-ardoise">{invitation?.email}</p>
            </div>
            <div>
              <p className="text-ardoise-clair mb-0.5">Rôle</p>
              <p className="font-semibold text-ardoise">{labelRole}</p>
            </div>
            {invitation?.domaine_nom && (
              <div>
                <p className="text-ardoise-clair mb-0.5">Domaine</p>
                <p className="font-semibold text-ardoise">{invitation.domaine_nom}</p>
              </div>
            )}
            {invitation?.departement_nom && (
              <div>
                <p className="text-ardoise-clair mb-0.5">Département</p>
                <p className="font-semibold text-ardoise">{invitation.departement_nom}</p>
              </div>
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-ardoise-clair/10">
            <p className="text-[10px] text-ardoise-clair">
              Expire le {new Date(invitation?.date_expiration || "").toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>

        {/* Erreur de soumission */}
        {erreurSoumission && (
          <Alerte variante="erreur" className="mb-4">
            {erreurSoumission}
          </Alerte>
        )}

        {/* Formulaire */}
        <form onSubmit={gererSoumission} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ChampSaisie
              libelle="Prénom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              required
              minLength={2}
              placeholder="Amadou"
            />
            <ChampSaisie
              libelle="Nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              minLength={2}
              placeholder="Diallo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ChampSaisie
              libelle="Ville"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              placeholder="Dakar"
            />
            <ChampSaisie
              libelle="Téléphone"
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+221 77 123 45 67"
            />
          </div>

          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
              Mot de passe <span className="text-terre">*</span>
            </label>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
              minLength={12}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
              placeholder="Au moins 12 caractères"
            />
            {/* Indicateur de force */}
            {motDePasse && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-ardoise-clair">Force du mot de passe</span>
                  <span className={`font-semibold ${
                    force.niveau === "Faible" ? "text-terre" :
                    force.niveau === "Moyen" ? "text-ocre" :
                    force.niveau === "Bon" ? "text-lagune" :
                    "text-green-600"
                  }`}>
                    {force.niveau}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-sable rounded-full overflow-hidden">
                  <div
                    className={`h-full ${force.couleur} transition-all duration-300`}
                    style={{ width: `${force.pourcentage}%` }}
                  />
                </div>
                <p className="text-[10px] text-ardoise-clair mt-1">
                  Utilisez au moins 12 caractères avec majuscules, chiffres et symboles
                </p>
              </div>
            )}
          </div>

          <ChampSaisie
            libelle="Confirmer le mot de passe"
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
            placeholder="Retapez le mot de passe"
          />

          <Bouton
            type="submit"
            variante="primaire"
            taille="grand"
            chargement={soumissionEnCours}
            className="w-full"
          >
            {soumissionEnCours ? "Création en cours..." : "Créer mon compte"}
          </Bouton>
        </form>

        <p className="text-xs text-ardoise-clair text-center mt-4">
          En créant ce compte, vous acceptez les{" "}
          <Link href="/conditions" className="text-lagune hover:underline">
            conditions d'utilisation
          </Link>{" "}
          de DigiID.
        </p>

        <div className="mt-4 pt-4 border-t border-ardoise-clair/10 text-center">
          <Link href="/connexion" className="text-xs text-ardoise-clair hover:text-lagune transition-colors">
            ← Déjà un compte ? Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}