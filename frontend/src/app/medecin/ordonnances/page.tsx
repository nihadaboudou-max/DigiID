"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EnvelopperEspaceProtege } from "@/composants/layouts/EnvelopperEspaceProtege";
import { Carte } from "@/composants/commun/Carte";
import { Bouton } from "@/composants/commun/Bouton";
import { Badge } from "@/composants/commun/Badge";
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
    <EnvelopperEspaceProtege rolesAutorises={["agent_medical", "chef_medical"]}>
      <Contenu />
    </EnvelopperEspaceProtege>
  );
}

function Contenu() {
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [dossiers, setDossiers] = useState<DossierMedical[]>([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState<{ type: "succes" | "erreur"; texte: string } | null>(null);

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

  useEffect(() => { 
    charger(); 
  }, []);

  async function charger() {
    setChargement(true);
    setMessage(null);
    try {
      const [dossiersData, ordonnancesData] = await Promise.all([
        listerDossiers(),
        listerToutesOrdonnances(),
      ]);
      setDossiers(dossiersData);
      setOrdonnances(ordonnancesData);
    } catch (error) {
      console.error("Erreur chargement:", error);
      setMessage({ type: "erreur", texte: "Erreur lors du chargement des données." });
    } finally {
      setChargement(false);
    }
  }

  function getDossierPatientName(dosId: string): string {
    const d = dossiers.find((d) => d.id === dosId);
    if (!d) return "Dossier inconnu";
    const prenom = d.patient_prenom ? `${d.patient_prenom} ` : "";
    const hop = d.hopital ? ` - ${d.hopital}` : "";
    return `${prenom}${d.patient_nom} (${d.patient_digiid})${hop}`;
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
    if (!dossierId || !medicaments.trim()) {
      setMessage({ type: "erreur", texte: "Le dossier et les médicaments sont obligatoires." });
      return;
    }
    setEnvoi(true);
    setMessage(null);
    try {
      await creerOrdonnance({
        dossier_id: dossierId,
        hopital: hopital || undefined,
        medicaments: medicaments.trim(),
        instructions: instructions.trim() || undefined,
        date_expiration: dateExpiration || undefined,
      });
      
      setMedicaments("");
      setInstructions("");
      setDateExpiration("");
      setDossierId("");
      setHopital("");
      
      const o = await listerToutesOrdonnances();
      setOrdonnances(o);
      setMessage({ type: "succes", texte: "Ordonnance créée avec succès." });
    } catch (error: any) {
      setMessage({ type: "erreur", texte: error?.message_utilisateur || "Erreur lors de la création." });
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
    if (!editId || !editMedicaments.trim()) {
      setMessage({ type: "erreur", texte: "Les médicaments sont obligatoires." });
      return;
    }
    setMessage(null);
    try {
      await modifierOrdonnance(editId, {
        medicaments: editMedicaments.trim(),
        instructions: editInstructions.trim() || undefined,
        date_expiration: editDateExp || undefined,
      });
      setEditId(null);
      setEditMedicaments("");
      setEditInstructions("");
      setEditDateExp("");
      setMessage({ type: "succes", texte: "Ordonnance modifiée avec succès." });
      
      const o = await listerToutesOrdonnances();
      setOrdonnances(o);
    } catch (error: any) {
      setMessage({ type: "erreur", texte: error?.message_utilisateur || "Erreur lors de la modification." });
    }
  }

  async function handleSupprimer() {
    if (!supprId) return;
    setMessage(null);
    try {
      await supprimerOrdonnance(supprId);
      setSupprId(null);
      const o = await listerToutesOrdonnances();
      setOrdonnances(o);
      setMessage({ type: "succes", texte: "Ordonnance supprimée avec succès." });
    } catch (error: any) {
      setMessage({ type: "erreur", texte: error?.message_utilisateur || "Erreur lors de la suppression." });
    }
  }

  return (
    <div className="space-y-6 apparition pb-20">
      <nav className="flex items-center gap-2 text-sm text-ardoise-clair">
        <Link href="/medecin/dashboard" className="hover:text-ocre transition-colors">Tableau de bord</Link>
        <span>/</span>
        <span className="text-ardoise font-semibold">Ordonnances</span>
      </nav>

      <div>
        <p className="text-ocre font-semibold text-sm uppercase tracking-wider">Espace médical</p>
        <h1 className="mt-1 text-2xl font-bold text-ardoise">Gestion des ordonnances</h1>
        <p className="text-ardoise-clair mt-1">
          {ordonnances.length} ordonnance(s) répartie(s) sur {Object.keys(ordonnancesParDossier).length} dossier(s).
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg border-l-4 ${
          message.type === "succes" 
            ? "bg-succes/10 border-succes text-succes" 
            : "bg-terre/10 border-terre text-terre"
        }`}>
          <p className="text-sm font-medium">{message.texte}</p>
        </div>
      )}

      {/* Formulaire de création */}
      <Carte titre="Nouvelle ordonnance">
        <div className="max-w-2xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Hôpital / Clinique (optionnel)
              </label>
              <input
                type="text"
                value={hopital}
                onChange={(e) => setHopital(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                placeholder="Ex: CHU de Cocody"
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Dossier patient *
              </label>
              <select
                value={dossierId}
                onChange={(e) => setDossierId(e.target.value)}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lagune/30"
              >
                <option value="">-- Sélectionnez un dossier --</option>
                {dossiers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.patient_prenom ? `${d.patient_prenom} ` : ""}{d.patient_nom} ({d.patient_digiid})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
              Médicaments et posologie *
            </label>
            <textarea
              value={medicaments}
              onChange={(e) => setMedicaments(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lagune/30"
              placeholder="Ex: Amoxicilline 500mg - 2 comprimés par jour pendant 7 jours"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Instructions / Précautions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lagune/30"
                placeholder="Ex: À prendre au milieu du repas"
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-ardoise-clair font-semibold mb-1">
                Date d'expiration (optionnelle)
              </label>
              <input
                type="date"
                value={dateExpiration}
                onChange={(e) => setDateExpiration(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 border border-ardoise-clair/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
              />
            </div>
          </div>

          <div className="pt-2">
            <Bouton
              variante="primaire"
              disabled={!dossierId || !medicaments.trim() || envoi}
              onClick={handleCreer}
              chargement={envoi}
            >
              {envoi ? "Création en cours..." : "💊 Prescrire l'ordonnance"}
            </Bouton>
          </div>
        </div>
      </Carte>

      {/* Liste des ordonnances groupées */}
      {chargement ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-lagune border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-ardoise-clair italic">Chargement des ordonnances...</p>
        </div>
      ) : ordonnances.length === 0 ? (
        <Carte>
          <div className="text-center py-8">
            <p className="text-4xl mb-3">💊</p>
            <p className="text-ardoise-clair italic">Aucune ordonnance prescrite pour le moment.</p>
          </div>
        </Carte>
      ) : (
        <div className="space-y-6">
          {Object.entries(ordonnancesParDossier).map(([dosId, ords]) => (
            <Carte
              key={dosId}
              titre={`👤 ${getDossierPatientName(dosId)}`}
              description={`${ords.length} ordonnance${ords.length > 1 ? "s" : ""}`}
            >
              <div className="space-y-3">
                {ords.map((o) => (
                  <div key={o.id} className="p-4 bg-sable/50 rounded-lg border border-ardoise-clair/10">
                    {editId === o.id ? (
                      /* Mode édition */
                      <div className="space-y-3">
                        <textarea
                          value={editMedicaments}
                          onChange={(e) => setEditMedicaments(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lagune/30"
                          placeholder="Médicaments..."
                        />
                        <textarea
                          value={editInstructions}
                          onChange={(e) => setEditInstructions(e.target.value)}
                          rows={1}
                          className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-lagune/30"
                          placeholder="Instructions..."
                        />
                        <input
                          type="date"
                          value={editDateExp}
                          onChange={(e) => setEditDateExp(e.target.value)}
                          className="w-full px-3 py-2 border border-ardoise-clair/20 rounded text-sm focus:outline-none focus:ring-2 focus:ring-lagune/30"
                        />
                        <div className="flex gap-2">
                          <Bouton variante="primaire" taille="petit" onClick={handleModifier}>
                            ✓ Sauvegarder
                          </Bouton>
                          <Bouton variante="ghost" taille="petit" onClick={() => setEditId(null)}>
                            ✕ Annuler
                          </Bouton>
                        </div>
                      </div>
                    ) : (
                      /* Mode affichage */
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-semibold text-ardoise">{o.medicaments}</p>
                            <span className="text-xs text-ardoise-clair font-mono bg-white px-1.5 py-0.5 rounded border border-ardoise-clair/10">
                              #{o.numero_ordonnance}
                            </span>
                            {o.statut !== "active" && (
                              <Badge variante={o.statut === "expiree" ? "terre" : "neutre"} taille="petit">
                                {o.statut === "expiree" ? "Expirée" : "Annulée"}
                              </Badge>
                            )}
                          </div>
                          {o.instructions && (
                            <p className="text-sm text-ardoise-clair mb-2">{o.instructions}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ardoise-clair">
                            <span>📅 {new Date(o.date_prescription).toLocaleDateString("fr-FR")}</span>
                            {o.date_expiration && (
                              <span className="text-terre">⏳ Expire le {new Date(o.date_expiration).toLocaleDateString("fr-FR")}</span>
                            )}
                            {o.medecin_nom && <span>👨‍⚕️ Dr. {o.medecin_nom}</span>}
                            {o.hopital && <span>🏥 {o.hopital}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 sm:flex-col sm:items-end shrink-0">
                          <button
                            onClick={() => ouvrirEdition(o)}
                            className="text-xs text-ocre hover:text-ocre/80 px-2 py-1 rounded hover:bg-ocre/10 transition-colors flex items-center gap-1"
                            title="Modifier"
                          >
                            ✏️ Modifier
                          </button>
                          <button
                            onClick={() => setSupprId(o.id)}
                            className="text-xs text-terre hover:text-terre/80 px-2 py-1 rounded hover:bg-terre/10 transition-colors flex items-center gap-1"
                            title="Supprimer"
                          >
                            🗑️ Supprimer
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ardoise/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm shadow-2xl border border-ardoise-clair/10 w-full">
            <h3 className="text-lg font-bold text-ardoise mb-2">⚠️ Confirmer la suppression</h3>
            <p className="text-sm text-ardoise-clair mb-6">
              Cette action est irréversible. L'ordonnance sera définitivement supprimée du système.
            </p>
            <div className="flex gap-3 justify-end">
              <Bouton variante="ghost" onClick={() => setSupprId(null)}>
                Annuler
              </Bouton>
              <Bouton variante="danger" onClick={handleSupprimer}>
                🗑️ Supprimer
              </Bouton>
            </div>
          </div>
        </div>
      )}

      <Link href="/medecin/dashboard">
        <Bouton variante="ghost">← Retour au tableau de bord</Bouton>
      </Link>
    </div>
  );
}