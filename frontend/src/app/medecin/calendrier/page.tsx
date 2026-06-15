"use client";

/**
 * Calendrier — Planification des rendez-vous médicaux.
 */
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";

export default function CalendrierMedecin() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <div className="space-y-8 apparition">
        {/* Fil d'Ariane */}
        <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
          <Link href="/medecin/dashboard" className="hover:text-ocre transition-colors">
            Tableau de bord
          </Link>
          <span>/</span>
          <span className="text-ardoise font-semibold">Calendrier</span>
        </nav>

        {/* En-tête */}
        <div>
          <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Espace medical</p>
          <h1 className="mt-1">Calendrier</h1>
          <p className="text-ardoise-clair mt-2">
            Planifiez et gerez vos rendez-vous medicaux.
          </p>
        </div>

        {/* Contenu */}
        <Carte titre="Planification des rendez-vous">
          <p className="text-sm text-ardoise-clair mb-4">
            Cette fonctionnalite arrive bientot. Vous pourrez planifier,
            modifier et consulter vos rendez-vous patients depuis cet espace.
          </p>
          <Link href="/medecin/dashboard">
            <Bouton variante="ghost">Retour</Bouton>
          </Link>
        </Carte>
      </div>
    </EnvelopperEspaceProtege>
  );
}
