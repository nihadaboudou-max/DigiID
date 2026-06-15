"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { useRoleUI } from "@/crochets/useRoleUI";
import { creerSignalement, listerSignalements } from "@/services/police";
import type { SignalementFraude } from "@/services/police";

export default function SignalementFraudePage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["police"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [signalements, setSignalements] = useState<SignalementFraude[]>([]);
  const [chargement, setChargement] = useState(true);
  const [digiid, setDigiid] = useState("");
  const [motif, setMotif] = useState("");
  const [description, setDescription] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [afficherFormulaire, setAfficherFormulaire] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    try { setSignalements(await listerSignalements()); }
    catch {}
    finally { setChargement(false); }
  }

  async function handleCreer() {
    if (!digiid || !motif) return;
    setEnvoi(true);
    try {
      await creerSignalement({ personne_digiid: digiid, motif, description: description || undefined });
      setDigiid(""); setMotif(""); setDescription("");
      setAfficherFormulaire(false);
      await charger();
    } catch {}
    finally { setEnvoi(false); }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="text-sm text-ardoise-clair flex gap-2">
        <Link href="/police/dashboard" className="hover:text-ocre">Dashboard</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Signalements fraude</span>
      </nav>

      <div className="flex justify-between items-center">
        <div>
          <p className="text-ocre text-sm uppercase font-semibold tracking-wider">Forces de l ordre</p>
          <h1 className="mt-1">Signalements de fraude</h1>
          <p className="text-ardoise-clair mt-2">{signalements.length} signalement(s)</p>
        </div>
        <Bouton variante="primaire" onClick={() => setAfficherFormulaire(!afficherFormulaire)}>
          {afficherFormulaire ? "Annuler" : "+ Nouveau signalement"}
        </Bouton>
      </div>

      {afficherFormulaire && (
        <Carte titre="Signaler une fraude">
          <div className="max-w-md space-y-3">
            <ChampSaisie libelle="DigiID de la personne" value={digiid} onChange={(e) => setDigiid(e.target.value)} placeholder="Ex: DIG-A1B2C3D4E5F6" />
            <ChampSaisie libelle="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex: Usurpation d identite" />
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none" placeholder="Details du signalement..." />
            </div>
            <Bouton variante="primaire" disabled={!digiid || !motif || envoi} onClick={handleCreer}>
              {envoi ? "Envoi..." : "Signaler"}
            </Bouton>
          </div>
        </Carte>
      )}

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
      ) : signalements.length === 0 ? (
        <Carte><p className="text-ardoise-clair italic text-center py-8">Aucun signalement.</p></Carte>
      ) : (
        <div className="space-y-2">
          {signalements.map((s) => (
            <div key={s.id} className="carte flex items-center justify-between">
              <div>
                <p className="font-semibold text-ardoise">{s.personne_digiid}</p>
                <p className="text-xs text-ardoise-clair">{s.motif} · {new Date(s.date_signalement).toLocaleDateString("fr-FR")}</p>
              </div>
              <Badge variante={s.statut === "en_cours" ? "ocre" : s.statut === "traite" ? "succes" : "lagune"}>
                {s.statut === "en_cours" ? "En cours" : s.statut === "traite" ? "Traite" : "Rejete"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Link href="/police/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
