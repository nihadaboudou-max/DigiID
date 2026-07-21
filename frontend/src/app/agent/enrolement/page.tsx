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
  const [etape, setEtape] = useState(1);

  async function handleSubmit() {
    if (!nom || !prenom || !telephone) return;
    setEnvoi(true);
    setErreur("");
    try {
      await creerEnrolement({ 
        citoyen_nom: nom, 
        citoyen_prenom: prenom, 
        citoyen_telephone: telephone, 
        citoyen_email: email || undefined, 
        notes: notes || undefined 
      });
      setSucces(true);
    } catch (e: any) {
      setErreur(e?.message_utilisateur || e.message || "Erreur lors de l'enrôlement");
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
        <Carte titre="✅ Enrôlement réussi !">
          <div className="flex items-center gap-4 mb-6 p-4 bg-succes/5 rounded-lg border border-succes/20">
            <span className="text-5xl">🎉</span>
            <div>
              <p className="text-lg font-bold text-ardoise">{prenom} {nom} a été enrôlé avec succès.</p>
              <p className="text-sm text-ardoise-clair">Le citoyen peut maintenant utiliser les services DigiID.</p>
            </div>
          </div>
          <div className="bg-sable p-4 rounded-lg space-y-2 mb-4">
            <h3 className="font-semibold text-ardoise">Récapitulatif</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><strong>Nom :</strong> {prenom} {nom}</p>
              <p><strong>Téléphone :</strong> {telephone}</p>
              {email && <p className="col-span-2"><strong>Email :</strong> {email}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Bouton variante="primaire" onClick={() => { setSucces(false); setNom(""); setPrenom(""); setTelephone(""); setEmail(""); setNotes(""); setEtape(1); }}>
              + Nouvel enrôlement
            </Bouton>
            <Link href="/agent/dashboard"><Bouton variante="secondaire">Tableau de bord</Bouton></Link>
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

      <Carte titre="Identité du citoyen">
        {/* Barre d'étapes */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`flex items-center gap-2 ${etape >= 1 ? "text-ocre" : "text-ardoise-clair/40"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${etape >= 1 ? "bg-ocre text-white" : "bg-ardoise-clair/10"}`}>1</div>
            <span className="text-sm font-medium">Identité</span>
          </div>
          <div className={`flex-1 h-px ${etape >= 2 ? "bg-ocre" : "bg-ardoise-clair/10"}`} />
          <div className={`flex items-center gap-2 ${etape >= 2 ? "text-ocre" : "text-ardoise-clair/40"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${etape >= 2 ? "bg-ocre text-white" : "bg-ardoise-clair/10"}`}>2</div>
            <span className="text-sm font-medium">Contact</span>
          </div>
          <div className={`flex-1 h-px ${etape >= 3 ? "bg-ocre" : "bg-ardoise-clair/10"}`} />
          <div className={`flex items-center gap-2 ${etape >= 3 ? "text-ocre" : "text-ardoise-clair/40"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${etape >= 3 ? "bg-ocre text-white" : "bg-ardoise-clair/10"}`}>3</div>
            <span className="text-sm font-medium">Confirmation</span>
          </div>
        </div>

        <div className="max-w-md space-y-4">
          {etape === 1 && (
            <>
              <ChampSaisie libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Diallo" required />
              <ChampSaisie libelle="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Ex: Fatou" required />
              <div className="flex justify-end pt-2">
                <Bouton variante="primaire" onClick={() => setEtape(2)} disabled={!nom || !prenom}>
                  Suivant →
                </Bouton>
              </div>
            </>
          )}

          {etape === 2 && (
            <>
              <ChampSaisie libelle="Téléphone *" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Ex: +221 77 123 45 67" aide="Numéro obligatoire pour la création du compte DigiID" required />
              <ChampSaisie libelle="Email (optionnel)" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex: fatou@email.com" />
              <div>
                <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">Notes (optionnel)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none" placeholder="Observations..." />
              </div>
              <div className="flex justify-between pt-2">
                <Bouton variante="ghost" onClick={() => setEtape(1)}>← Retour</Bouton>
                <Bouton variante="primaire" onClick={() => setEtape(3)} disabled={!telephone}>
                  Suivant →
                </Bouton>
              </div>
            </>
          )}

          {etape === 3 && (
            <>
              <div className="bg-sable p-4 rounded-lg space-y-2 mb-4">
                <p className="text-xs uppercase text-ardoise-clair font-semibold">Récapitulatif</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Nom :</strong> {prenom} {nom}</p>
                  <p><strong>Téléphone :</strong> {telephone}</p>
                  {email && <p className="col-span-2"><strong>Email :</strong> {email}</p>}
                  {notes && <p className="col-span-2"><strong>Notes :</strong> {notes}</p>}
                </div>
              </div>
              {can.scanCNI && (
                <div className="bg-lagune/5 border border-lagune/20 p-3 rounded-lg mb-4">
                  <p className="text-sm font-semibold text-lagune">📷 Scanner aussi la CNI ?</p>
                  <p className="text-xs text-ardoise-clair mt-1">Tu peux scanner la carte d'identité après l'enrôlement pour extraire automatiquement les données.</p>
                </div>
              )}
              {erreur && <p className="text-terre text-sm">{erreur}</p>}
              <div className="flex justify-between pt-2">
                <Bouton variante="ghost" onClick={() => setEtape(2)}>← Retour</Bouton>
                <Bouton variante="primaire" disabled={!nom || !prenom || !telephone || envoi} onClick={handleSubmit} chargement={envoi}>
                  {envoi ? "Enrôlement en cours..." : "✅ Confirmer l'enrôlement"}
                </Bouton>
              </div>
            </>
          )}
        </div>
      </Carte>

      {can.scanCNI && (
        <div className="bg-lagune/5 border border-lagune/20 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ardoise">📷 Scanner une CNI</p>
            <p className="text-xs text-ardoise-clair">Extraire les données depuis une photo de carte d'identité</p>
          </div>
          <Link href="/agent/scan">
            <Bouton variante="secondaire" taille="petit">Scanner</Bouton>
          </Link>
        </div>
      )}

      <Link href="/agent/dashboard"><Bouton variante="ghost">Retour</Bouton></Link>
    </div>
  );
}
