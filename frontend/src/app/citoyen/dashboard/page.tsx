"use client";

/**
 * Tableau de bord Citoyen — Identité numérique et score de confiance.
 * 
 * Modules accessibles :
 *   - mon_profil            → /citoyen/profil
 *   - mes_attestations      → /citoyen/attestations
 *   - mon_score             → /citoyen/score
 *   - mes_documents         → /citoyen/documents
 *   - historique_acces      → /citoyen/acces
 *   - verification_cni      → /citoyen/verification-cni
 *   - verification_faciale  → /citoyen/verification-faciale
 *   - consentements         → /citoyen/consentements
 *   - chatbot               → /chatbot
 *   - badges                → /citoyen/badges
 *   - parrainage            → /citoyen/parrainage
 */

import Link from "next/link";
import { useRoleUI } from "@/crochets/useRoleUI";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { BarreProgression } from "@/composants/commun/BarreProgression";

export default function CitoyenDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can, chargement } = useRoleUI();

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1>Mon identité numérique</h1>
        <p className="text-ardoise-clair italic py-12">Chargement de ton profil...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Mon espace</p>
        <h1 className="mt-1">Mon identité numérique</h1>
        <p className="text-ardoise-clair mt-2">Bienvenue sur ton espace DigiID. Gère ton identité et suis ton score de confiance.</p>
      </div>

      {/* Résumé identité */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Carte>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-ocre/10 flex items-center justify-center text-ocre text-2xl font-bold">FD</div>
            <div>
              <h2 className="font-bold text-ardoise text-lg">Fatou Diallo</h2>
              <p className="text-sm text-ardoise-clair">DIG-A1B2C3D4E5F6</p>
              <Badge variante="succes">Identité vérifiée</Badge>
            </div>
          </div>
        </Carte>

        {/* Score de confiance */}
        {can.viewScore && (
          <Carte>
            <p className="text-xs uppercase text-ardoise-clair font-semibold mb-1">Score de confiance</p>
            <div className="flex items-center gap-3">
              <span className="text-4xl font-bold text-lagune">78</span>
              <span className="text-sm text-ardoise-clair">/100</span>
              <div className="flex-1">
                <BarreProgression valeur={78} couleur="lagune" />
              </div>
            </div>
            <Link href="/citoyen/score" className="text-xs text-ocre hover:underline mt-2 inline-block">
              Voir les détails →
            </Link>
          </Carte>
        )}
      </div>

      {/* Attestations récentes */}
      {can.viewAttestations && (
        <Carte titre="Attestations récentes">
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-sable rounded-lg">
              <div>
                <p className="text-sm font-semibold text-ardoise">Attestation d'identité</p>
                <p className="text-xs text-ardoise-clair">Émise par Mairie de Dakar · 10/06/2026</p>
              </div>
              <Badge variante="succes">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-sable rounded-lg">
              <div>
                <p className="text-sm font-semibold text-ardoise">Certificat de résidence</p>
                <p className="text-xs text-ardoise-clair">Émis par ONG Partenaire · 05/06/2026</p>
              </div>
              <Badge variante="succes">Active</Badge>
            </div>
          </div>
          <Link href="/citoyen/attestations" className="text-xs text-ocre hover:underline mt-2 inline-block">
            Voir toutes les attestations →
          </Link>
        </Carte>
      )}

      {/* Alerte accès récent */}
      {can.viewAccessHistory && (
        <div className="bg-lagune/10 border-l-4 border-lagune p-4 rounded">
          <p className="text-sm font-semibold text-lagune">🔔 Accès récent par une institution</p>
          <p className="text-xs text-ardoise-clair mt-1">
            La Police nationale a consulté ton profil le 09/06/2026 à 14h32.
            <Link href="/citoyen/acces" className="text-ocre hover:underline ml-1">Voir l'historique →</Link>
          </p>
        </div>
      )}

      {/* Grille d'accès rapide */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {can.verifyCNI && (
          <CarteAction titre="Vérifier ma CNI" description="Scanner ta carte d'identité" href="/citoyen/verification-cni" icone="🪪" />
        )}
        {can.verifyFace && (
          <CarteAction titre="Vérification faciale" description="Reconnaissance biométrique" href="/citoyen/verification-faciale" icone="📸" />
        )}
        {can.manageConsent && (
          <CarteAction titre="Mes consentements" description="Gérer les accès autorisés" href="/citoyen/consentements" icone="✅" />
        )}
        {can.viewDocuments && (
          <CarteAction titre="Mes documents" description="Documents et justificatifs" href="/citoyen/documents" icone="📄" />
        )}
        {can.manageReferral && (
          <CarteAction titre="Parrainage" description="Invite tes proches" href="/citoyen/parrainage" icone="📨" />
        )}
        {can.viewBadges && (
          <CarteAction titre="Mes badges" description="Gamification et récompenses" href="/citoyen/badges" icone="🏆" />
        )}
        {can.useChatbot && (
          <CarteAction titre="Assistant DigiID" description="Pose tes questions" href="/chatbot" icone="🤖" />
        )}
      </div>
    </div>
  );
}

function CarteAction({ titre, description, href, icone }: { titre: string; description: string; href: string; icone: string }) {
  return (
    <Link href={href} className="block group">
      <div className="carte cursor-pointer hover:shadow-lg transition-all h-full">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{icone}</span>
          <div>
            <h3 className="font-bold text-ardoise group-hover:text-ocre transition-colors">{titre}</h3>
            <p className="text-sm text-ardoise-clair mt-1">{description}</p>
          </div>
        </div>
        <p className="text-xs text-ocre font-semibold mt-3 group-hover:translate-x-1 transition-transform">Accéder →</p>
      </div>
    </Link>
  );
}
