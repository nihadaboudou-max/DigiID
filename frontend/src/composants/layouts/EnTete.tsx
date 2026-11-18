"use client";

/**
 * En-tête de navigation — design compact et élégant aux couleurs DigiID.
 * Profil utilisateur simplifié : icône + initiales.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/composants/commun/Logo";
import { Bouton } from "@/composants/commun/Bouton";
import { BoutonMenuMobile } from "@/composants/layouts/MenuMobile";
import { useAuthentification } from "@/contextes/authentification";
import { cheminTableauDeBord as cheminTDB } from "@/types/api";
import { useNotifications } from "@/contextes/notifications";
import { IconeCloche, IconeDeconnexion } from "@/composants/commun/Icones";
import { BoutonMuet } from "@/composants/accessibilite/BoutonMuet";
import { listerMesNotifications } from "@/services/gamification";

export function EnTete() {
  const { utilisateur, estConnecte, seDeconnecter } = useAuthentification();
  const { notifier } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();
  const [nombreMessagesNonLus, setNombreMessagesNonLus] = useState(0);
  const estCitoyen = utilisateur?.role === "citoyen";

  useEffect(() => {
    if (!utilisateur?.id) {
      setNombreMessagesNonLus(0);
      return;
    }

    let annule = false;
    const chargerCompteur = async () => {
      try {
        const resultat = await listerMesNotifications(false, {
          page: 1,
          parPage: 1,
          ...(estCitoyen
            ? { categorie: "logistique_colis,logistique_suivi" }
            : {}),
        });
        if (!annule) setNombreMessagesNonLus(resultat.non_lues);
      } catch {
        if (!annule) {
          console.error("Impossible de charger le compteur de messages.");
        }
      }
    };

    void chargerCompteur();
    const minuteur = window.setInterval(() => void chargerCompteur(), 60_000);
    return () => {
      annule = true;
      window.clearInterval(minuteur);
    };
  }, [estCitoyen, utilisateur?.id, pathname]);

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
    <header className="bg-white/95 backdrop-blur border-b border-ardoise-clair/10 shadow-sm sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {estConnecte && utilisateur?.role !== "citoyen" && <BoutonMenuMobile />}
          <Link href="/" className="hover:opacity-80 transition-opacity flex-shrink-0">
            <Logo taille="petit" />
          </Link>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <BoutonMuet />
          {estConnecte && utilisateur ? (
            <>
              <Link
                href={estCitoyen ? "/citoyen/messages" : "/notifications"}
                aria-label={
                  nombreMessagesNonLus > 0
                    ? `Notifications, ${nombreMessagesNonLus} non lues`
                    : "Notifications"
                }
                className="relative flex min-h-14 min-w-11 items-center justify-center rounded-xl px-2 text-lagune hover:bg-sable focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lagune/50"
                title="Notifications"
              >
                <IconeCloche className="h-6 w-6" />
                <span className="sr-only">Notifications</span>
                {nombreMessagesNonLus > 0 && (
                  <span
                    className="absolute right-1 top-2 h-2.5 w-2.5 rounded-full bg-terre ring-2 ring-white"
                    aria-hidden="true"
                  />
                )}
              </Link>
              <Link
                href={cheminTableauDeBord}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-sable transition-all duration-200 group"
                title={utilisateur.prenom || utilisateur.email}
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-lagune to-lagune-clair text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {initiales}
                </div>
                <span className="text-sm text-ardoise-clair hidden sm:inline group-hover:text-ardoise transition-colors max-w-[120px] truncate">
                  {utilisateur.prenom || utilisateur.email}
                </span>
              </Link>

              <div className="h-5 w-px bg-ardoise-clair/10 mx-1" />

              <button
                onClick={gererDeconnexion}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-sm font-medium text-ardoise-clair hover:text-terre hover:bg-terre/5 transition-all duration-200"
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