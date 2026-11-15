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
import { Logo } from "@/composants/commun/Logo";
import { inscrire } from "@/services/authentification";
import { ErreurAPI } from "@/services/client_api";
import { useAuthentification } from "@/contextes/authentification";
import { normaliserTelephone } from "@/services/telephone";

export default function PageInscription() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { rafraichirProfil } = useAuthentification();
  const [donnees, setDonnees] = useState({
    email: "",
    mot_de_passe: "",
    prenom: "",
    nom: "",
    telephone: "",
    ville: "Cotonou",
    code_parrainage: "",
  });
  const [accepteCgu, setAccepteCgu] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

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
      const telephone = normaliserTelephone(donnees.telephone);
      if (!telephone) {
        setErreur("Saisis les 8 derniers chiffres, par exemple : 97 12 34 56.");
        setChargement(false);
        return;
      }
      const requete = {
        ...donnees,
        accepte_cgu: accepteCgu,
        telephone,
        ...(donnees.code_parrainage ? { code_parrainage: donnees.code_parrainage } : {}),
      };
      const reponse = await inscrire(requete);
      // Recharger le profil utilisateur dans le contexte d'authentification
      // (les tokens ont déjà été stockés par le service)
      if (reponse.jetons) {
        await rafraichirProfil();
      }
      router.push("/verification-email?apres_inscription=1");
    } catch (e) {
      if (e instanceof ErreurAPI) {
        setErreur(e.message_utilisateur);
      } else {
        setErreur("Erreur inattendue. Réessaie dans un instant.");
      }
      setChargement(false);
    }
  }

  return (
    <>
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
              libelle="Téléphone (obligatoire)"
              type="tel"
              value={donnees.telephone}
              onChange={modifierChamp("telephone")}
              placeholder="97 12 34 56"
              autoComplete="tel"
              required
              inputMode="tel"
              aide="Saisis les 8 derniers chiffres : 97 12 34 56. Le préfixe +229 01 est ajouté automatiquement."
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
              placeholder="Cotonou"
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
                <a href="#" className="font-medium">politique de confidentialité</a> conformes au Code numérique du Bénin (loi 2017-20).
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
