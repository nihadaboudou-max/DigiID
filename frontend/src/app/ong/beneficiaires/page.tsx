"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { useRoleUI } from "@/crochets/useRoleUI";
import { listerBeneficiaires, creerBeneficiaire } from "@/services/ong";
import type { BeneficiaireONG } from "@/services/ong";

export default function BeneficiairesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_ong"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [beneficiaires, setBeneficiaires] = useState<BeneficiaireONG[]>([]);
  const [chargement, setChargement] = useState(true);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);
  const [nom, setNom] = useState("");
  const [programme, setProgramme] = useState("");
  const [zone, setZone] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    try { setBeneficiaires(await listerBeneficiaires()); }
    catch {}
    finally { setChargement(false); }
  }

  async function handleCreer() {
    if (!nom || !programme) return;
    setEnvoi(true);
    try {
      await creerBeneficiaire({ nom, programme, zone: zone || undefined });
      setNom(""); setProgramme(""); setZone("");
      setAfficherFormulaire(false);
      await charger();
    } catch {}
    finally { setEnvoi(false); }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/ong/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Beneficiaires</span>
      </nav>

      <div className="flex justify-between items-center">
        <div>
          <p className="text-ocre font-semibold text-sm uppercase tracking-wider">ONG</p>
          <h1 className="mt-1">Beneficiaires</h1>
          <p className="text-ardoise-clair mt-2">{beneficiaires.length} inscrits</p>
        </div>
        <Bouton variante="primaire" onClick={() => setAfficherFormulaire(!afficherFormulaire)}>
          {afficherFormulaire ? "Annuler" : "+ Nouveau beneficiaire"}
        </Bouton>
      </div>

      {afficherFormulaire && (
        <Carte titre="Ajouter un beneficiaire">
          <div className="max-w-md space-y-3">
            <ChampSaisie libelle="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Fatou Diallo" />
            <ChampSaisie libelle="Programme" value={programme} onChange={(e) => setProgramme(e.target.value)} placeholder="Ex: Aide alimentaire" />
            <ChampSaisie libelle="Zone (optionnel)" value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Ex: Dakar" />
            <Bouton variante="primaire" disabled={!nom || !programme || envoi} onClick={handleCreer}>
              {envoi ? "Ajout..." : "Ajouter le beneficiaire"}
            </Bouton>
          </div>
        </Carte>
      )}

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-12">Chargement...</p>
      ) : beneficiaires.length === 0 ? (
        <Carte><p className="text-ardoise-clair italic text-center py-8">Aucun beneficiaire. Ajoutez-en un !</p></Carte>
      ) : (
        <div className="space-y-2">
          {beneficiaires.map((b) => (
            <div key={b.id} className="carte flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-600 font-bold">
                  {b.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-bold text-ardoise">{b.nom}</p>
                  <p className="text-xs text-ardoise-clair">{b.programme} · {b.zone || "N/A"}</p>
                </div>
              </div>
              <Badge variante={b.statut === "actif" ? "succes" : "lagune"}>
                {b.statut === "actif" ? "Actif" : "Inactif"}
              </Badge>
            </div>
          ))}
        </div>
      )}
      <Link href="/ong/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
