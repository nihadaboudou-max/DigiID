"use client";

/**
 * Tableau de bord Police — Vérification d'identité et consultations.
 * 
 * Modules accessibles :
 *   - verification_identite  → /police/verification
 *   - consultation_score     → (intégré)
 *   - recherche_personne     → /police/recherche
 *   - audit_acces_police     → /police/audit
 *   - signalement_fraude     → /police/signalement
 */
import Link from "next/link";
import { useState } from "react";

import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { useRoleUI } from "@/crochets/useRoleUI";

export default function PoliceDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can, chargement } = useRoleUI();
  const [recherche, setRecherche] = useState("");
  const [resultatVisible, setResultatVisible] = useState(false);

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Forces de l'ordre</p>
        <h1>Vérification d'identité</h1>
        <p className="text-ardoise-clair italic py-12">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Forces de l'ordre</p>
          <h1 className="mt-1">Vérification d'identité</h1>
          <p className="text-ardoise-clair mt-2">
            Vérifie l'identité des citoyens. Chaque consultation est tracée dans le journal d'audit.
          </p>
        </div>
        <div className="flex gap-3">
          {can.reportFraud && (
            <Link href="/police/signalement">
              <Bouton variante="tertre" taille="petit">Signalement fraude</Bouton>
            </Link>
          )}
          {can.viewPoliceAudit && (
            <Link href="/police/audit">
              <Bouton variante="ghost" taille="petit">Mon historique</Bouton>
            </Link>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">47</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Vérifications aujourd'hui</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">100%</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Identités vérifiées</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">0</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Alertes</p>
        </div>
      </div>

      {/* Recherche rapide */}
      <Carte titre="Recherche rapide">
                <ChampRecherche
            placeholder="DigiID, numéro CNI ou empreinte..."
            onChange={(e) => {
              setRecherche(e.target.value);
              if (e.target.value.length >= 4) setResultatVisible(true);
              else setResultatVisible(false);
            }}
          />
        <p className="text-xs text-ardoise-clair mt-2">
          ⚠ Chaque consultation est automatiquement loguée dans le journal d'audit.
        </p>
      </Carte>

      {/* Résultat de recherche */}
      {resultatVisible && (
        <Carte>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-lagune/10 flex items-center justify-center text-lagune text-xl font-bold">FD</div>
              <div>
                <h3 className="font-bold text-ardoise text-lg">Fatou Diallo</h3>
                <p className="text-sm text-ardoise-clair">DIG-A1B2C3D4E5F6</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variante="succes">Identité vérifiée</Badge>
                  <Badge variante="lagune">Score: 78</Badge>
                </div>
              </div>
            </div>
            <Link href="/police/verification">
              <Bouton variante="primaire" taille="petit">Consulter</Bouton>
            </Link>
          </div>
        </Carte>
      )}

      {/* Accès rapide */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {can.verifyIdentity && (
          <CarteAction titre="Vérification d'identité" description="Vérifier l'identité complète" href="/police/verification" icone="🔍" />
        )}
        {can.searchPerson && (
          <CarteAction titre="Recherche avancée" description="Par empreinte, CNI ou visage" href="/police/recherche" icone="🔐" />
        )}
        {can.viewPoliceAudit && (
          <CarteAction titre="Mon historique" description="Mes vérifications effectuées" href="/police/audit" icone="🕐" />
        )}
      </div>

      {/* Avertissement légal */}
      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          <strong>🔒 Conformité légale :</strong> Conformément à la loi sénégalaise 2008-12 sur les données personnelles,
          chaque consultation est tracée et horodatée. Tout accès non autorisé est passible de poursuites.
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
