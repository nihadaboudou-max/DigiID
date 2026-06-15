"use client";

/**
 * Historique — Timeline des consultations médicales.
 */
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";

export default function HistoriqueMedecin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <div className="space-y-8 apparition">
        {/* Fil d'Ariane */}
        <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
          <Link href="/medecin/dashboard" className="hover:text-ocre transition-colors">
            Tableau de bord
          </Link>
          <span>/</span>
          <span className="text-ardoise font-semibold">Historique</span>
        </nav>

        {/* En-tête */}
        <div>
          <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Espace medical</p>
          <h1 className="mt-1">Historique</h1>
          <p className="text-ardoise-clair mt-2">
            Timeline complete des consultations et interventions.
          </p>
        </div>

        {/* Contenu */}
        <Carte titre="Historique des consultations">
          <p className="text-sm text-ardoise-clair mb-4">
            Cette fonctionnalite arrive bientot. Vous pourrez consulter
            la timeline complete des consultations et interventions
            de vos patients.
          </p>
          <Link href="/medecin/dashboard">
            <Bouton variante="ghost">Retour</Bouton>
          </Link>
        </Carte>
      </div>
    </EnvelopperEspaceProtege>
  );
}
