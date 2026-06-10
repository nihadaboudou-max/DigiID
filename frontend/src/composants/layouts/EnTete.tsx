"use client";

/**
 * En-tête de navigation — design compact et élégant aux couleurs DigiID.
 * Profil utilisateur simplifié : icône + initiales.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Logo } from "@/composants/commun/Logo";
import { Bouton } from "@/composants/commun/Bouton";
import { BoutonMenuMobile } from "@/composants/layouts/MenuMobile";
import { useAuthentification } from "@/contextes/authentification";
import { cheminTableauDeBord as cheminTDB } from "@/types/api";
import { useNotifications } from "@/contextes/notifications";
import { IconeDeconnexion, IconeAccueil } from "@/composants/commun/Icones";

export function EnTete() {
  const { utilisateur, estConnecte, seDeconnecter } = useAuthentification();
  const { notifier } = useNotifications();
  const router = useRouter();

  async function gererDeconnexion() {
    await seDeconnecter();
    notifier("Tu es déconnecté. À très vite.", "info");
    router.push("/");
  }

  const cheminTableauDeBord = utilisateur
    ? cheminTDB(utilisateur.role)
    : "/tableau-de-bord";

  const initiales = utilisateur?.prenom
    ? (utilisateur.prenom.charAt(0) + (utilisateur.nom?.charAt(0) || "")).toUpperCase()
    : utilisateur?.email?.charAt(0).toUpperCase() || "?";

  return (
    <header className="bg-white border-b border-ardoise-clair/10 shadow-sm sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {estConnecte && <BoutonMenuMobile />}
          <Link href="/" className="hover:opacity-80 transition-opacity flex-shrink-0">
            <Logo taille="petit" />
          </Link>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          {estConnecte && utilisateur ? (
            <>
              <Link
                href={cheminTableauDeBord}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-ardoise-clair hover:text-lagune hover:bg-sable transition-all duration-200"
              >
                <IconeAccueil className="w-4 h-4" />
                <span>Accueil</span>
              </Link>

              <Link
                href={cheminTableauDeBord}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sable transition-all duration-200 group"
                title={utilisateur.prenom || utilisateur.email}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-lagune to-lagune-clair text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {initiales}
                </div>
                <span className="text-sm text-ardoise-clair hidden sm:inline group-hover:text-ardoise transition-colors max-w-[120px] truncate">
                  {utilisateur.prenom || utilisateur.email}
                </span>
              </Link>

              <div className="h-5 w-px bg-ardoise-clair/10 mx-1" />

              <button
                onClick={gererDeconnexion}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-ardoise-clair hover:text-terre hover:bg-terre/5 transition-all duration-200"
                title="Se déconnecter"
              >
                <IconeDeconnexion className="w-4 h-4" />
                <span className="hidden sm:inline">Quitter</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/connexion"
                className="text-sm font-medium text-ardoise-clair hover:text-lagune px-3 py-1.5 rounded-lg hover:bg-sable transition-all duration-200"
              >
                Connexion
              </Link>
              <Link href="/inscription">
                <Bouton variante="primaire" taille="petit">
                  Créer un compte
                </Bouton>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
