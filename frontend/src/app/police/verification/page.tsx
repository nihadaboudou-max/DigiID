"use client";

import { useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { Badge } from "@/composants/commun/Badge";
import { useRoleUI } from "@/crochets/useRoleUI";
import { verifierIdentite, rechercherPersonne } from "@/services/police";
import type { PersonneRecherchee } from "@/services/police";

export default function VerificationPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [digiid, setDigiid] = useState("");
  const [personne, setPersonne] = useState<PersonneRecherchee | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [enRecherche, setEnRecherche] = useState(false);

  async function handleRecherche() {
    if (!digiid) return;
    setEnRecherche(true);
    setErreur("");
    setPersonne(null);
    setResultat(null);
    try {
      const p = await rechercherPersonne(digiid);
      if (p) {
        setPersonne(p);
        setResultat("confirme");
        await verifierIdentite({ personne_digiid: digiid, personne_nom: p.nom });
      } else {
        setErreur("Personne non trouvee dans le systeme DigiID");
        setResultat("infirme");
        await verifierIdentite({ personne_digiid: digiid, notes: "Non trouve" });
      }
    } catch {
      setErreur("Erreur lors de la verification");
      setResultat("infirme");
    } finally {
      setEnRecherche(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/police/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Verification identite</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Forces de l ordre</p>
        <h1 className="mt-1">Verification d identite</h1>
        <p className="text-ardoise-clair mt-2">Saisis le DigiID pour verifier l identite d une personne.</p>
      </div>

      <Carte titre="Saisie du DigiID">
        <div className="max-w-md space-y-4">
          <ChampSaisie libelle="DigiID de la personne" value={digiid}
            onChange={(e) => setDigiid(e.target.value)}
            placeholder="Ex: DIG-A1B2C3D4E5F6" />
          <Bouton variante="primaire" disabled={digiid.length < 4 || enRecherche} onClick={handleRecherche}>
            {enRecherche ? "Recherche..." : "Verifier l identite"}
          </Bouton>
        </div>
      </Carte>

      {resultat === "confirme" && personne && (
        <Carte titre="Identite confirmee">
          <div className="flex items-center gap-4 p-3 bg-succes/5 rounded-lg">
            <div className="w-16 h-16 rounded-full bg-succes/10 flex items-center justify-center text-succes font-bold text-xl">
              {personne.nom.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="font-bold text-lg text-ardoise">{personne.nom}</p>
              <p className="text-sm text-ardoise-clair">{personne.digiid}</p>
              <div className="flex gap-2 mt-2">
                <Badge variante="succes">Actif</Badge>
                <span className="text-xs text-ardoise-clair">Score: {personne.score}</span>
              </div>
            </div>
          </div>
        </Carte>
      )}

      {resultat === "infirme" && !personne && (
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre font-semibold">Identite non confirmee</p>
          <p className="text-xs text-ardoise-clair mt-1">{erreur || "Aucune correspondance trouvee"}</p>
        </div>
      )}

      <div className="bg-ocre/5 border border-ocre/20 p-4 rounded">
        <p className="text-xs text-ardoise-clair">Cette verification a ete enregistree dans l historique.</p>
      </div>

      <Link href="/police/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
