"use client";

import { useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { ChampSaisie } from "@/composants/commun/ChampSaisie";
import { useRoleUI } from "@/crochets/useRoleUI";
import { creerEnrolement } from "@/services/enrolement";

export default function EnrolementPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["agent_terrain"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleSubmit() {
    if (!nom || !prenom || !telephone) return;
    setEnvoi(true);
    setErreur("");
    try {
      await creerEnrolement({ citoyen_nom: nom, citoyen_prenom: prenom, citoyen_telephone: telephone, citoyen_email: email || undefined, notes: notes || undefined });
      setSucces(true);
    } catch (e: any) {
      setErreur(e.message || "Erreur lors de l enrolement");
    } finally {
      setEnvoi(false);
    }
  }

  if (!can.enroll) {
    return (
      <div className="space-y-8 apparition">
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Agent terrain</p>
        <h1>Enrolement</h1>
        <div className="bg-terre/10 border-l-4 border-terre p-4 rounded">
          <p className="text-sm text-terre">Module desactive.</p>
        </div>
        <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
      </div>
    );
  }

  if (succes) {
    return (
      <div className="space-y-8 apparition">
        <Carte titre="Enrolement reussi !">
          <p className="text-sm text-ardoise-clair mb-4">{prenom} {nom} a ete enrole avec succes.</p>
          <div className="bg-sable p-4 rounded-lg space-y-2 mb-4">
            <p className="text-sm"><strong>Nom :</strong> {prenom} {nom}</p>
            <p className="text-sm"><strong>Telephone :</strong> {telephone}</p>
            {email && <p className="text-sm"><strong>Email :</strong> {email}</p>}
          </div>
          <div className="flex gap-3">
            <Bouton variante="ghost" onClick={() => { setSucces(false); setNom(""); setPrenom(""); setTelephone(""); setEmail(""); setNotes(""); }}>
              Nouvel enrolement
            </Bouton>
            <Link href="/agent/dashboard"><Bouton variante="secondaire">Retour</Bouton></Link>
          </div>
        </Carte>
      </div>
    );
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/agent/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Nouvel enrolement</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Agent terrain</p>
        <h1 className="mt-1">Enrolement citoyen</h1>
        <p className="text-ardoise-clair mt-2">Inscris un nouveau citoyen dans le systeme DigiID.</p>
      </div>

      <Carte titre="Identite du citoyen">
        <div className="max-w-md space-y-4">
          <ChampSaisie libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Diallo" />
          <ChampSaisie libelle="Prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Ex: Fatou" />
          <ChampSaisie libelle="Telephone *" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex: +221 77 123 45 67" aide="Numero obligatoire pour la creation du compte DigiID" required />
          <ChampSaisie libelle="Email (optionnel)" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex: fatou@email.com" />
          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Notes (optionnel)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none" placeholder="Observations..." />
          </div>
          {erreur && <p className="text-red-600 text-sm">{erreur}</p>}
          <Bouton variante="primaire" disabled={!nom || !prenom || !telephone || envoi} onClick={handleSubmit}>
            {envoi ? "Enrôlement..." : "Enrôler le citoyen"}
          </Bouton>
        </div>
      </Carte>

      <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
