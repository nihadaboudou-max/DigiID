"use client";
/**
 * Page publique — Accepter une invitation Super Admin.
 * La personne crée son compte avec le rôle prédéfini par l'invitation.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { clientAPI, ErreurAPI } from "@/services/client_api";

interface InvitationInfo {
  email: string;
  role: string;
  domaine_nom: string | null;
  departement_nom: string | null;
  date_expiration: string;
}

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
          ville,
          telephone,
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

  if (chargement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sable-clair">
        <p className="text-ardoise-clair italic">Vérification de l'invitation...</p>
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
          <p className="text-xs text-ardoise-clair mb-4">
            Votre rôle : <strong>{invitation?.role}</strong>
            {invitation?.domaine_nom && ` — ${invitation.domaine_nom}`}
          </p>
          <Link href="/connexion" className="inline-block bg-lagune text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-lagune/90 transition-colors">
            Se connecter →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sable-clair p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-6">
        {/* En-tête */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-lagune/10 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">️</span>
          </div>
          <h1 className="text-xl font-bold text-ardoise">Accepter l'invitation</h1>
          <p className="text-sm text-ardoise-clair mt-1">
            Créez votre compte <strong>{invitation?.role}</strong>
          </p>
        </div>

        {/* Infos invitation */}
        <div className="bg-sable rounded-lg p-3 mb-4 text-sm">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-ardoise-clair">Email</p>
              <p className="font-semibold text-ardoise">{invitation?.email}</p>
            </div>
            <div>
              <p className="text-ardoise-clair">Rôle</p>
              <p className="font-semibold text-ardoise">{invitation?.role}</p>
            </div>
            {invitation?.domaine_nom && (
              <div>
                <p className="text-ardoise-clair">Domaine</p>
                <p className="font-semibold text-ardoise">{invitation.domaine_nom}</p>
              </div>
            )}
            {invitation?.departement_nom && (
              <div>
                <p className="text-ardoise-clair">Département</p>
                <p className="font-semibold text-ardoise">{invitation.departement_nom}</p>
              </div>
            )}
          </div>
        </div>

        {erreurSoumission && (
          <div className="bg-terre/10 border border-terre/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-terre">{erreurSoumission}</p>
          </div>
        )}

        {/* Formulaire */}
        <form onSubmit={gererSoumission} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Prénom <span className="text-terre">*</span>
              </label>
              <input
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                required
                minLength={2}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                placeholder="Amadou"
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Nom <span className="text-terre">*</span>
              </label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
                minLength={2}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                placeholder="Diallo"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
              Ville
            </label>
            <input
              type="text"
              value={ville}
              onChange={(e) => setVille(e.target.value)}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
              placeholder="Dakar"
            />
          </div>

          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
              Téléphone
            </label>
            <input
              type="tel"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
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
          </div>

          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
              Confirmer le mot de passe <span className="text-terre">*</span>
            </label>
            <input
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
              placeholder="Retapez le mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={soumissionEnCours}
            className="w-full bg-lagune text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-lagune/90 transition-colors disabled:opacity-50"
          >
            {soumissionEnCours ? "Création en cours..." : "Créer mon compte"}
          </button>
        </form>

        <p className="text-xs text-ardoise-clair text-center mt-4">
          En créant ce compte, vous acceptez les conditions d'utilisation de DigiID.
        </p>
      </div>
    </div>
  );
}