"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { useRoleUI } from "@/crochets/useRoleUI";
import {
  listerDossiers,
  listerToutesOrdonnances,
  creerOrdonnance,
  modifierOrdonnance,
  supprimerOrdonnance,
} from "@/services/medical";
import type { Ordonnance, DossierMedical } from "@/services/medical";

export default function OrdonnancesPage() {
  return (
    <EnvelopperEspaceProtege rolesAutorises={["medecin"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const { can } = useRoleUI();
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [dossiers, setDossiers] = useState<DossierMedical[]>([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState("");

  // Nouvelle ordonnance
  const [dossierId, setDossierId] = useState("");
  const [medicaments, setMedicaments] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dateExpiration, setDateExpiration] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [hopital, setHopital] = useState("");

  // Modification
  const [editId, setEditId] = useState<string | null>(null);
  const [editMedicaments, setEditMedicaments] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editDateExp, setEditDateExp] = useState("");

  // Suppression
  const [supprId, setSupprId] = useState<string | null>(null);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setChargement(true);
    try {
      const [dossiersData, ordonnancesData] = await Promise.all([
        listerDossiers(),
        listerToutesOrdonnances(),
      ]);
      setDossiers(dossiersData);
      setOrdonnances(ordonnancesData);
    } catch {
      setMessage("Erreur lors du chargement.");
    } finally {
      setChargement(false);
    }
  }

  function getDossierPatientName(dossierId: string): string {
    const d = dossiers.find((d) => d.id === dossierId);
    if (!d) return "Dossier inconnu";
    const prenom = d.patient_prenom ? `${d.patient_prenom} ` : "";
    const hopital = d.hopital ? ` - ${d.hopital}` : "";
    return `${prenom}${d.patient_nom} (${d.patient_digiid})${hopital}`;
  }

  // Grouper les ordonnances par dossier
  const ordonnancesParDossier: Record<string, Ordonnance[]> = {};
  for (const o of ordonnances) {
    if (!ordonnancesParDossier[o.dossier_id]) {
      ordonnancesParDossier[o.dossier_id] = [];
    }
    ordonnancesParDossier[o.dossier_id].push(o);
  }

  async function handleCreer() {
    if (!dossierId || !medicaments) return;
    setEnvoi(true);
    setMessage("");
    try {
      await creerOrdonnance({
        dossier_id: dossierId,
        hopital: hopital || undefined,
        medicaments,
        instructions: instructions || undefined,
        date_expiration: dateExpiration || undefined,
      });
      setMedicaments("");
      setInstructions("");
      setDateExpiration("");
      setDossierId("");
      setHopital("");
      const o = await listerToutesOrdonnances();
      setOrdonnances(o);
      setMessage("Ordonnance créée avec succès.");
    } catch {
      setMessage("Erreur lors de la création.");
    } finally {
      setEnvoi(false);
    }
  }

  function ouvrirEdition(o: Ordonnance) {
    setEditId(o.id);
    setEditMedicaments(o.medicaments);
    setEditInstructions(o.instructions || "");
    setEditDateExp(o.date_expiration || "");
  }

  async function handleModifier() {
    if (!editId || !editMedicaments) return;
    setMessage("");
    try {
      await modifierOrdonnance(editId, {
        medicaments: editMedicaments,
        instructions: editInstructions || undefined,
        date_expiration: editDateExp || undefined,
      });
      setEditId(null);
      setEditMedicaments("");
      setEditInstructions("");
      setEditDateExp("");
      setMessage("Ordonnance modifiée avec succès.");
      // Rechargement silencieux
      try {
        const o = await listerToutesOrdonnances();
        setOrdonnances(o);
      } catch { /* silencieux */ }
    } catch (e: any) {
      console.error("Erreur modification ordonnance:", e);
      setMessage(e?.message_utilisateur || "Erreur lors de la modification.");
    }
  }

  async function handleSupprimer() {
    if (!supprId) return;
    setMessage("");
    try {
      await supprimerOrdonnance(supprId);
      setSupprId(null);
      const o = await listerToutesOrdonnances();
      setOrdonnances(o);
      setMessage("Ordonnance supprimée avec succès.");
    } catch {
      setMessage("Erreur lors de la suppression.");
    }
  }

  return (
    <div className="space-y-8 apparition">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Ordonnances</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace medical</p>
        <h1 className="mt-1">Gestion des ordonnances</h1>
        <p className="text-ardoise-clair mt-2">
          {ordonnances.length} ordonnance(s) r&eacute;parties sur {Object.keys(ordonnancesParDossier).length} dossier(s).
        </p>
      </div>

      {message && (
        <div className="bg-vert/10 border-l-4 border-vert p-3 rounded">
          <p className="text-sm text-vert">{message}</p>
        </div>
      )}

      {can.managePrescriptions && (
        <Carte titre="Nouvelle ordonnance">
          <div className="max-w-md space-y-3">
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Hôpital / Clinique
              </label>
              <input
                type="text"
                value={hopital}
                onChange={(e) => setHopital(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
                placeholder="Ex: CHU de Cocody"
              />
            </div>
            <select
              value={dossierId}
              onChange={(e) => setDossierId(e.target.value)}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white"
            >
              <option value="">-- S&eacute;lectionnez un dossier --</option>
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.patient_nom} ({d.patient_digiid})
                </option>
              ))}
            </select>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                M&eacute;dicaments
              </label>
              <textarea
                value={medicaments}
                onChange={(e) => setMedicaments(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                placeholder="Ex: Amoxicilline 500mg - 2x/jour pendant 7 jours"
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none"
                placeholder="Pr&eacute;cautions, posologie..."
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Date d&apos;expiration (optionnelle)
              </label>
              <input
                type="date"
                value={dateExpiration}
                onChange={(e) => setDateExpiration(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm"
              />
            </div>
            <Bouton
              variante="primaire"
              disabled={!dossierId || !medicaments || envoi}
              onClick={handleCreer}
            >
              {envoi ? "Cr&eacute;ation..." : "Prescrire"}
            </Bouton>
          </div>
        </Carte>
      )}

      {chargement ? (
        <p className="text-ardoise-clair italic text-center py-8">Chargement...</p>
      ) : ordonnances.length === 0 ? (
        <Carte>
          <p className="text-ardoise-clair italic text-center py-8">Aucune ordonnance pour le moment.</p>
        </Carte>
      ) : (
        <div className="space-y-6">
          {Object.entries(ordonnancesParDossier).map(([dosId, ords]) => (
            <Carte
              key={dosId}
              titre={`${getDossierPatientName(dosId)} (${ords.length} ordonnance${ords.length > 1 ? "s" : ""})`}
            >
              <div className="space-y-3">
                {ords.map((o) => (
                  <div key={o.id} className="p-3 bg-sable rounded-lg">
                    {editId === o.id ? (
                      /* Mode &eacute;dition */
                      <div className="space-y-2">
                        <textarea
                          value={editMedicaments}
                          onChange={(e) => setEditMedicaments(e.target.value)}
                          rows={2}
                          className="w-full px-2 py-1 border border-ardoise-clair/20 rounded text-xs resize-none"
                        />
                        <textarea
                          value={editInstructions}
                          onChange={(e) => setEditInstructions(e.target.value)}
                          rows={1}
                          className="w-full px-2 py-1 border border-ardoise-clair/20 rounded text-xs resize-none"
                          placeholder="Instructions..."
                        />
                        <input
                          type="date"
                          value={editDateExp}
                          onChange={(e) => setEditDateExp(e.target.value)}
                          className="w-full px-2 py-1 border border-ardoise-clair/20 rounded text-xs"
                        />
                        <div className="flex gap-2">
                          <Bouton variante="primaire" taille="petit" onClick={handleModifier}>
                            Sauvegarder
                          </Bouton>
                          <Bouton variante="ghost" taille="petit" onClick={() => setEditId(null)}>
                            Annuler
                          </Bouton>
                        </div>
                      </div>
                    ) : (
                      /* Mode affichage */
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-ardoise">{o.medicaments}</p>
                            <span className="text-xs text-ardoise-clair font-mono">#{o.numero_ordonnance}</span>
                            {o.statut !== "active" && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${o.statut === "expiree" ? "bg-ardoise-clair/20 text-ardoise-clair" : "bg-terre/10 text-terre"}`}>
                                {o.statut === "expiree" ? "Expirée" : "Annulée"}
                              </span>
                            )}
                          </div>
                          {o.instructions && (
                            <p className="text-xs text-ardoise-clair mt-1">{o.instructions}</p>
                          )}
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-ardoise-clair">
                            <span>📅 {new Date(o.date_prescription).toLocaleString("fr-FR")}</span>
                            {o.date_expiration && <span className="text-terre">⏳ Expire le {new Date(o.date_expiration).toLocaleDateString("fr-FR")}</span>}
                            {o.medecin_nom && <span>👨‍⚕️ Dr. {o.medecin_nom}</span>}
                            {o.hopital && <span>🏥 {o.hopital}</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
                          <button
                            onClick={() => ouvrirEdition(o)}
                            className="text-xs text-ocre hover:text-ocre-fonce px-1.5 py-0.5 rounded hover:bg-ocre/10 transition-colors"
                            title="Modifier"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => setSupprId(o.id)}
                            className="text-xs text-terre hover:text-terre-fonce px-1.5 py-0.5 rounded hover:bg-terre/10 transition-colors"
                            title="Supprimer"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Carte>
          ))}
        </div>
      )}

      {/* Modale de confirmation suppression */}
      {supprId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ardoise/50">
          <div className="bg-white rounded-xl p-6 max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-ardoise mb-2">Confirmer la suppression</h3>
            <p className="text-sm text-ardoise-clair mb-4">
              Cette action est irr&eacute;versible. L&apos;ordonnance sera d&eacute;finitivement supprim&eacute;e.
              L&apos;historique reste consultable par le super administrateur.
            </p>
            <div className="flex gap-3 justify-end">
              <Bouton variante="ghost" onClick={() => setSupprId(null)}>
                Annuler
              </Bouton>
              <Bouton variante="danger" onClick={handleSupprimer}>
                Supprimer
              </Bouton>
            </div>
          </div>
        </div>
      )}

      <Link href="/medecin/dashboard">
        <Bouton variante="ghost">Retour</Bouton>
      </Link>
    </div>
  );
}
