"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { useRoleUI } from "@/crochets/useRoleUI";
import { listerVerifications, rechercherPersonnes, obtenirStatistiques } from "@/services/police";
import type { VerificationPolice, StatistiquesPolice } from "@/services/police";

export default function PoliceDashboard() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can, chargement } = useRoleUI();
  const [verifications, setVerifications] = useState<VerificationPolice[]>([]);
  const [chargementVerif, setChargementVerif] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [stats, setStats] = useState<StatistiquesPolice | null>(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargementVerif(true);
    try { 
      const data = await listerVerifications();
      setVerifications(data || []);
    } catch (error) {
      console.error("Erreur chargement vérifications:", error);
    } finally { 
      setChargementVerif(false); 
    }
  }

  const handleSearch = useCallback(async () => {
    if (!recherche) return;
    setRechercheEnCours(true);
    try {
      const resultats = await rechercherPersonnes({ query: recherche });
      setVerifications([]);
    } catch (error) {
      console.error("Erreur recherche:", error);
    } finally { 
      setRechercheEnCours(false); 
    }
  }, [recherche]);

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Forces de l'ordre</p>
        <h1>Tableau de bord</h1>
        <p className="text-ardoise-clair italic py-12">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      {/* En-tête */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Forces de l'ordre</p>
          <h1 className="mt-1">Tableau de bord</h1>
          <p className="text-ardoise-clair mt-2">
            Vérifie l'identité des citoyens. Chaque consultation est tracée.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/police/signalement">
            <Bouton variante="secondaire" taille="petit">
              Signalement fraude
            </Bouton>
          </Link>
          <Link href="/police/audit">
            <Bouton variante="ghost" taille="petit">
              Mon historique
            </Bouton>
          </Link>
        </div>
      </div>

      {/* Statistiques d'activité */}
      <div className="grid grid-cols-3 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">
            {chargementVerif ? "..." : verifications.length}
          </p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Vérifications
          </p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">100%</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Identités vérifiées
          </p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">
            {verifications.filter(v => v.est_signalement_fraude).length}
          </p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">
            Signalements
          </p>
        </div>
      </div>

      {/* Recherche rapide */}
      <Carte titre="Recherche rapide">
        <div className="flex gap-2">
          <ChampRecherche 
            placeholder="DigiID, numéro CNI..." 
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }} 
          />
          <Bouton 
            variante="primaire" 
            taille="petit" 
            disabled={rechercheEnCours || !recherche} 
            onClick={handleSearch}
          >
            {rechercheEnCours ? "..." : "🔍"}
          </Bouton>
        </div>
        {recherche && (
          <Link href={`/police/recherche?q=${encodeURIComponent(recherche)}`} className="mt-3 inline-block">
            <Bouton variante="secondaire" taille="petit">
              Recherche avancée →
            </Bouton>
          </Link>
        )}
        <p className="text-xs text-ardoise-clair mt-2">
          Chaque consultation est automatiquement loguée.
        </p>
      </Carte>

      {/* Fonctionnalités accessibles via la barre latérale */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {can.verifyIdentity && (
          <CarteAction 
            titre="Vérification" 
            description="Vérifier identité complète" 
            href="/police/verification" 
            icone="🔍" 
          />
        )}
        {can.searchPerson && (
          <CarteAction 
            titre="Recherche" 
            description="Par DigiID, nom, CNI" 
            href="/police/recherche" 
            icone="🔐" 
          />
        )}
        <CarteAction 
          titre="Scan QR" 
          description="Scanner un QR code" 
          href="/police/scan-qr" 
          icone="📱" 
        />
        <CarteAction 
          titre="Alertes" 
          description="Alertes en temps réel" 
          href="/police/alertes" 
          icone="🔔" 
        />
        <CarteAction 
          titre="Historique" 
          description="Toutes les activités" 
          href="/police/historique" 
          icone="🕐" 
        />
        {can.viewPoliceAudit && (
          <CarteAction 
            titre="Audit" 
            description="Journal d'audit" 
            href="/police/audit" 
            icone="📜" 
          />
        )}
        <CarteAction 
          titre="Export" 
          description="Exporter des rapports" 
          href="/police/export" 
          icone="📊" 
        />
        <CarteAction 
          titre="Signalement" 
          description="Signaler une fraude" 
          href="/police/signalement" 
          icone="🚨" 
        />
      </div>

      {/* Avertissement */}
      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">
          ⚠️ Chaque consultation est tracée et horodatée. 
          Tout accès non autorisé est passible de poursuites.
        </p>
      </div>
    </div>
  );
}

function CarteAction({ 
  titre, 
  description, 
  href, 
  icone 
}: { 
  titre: string; 
  description: string; 
  href: string; 
  icone: string; 
}) {
  return (
    <Link href={href} className="block group">
      <div className="carte cursor-pointer hover:shadow-lg transition-all h-full">
        <div className="flex items-start gap-3">
          <span className="text-3xl">{icone}</span>
          <div>
            <h3 className="font-bold text-ardoise group-hover:text-ocre transition-colors">
              {titre}
            </h3>
            <p className="text-sm text-ardoise-clair mt-1">{description}</p>
          </div>
        </div>
        <p className="text-xs text-ocre font-semibold mt-3 group-hover:translate-x-1 transition-transform">
          Accéder →
        </p>
      </div>
    </Link>
  );
}