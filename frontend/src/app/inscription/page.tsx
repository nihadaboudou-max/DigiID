"use client";

/**
 * Page d'inscription.
 * Appelle l'API backend /api/v1/auth/inscription.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { EnTete } from "@/composants/layouts/EnTete";
import { Logo } from "@/composants/commun/Logo";
import { inscrire } from "@/services/authentification";
import { ErreurAPI } from "@/services/client_api";
import { useAuthentification } from "@/contextes/authentification";
import { cheminTableauDeBord } from "@/types/api";

export default function PageInscription() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { rafraichirProfil, utilisateur } = useAuthentification();
  const [donnees, setDonnees] = useState({
    email: "",
    mot_de_passe: "",
    prenom: "",
    nom: "",
    telephone: "",
    ville: "Dakar",
    code_parrainage: "",
  });
  const [accepteCgu, setAccepteCgu] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      setDonnees((d) => ({
        ...d,
        code_parrainage: code.trim().toUpperCase(),
      }));
    }
  }, [searchParams]);

  function modifierChamp(champ: keyof typeof donnees) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setDonnees((d) => ({
        ...d,
        [champ]: champ === "code_parrainage"
          ? e.target.value.trim().toUpperCase()
          : e.target.value,
      }));
  }

  async function gererSoumission(evt: React.FormEvent) {
    evt.preventDefault();
    setErreur(null);

    if (!accepteCgu) {
      setErreur("Tu dois accepter les conditions générales pour continuer.");
      return;
    }

    setChargement(true);
    try {
      const requete = {
        ...donnees,
        accepte_cgu: accepteCgu,
        ...(donnees.telephone ? { telephone: donnees.telephone } : {}),
        ...(donnees.code_parrainage ? { code_parrainage: donnees.code_parrainage } : {}),
      };
      const reponse = await inscrire(requete);
      setSucces(true);

      // Recharger le profil utilisateur dans le contexte d'authentification
      // (les tokens ont déjà été stockés par le service)
      if (reponse.jetons) {
        await rafraichirProfil();
      }

      // Rediriger automatiquement vers la vérification d'identité
      // après un court délai pour que l'utilisateur voie le message de succès
      setTimeout(() => {
        router.push("/verification");
      }, 1500);
    } catch (e) {
      if (e instanceof ErreurAPI) {
        setErreur(e.message_utilisateur);
      } else {
        setErreur("Erreur inattendue. Réessaie dans un instant.");
      }
      setChargement(false);
    }
  }

  if (succes) {
    return (
      <>
        <EnTete />
        <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
          <div className="max-w-md w-full carte apparition">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-green-700">✓</span>
              </div>
              <h1 className="text-2xl mb-1">Compte crée !</h1>
              <p className="text-ardoise-clair mb-6">
                Ton DigiID a été généré. Voici tes informations :
              </p>
            </div>

            <div className="bg-sable rounded-xl p-4 space-y-3 mb-6">
              <InfoRow label="Email" value={donnees.email} />
              {donnees.telephone && <InfoRow label="Téléphone" value={donnees.telephone} />}
              <InfoRow label="Prénom" value={donnees.prenom} />
              <InfoRow label="Nom" value={donnees.nom} />
              <InfoRow label="Ville" value={donnees.ville} />
            </div>

            <p className="text-sm text-ardoise-clair text-center mb-6">
              Pour sécuriser ton compte, vérifie ton email dès maintenant.
              Tu pourras aussi le faire plus tard depuis ton profil.
            </p>

            <div className="space-y-3">
              <Bouton
                variante="primaire"
                className="w-full"
                onClick={() => router.push("/verification")}
              >
                Vérifier mon identité
              </Bouton>
              <Bouton
                variante="ghost"
                className="w-full"
                onClick={() => router.push(utilisateur ? cheminTableauDeBord(utilisateur.role) : "/tableau-de-bord")}
              >
                Passer pour l'instant
              </Bouton>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <EnTete />
      <main className="flex-grow flex items-center justify-center px-6 py-12 bg-sable-clair">
        <div className="max-w-lg w-full carte apparition">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <Logo taille="moyen" />
            </div>
            <h1 className="text-2xl mb-1">Crée ton DigiID</h1>
            <p className="text-sm text-ardoise-clair">
              Quelques informations, et c'est parti.
            </p>
          </div>

          {erreur && (
            <div className="bg-terre/10 border-l-4 border-terre p-4 mb-5 rounded">
              <p className="text-sm text-terre font-medium">{erreur}</p>
            </div>
          )}

          <form onSubmit={gererSoumission} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <ChampSaisie
                libelle="Prénom"
                required
                minLength={2}
                value={donnees.prenom}
                onChange={modifierChamp("prenom")}
              />
              <ChampSaisie
                libelle="Nom"
                required
                minLength={2}
                value={donnees.nom}
                onChange={modifierChamp("nom")}
              />
            </div>

            <ChampSaisie
              libelle="Email"
              type="email"
              required
              value={donnees.email}
              onChange={modifierChamp("email")}
              placeholder="amadou@exemple.com"
              autoComplete="email"
            />

            <ChampSaisie
              libelle="Téléphone"
              type="tel"
              value={donnees.telephone}
              onChange={modifierChamp("telephone")}
              placeholder="+221 77 123 45 67"
              autoComplete="tel"
              aide="Numéro au format international. Facultatif mais améliore ton score."
            />

            <ChampSaisie
              libelle="Mot de passe"
              type="password"
              required
              minLength={12}
              value={donnees.mot_de_passe}
              onChange={modifierChamp("mot_de_passe")}
              autoComplete="new-password"
              aide="Minimum 12 caractères, avec majuscule, minuscule, chiffre et caractère spécial."
            />

            <ChampSaisie
              libelle="Ville"
              value={donnees.ville}
              onChange={modifierChamp("ville")}
              placeholder="Dakar"
            />

            <ChampSaisie
              libelle="Code de parrainage (facultatif)"
              value={donnees.code_parrainage}
              onChange={modifierChamp("code_parrainage")}
              placeholder="ABCD1234"
              aide="Entrez le code de parrainage de votre ami si vous en avez un."
            />

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accepteCgu}
                onChange={(e) => setAccepteCgu(e.target.checked)}
                className="mt-1 w-4 h-4 accent-lagune"
                required
              />
              <span className="text-sm text-ardoise-clair leading-relaxed">
                J'accepte les <a href="#" className="font-medium">conditions générales d'utilisation</a> et la{" "}
                <a href="#" className="font-medium">politique de confidentialité</a> conformes à la loi sénégalaise 2008-12.
              </span>
            </label>

            <Bouton
              type="submit"
              variante="primaire"
              chargement={chargement}
              className="w-full mt-2"
            >
              Créer mon compte
            </Bouton>
          </form>

          <div className="mt-6 pt-6 border-t border-ardoise-clair/10 text-center text-sm">
            <p className="text-ardoise-clair">
              Tu as déjà un DigiID ?{" "}
              <Link href="/connexion" className="font-medium">
                Connexion
              </Link>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-ardoise-clair">{label}</span>
      <span className="font-medium text-ardoise">{value}</span>
    </div>
  );
}
