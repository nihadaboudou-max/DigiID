"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { mesOrdonnances, signalerOrdonnance } from "@/services/medical";
import type { Ordonnance } from "@/services/medical";

export default function MesOrdonnancesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["citoyen"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState("");

  // Signalement
  const [signalerId, setSignalerId] = useState<string | null>(null);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    try {
      const data = await mesOrdonnances();
      setOrdonnances(data);
    } catch (error: any) {
      console.error("Erreur chargement ordonnances:", error);
      setMessage(error?.message || "Erreur lors du chargement de vos ordonnances.");
    } finally {
      setChargement(false);
    }
  }

  async function handleSignaler() {
    if (!signalerId || motif.length < 10) return;
    setEnvoi(true);
    setMessage("");
    try {
      const result = await signalerOrdonnance(signalerId, motif);
      setMessage(result.message || "Signalement envoyé !");
      setSignalerId(null);
      setMotif("");
    } catch {
      setMessage("Erreur lors de l'envoi du signalement.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/citoyen/dashboard" className="hover:text-ocre">Mon espace</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Mes ordonnances</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Santé</p>
        <h1 className="mt-1">Mes ordonnances</h1>
        <p className="text-ardoise-clair mt-2">
          Consultez vos prescriptions médicales. Si vous constatez une erreur, vous pouvez la signaler.
        </p>
      </div>

      {message && (
        <div className={`border-l-4 p-3 rounded ${message.includes("succès") || message.includes("Succès") || message.includes("Signalement") ? "bg-vert/10 border-vert text-vert" : "bg-ocre/10 border-ocre text-ocre"}`}>
          <p className="text-sm">{message}</p>
        </div>
      )}

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-8">Chargement de vos ordonnances...</p>
      ) : ordonnances.length === 0 ? (
        <Carte>
          <p className="text-ardoise-clair italic text-center py-8">
            Vous n&apos;avez aucune ordonnance pour le moment.
          </p>
        </Carte>
      ) : (
        <div className="space-y-4">
          {ordonnances.map((o) => (
            <Carte key={o.id}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-ardoise">{o.medicaments}</h3>
                    <span className="text-xs text-ardoise-clair font-mono">#{o.numero_ordonnance}</span>
                    {o.statut !== "active" && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${o.statut === "expiree" ? "bg-ardoise-clair/20 text-ardoise-clair" : "bg-terre/10 text-terre"}`}>
                        {o.statut === "expiree" ? "Expirée" : "Annulée"}
                      </span>
                    )}
                  </div>
                  {o.instructions && (
                    <p className="text-sm text-ardoise-clair mt-1">{o.instructions}</p>
                  )}
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-ardoise-clair">
                    <span>📅 {new Date(o.date_prescription).toLocaleString("fr-FR")}</span>
                    {o.date_expiration && (
                      <span className="text-terre">⏳ Expire le {new Date(o.date_expiration).toLocaleDateString("fr-FR")}</span>
                    )}
                    {o.medecin_nom && <span>👨‍⚕️ Dr. {o.medecin_nom}</span>}
                    {o.hopital && <span>🏥 {o.hopital}</span>}
                  </div>
                </div>
              </div>

              {/* Bouton Signaler */}
              <div className="mt-3 pt-3 border-t border-ardoise-clair/10">
                {signalerId === o.id ? (
                  <div className="space-y-2">
                    <label className="block text-xs uppercase text-ardoise-clair font-semibold">
                      Décrivez le problème (min. 10 caractères)
                    </label>
                    <textarea
                      value={motif}
                      onChange={(e) => setMotif(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                      placeholder="Ex: Le dosage de l&apos;amoxicilline semble incorrect, c&apos;était 500mg pas 1000mg..."
                    />
                    <div className="flex gap-2">
                      <Bouton
                        variante="primaire"
                        taille="petit"
                        disabled={motif.length < 10 || envoi}
                        onClick={handleSignaler}
                      >
                        {envoi ? "Envoi..." : "Envoyer le signalement"}
                      </Bouton>
                      <Bouton
                        variante="ghost"
                        taille="petit"
                        onClick={() => { setSignalerId(null); setMotif(""); }}
                      >
                        Annuler
                      </Bouton>
                    </div>
                    {motif.length < 10 && motif.length > 0 && (
                      <p className="text-xs text-terre">
                        Encore {10 - motif.length} caractères requis
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setSignalerId(o.id)}
                    className="text-xs text-terre hover:text-terre-fonce flex items-center gap-1 hover:underline"
                  >
                    ⚠️ Signaler une erreur sur cette ordonnance
                  </button>
                )}
              </div>
            </Carte>
          ))}
        </div>
      )}

      <Link href="/citoyen/dashboard">
        <Bouton variante="ghost">Retour à mon espace</Bouton>
      </Link>
    </div>
  );
}
