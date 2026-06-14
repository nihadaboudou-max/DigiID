"use client";

/**
 * Tableau de bord ONG — Gestion des bénéficiaires et programmes.
 * 
 * Modules accessibles :
 *   - consultation_beneficiaires     → /ong/beneficiaires
 *   - attestations_communautaires    → /ong/attestations
 *   - rapports_terrain               → /ong/rapports
 *   - gestion_programme              → /ong/programme
 *   - statistiques_ong               → /ong/statistiques
 *   - calendrier_missions            → /ong/missions
 */
import Link from "next/link";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { BarreProgression } from "@/composants/commun/BarreProgression";
import { useRoleUI } from "@/crochets/useRoleUI";

export default function OngDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["ong"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

const BENEFICIAIRES_RECENTS = [
  { id: "BEN-001", nom: "Aïssatou Ndiaye", programme: "Nutrition infantile", date: "10/06/2026", statut: "actif" as const },
  { id: "BEN-002", nom: "Moussa Diop", programme: "Aide scolaire", date: "09/06/2026", statut: "actif" as const },
  { id: "BEN-003", nom: "Khady Fall", programme: "Santé maternelle", date: "08/06/2026", statut: "en_attente" as const },
  { id: "BEN-004", nom: "Ibrahima Sow", programme: "Nutrition infantile", date: "07/06/2026", statut: "actif" as const },
];

function Contenu() {
  const { can, chargement } = useRoleUI();

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">ONG Partenaire</p>
        <h1>Programme DigiID</h1>
        <p className="text-ardoise-clair italic py-12">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">ONG Partenaire</p>
          <h1 className="mt-1">Programme DigiID</h1>
          <p className="text-ardoise-clair mt-2">
            Gère tes bénéficiaires, émets des attestations communautaires et suis tes programmes terrain.
          </p>
        </div>
        <div className="flex gap-3">
          {can.manageCommunityAttestations && (
            <Link href="/ong/attestations">
              <Bouton variante="primaire">+ Nouvelle attestation</Bouton>
            </Link>
          )}
          {can.viewFieldReports && (
            <Link href="/ong/rapports">
              <Bouton variante="ghost">Exporter rapport</Bouton>
            </Link>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">156</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Bénéficiaires actifs</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">89%</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Taux de couverture</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-ocre">3</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Programmes actifs</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">12</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Missions terrain</p>
        </div>
      </div>

      {/* Couverture géographique */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Carte titre="Couverture par zone">
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Dakar</span><span>45%</span>
              </div>
              <BarreProgression valeur={45} couleur="lagune" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Thiès</span><span>25%</span>
              </div>
              <BarreProgression valeur={25} couleur="ocre" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Saint-Louis</span><span>19%</span>
              </div>
              <BarreProgression valeur={19} couleur="succes" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Autres</span><span>11%</span>
              </div>
              <BarreProgression valeur={11} couleur="terre" />
            </div>
          </div>
        </Carte>

        {/* Bénéficiaires récents */}
        {can.viewBeneficiaries && (
          <Carte titre="Bénéficiaires récents">
            <div className="space-y-2">
              {BENEFICIAIRES_RECENTS.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-2 bg-sable rounded-lg">
                  <div>
                    <p className="text-sm font-semibold text-ardoise">{b.nom}</p>
                    <p className="text-xs text-ardoise-clair">{b.programme}</p>
                  </div>
                  <Badge variante={b.statut === "actif" ? "succes" : "ocre"}>
                    {b.statut === "actif" ? "Actif" : "En attente"}
                  </Badge>
                </div>
              ))}
            </div>
            <Link href="/ong/beneficiaires" className="text-xs text-ocre hover:underline mt-2 inline-block">
              Voir tous les bénéficiaires →
            </Link>
          </Carte>
        )}
      </div>

      {/* Accès rapide */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {can.viewBeneficiaries && (
          <CarteAction titre="Bénéficiaires" description="Liste et recherche" href="/ong/beneficiaires" icone="👥" />
        )}
        {can.manageCommunityAttestations && (
          <CarteAction titre="Attestations" description="Émettre des attestations" href="/ong/attestations" icone="📜" />
        )}
        {can.viewFieldReports && (
          <CarteAction titre="Rapports terrain" description="Export CSV et analyse" href="/ong/rapports" icone="📊" />
        )}
        {can.manageProgram && (
          <CarteAction titre="Programme" description="Indicateurs et suivi" href="/ong/programme" icone="📋" />
        )}
        {can.viewONGStats && (
          <CarteAction titre="Statistiques" description="Indicateurs de couverture" href="/ong/statistiques" icone="📈" />
        )}
        {can.manageMissions && (
          <CarteAction titre="Missions terrain" description="Calendrier des missions" href="/ong/missions" icone="📅" />
        )}
      </div>

      {/* Note de conformité */}
      <div className="bg-lagune/5 border border-lagune/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          <strong>🌍 Conformité :</strong> Les données des bénéficiaires sont protégées conformément
          au code numérique du Bénin (2017-20) et à la loi sénégalaise 2008-12.
          L'hébergement est situé dans la zone CEDEAO.
        </p>
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
