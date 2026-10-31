"use client";

/**
 * Tableau de bord Citoyen — Identité numérique et score de confiance.
 * Données dynamiques issues de l'API via le contexte d'authentification.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Badge, type BadgeVariante } from "@/composants/commun/Badge";
import { EtatVerificationsCitoyen } from "@/composants/verifications";
import {
  useEtatVerifications,
  type NiveauVerification,
} from "@/crochets/useEtatVerifications";
import { useAuthentification } from "@/contextes/authentification";
import { logistiqueAPI } from "@/services/logistique_api";
import type { Colis } from "@/types/logistique";

export default function CitoyenDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { utilisateur, chargement: chargementAuth } = useAuthentification();
  const etatVerifications = useEtatVerifications();
  const [codeSuivi, setCodeSuivi] = useState("");
  const [mesColis, setMesColis] = useState<Colis[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!utilisateur?.id) return;
    void logistiqueAPI.colis.mes()
      .then((reponse) => setMesColis(reponse.elements))
      .catch(() => setMesColis([]));
  }, [utilisateur?.id]);

  if (chargementAuth) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1>Mon identité numérique</h1>
        <p className="text-ardoise-clair italic py-12">Chargement de ton profil...</p>
      </div>
    );
  }

  if (!utilisateur) return null;

  // Initiales pour l'avatar
  const initiales = ((utilisateur.prenom?.[0] || "") + (utilisateur.nom?.[0] || "")).toUpperCase() || "?";
  const nomComplet = [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") || utilisateur.email;

  // Niveau de vérification (compte + documents d'identité fournis)
  const LIBELLES_NIVEAU: Record<NiveauVerification, string> = {
    aucune: "Non vérifié",
    partielle: "Partiellement vérifié",
    renforcee: "Vérifié",
    complete: "Identité complète ✓",
  };
  const VARIANTES_NIVEAU: Record<NiveauVerification, BadgeVariante> = {
    aucune: "neutre",
    partielle: "ocre",
    renforcee: "info",
    complete: "succes",
  };
  const niveauIdentite = {
    texte: LIBELLES_NIVEAU[etatVerifications.niveau],
    variante: VARIANTES_NIVEAU[etatVerifications.niveau],
  };

  return (
    <div className="space-y-6 apparition pb-20">
      {/* En-tête */}
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1 className="mt-1">Tableau de bord</h1>
        <p className="text-ardoise-clair mt-1 text-sm">
          Bienvenue {nomComplet.split(" ")[0]} — retrouve ici ton identité et tes suivis de transport.
        </p>
      </div>

      {/* Identité et vérifications essentielles */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Carte Identité */}
        <Carte className="lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-ocre/10 flex items-center justify-center text-ocre text-xl font-bold flex-shrink-0">
              {initiales}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-ardoise truncate">{nomComplet}</h2>
              <p className="text-xs text-ardoise-clair font-mono truncate">{utilisateur.digiid_public || "—"}</p>
              <Badge variante={niveauIdentite.variante} taille="petit" className="mt-1">{niveauIdentite.texte}</Badge>
            </div>
          </div>
          <div className="mt-4 flex gap-2 flex-wrap">
            <Link href="/parametres">
              <Badge variante="ocre" taille="petit" className="cursor-pointer hover:opacity-80">⚙️ Modifier</Badge>
            </Link>
            <Link href="/profil">
              <Badge variante="lagune" taille="petit" className="cursor-pointer hover:opacity-80">👤 Profil complet</Badge>
            </Link>
          </div>
        </Carte>

        {/* État des vérifications (compte + documents fournis) */}
        <Carte className="lg:col-span-1">
          <p className="text-xs uppercase text-ardoise-clair font-semibold mb-3">Vérifications</p>
          <EtatVerificationsCitoyen etat={etatVerifications} variante="compact" />
          <Link href="/documents-identite" className="block text-center mt-3 text-xs text-ocre hover:underline font-semibold">
            Compléter mes vérifications →
          </Link>
        </Carte>
      </div>

      {/* Le détail des envois se charge uniquement à l'ouverture de la carte. */}
      <Carte titre="Transport et suivi" description="Suis tes colis et les trajets de tes proches, de la gare de départ à l'arrivée.">
        <form
          className="flex flex-col sm:flex-row gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const code = codeSuivi.trim();
            if (code) router.push(`/suivi/${encodeURIComponent(code)}`);
          }}
        >
          <label htmlFor="code-suivi" className="sr-only">Code de suivi</label>
          <input
            id="code-suivi"
            className="champ-saisie flex-1"
            value={codeSuivi}
            onChange={(event) => setCodeSuivi(event.target.value)}
            placeholder="Saisir un code de suivi"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!codeSuivi.trim()}
            className="rounded-lg bg-lagune px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lagune/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Suivre
          </button>
        </form>
        <Link
          href="/identite/carte"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ocre hover:underline"
        >
          Ma carte DigiID, mes colis et mes proches →
        </Link>
        {mesColis.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-ardoise-clair/10 pt-4">
            <p className="text-xs font-semibold uppercase text-ardoise-clair">
              Colis liés à ton compte
            </p>
            {mesColis.slice(0, 5).map((colis) => (
              <button
                key={colis.id}
                type="button"
                onClick={() => router.push(`/suivi/${encodeURIComponent(colis.code_clair || colis.id)}`)}
                className="flex w-full items-center justify-between rounded-lg bg-sable px-3 py-2 text-left text-sm hover:bg-sable/70"
              >
                <span className="font-mono text-lagune">{colis.code_clair || "Code indisponible"}</span>
                <span className="text-ardoise-clair">{colis.statut}</span>
              </button>
            ))}
          </div>
        )}
      </Carte>
    </div>
  );
}

/* ─── Sous-composants ─── */
