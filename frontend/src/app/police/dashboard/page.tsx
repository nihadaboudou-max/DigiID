"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampRecherche } from "@/composants/commun/ChampRecherche";
import { useRoleUI } from "@/crochets/useRoleUI";
import { listerVerifications, rechercherPersonne, listerSignalements } from "@/services/police";
import type { VerificationPolice, PersonneRecherchee } from "@/services/police";

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
  const [personne, setPersonne] = useState<PersonneRecherchee | null>(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargementVerif(true);
    try { setVerifications(await listerVerifications()); }
    catch {}
    finally { setChargementVerif(false); }
  }

  const handleSearch = useCallback(async () => {
    if (!recherche) return;
    setRechercheEnCours(true);
    try { setPersonne(await rechercherPersonne(recherche)); }
    catch { setPersonne(null); }
    finally { setRechercheEnCours(false); }
  }, [recherche]);

  if (chargement) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Forces de l ordre</p>
        <h1>Tableau de bord</h1>
        <p className="text-ardoise-clair italic py-12">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Forces de l ordre</p>
          <h1 className="mt-1">Verification d identite</h1>
          <p className="text-ardoise-clair mt-2">Verifie l identite des citoyens. Chaque consultation est tracee.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/police/signalement"><Bouton variante="secondaire" taille="petit">Signalement fraude</Bouton></Link>
          <Link href="/police/audit"><Bouton variante="ghost" taille="petit">Mon historique</Bouton></Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="carte text-center">
          <p className="text-3xl font-bold text-lagune">{chargementVerif ? "..." : verifications.length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Verifications</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-succes">100%</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Identites verifiees</p>
        </div>
        <div className="carte text-center">
          <p className="text-3xl font-bold text-terre">{verifications.filter(v => v.est_signalement_fraude).length}</p>
          <p className="text-xs uppercase text-ardoise-clair font-semibold">Signalements</p>
        </div>
      </div>

      <Carte titre="Recherche rapide">
        <div className="flex gap-2">
          <ChampRecherche placeholder="DigiID, numero CNI..." value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }} />
          <Bouton variante="primaire" taille="petit" disabled={rechercheEnCours || !recherche} onClick={handleSearch}>
            {rechercheEnCours ? "..." : "🔍"}
          </Bouton>
        </div>
        {personne && (
          <div className="mt-4 p-3 bg-lagune/5 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-lagune/10 flex items-center justify-center text-lagune font-bold">
                {personne.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="font-bold text-ardoise">{personne.nom}</p>
                <p className="text-xs text-ardoise-clair">{personne.digiid}</p>
                <Badge variante={personne.est_actif ? "succes" : "terre"}>
                  {personne.est_actif ? "Actif" : "Inactif"}
                </Badge>
                <span className="ml-2 text-xs">Score: {personne.score}</span>
              </div>
            </div>
          </div>
        )}
        <p className="text-xs text-ardoise-clair mt-2">Chaque consultation est automatiquement loguee.</p>
      </Carte>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {can.verifyIdentity && <CarteAction titre="Verification identite" description="Verifier l identite complete" href="/police/verification" icone="🔍" />}
        {can.searchPerson && <CarteAction titre="Recherche avancee" description="Par empreinte, CNI ou visage" href="/police/recherche" icone="🔐" />}
        {can.viewPoliceAudit && <CarteAction titre="Mon historique" description="Mes verifications effectuees" href="/police/audit" icone="🕐" />}
      </div>

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">Chaque consultation est tracee et horodatee. Tout acces non autorise est passible de poursuites.</p>
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
        <p className="text-xs text-ocre font-semibold mt-3 group-hover:translate-x-1 transition-transform">Acceder →</p>
      </div>
    </Link>
  );
}
