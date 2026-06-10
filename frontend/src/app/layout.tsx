/**
 * Layout racine — englobe TOUTES les pages.
 * Charge Poppins en local (évite les problèmes de connexion à Google Fonts).
 * Applique les styles globaux, monte les contextes.
 */
import type { Metadata } from "next";
import localFont from "next/font/local";
import "@/styles/globaux.css";

import { FournisseurAuthentification } from "@/contextes/authentification";
import { FournisseurNotifications } from "@/contextes/notifications";

// Polices Poppins hébergées localement — pas de dépendance à Google Fonts
const poppins = localFont({
  src: [
    {
      path: "../../fonts/poppins/Poppins-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../fonts/poppins/Poppins-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../fonts/poppins/Poppins-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../fonts/poppins/Poppins-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../fonts/poppins/Poppins-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DigiID — Système d'identité numérique africaine",
  description:
    "Une identité née de la vie quotidienne. " +
    "Prototype académique — Mémoire de fin d'études M2 ISM Dakar.",
};

export default function LayoutRacine({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={poppins.variable}>
      <body className="min-h-screen flex flex-col">
        <FournisseurAuthentification>
          <FournisseurNotifications>
            {children}
          </FournisseurNotifications>
        </FournisseurAuthentification>
      </body>
    </html>
  );
}
